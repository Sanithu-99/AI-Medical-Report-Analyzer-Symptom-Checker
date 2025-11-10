import io
from functools import lru_cache
from typing import Literal

import easyocr
import fitz  # PyMuPDF
import numpy as np
from PIL import Image

ContentType = Literal["application/pdf", "image/png", "image/jpeg"]


def extract_text_from_file(file_content: bytes, content_type: ContentType) -> str:
    if content_type == "application/pdf":
        return _extract_from_pdf(file_content)
    if content_type in {"image/png", "image/jpeg"}:
        return _extract_from_image(file_content)
    raise ValueError("Unsupported content type for OCR.")


def _extract_from_pdf(file_content: bytes) -> str:
    """Prefer native text extraction and fall back to OCR page-by-page."""

    texts: list[str] = []
    with fitz.open(stream=file_content, filetype="pdf") as doc:
        for page in doc:
            text = _normalize_pdf_text(page.get_text("text"))
            if _has_meaningful_text(text):
                texts.append(text)
                continue

            pix = page.get_pixmap(dpi=180)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            texts.append(_perform_ocr(img))

    return "\n".join(filter(None, texts))


def _normalize_pdf_text(value: str | None) -> str:
    """Collapse excessive whitespace so we can judge whether a page has real text."""
    if not value:
        return ""
    collapsed = " ".join(value.split())
    return collapsed.strip()


def _has_meaningful_text(value: str) -> bool:
    """Treat the page as text-based when enough alphanumeric characters remain."""
    if not value:
        return False
    alnum_count = sum(char.isalnum() for char in value)
    return alnum_count >= 10


def _extract_from_image(file_content: bytes) -> str:
    img = Image.open(io.BytesIO(file_content)).convert("RGB")
    return _perform_ocr(img)


def _perform_ocr(image: Image.Image) -> str:
    array = np.array(image)
    reader = _get_reader()
    result = reader.readtext(array, detail=0)
    return "\n".join(result)


@lru_cache(maxsize=1)
def _get_reader() -> easyocr.Reader:
    return easyocr.Reader(["en"], gpu=False)
