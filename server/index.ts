import "dotenv/config";
import { GoogleAuth } from "google-auth-library";
import cors from "cors";
import express from "express";

type Turn = { role: "user" | "assistant"; content: string };
type RetrievedContext = { text: string; sourceUri: string };

const PORT = Number(process.env.PORT ?? 8787);
const GOOGLE_CLOUD_PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT?.trim() || process.env.GCLOUD_PROJECT?.trim() || "";
const GOOGLE_CLOUD_LOCATION = (process.env.GOOGLE_CLOUD_LOCATION ?? "us-west1").trim();
const VERTEX_MODEL = process.env.VERTEX_MODEL?.trim() || "gemini-2.5-flash";
const VERTEX_RAG_CORPUS = process.env.VERTEX_RAG_CORPUS?.trim() || "";
const VERTEX_RAG_TOP_K = Math.max(1, Number(process.env.VERTEX_RAG_TOP_K ?? 4));

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const vertexAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

async function getAccessToken(): Promise<string> {
  const authClient = await vertexAuth.getClient();
  const tokenResult = await authClient.getAccessToken();
  const accessToken = typeof tokenResult === "string" ? tokenResult : tokenResult?.token;
  if (!accessToken) {
    throw new Error("Could not obtain Google access token. Run 'gcloud auth application-default login'.");
  }
  return accessToken;
}

function requireVertexConfig(): void {
  if (!GOOGLE_CLOUD_PROJECT) {
    throw new Error("GOOGLE_CLOUD_PROJECT is required.");
  }
  if (!GOOGLE_CLOUD_LOCATION) {
    throw new Error("GOOGLE_CLOUD_LOCATION is required.");
  }
  if (!VERTEX_MODEL) {
    throw new Error("VERTEX_MODEL is required.");
  }
  if (!VERTEX_RAG_CORPUS) {
    throw new Error("VERTEX_RAG_CORPUS is required.");
  }
}

async function retrieveFromVertexCorpus(query: string, topK: number): Promise<RetrievedContext[]> {
  requireVertexConfig();
  const accessToken = await getAccessToken();

  const endpoint =
    `https://${GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1` +
    `/projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_LOCATION}:retrieveContexts`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      query: {
        text: query,
        ragRetrievalConfig: { topK }
      },
      vertexRagStore: {
        ragResources: [{ ragCorpus: VERTEX_RAG_CORPUS }]
      }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Vertex retrieveContexts failed: ${response.status} ${details}`);
  }

  const payload = (await response.json()) as {
    contexts?: {
      contexts?: Array<{ text?: string; sourceUri?: string }>;
    };
  };

  const contexts = payload.contexts?.contexts ?? [];
  return contexts
    .map((item) => ({
      text: item.text?.trim() ?? "",
      sourceUri: item.sourceUri?.trim() ?? "unknown-source"
    }))
    .filter((item) => item.text.length > 0);
}

function fallbackAnswer(question: string, contexts: RetrievedContext[]): string {
  if (contexts.length === 0) {
    return "I could not retrieve relevant context from the configured Vertex corpus. Try rephrasing your question.";
  }

  const preview = contexts
    .map((chunk, idx) => `(${idx + 1}) ${chunk.text.slice(0, 280).trim()}...`)
    .join("\n\n");

  return [
    `Question: ${question}`,
    "No model response was generated, so this answer is extractive from corpus matches:",
    preview
  ].join("\n\n");
}

async function generateWithVertex(
  message: string,
  history: Turn[],
  promptContext: string
): Promise<string> {
  requireVertexConfig();
  const accessToken = await getAccessToken();

  const vertexHistory = history.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }]
  }));

  const endpoint =
    `https://${GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1` +
    `/projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_LOCATION}` +
    `/publishers/google/models/${VERTEX_MODEL}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are a RAG assistant. Answer using the provided context. If context is insufficient, say what is missing." +
              `\n\nContext from the Vertex RAG corpus:\n${promptContext}`
          }
        ]
      },
      contents: [...vertexHistory, { role: "user", parts: [{ text: message }] }],
      generationConfig: {
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Vertex generateContent failed: ${response.status} ${details}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  return text || "I do not have an answer.";
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    sourceMode: "vertex-rag-corpus",
    model: `vertex:${VERTEX_MODEL}`,
    project: GOOGLE_CLOUD_PROJECT || null,
    location: GOOGLE_CLOUD_LOCATION,
    corpus: VERTEX_RAG_CORPUS || null,
    topK: VERTEX_RAG_TOP_K
  });
});

app.post("/api/reindex", (_req, res) => {
  res.json({
    ok: true,
    message: "This app uses Vertex RAG corpus retrieval. Reindex by running corpus import, not /api/reindex."
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const body = req.body as { message?: string; history?: Turn[] };
    const message = (body.message ?? "").trim();

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const contexts = await retrieveFromVertexCorpus(message, VERTEX_RAG_TOP_K);
    const sources = Array.from(new Set(contexts.map((x) => x.sourceUri)));

    if (contexts.length === 0) {
      res.json({ answer: fallbackAnswer(message, contexts), sources });
      return;
    }

    const promptContext = contexts.map((x, i) => `[Chunk ${i + 1}] ${x.text}`).join("\n\n");
    const answer = await generateWithVertex(message, history, promptContext);
    res.json({ answer, sources });
  } catch (error) {
    const text = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ error: text });
  }
});

app.listen(PORT, () => {
  console.log(`RAG server on http://localhost:${PORT}`);
});
