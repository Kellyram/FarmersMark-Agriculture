# FarmersMark RAG Scaffold

Scaffold generated from `rag.md` for a Firebase + Firestore + Vertex AI RAG system.

## Structure
- `functions/`: Firebase Functions (TypeScript API)
- `python/rag_pipeline/`: document ingestion and embedding pipeline
- `web/`: React + Vite frontend for analysis and reports
- `scripts/`: setup helpers for Google Cloud/Firebase
- `firestore.rules`: security rules

## Quick start
1. Copy `.env.example` values into your shell env.
2. Run `scripts/setup-gcloud.ps1` (Windows) or `scripts/setup-gcloud.sh` (Linux/Mac).
3. Install Python deps: `pip install -r requirements.txt`.
4. Process framework docs: `python process_documents.py`.
5. Install JS deps (workspace): `pnpm install`.
6. Build and deploy functions:
   - `pnpm --filter farmersmark-functions build`
   - `firebase deploy --only functions`

## Frontend
1. `cd web`
2. `copy .env.example .env` (Windows) and set your real project in `VITE_FUNCTIONS_BASE_URL`
3. `pnpm dev`

Build/deploy hosting:
- `pnpm --filter farmersmark-web build`
- `firebase deploy --only hosting`

## Notes
- Update `PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` before running ingestion.
- `analyzeDocument` includes embedding-based retrieval + Gemini generation via Vertex REST.