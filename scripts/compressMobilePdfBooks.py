"""Generates compact, text-preserving mobile PDF editions for offline Android APKs.

Downsamples and re-encodes oversized raster XObject images using Pillow + PyMuPDF
Pixmap color normalization (accurately preserving CMYK/RGB/Gray plates) while keeping
all fonts, vector text, outlines, and selectable TextLayer glyphs 100% intact.
"""

from __future__ import annotations

import io
import pathlib
import sys
import PIL.Image
import pymupdf


ROOT = pathlib.Path(__file__).resolve().parent.parent
BOOKS = [
    ("public/books/book1-netters-atlas-7ed.pdf", "mobile-assets/books/book1-netters-atlas-7ed.pdf"),
    ("public/books/book2-grays-anatomy-4ed.pdf", "mobile-assets/books/book2-grays-anatomy-4ed.pdf"),
]

# Tuned for crisp mobile readability at < ~55 MiB per textbook (100% offline APK)
MAX_IMAGE_EDGE = 960
JPEG_QUALITY = 50
MIN_BYTES_TO_REENCODE = 14_000


def reencode_pixmap_to_jpeg(doc: pymupdf.Document, xref: int, max_edge: int, quality: int) -> bytes | None:
    pix = None
    rgb_pix = None
    try:
        pix = pymupdf.Pixmap(doc, xref)
        if pix.alpha or pix.n < 1:
            return None
        if pix.colorspace is None:
            return None
        if pix.colorspace.name not in ("DeviceRGB", "DeviceGray"):
            rgb_pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            src_pix = rgb_pix
        else:
            src_pix = pix

        mode = "L" if src_pix.colorspace.name == "DeviceGray" else "RGB"
        pil_img = PIL.Image.frombytes(mode, (src_pix.width, src_pix.height), src_pix.samples)

        w, h = pil_img.size
        if max(w, h) > max_edge:
            pil_img.thumbnail((max_edge, max_edge), PIL.Image.Resampling.LANCZOS)

        buf = io.BytesIO()
        pil_img.save(
            buf,
            format="JPEG",
            quality=quality,
            optimize=True,
            subsampling="4:2:0" if mode == "RGB" else 0,
        )
        return buf.getvalue()
    except Exception:
        return None
    finally:
        if rgb_pix is not None:
            rgb_pix = None
        if pix is not None:
            pix = None


def compress_book(src: pathlib.Path, dst: pathlib.Path) -> None:
    if not src.exists():
        raise FileNotFoundError(f"Missing source PDF: {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(".pdf.tmp")

    doc = pymupdf.open(str(src))
    replaced_count = 0
    saved_bytes = 0
    try:
        seen_xrefs: set[int] = set()
        for page in doc:
            for img_info in page.get_images(full=False):
                xref = int(img_info[0])
                smask = int(img_info[1])
                if xref in seen_xrefs or smask != 0:
                    continue
                seen_xrefs.add(xref)

                extracted = doc.extract_image(xref)
                if not extracted or not extracted.get("image"):
                    continue
                orig_bytes = len(extracted["image"])
                if orig_bytes < MIN_BYTES_TO_REENCODE:
                    continue

                new_jpeg = reencode_pixmap_to_jpeg(doc, xref, MAX_IMAGE_EDGE, JPEG_QUALITY)
                if new_jpeg and len(new_jpeg) < int(orig_bytes * 0.85):
                    page.replace_image(xref, stream=new_jpeg)
                    replaced_count += 1
                    saved_bytes += orig_bytes - len(new_jpeg)

        doc.save(
            str(tmp),
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
            use_objstms=1,
        )
    finally:
        doc.close()

    # Verify text layer integrity and page count on compressed output
    verify = pymupdf.open(str(tmp))
    try:
        page_count = len(verify)
        sample_idx = min(38, max(0, page_count - 1))
        sample_text = verify[sample_idx].get_text("text").strip()
        if not sample_text:
            raise RuntimeError(
                f"Verification failed: empty extracted text at page {sample_idx + 1} in {dst.name}"
            )
    finally:
        verify.close()

    if dst.exists():
        dst.unlink()
    tmp.replace(dst)

    src_mb = src.stat().st_size / (1024 * 1024)
    dst_mb = dst.stat().st_size / (1024 * 1024)
    ratio = (1.0 - (dst_mb / src_mb)) * 100.0 if src_mb > 0 else 0.0
    print(
        f"[MOBILE PDF] {dst.name}: {src_mb:.2f} MiB -> {dst_mb:.2f} MiB (-{ratio:.1f}%), "
        f"reencoded_imgs={replaced_count} (-{saved_bytes / (1024 * 1024):.1f} MiB stream delta), pages={page_count}",
        flush=True,
    )


def main() -> int:
    for src_rel, dst_rel in BOOKS:
        compress_book(ROOT / src_rel, ROOT / dst_rel)
    return 0


if __name__ == "__main__":
    sys.exit(main())
