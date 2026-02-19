from typing import List, Dict, Any


def chunk_text_intelligent(
    text_items: List[Dict[str, Any]],
    max_tokens: int = 500,
    overlap_tokens: int = 50,
) -> List[Dict[str, Any]]:
    """Chunk extracted text while preserving rough sentence boundaries."""
    chunks: List[Dict[str, Any]] = []

    for item in text_items:
      text = item["text"]
      page = item["page"]
      sentences = text.split(". ")

      current: List[str] = []
      current_tokens = 0

      for sentence in sentences:
          sentence_tokens = len(sentence.split())
          if current_tokens + sentence_tokens > max_tokens and current:
              chunk_text = ". ".join(current).strip()
              chunks.append({
                  "text": chunk_text,
                  "page": page,
                  "tokens": current_tokens,
                  "metadata": item["metadata"],
              })

              overlap_words = chunk_text.split()[-overlap_tokens:]
              overlap_text = " ".join(overlap_words)
              current = [overlap_text, sentence] if overlap_text else [sentence]
              current_tokens = len(" ".join(current).split())
          else:
              current.append(sentence)
              current_tokens += sentence_tokens

      if current:
          chunk_text = ". ".join(current).strip()
          chunks.append({
              "text": chunk_text,
              "page": page,
              "tokens": current_tokens,
              "metadata": item["metadata"],
          })

    return chunks