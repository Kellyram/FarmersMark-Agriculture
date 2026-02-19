import io
from typing import List, Dict, Any
import pdfplumber


def extract_text_from_pdf(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    text_items: List[Dict[str, Any]] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        total_pages = len(pdf.pages)
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text()
            if text and text.strip():
                text_items.append({
                    "text": text.strip(),
                    "page": page_num,
                    "metadata": {
                        "page_number": page_num,
                        "total_pages": total_pages,
                    },
                })
    return text_items