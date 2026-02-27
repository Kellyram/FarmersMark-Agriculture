import "dotenv/config";
import { GoogleAuth } from "google-auth-library";
import cors from "cors";
import express from "express";

type Turn = { role: "user" | "assistant"; content: string };
type RetrievedContext = { text: string; sourceUri: string; sectionCitation?: string };
type Citation = { sectionCitation: string; sourceUri: string };
type VertexErrorPayload = { error?: { code?: number; message?: string; status?: string } };

class HttpError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, status: number, code: string, retryable = false) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

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

function parseVertexErrorDetails(raw: string): {
  code?: number;
  message?: string;
  status?: string;
} {
  try {
    const parsed = JSON.parse(raw) as VertexErrorPayload;
    return {
      code: parsed.error?.code,
      message: parsed.error?.message,
      status: parsed.error?.status
    };
  } catch {
    return {};
  }
}

function toVertexHttpError(operation: string, status: number, rawDetails: string): HttpError {
  const parsed = parseVertexErrorDetails(rawDetails);
  const providerStatus = parsed.status?.toUpperCase();
  const providerMessage = parsed.message?.trim();
  const isQuota = status === 429 || providerStatus === "RESOURCE_EXHAUSTED";

  console.error(`[vertex:${operation}]`, {
    status,
    providerStatus: providerStatus ?? null,
    providerMessage: providerMessage ?? null,
    rawDetails
  });

  if (isQuota) {
    return new HttpError(
      "The assistant is temporarily at capacity. Please retry shortly.",
      429,
      "RESOURCE_EXHAUSTED",
      true
    );
  }

  const safeStatus = status >= 400 && status < 600 ? status : 500;
  return new HttpError(
    "I could not process that request right now. Please try again.",
    safeStatus,
    providerStatus || "VERTEX_ERROR",
    false
  );
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
    throw toVertexHttpError("retrieveContexts", response.status, details);
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

function getBasicSafeReply(message: string): string | null {
  const input = message.trim().toLowerCase();

  if (!input) return null;

  if (/^(hi|hey|hello|yo|good morning|good afternoon|good evening)\b/.test(input)) {
    return "Hello. I can help explain information from your configured Vertex RAG corpus using retrieved sources only.";
  }

  if (/^(how are you|how are you doing|how's it going)\b/.test(input)) {
    return "I am ready to help. I answer using retrieved corpus context and avoid adding unsupported facts.";
  }

  if (
    /\b(what are you|who are you|what can you do|what information do you have|help)\b/.test(input)
  ) {
    return [
      "I am your FarmersMark RAG assistant.",
      "I can explain content that exists in your configured Vertex corpus and cite the source.",
      "If information is not in retrieved context, I will say what is missing."
    ].join(" ");
  }

  if (/^(thanks|thank you)\b/.test(input)) {
    return "You’re welcome.";
  }

  if (/^(bye|goodbye|see you)\b/.test(input)) {
    return "Goodbye.";
  }

  return null;
}

function sanitizeAnswer(rawAnswer: string): string {
  const withoutDisclaimer = rawAnswer.replace(
    /\bThis is only an explanation and not legal help\.?/gi,
    ""
  );
  const withoutReferences = withoutDisclaimer.replace(/\n*\s*References\s*:[\s\S]*$/i, "");
  const cleaned = withoutReferences
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || rawAnswer.trim();
}

async function generateWithVertex(
  message: string,
  history: Turn[],
  promptContext: string,
  citationMap: string
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
            text: [
              "You are a legal-information RAG assistant.",
              "Follow these rules strictly:",
              "1) Transform: translate dense legal jargon into simple, plain English.",
              "2) Ground: base your answer strictly on the provided context. Do not add facts not present in context.",
              "3) Cite: after each factual claim, include the relevant section citation token (for example: [S1], [S2]).",
              "4) If context is insufficient, explicitly say what is missing and ask for the specific missing document/section.",
              "5) Use only citations from the citation map below. Do not invent citation tokens.",
              "",
              "Output format:",
              "- Plain-language answer",
              "- Short bullet summary",
              "",
              `Citation map:\n${citationMap}`,
              "",
              `Context from the Vertex RAG corpus:\n${promptContext}`
            ].join("\n")
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
    throw toVertexHttpError("generateContent", response.status, details);
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

    const basicReply = getBasicSafeReply(message);
    if (basicReply) {
      res.json({ answer: basicReply, sources: [] });
      return;
    }

    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const contextsRaw = await retrieveFromVertexCorpus(message, VERTEX_RAG_TOP_K);
    const contexts = contextsRaw.map((ctx, idx) => ({
      ...ctx,
      sectionCitation: `S${idx + 1}`
    }));
    const citations: Citation[] = Array.from(
      new Map(contexts.map((x) => [x.sectionCitation ?? "", x.sourceUri])).entries()
    )
      .filter(([sectionCitation, sourceUri]) => sectionCitation && sourceUri)
      .map(([sectionCitation, sourceUri]) => ({ sectionCitation, sourceUri }));
    const sources = citations.map((c) => `[${c.sectionCitation}] ${c.sourceUri}`);

    if (contexts.length === 0) {
      res.json({ answer: fallbackAnswer(message, contexts), sources });
      return;
    }

    const promptContext = contexts
      .map((x) => `[${x.sectionCitation}] ${x.sourceUri}\n${x.text}`)
      .join("\n\n");
    const citationMap = citations.map((c) => `[${c.sectionCitation}] ${c.sourceUri}`).join("\n");
    const rawAnswer = await generateWithVertex(message, history, promptContext, citationMap);
    const answer = sanitizeAnswer(rawAnswer);
    res.json({ answer, sources });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({
        error: error.message,
        status: error.status,
        code: error.code,
        retryable: error.retryable
      });
      return;
    }

    console.error("[api/chat] unexpected error", error);
    res.status(500).json({
      error: "I could not process that request right now. Please try again.",
      status: 500,
      code: "INTERNAL_ERROR",
      retryable: false
    });
  }
});

app.listen(PORT, () => {
  console.log(`RAG server on http://localhost:${PORT}`);
});
