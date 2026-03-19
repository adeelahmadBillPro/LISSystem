"""Unit tests for HL7 v2.x message parser."""

import pytest
from backend.hl7_parser import parse_hl7_message, _parse_reference_range


# --- Sample HL7 Messages ---

SAMPLE_CBC_MESSAGE = (
    "MSH|^~\\&|ANALYZER|LAB|LIS|HOSPITAL|20240115120000||ORU^R01|MSG001|P|2.3\r"
    "PID|1||PAT001^^^MRN||Khan^Ahmed^||19850315|M|||123 Main St^Lahore^Punjab^54000||(0300)1234567\r"
    "OBR|1|SAM001||CBC^Complete Blood Count|||20240115100000||||||||||Dr001^Ali^Dr|||||||20240115120000\r"
    "OBX|1|NM|WBC^White Blood Cells||7.5|10*3/uL|4.0-10.0|N|||F\r"
    "OBX|2|NM|RBC^Red Blood Cells||5.2|10*6/uL|4.5-5.5|N|||F\r"
    "OBX|3|NM|HGB^Hemoglobin||14.5|g/dL|13.0-17.0|N|||F\r"
    "OBX|4|NM|HCT^Hematocrit||42.0|%|38.0-50.0|N|||F\r"
    "OBX|5|NM|PLT^Platelets||350|10*3/uL|150-400|N|||F\r"
)

SAMPLE_ABNORMAL_MESSAGE = (
    "MSH|^~\\&|ANALYZER|LAB|LIS|HOSPITAL|20240115130000||ORU^R01|MSG002|P|2.3\r"
    "PID|1||PAT002^^^MRN||Fatima^Ayesha^||19900520|F|||456 Oak Rd^Karachi^Sindh||(0321)9876543\r"
    "OBR|1|SAM002||CBC^Complete Blood Count|||20240115110000\r"
    "OBX|1|NM|WBC^White Blood Cells||15.2|10*3/uL|4.0-10.0|H|||F\r"
    "OBX|2|NM|HGB^Hemoglobin||9.5|g/dL|12.0-16.0|L|||F\r"
    "OBX|3|NM|PLT^Platelets||180|10*3/uL|150-400|N|||F\r"
)

SAMPLE_MINIMAL_MESSAGE = (
    "MSH|^~\\&|ANALYZER|LAB|LIS|HOSPITAL|20240115140000||ORU^R01|MSG003|P|2.3\r"
    "PID|1||PAT003\r"
    "OBR|1|SAM003\r"
    "OBX|1|NM|GLU^Glucose||110|mg/dL|70-100|H|||F\r"
)


class TestHL7Parser:
    """Tests for the main parse_hl7_message function."""

    def test_parse_complete_cbc_message(self):
        result = parse_hl7_message(SAMPLE_CBC_MESSAGE)

        assert result["message_type"] == "ORU^R01"
        assert result["patient"]["patient_id"] == "PAT001"
        assert result["patient"]["first_name"] == "Ahmed"
        assert result["patient"]["last_name"] == "Khan"
        assert result["patient"]["gender"] == "M"
        assert result["patient"]["dob"] == "19850315"
        assert result["sample"]["sample_id"] == "SAM001"
        assert result["sample"]["test_code"] == "CBC"
        assert len(result["results"]) == 5

    def test_parse_abnormal_results(self):
        result = parse_hl7_message(SAMPLE_ABNORMAL_MESSAGE)

        # High WBC
        wbc = result["results"][0]
        assert wbc["test_code"] == "WBC"
        assert wbc["value"] == "15.2"
        assert wbc["flag"] == "H"
        assert wbc["ref_low"] == 4.0
        assert wbc["ref_high"] == 10.0

        # Low HGB
        hgb = result["results"][1]
        assert hgb["test_code"] == "HGB"
        assert hgb["value"] == "9.5"
        assert hgb["flag"] == "L"

        # Normal PLT
        plt = result["results"][2]
        assert plt["flag"] == "N"

    def test_parse_patient_name(self):
        result = parse_hl7_message(SAMPLE_CBC_MESSAGE)
        assert result["patient"]["name"] == "Ahmed Khan"

    def test_parse_result_units(self):
        result = parse_hl7_message(SAMPLE_CBC_MESSAGE)
        wbc = result["results"][0]
        assert wbc["unit"] == "10*3/uL"

    def test_parse_minimal_message(self):
        result = parse_hl7_message(SAMPLE_MINIMAL_MESSAGE)
        assert result["patient"]["patient_id"] == "PAT003"
        assert result["sample"]["sample_id"] == "SAM003"
        assert len(result["results"]) == 1
        assert result["results"][0]["test_name"] == "Glucose"

    def test_parse_reference_range_values(self):
        result = parse_hl7_message(SAMPLE_CBC_MESSAGE)
        wbc = result["results"][0]
        assert wbc["ref_low"] == 4.0
        assert wbc["ref_high"] == 10.0
        assert wbc["reference_range"] == "4.0-10.0"

    def test_invalid_message_raises_error(self):
        with pytest.raises(ValueError, match="HL7 parsing error"):
            parse_hl7_message("")

    def test_raw_message_preserved(self):
        result = parse_hl7_message(SAMPLE_CBC_MESSAGE)
        assert "MSH|" in result["raw_message"]

    def test_result_status_field(self):
        result = parse_hl7_message(SAMPLE_CBC_MESSAGE)
        assert result["results"][0]["status"] == "F"  # Final


class TestReferenceRangeParsing:
    """Tests for reference range parsing utility."""

    def test_standard_range(self):
        assert _parse_reference_range("4.0-10.0") == (4.0, 10.0)

    def test_spaced_range(self):
        assert _parse_reference_range("4.0 - 10.0") == (4.0, 10.0)

    def test_less_than(self):
        assert _parse_reference_range("<10.0") == (None, 10.0)

    def test_greater_than(self):
        assert _parse_reference_range(">4.0") == (4.0, None)

    def test_empty_range(self):
        assert _parse_reference_range("") == (None, None)

    def test_none_range(self):
        assert _parse_reference_range(None) == (None, None)

    def test_integer_range(self):
        assert _parse_reference_range("150-400") == (150.0, 400.0)
