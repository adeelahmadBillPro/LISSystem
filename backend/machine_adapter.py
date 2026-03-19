"""
Machine Adapter Pattern for multi-protocol support.

Different blood analyzer machines use different communication protocols:
- HL7 v2.x: Sysmex XN, Roche Cobas, Abbott Architect
- ASTM E1381: Mindray BC series, older Beckman Coulter
- Custom: Some machines use proprietary formats

This module auto-detects the protocol and routes to the correct parser.
"""

from abc import ABC, abstractmethod
from loguru import logger

from backend.hl7_parser import parse_hl7_message


class MachineAdapter(ABC):
    """Base class — every machine protocol adapter must implement parse()."""

    @abstractmethod
    def parse(self, raw_data: str) -> dict:
        """
        Parse raw machine data into a standardized result dictionary.

        Returns:
            dict with keys: patient, sample, results (same format as HL7 parser)
        """
        raise NotImplementedError


class HL7Adapter(MachineAdapter):
    """
    HL7 v2.x adapter — used by most modern analyzers.
    Machines: Sysmex XN, Roche Cobas, Abbott Architect, Beckman AU
    """

    def parse(self, raw_data: str) -> dict:
        logger.info("Parsing HL7 v2.x message ({} chars)", len(raw_data))
        return parse_hl7_message(raw_data)


class ASTMAdapter(MachineAdapter):
    """
    ASTM E1381/1394 adapter — used by Mindray, some older machines.
    Machines: Mindray BC-5000/6000, older Beckman Coulter, Erba
    """

    def parse(self, raw_data: str) -> dict:
        logger.info("Parsing ASTM message ({} chars)", len(raw_data))

        result = {
            "message_type": "ASTM",
            "patient": {"patient_id": "", "name": "", "first_name": "", "last_name": "",
                        "dob": "", "gender": "", "phone": "", "address": ""},
            "sample": {"sample_id": "", "test_code": "", "test_name": "",
                       "ordered_at": "", "collected_at": "", "reported_at": "",
                       "ordering_provider": ""},
            "results": [],
            "raw_message": raw_data,
        }

        for line in raw_data.split("\r"):
            line = line.strip()
            if not line:
                continue

            # Split ASTM fields by |
            fields = line.split("|")
            record_type = fields[0].strip() if fields else ""

            # H = Header record
            # P = Patient record
            # O = Order record (sample info)
            # R = Result record
            # L = Terminator

            if record_type == "P" and len(fields) > 5:
                # Patient: P|seq|practice_id|patient_id|...name...
                result["patient"]["patient_id"] = fields[3].strip("^") if len(fields) > 3 else ""
                if len(fields) > 5:
                    name_parts = fields[5].split("^")
                    result["patient"]["last_name"] = name_parts[0] if name_parts else ""
                    result["patient"]["first_name"] = name_parts[1] if len(name_parts) > 1 else ""
                    result["patient"]["name"] = f"{result['patient']['first_name']} {result['patient']['last_name']}".strip()
                if len(fields) > 8:
                    result["patient"]["dob"] = fields[7] if len(fields) > 7 else ""
                    result["patient"]["gender"] = fields[8] if len(fields) > 8 else ""

            elif record_type == "O" and len(fields) > 4:
                # Order: O|seq|sample_id|...|test_code^test_name|...
                result["sample"]["sample_id"] = fields[2].strip("^") if len(fields) > 2 else ""
                if len(fields) > 4:
                    test_parts = fields[4].split("^")
                    result["sample"]["test_code"] = test_parts[3] if len(test_parts) > 3 else test_parts[0]
                    result["sample"]["test_name"] = test_parts[4] if len(test_parts) > 4 else ""

            elif record_type == "R" and len(fields) > 4:
                # Result: R|seq|test_code^name|value|unit|ref_range|flag|...
                test_info = fields[2].split("^") if len(fields) > 2 else []
                res = {
                    "set_id": fields[1] if len(fields) > 1 else "",
                    "value_type": "NM",
                    "test_code": test_info[3] if len(test_info) > 3 else (test_info[0] if test_info else ""),
                    "test_name": test_info[4] if len(test_info) > 4 else (test_info[1] if len(test_info) > 1 else ""),
                    "value": fields[3] if len(fields) > 3 else "",
                    "unit": fields[4] if len(fields) > 4 else "",
                    "reference_range": fields[5] if len(fields) > 5 else "",
                    "ref_low": None,
                    "ref_high": None,
                    "flag": fields[6].strip().upper() if len(fields) > 6 and fields[6].strip() else "N",
                    "status": fields[8] if len(fields) > 8 else "F",
                }

                # Parse reference range
                if res["reference_range"] and "-" in res["reference_range"]:
                    try:
                        parts = res["reference_range"].split("-", 1)
                        res["ref_low"] = float(parts[0].strip())
                        res["ref_high"] = float(parts[1].strip())
                    except (ValueError, IndexError):
                        pass

                result["results"].append(res)

        logger.info("ASTM parsed: patient={}, sample={}, results={}",
                     result["patient"]["patient_id"],
                     result["sample"]["sample_id"],
                     len(result["results"]))
        return result


class CustomAdapter(MachineAdapter):
    """
    Fallback adapter for machines with proprietary/unknown formats.
    Logs the raw data and returns empty structure for manual handling.
    """

    def parse(self, raw_data: str) -> dict:
        logger.warning("Unknown protocol — raw data logged for manual review ({} chars)", len(raw_data))
        return {
            "message_type": "UNKNOWN",
            "patient": {"patient_id": "", "name": "", "first_name": "", "last_name": "",
                        "dob": "", "gender": "", "phone": "", "address": ""},
            "sample": {"sample_id": "", "test_code": "", "test_name": "",
                       "ordered_at": "", "collected_at": "", "reported_at": "",
                       "ordering_provider": ""},
            "results": [],
            "raw_message": raw_data,
        }


def detect_protocol(raw_data: str) -> MachineAdapter:
    """
    Auto-detect which protocol the incoming data uses.

    Detection logic:
    - Starts with 'MSH|' → HL7 v2.x
    - Starts with 'H|' or 'H\\' → ASTM E1381
    - Otherwise → Custom/Unknown
    """
    raw_data = raw_data.strip().lstrip("\x0b")  # Remove MLLP wrapper if present

    if raw_data.startswith("MSH|"):
        logger.info("Protocol detected: HL7 v2.x")
        return HL7Adapter()

    elif raw_data.startswith("H|") or raw_data.startswith("H\\"):
        logger.info("Protocol detected: ASTM E1381")
        return ASTMAdapter()

    else:
        logger.warning("Protocol unknown — using CustomAdapter")
        return CustomAdapter()
