"""
HL7 v2.x Message Parser for Laboratory Information System.

Parses raw HL7 messages from blood analyzer machines and extracts:
- Patient information (PID segment)
- Sample/Order information (OBR segment)
- Test results with flags (OBX segments)
"""

import hl7
from typing import Optional
from loguru import logger


def parse_hl7_message(raw_message: str) -> dict:
    """
    Parse a raw HL7 v2.x message string and return a structured dictionary.

    Args:
        raw_message: Raw HL7 message string with segments separated by \\r

    Returns:
        Dictionary with patient, sample, and results data

    Raises:
        ValueError: If the message cannot be parsed or is missing required segments
    """
    try:
        # Clean the message - normalize line endings
        raw_message = raw_message.strip()
        raw_message = raw_message.replace("\n", "\r")
        # Remove duplicate \r
        while "\r\r" in raw_message:
            raw_message = raw_message.replace("\r\r", "\r")

        parsed = hl7.parse(raw_message)

        result = {
            "message_type": _extract_message_type(parsed),
            "patient": _extract_patient(parsed),
            "sample": _extract_sample(parsed),
            "results": _extract_results(parsed),
            "raw_message": raw_message,
        }

        logger.info(
            "Parsed HL7 message: type={}, patient_id={}, sample_id={}, results_count={}",
            result["message_type"],
            result["patient"].get("patient_id"),
            result["sample"].get("sample_id"),
            len(result["results"]),
        )

        return result

    except Exception as e:
        logger.error("Failed to parse HL7 message: {}", str(e))
        raise ValueError(f"HL7 parsing error: {str(e)}") from e


def _extract_message_type(parsed: hl7.Message) -> str:
    """Extract message type from MSH segment (MSH.9)."""
    try:
        msh = _get_segment(parsed, "MSH")
        if msh:
            return str(msh[9])
        return "UNKNOWN"
    except (IndexError, KeyError):
        return "UNKNOWN"


def _extract_patient(parsed: hl7.Message) -> dict:
    """Extract patient information from PID segment."""
    patient = {
        "patient_id": "",
        "name": "",
        "first_name": "",
        "last_name": "",
        "dob": "",
        "gender": "",
        "phone": "",
        "address": "",
    }

    pid = _get_segment(parsed, "PID")
    if not pid:
        logger.warning("No PID segment found in HL7 message")
        return patient

    try:
        # PID-3: Patient ID
        patient["patient_id"] = str(pid[3]).split("^")[0] if len(pid) > 3 else ""

        # PID-5: Patient Name (Last^First^Middle)
        if len(pid) > 5:
            name_parts = str(pid[5]).split("^")
            patient["last_name"] = name_parts[0] if len(name_parts) > 0 else ""
            patient["first_name"] = name_parts[1] if len(name_parts) > 1 else ""
            patient["name"] = f"{patient['first_name']} {patient['last_name']}".strip()

        # PID-7: Date of Birth
        patient["dob"] = str(pid[7]) if len(pid) > 7 else ""

        # PID-8: Gender
        patient["gender"] = str(pid[8]) if len(pid) > 8 else ""

        # PID-11: Address
        patient["address"] = str(pid[11]).replace("^", ", ") if len(pid) > 11 else ""

        # PID-13: Phone
        patient["phone"] = str(pid[13]) if len(pid) > 13 else ""

    except (IndexError, KeyError) as e:
        logger.warning("Error extracting patient data: {}", str(e))

    return patient


def _extract_sample(parsed: hl7.Message) -> dict:
    """Extract sample/order information from OBR segment."""
    sample = {
        "sample_id": "",
        "test_code": "",
        "test_name": "",
        "ordered_at": "",
        "collected_at": "",
        "reported_at": "",
        "ordering_provider": "",
    }

    obr = _get_segment(parsed, "OBR")
    if not obr:
        logger.warning("No OBR segment found in HL7 message")
        return sample

    try:
        # OBR-2: Placer Order Number (Sample ID)
        sample["sample_id"] = str(obr[2]).split("^")[0] if len(obr) > 2 else ""

        # OBR-3: Filler Order Number (alternative Sample ID)
        if not sample["sample_id"] and len(obr) > 3:
            sample["sample_id"] = str(obr[3]).split("^")[0]

        # OBR-4: Universal Service ID (Test Code^Test Name)
        if len(obr) > 4:
            service_parts = str(obr[4]).split("^")
            sample["test_code"] = service_parts[0] if len(service_parts) > 0 else ""
            sample["test_name"] = service_parts[1] if len(service_parts) > 1 else ""

        # OBR-7: Observation Date/Time
        sample["collected_at"] = str(obr[7]) if len(obr) > 7 else ""

        # OBR-14: Specimen Received Date/Time
        sample["ordered_at"] = str(obr[14]) if len(obr) > 14 else ""

        # OBR-22: Results Report Date/Time
        sample["reported_at"] = str(obr[22]) if len(obr) > 22 else ""

        # OBR-16: Ordering Provider
        if len(obr) > 16:
            provider_parts = str(obr[16]).split("^")
            if len(provider_parts) > 1:
                sample["ordering_provider"] = f"{provider_parts[1]} {provider_parts[0]}".strip()
            else:
                sample["ordering_provider"] = provider_parts[0]

    except (IndexError, KeyError) as e:
        logger.warning("Error extracting sample data: {}", str(e))

    return sample


def _extract_results(parsed: hl7.Message) -> list[dict]:
    """Extract all test results from OBX segments."""
    results = []

    for segment in parsed:
        if str(segment[0]) != "OBX":
            continue

        result = {
            "set_id": "",
            "value_type": "",
            "test_code": "",
            "test_name": "",
            "value": "",
            "unit": "",
            "reference_range": "",
            "ref_low": None,
            "ref_high": None,
            "flag": "N",  # N=Normal, H=High, L=Low, A=Abnormal
            "status": "",
        }

        try:
            # OBX-1: Set ID
            result["set_id"] = str(segment[1]) if len(segment) > 1 else ""

            # OBX-2: Value Type (NM=Numeric, ST=String, etc.)
            result["value_type"] = str(segment[2]) if len(segment) > 2 else ""

            # OBX-3: Observation Identifier (Code^Name)
            if len(segment) > 3:
                obs_parts = str(segment[3]).split("^")
                result["test_code"] = obs_parts[0] if len(obs_parts) > 0 else ""
                result["test_name"] = obs_parts[1] if len(obs_parts) > 1 else ""

            # OBX-5: Observation Value
            result["value"] = str(segment[5]) if len(segment) > 5 else ""

            # OBX-6: Units
            result["unit"] = str(segment[6]) if len(segment) > 6 else ""

            # OBX-7: Reference Range (e.g., "4.0-10.0")
            if len(segment) > 7:
                ref_range = str(segment[7])
                result["reference_range"] = ref_range
                ref_low, ref_high = _parse_reference_range(ref_range)
                result["ref_low"] = ref_low
                result["ref_high"] = ref_high

            # OBX-8: Abnormal Flags
            if len(segment) > 8:
                flag = str(segment[8]).strip().upper()
                result["flag"] = flag if flag in ("H", "L", "A", "HH", "LL", "N", "") else "N"
                if result["flag"] == "":
                    result["flag"] = "N"

            # OBX-11: Observation Result Status
            result["status"] = str(segment[11]) if len(segment) > 11 else ""

        except (IndexError, KeyError) as e:
            logger.warning("Error extracting OBX result: {}", str(e))

        results.append(result)

    return results


def _parse_reference_range(ref_range: str) -> tuple[Optional[float], Optional[float]]:
    """Parse reference range string like '4.0-10.0' into (low, high) tuple."""
    try:
        if not ref_range or ref_range.strip() == "":
            return None, None

        # Handle formats: "4.0-10.0", "4.0 - 10.0", "<10.0", ">4.0"
        ref_range = ref_range.strip()

        if ref_range.startswith("<") or ref_range.startswith("<="):
            high = float(ref_range.lstrip("<= "))
            return None, high

        if ref_range.startswith(">") or ref_range.startswith(">="):
            low = float(ref_range.lstrip(">= "))
            return low, None

        if "-" in ref_range:
            # Handle negative numbers: split on " - " first, then "-"
            if " - " in ref_range:
                parts = ref_range.split(" - ")
            else:
                parts = ref_range.split("-", 1)

            if len(parts) == 2:
                low = float(parts[0].strip()) if parts[0].strip() else None
                high = float(parts[1].strip()) if parts[1].strip() else None
                return low, high

        return None, None

    except (ValueError, TypeError):
        return None, None


def _get_segment(parsed: hl7.Message, segment_id: str):
    """Get the first occurrence of a segment by its ID."""
    for segment in parsed:
        if str(segment[0]) == segment_id:
            return segment
    return None
