export const CONFIG = {
  PROJECT_ID: process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || "your-project-id",
  REGION: "us-central1",
  VERTEX_AI_LOCATION: "us-central1",
  EMBEDDING_MODEL: "text-embedding-004",
  GENERATION_MODEL: "gemini-2.5-flash",
  GCS_BUCKET: process.env.GCS_BUCKET || `${process.env.GCLOUD_PROJECT}.firebasestorage.app`,
  COLLECTIONS: {
    FRAMEWORKS: "frameworks",
    POLICIES: "policies",
    REPORTS: "reports",
  },
  RAG: {
    TOP_K: 10,
    OUTPUT_DIMENSIONALITY: 768,
  },
};