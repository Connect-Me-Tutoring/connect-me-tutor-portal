import io
import time
import urllib.request
from datetime import datetime, timezone

import fitz

HANDBOOK_URL = "https://docs.google.com/uc?export=download&id=13567c0r06Yp881dGcx5E5LT_miFay9Ep"
CACHE_TTL_SECONDS = 3600

_cache = {
    "text": "",
    "fetched_at": None,
}


def _download_pdf_bytes() -> bytes:
    req = urllib.request.Request(
        HANDBOOK_URL,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req) as response:
        return response.read()


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        text = page.get_text()
        if text.strip():
            pages.append(text)
    doc.close()
    return "\n\n".join(pages)


def _is_cache_valid() -> bool:
    if not _cache["fetched_at"]:
        return False
    age = time.time() - _cache["fetched_at"]
    return age < CACHE_TTL_SECONDS


async def get_handbook_text() -> str:
    if _is_cache_valid():
        return _cache["text"]

    try:
        pdf_bytes = _download_pdf_bytes()
        text = _extract_text_from_pdf(pdf_bytes)
        _cache["text"] = text
        _cache["fetched_at"] = time.time()
        return text
    except Exception as e:
        print(f"Failed to fetch handbook: {e}")
        if _cache["text"]:
            return _cache["text"]
        return ""


async def refresh_handbook() -> str:
    _cache["fetched_at"] = None
    return await get_handbook_text()


def get_handbook_status() -> dict:
    fetched_at = _cache["fetched_at"]
    if fetched_at:
        age = time.time() - fetched_at
        fetched_str = datetime.fromtimestamp(fetched_at, tz=timezone.utc).isoformat()
    else:
        age = None
        fetched_str = None

    return {
        "cached": bool(_cache["text"]),
        "last_fetched": fetched_str,
        "text_length": len(_cache["text"]),
        "cache_age_seconds": round(age, 1) if age is not None else None,
    }
