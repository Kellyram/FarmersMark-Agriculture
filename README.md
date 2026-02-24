# FarmersMark2.0 - Vertex RAG Corpus Chat App (React + TypeScript)

Chat-style UI backed by a Node server that retrieves context from a Vertex AI RAG corpus and generates answers with Gemini.

## Run

```bash
npm install
copy .env.example .env
gcloud auth application-default login
npm run dev
```

Open `http://localhost:5173`.

## Required `.env`

```bash
GOOGLE_CLOUD_PROJECT=farmersmark-agriculture
GOOGLE_CLOUD_LOCATION=us-west1
VERTEX_MODEL=gemini-2.5-flash
VERTEX_RAG_CORPUS=projects/1030666165439/locations/us-west1/ragCorpora/2305843009213693952
VERTEX_RAG_TOP_K=4

VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_API_BASE_URL=http://localhost:8787
```

## Production Env

Create a local `.env.production` from `.env.production.example` before running a production build.

```bash
copy .env.production.example .env.production
```

Set:

- `VITE_FIREBASE_*` to your active Firebase web app values from Firebase Console.
- `VITE_API_BASE_URL` to your deployed backend URL.

If you see `auth/api-key-expired`, rotate/regenerate the Firebase web API key in Google Cloud and update `VITE_FIREBASE_API_KEY` in `.env.production`, then rebuild and redeploy.

## Notes

- Retrieval uses Vertex `retrieveContexts` from `VERTEX_RAG_CORPUS`.
- Generation uses Vertex `generateContent` with `VERTEX_MODEL`.
- `/api/reindex` is informational in corpus mode; import new files into corpus with the ingestion script.

## Corpus Import

Use:

```bash
python server/scripts/create_vertex_corpus.py --project farmersmark-agriculture --location us-west1 --bucket farmermarkpdfs --corpus-name projects/1030666165439/locations/us-west1/ragCorpora/2305843009213693952
```
