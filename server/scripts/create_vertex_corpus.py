#!/usr/bin/env python
"""Create and ingest a Vertex AI RAG corpus with strong defaults.

Usage:
  python server/scripts/create_vertex_corpus.py \
    --project farmersmark-agriculture \
    --location us-west1 \
    --bucket farmermarkpdfs \
    --display-name farmersmark-best-corpus
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

import vertexai
from vertexai import rag


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create and import a Vertex RAG corpus from GCS PDFs")
    parser.add_argument("--project", required=True, help="GCP project id")
    parser.add_argument("--location", default="us-west1", help="Vertex location")
    parser.add_argument("--bucket", required=True, help="GCS bucket containing PDFs")
    parser.add_argument("--prefix", default="", help="Optional GCS prefix inside bucket")
    parser.add_argument("--display-name", default="farmersmark-best-corpus", help="Corpus display name")
    parser.add_argument("--corpus-name", default="", help="Existing corpus resource name (skip create)")
    parser.add_argument(
        "--embedding-model",
        default="publishers/google/models/text-embedding-005",
        help="Embedding model publisher path",
    )
    parser.add_argument("--chunk-size", type=int, default=768, help="Chunk size in tokens")
    parser.add_argument("--chunk-overlap", type=int, default=128, help="Chunk overlap in tokens")
    parser.add_argument(
        "--max-embedding-rpm",
        type=int,
        default=900,
        help="Embedding requests per minute throttle",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=1800,
        help="Import timeout in seconds",
    )
    return parser.parse_args()


def normalize_gcs_path(bucket: str, prefix: str) -> str:
    cleaned = prefix.strip().strip("/")
    return f"gs://{bucket}/{cleaned}" if cleaned else f"gs://{bucket}/"


def main() -> None:
    args = parse_args()
    vertexai.init(project=args.project, location=args.location)

    source_path = normalize_gcs_path(args.bucket, args.prefix)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    corpus_name = args.corpus_name.strip()
    if corpus_name:
        print("Using existing corpus:", corpus_name, flush=True)
    else:
        backend_config = rag.RagVectorDbConfig(
            rag_embedding_model_config=rag.RagEmbeddingModelConfig(
                vertex_prediction_endpoint=rag.VertexPredictionEndpoint(
                    publisher_model=args.embedding_model
                )
            )
        )

        corpus = rag.create_corpus(
            display_name=args.display_name,
            description=(
                "FarmersMark production corpus. "
                f"Chunking {args.chunk_size}/{args.chunk_overlap}, embedding {args.embedding_model}."
            ),
            backend_config=backend_config,
        )
        corpus_name = corpus.name
        print("Created corpus:", corpus_name, flush=True)

    sink = f"gs://{args.bucket}/rag_import_logs/{timestamp}_results.ndjson"
    failures_sink = f"gs://{args.bucket}/rag_import_logs/{timestamp}_failures.ndjson"

    result = rag.import_files(
        corpus_name=corpus_name,
        paths=[source_path],
        transformation_config=rag.TransformationConfig(
            rag.ChunkingConfig(chunk_size=args.chunk_size, chunk_overlap=args.chunk_overlap)
        ),
        max_embedding_requests_per_min=args.max_embedding_rpm,
        import_result_sink=sink,
        partial_failures_sink=failures_sink,
        timeout=args.timeout_seconds,
    )

    print("Source path:", source_path, flush=True)
    print("Imported files:", result.imported_rag_files_count, flush=True)
    print("Skipped files:", result.skipped_rag_files_count, flush=True)
    print("Import log:", sink, flush=True)
    print("Failures log:", failures_sink, flush=True)


if __name__ == "__main__":
    main()
