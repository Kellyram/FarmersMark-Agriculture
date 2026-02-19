import {GoogleAuth} from "google-auth-library";
import {CONFIG} from "../config";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

type VertexResponse = {
  predictions?: Array<{embeddings?: {values?: number[]}}>;
  candidates?: Array<{content?: {parts?: Array<{text?: string}>}}>;
};

async function vertexPost(endpoint: string, body: unknown): Promise<VertexResponse> {
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const url = `https://${CONFIG.VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/${endpoint}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex call failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as VertexResponse;
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const endpoint = `projects/${CONFIG.PROJECT_ID}/locations/${CONFIG.VERTEX_AI_LOCATION}` +
    `/publishers/google/models/${CONFIG.EMBEDDING_MODEL}:predict`;

  const body = {
    instances: [{content: query}],
    parameters: {
      outputDimensionality: CONFIG.RAG.OUTPUT_DIMENSIONALITY,
      task_type: "RETRIEVAL_QUERY",
    },
  };

  const json = await vertexPost(endpoint, body);
  return json.predictions?.[0]?.embeddings?.values || [];
}

export async function generateAnalysis(prompt: string): Promise<string> {
  const endpoint = `projects/${CONFIG.PROJECT_ID}/locations/${CONFIG.VERTEX_AI_LOCATION}` +
    `/publishers/google/models/${CONFIG.GENERATION_MODEL}:generateContent`;

  const body = {
    contents: [{role: "user", parts: [{text: prompt}]}],
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  };

  const json = await vertexPost(endpoint, body);
  return json.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }

  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  if (!magA || !magB) {
    return 0;
  }

  return dot / (magA * magB);
}