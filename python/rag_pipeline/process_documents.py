"""
Document Processing Script for RAG System
Processes PDFs and generates embeddings for Firestore storage.
"""

import os
from typing import Dict, List
from google.cloud import firestore
from google.cloud import storage
from .chunking import chunk_text_intelligent
from .embeddings import init_vertex, generate_embeddings
from .firestore_utils import store_chunks_and_embeddings
from .gcs_utils import download_blob_as_bytes
from .pdf_utils import extract_text_from_pdf

PROJECT_ID = os.getenv("PROJECT_ID", "your-project-id")
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", f"{PROJECT_ID}-documents")
LOCATION = os.getenv("VERTEX_LOCATION", "us-central1")


def process_document(
    storage_client: storage.Client,
    firestore_client: firestore.Client,
    gcs_path: str,
    collection_name: str,
    document_name: str,
) -> None:
    print(f"Processing {document_name} from {gcs_path}...")
    pdf_bytes = download_blob_as_bytes(storage_client, GCS_BUCKET_NAME, gcs_path)

    text_items = extract_text_from_pdf(pdf_bytes)
    chunks = chunk_text_intelligent(text_items, max_tokens=500, overlap_tokens=50)
    print(f"Created {len(chunks)} chunks")

    all_embeddings: List[List[float]] = []
    batch_size = 20
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        texts = [c["text"] for c in batch]
        emb = generate_embeddings(texts)
        all_embeddings.extend(emb)
        print(f"Embedded batch {i // batch_size + 1}/{(len(chunks) + batch_size - 1) // batch_size}")

    store_chunks_and_embeddings(
        db=firestore_client,
        collection_name=collection_name,
        document_name=document_name,
        chunks=chunks,
        embeddings=all_embeddings,
    )

    print(f"Successfully processed {document_name}")


def main() -> None:
    if PROJECT_ID == "your-project-id":
        raise RuntimeError("Set PROJECT_ID before running ingestion.")

    init_vertex(project_id=PROJECT_ID, location=LOCATION)

    storage_client = storage.Client(project=PROJECT_ID)
    firestore_client = firestore.Client(project=PROJECT_ID)

    documents: List[Dict[str, str]] = [
        {"gcs_path": "frameworks/iso27001.pdf", "collection": "frameworks", "name": "iso27001"},
        {"gcs_path": "frameworks/nist.pdf", "collection": "frameworks", "name": "nist"},
    ]

    for doc in documents:
        try:
            process_document(
                storage_client=storage_client,
                firestore_client=firestore_client,
                gcs_path=doc["gcs_path"],
                collection_name=doc["collection"],
                document_name=doc["name"],
            )
        except Exception as exc:
            print(f"Error processing {doc['name']}: {exc}")


if __name__ == "__main__":
    main()