import {AnalyzePayload, AnalyzeResponse, ReportsResponse} from "./types";

const baseUrl =
  import.meta.env.VITE_FUNCTIONS_BASE_URL ||
  "http://127.0.0.1:5001/your-project-id/us-central1";

async function handleJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T;
  if (!response.ok) {
    throw new Error((data as {error?: string}).error || `Request failed with ${response.status}`);
  }
  return data;
}

export async function analyzeDocument(payload: AnalyzePayload): Promise<AnalyzeResponse> {
  const response = await fetch(`${baseUrl}/analyzeDocument`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });

  return handleJson<AnalyzeResponse>(response);
}

export async function getReports(userId: string): Promise<ReportsResponse> {
  const response = await fetch(`${baseUrl}/getReports?userId=${encodeURIComponent(userId)}`);
  return handleJson<ReportsResponse>(response);
}