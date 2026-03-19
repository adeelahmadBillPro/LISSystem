"""
Barcode Generation Service for Sample Labels.

Generates barcode images (Code128) for sample tubes.
Can produce individual barcodes or printable label sheets.
"""

import os
import io
from datetime import datetime

from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4
from reportlab.graphics.barcode import code128
from reportlab.graphics import renderPDF
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors


def generate_barcode_image(sample_id: str, output_path: str = None) -> str:
    """Generate a single barcode PNG for a sample ID."""
    from reportlab.graphics.barcode import code128 as bc128

    if not output_path:
        os.makedirs("./barcodes", exist_ok=True)
        output_path = f"./barcodes/{sample_id}.png"

    # Create barcode drawing
    d = Drawing(200, 80)
    barcode = bc128.Code128(sample_id, barWidth=1.2, barHeight=35)
    barcode.x = 10
    barcode.y = 25
    d.add(barcode)

    # Add text below
    d.add(String(10, 10, sample_id, fontSize=10, fontName="Helvetica-Bold"))

    from reportlab.graphics import renderPM
    renderPM.drawToFile(d, output_path, fmt="PNG", dpi=200)

    return output_path


def generate_barcode_label_pdf(
    sample_id: str,
    patient_name: str = "",
    test_panel: str = "",
    collected_at: str = "",
    output_path: str = None,
) -> str:
    """
    Generate a small label PDF (50mm x 25mm) with barcode + patient info.
    Suitable for printing on label printers (Brother, Zebra, etc.)
    """
    if not output_path:
        os.makedirs("./barcodes", exist_ok=True)
        output_path = f"./barcodes/label_{sample_id}.pdf"

    # Label size: 50mm x 25mm
    width = 50 * mm
    height = 25 * mm

    c = canvas.Canvas(output_path, pagesize=(width, height))

    # Barcode
    barcode = code128.Code128(sample_id, barWidth=0.8, barHeight=10 * mm)
    barcode.drawOn(c, 2 * mm, 10 * mm)

    # Sample ID text
    c.setFont("Helvetica-Bold", 7)
    c.drawString(2 * mm, 7 * mm, sample_id)

    # Patient name (truncated)
    c.setFont("Helvetica", 5)
    name_display = patient_name[:25] if patient_name else ""
    c.drawString(2 * mm, 4 * mm, name_display)

    # Test panel + date
    info = f"{test_panel} | {collected_at}" if test_panel else collected_at
    c.drawString(2 * mm, 1.5 * mm, info[:35])

    c.save()
    return output_path


def generate_barcode_sheet_pdf(
    samples: list[dict],
    output_path: str = None,
) -> str:
    """
    Generate an A4 sheet with multiple barcode labels (3 columns x 10 rows = 30 labels).
    Each label: 60mm x 25mm

    samples: list of dicts with keys: sample_id, patient_name, test_panel
    """
    if not output_path:
        os.makedirs("./barcodes", exist_ok=True)
        output_path = f"./barcodes/sheet_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    c = canvas.Canvas(output_path, pagesize=A4)
    page_w, page_h = A4

    # Label dimensions
    label_w = 63 * mm
    label_h = 25 * mm
    margin_left = 5 * mm
    margin_top = 10 * mm
    cols = 3
    rows = 10
    gap_x = 3 * mm
    gap_y = 2 * mm

    for idx, sample in enumerate(samples):
        # Calculate position
        page_idx = idx // (cols * rows)
        pos_on_page = idx % (cols * rows)
        col = pos_on_page % cols
        row = pos_on_page // cols

        if pos_on_page == 0 and idx > 0:
            c.showPage()

        x = margin_left + col * (label_w + gap_x)
        y = page_h - margin_top - (row + 1) * (label_h + gap_y)

        # Draw label border (light)
        c.setStrokeColor(colors.Color(0.85, 0.85, 0.85))
        c.setLineWidth(0.3)
        c.rect(x, y, label_w, label_h)

        # Barcode
        sid = sample.get("sample_id", "")
        barcode = code128.Code128(sid, barWidth=0.7, barHeight=8 * mm)
        barcode.drawOn(c, x + 2 * mm, y + 12 * mm)

        # Text
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(x + 2 * mm, y + 9 * mm, sid)

        c.setFont("Helvetica", 5)
        name = sample.get("patient_name", "")[:25]
        c.drawString(x + 2 * mm, y + 6 * mm, name)

        panel = sample.get("test_panel", "")
        c.drawString(x + 2 * mm, y + 3 * mm, panel)

    c.save()
    return output_path
