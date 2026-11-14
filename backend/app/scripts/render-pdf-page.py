"""Render a certificate PDF from stdin to PNG stdout for QR acceptance checks."""
import sys
import pymupdf

# Certificate PDFs are server-generated, exactly one page; bound raster size.
content = sys.stdin.buffer.read(20 * 1024 * 1024 + 1)
if len(content) > 20 * 1024 * 1024:
    raise ValueError("PDF too large for acceptance renderer")
scale = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0
if not 0.5 <= scale <= 4:
    raise ValueError("Unsupported render scale")
with pymupdf.open(stream=content, filetype="pdf") as doc:
    if len(doc) != 1:
        raise ValueError("Certificate must contain exactly one page")
    sys.stdout.buffer.write(doc[0].get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False).tobytes("png"))
