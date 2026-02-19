from datetime import datetime
from typing import Dict, List, Any
from google.cloud import firestore


def store_chunks_and_embeddings(
    db: firestore.Client,
    collection_name: str,
    document_name: str,
    chunks: List[Dict[str, Any]],
    embeddings: List[List[float]],
) -> None:
    doc_ref = db.collection(collection_name).document(document_name)
    now = datetime.utcnow()

    doc_ref.set({
        "name": document_name,
        "total_chunks": len(chunks),
        "created_at": now,
        "updated_at": now,
        "status": "processed",
    })

    chunks_ref = doc_ref.collection("chunks")
    batch = db.batch()
    batch_count = 0

    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        chunk_ref = chunks_ref.document(f"chunk_{i:04d}")
        batch.set(chunk_ref, {
            "text": chunk["text"],
            "page": chunk["page"],
            "chunk_index": i,
            "tokens": chunk["tokens"],
            "embedding": embedding,
            "metadata": chunk["metadata"],
            "created_at": now,
        })
        batch_count += 1

        if batch_count >= 500:
            batch.commit()
            batch = db.batch()
            batch_count = 0

    if batch_count > 0:
        batch.commit()