"""
PDF Lab Report Generator using ReportLab.

Generates professional A4 lab reports suitable for Pakistan private labs.
Includes patient info, test results with color-coded flags, and signature line.
"""

import os
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    HRFlowable, Image
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from backend.config import get_settings


# Color constants
COLOR_HIGH = colors.red
COLOR_LOW = colors.blue
COLOR_NORMAL = colors.black
COLOR_HEADER_BG = colors.Color(0.1, 0.3, 0.6)  # Dark blue
COLOR_ROW_ALT = colors.Color(0.95, 0.95, 0.98)  # Light blue-grey


def generate_report(
    patient: dict,
    sample: dict,
    results: list[dict],
    output_path: str,
    logo_path: Optional[str] = None,
    technician_sig: Optional[str] = None,
    pathologist_sig: Optional[str] = None,
    technician_name: Optional[str] = None,
    pathologist_name: Optional[str] = None,
) -> str:
    """
    Generate a professional A4 lab report PDF.

    Args:
        patient: Dict with keys: name, age, gender, mrn, dob, phone
        sample: Dict with keys: sample_id, collected_at, test_panel, doctor_name
        results: List of dicts with: test_name, value, unit, ref_low, ref_high, flag
        output_path: File path to save the PDF
        logo_path: Optional path to lab logo image

    Returns:
        The output file path
    """
    settings = get_settings()

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=15 * mm,
        bottomMargin=20 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        "LabTitle", parent=styles["Heading1"],
        fontSize=18, textColor=COLOR_HEADER_BG,
        alignment=TA_CENTER, spaceAfter=2 * mm,
    ))
    styles.add(ParagraphStyle(
        "LabSubtitle", parent=styles["Normal"],
        fontSize=9, textColor=colors.grey,
        alignment=TA_CENTER, spaceAfter=1 * mm,
    ))
    styles.add(ParagraphStyle(
        "SectionHeader", parent=styles["Heading2"],
        fontSize=11, textColor=COLOR_HEADER_BG,
        spaceBefore=4 * mm, spaceAfter=2 * mm,
    ))
    styles.add(ParagraphStyle(
        "InfoLabel", parent=styles["Normal"],
        fontSize=9, textColor=colors.grey,
    ))
    styles.add(ParagraphStyle(
        "InfoValue", parent=styles["Normal"],
        fontSize=10, textColor=colors.black,
    ))

    elements = []

    # === HEADER: Lab Name & Contact ===
    if logo_path and os.path.exists(logo_path):
        logo = Image(logo_path, width=25 * mm, height=25 * mm)
        elements.append(logo)

    elements.append(Paragraph(settings.LAB_NAME, styles["LabTitle"]))
    elements.append(Paragraph(settings.LAB_ADDRESS, styles["LabSubtitle"]))
    elements.append(Paragraph(
        f"Phone: {settings.LAB_PHONE} | Email: {settings.LAB_EMAIL}",
        styles["LabSubtitle"],
    ))
    elements.append(HRFlowable(
        width="100%", thickness=1.5, color=COLOR_HEADER_BG,
        spaceAfter=3 * mm, spaceBefore=2 * mm,
    ))

    # === REPORT TITLE ===
    panel_name = sample.get("test_panel", "Laboratory Report")
    elements.append(Paragraph(
        f"<b>{panel_name}</b>",
        ParagraphStyle("ReportTitle", parent=styles["Normal"],
                       fontSize=13, alignment=TA_CENTER,
                       textColor=COLOR_HEADER_BG, spaceAfter=4 * mm),
    ))

    # === PATIENT INFO TABLE ===
    gender_display = {"M": "Male", "F": "Female", "O": "Other"}.get(
        patient.get("gender", ""), patient.get("gender", "")
    )
    collected_at = sample.get("collected_at", "")
    if isinstance(collected_at, datetime):
        collected_at = collected_at.strftime("%d-%b-%Y %I:%M %p")

    patient_data = [
        [_label_value("Patient Name", patient.get("name", "")),
         _label_value("Age / Gender", f"{patient.get('age', 'N/A')} yrs / {gender_display}")],
        [_label_value("MRN", patient.get("mrn", "")),
         _label_value("Date of Birth", patient.get("dob", ""))],
        [_label_value("Sample ID", sample.get("sample_id", "")),
         _label_value("Collection Date", collected_at)],
        [_label_value("Referred By", sample.get("doctor_name", "")),
         _label_value("Report Date", datetime.now().strftime("%d-%b-%Y %I:%M %p"))],
    ]

    patient_table = Table(patient_data, colWidths=[90 * mm, 90 * mm])
    patient_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(patient_table)
    elements.append(Spacer(1, 4 * mm))

    # === RESULTS TABLE ===
    elements.append(Paragraph("Test Results", styles["SectionHeader"]))

    # Table header
    header_style = ParagraphStyle(
        "TableHeader", parent=styles["Normal"],
        fontSize=9, textColor=colors.white, fontName="Helvetica-Bold",
    )
    table_data = [[
        Paragraph("Test Name", header_style),
        Paragraph("Result", header_style),
        Paragraph("Unit", header_style),
        Paragraph("Reference Range", header_style),
        Paragraph("Flag", header_style),
    ]]

    # Table rows
    for r in results:
        flag = r.get("flag", "N")
        flag_color = _get_flag_color(flag)
        flag_label = _get_flag_label(flag)

        # Format reference range
        ref_low = r.get("ref_low")
        ref_high = r.get("ref_high")
        if ref_low is not None and ref_high is not None:
            ref_range = f"{ref_low} - {ref_high}"
        elif r.get("reference_range"):
            ref_range = r["reference_range"]
        else:
            ref_range = "-"

        row_style = ParagraphStyle(
            "RowNormal", parent=styles["Normal"], fontSize=9,
        )
        value_style = ParagraphStyle(
            "RowValue", parent=styles["Normal"],
            fontSize=9, fontName="Helvetica-Bold", textColor=flag_color,
        )
        flag_style = ParagraphStyle(
            "RowFlag", parent=styles["Normal"],
            fontSize=9, fontName="Helvetica-Bold", textColor=flag_color,
            alignment=TA_CENTER,
        )

        table_data.append([
            Paragraph(r.get("test_name", ""), row_style),
            Paragraph(str(r.get("value", "")), value_style),
            Paragraph(r.get("unit", ""), row_style),
            Paragraph(ref_range, row_style),
            Paragraph(flag_label, flag_style),
        ])

    # Build results table
    col_widths = [60 * mm, 30 * mm, 25 * mm, 40 * mm, 20 * mm]
    results_table = Table(table_data, colWidths=col_widths, repeatRows=1)

    # Table styling
    table_style = [
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        # All cells
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        # Grid lines
        ("LINEBELOW", (0, 0), (-1, 0), 1, COLOR_HEADER_BG),
        ("LINEBELOW", (0, -1), (-1, -1), 1, COLOR_HEADER_BG),
        ("LINEAFTER", (0, 0), (-2, -1), 0.5, colors.Color(0.85, 0.85, 0.85)),
    ]

    # Alternating row colors
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            table_style.append(("BACKGROUND", (0, i), (-1, i), COLOR_ROW_ALT))

    results_table.setStyle(TableStyle(table_style))
    elements.append(results_table)

    # === LEGEND ===
    elements.append(Spacer(1, 4 * mm))
    legend_style = ParagraphStyle(
        "Legend", parent=styles["Normal"], fontSize=8, textColor=colors.grey,
    )
    elements.append(Paragraph(
        '<b>Flags:</b> '
        '<font color="red">H = High</font> | '
        '<font color="blue">L = Low</font> | '
        'N = Normal | '
        '<font color="red"><b>HH = Critical High</b></font> | '
        '<font color="blue"><b>LL = Critical Low</b></font>',
        legend_style,
    ))

    # === FOOTER: Signature ===
    elements.append(Spacer(1, 15 * mm))
    elements.append(HRFlowable(
        width="100%", thickness=0.5, color=colors.grey,
        spaceAfter=3 * mm,
    ))

    # Build signature cells — use images if available, otherwise blank lines
    tech_sig_cell = ""
    path_sig_cell = ""

    if technician_sig and os.path.exists(technician_sig):
        tech_sig_cell = Image(technician_sig, width=35 * mm, height=15 * mm)
    else:
        tech_sig_cell = Paragraph("_________________________", styles["Normal"])

    if pathologist_sig and os.path.exists(pathologist_sig):
        path_sig_cell = Image(pathologist_sig, width=35 * mm, height=15 * mm)
    else:
        path_sig_cell = Paragraph("_________________________", styles["Normal"])

    tech_label = technician_name or "Lab Technician"
    path_label = pathologist_name or "Pathologist / Verified By"

    sig_data = [
        [tech_sig_cell, path_sig_cell],
        [tech_label, path_label],
        ["Date: _______________", "Date: _______________"],
    ]
    sig_table = Table(sig_data, colWidths=[90 * mm, 90 * mm])
    sig_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.grey),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(sig_table)

    # === QR CODE for verification ===
    try:
        from backend.qr_service import generate_qr_data, generate_qr_image
        qr_data = generate_qr_data(
            sample.get("sample_id", ""),
            patient.get("name", ""),
        )
        qr_path = generate_qr_image(qr_data)
        if qr_path and os.path.exists(qr_path):
            elements.append(Spacer(1, 3 * mm))
            qr_table = Table(
                [[Image(qr_path, width=22 * mm, height=22 * mm),
                  Paragraph(
                      '<font size="7" color="grey">Scan to verify this report<br/>'
                      f'<font size="6">{qr_data}</font></font>',
                      styles["Normal"],
                  )]],
                colWidths=[28 * mm, 150 * mm],
            )
            qr_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
            elements.append(qr_table)
    except Exception:
        pass  # QR code is optional

    # === DISCLAIMER ===
    elements.append(Spacer(1, 5 * mm))
    elements.append(Paragraph(
        "This report is generated electronically and is valid without signature. "
        "Results should be correlated clinically. "
        "Please consult your physician for interpretation.",
        ParagraphStyle("Disclaimer", parent=styles["Normal"],
                       fontSize=7, textColor=colors.grey, alignment=TA_CENTER),
    ))

    # Build PDF with page number footer
    doc.build(elements, onFirstPage=_add_page_number, onLaterPages=_add_page_number)

    return output_path


def _label_value(label: str, value: str) -> Paragraph:
    """Create a formatted label: value paragraph."""
    styles = getSampleStyleSheet()
    return Paragraph(
        f'<font size="8" color="grey">{label}:</font><br/>'
        f'<font size="10"><b>{value}</b></font>',
        styles["Normal"],
    )


def _get_flag_color(flag: str):
    """Return color for result flag."""
    flag = flag.upper().strip()
    if flag in ("H", "HH", "A"):
        return COLOR_HIGH
    elif flag in ("L", "LL"):
        return COLOR_LOW
    return COLOR_NORMAL


def _get_flag_label(flag: str) -> str:
    """Return display label for result flag."""
    flag = flag.upper().strip()
    labels = {
        "H": "HIGH",
        "L": "LOW",
        "HH": "CRIT HIGH",
        "LL": "CRIT LOW",
        "A": "ABNORMAL",
        "N": "Normal",
    }
    return labels.get(flag, "Normal")


def _add_page_number(canvas, doc):
    """Add page number to the bottom of each page."""
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    page_num = canvas.getPageNumber()
    canvas.drawCentredString(A4[0] / 2, 10 * mm, f"Page {page_num}")
    canvas.restoreState()
