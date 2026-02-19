from typing import List
import vertexai
from vertexai.language_models import TextEmbeddingModel


def init_vertex(project_id: str, location: str) -> None:
    vertexai.init(project=project_id, location=location)


def generate_embeddings(
    texts: List[str],
    model_name: str = "text-embedding-004",
    task_type: str = "RETRIEVAL_DOCUMENT",
    output_dimensionality: int = 768,
) -> List[List[float]]:
    model = TextEmbeddingModel.from_pretrained(model_name)
    embeddings = model.get_embeddings(
        texts,
        task_type=task_type,
        output_dimensionality=output_dimensionality,
    )
    return [list(item.values) for item in embeddings]