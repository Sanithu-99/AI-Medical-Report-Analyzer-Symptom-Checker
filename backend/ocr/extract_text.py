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
    texts = []
    with fitz.open(stream=file_content, filetype="pdf") as doc:
        for page in doc:
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            texts.append(_perform_ocr(img))
    return "\n".join(texts)


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
