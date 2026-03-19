"""QR Code generation for report verification."""

import os
import io
import hashlib
from datetime import datetime

from reportlab.lib.units import mm
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPM


def generate_qr_data(sample_id: str, patient_name: str, report_date: str = None) -> str:
    """Generate verification URL/data for QR code."""
    if not report_date:
        report_date = datetime.now().strftime("%Y%m%d")

    # Create a hash for verification
    raw = f"{sample_id}:{patient_name}:{report_date}"
    verify_hash = hashlib.sha256(raw.encode()).hexdigest()[:12]

    # This URL would point to your patient portal in production
    return f"https://verify.lab.pk/r/{sample_id}?h={verify_hash}"


def generate_qr_image(data: str, output_path: str = None, size: int = 150) -> str:
    """Generate QR code image file."""
    try:
        import qrcode

        qr = qrcode.QRCode(version=1, box_size=4, border=2)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        if not output_path:
            os.makedirs("./qrcodes", exist_ok=True)
            output_path = f"./qrcodes/qr_{hashlib.md5(data.encode()).hexdigest()[:8]}.png"

        img.save(output_path)
        return output_path

    except ImportError:
        # If qrcode library not installed, create a placeholder
        return None


def generate_qr_bytes(data: str) -> bytes:
    """Generate QR code as bytes (for embedding in PDF)."""
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=4, border=2)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf.getvalue()
    except ImportError:
        return None
