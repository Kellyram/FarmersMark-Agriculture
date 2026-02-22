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
```

## Notes

- Retrieval uses Vertex `retrieveContexts` from `VERTEX_RAG_CORPUS`.
- Generation uses Vertex `generateContent` with `VERTEX_MODEL`.
- `/api/reindex` is informational in corpus mode; import new files into corpus with the ingestion script.

## Corpus Import

Use:

```bash
python server/scripts/create_vertex_corpus.py --project farmersmark-agriculture --location us-west1 --bucket farmermarkpdfs --corpus-name projects/1030666165439/locations/us-west1/ragCorpora/2305843009213693952
```
