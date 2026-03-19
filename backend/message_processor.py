"""
Message Processor - bridges serial listener to database.

When a complete HL7/ASTM message arrives from a blood analyzer,
this module parses it and saves results to the database via the API.
"""

import requests
from loguru import logger

from backend.machine_adapter import detect_protocol
from backend.config import get_settings


API_BASE_URL = "http://localhost:8000"


def process_message(raw_message: str):
    """
    Process a raw message from a blood analyzer.
    Auto-detects protocol (HL7/ASTM/Custom) and parses accordingly.
    """
    try:
        adapter = detect_protocol(raw_message)
        parsed = adapter.parse(raw_message)
        logger.info(
            "Processing message: sample_id={}, results_count={}",
            parsed["sample"]["sample_id"],
            len(parsed["results"]),
        )

        # Build the batch payload
        payload = {
            "sample_id": parsed["sample"]["sample_id"],
            "machine_id": "SERIAL_ANALYZER",
            "patient_id": parsed["patient"]["patient_id"],
            "results": [
                {
                    "sample_id": parsed["sample"]["sample_id"],
                    "test_code": r["test_code"],
                    "test_name": r["test_name"],
                    "value": r["value"],
                    "unit": r["unit"],
                    "ref_low": r["ref_low"],
                    "ref_high": r["ref_high"],
                    "flag": r["flag"],
                }
                for r in parsed["results"]
            ],
        }

        # Send to API
        response = requests.post(f"{API_BASE_URL}/api/results", json=payload, timeout=10)
        if response.status_code in (200, 201):
            logger.info("Results saved successfully for sample {}", parsed["sample"]["sample_id"])
        else:
            logger.error("API error {}: {}", response.status_code, response.text)

    except ValueError as e:
        logger.error("Failed to parse message: {}", str(e))
    except requests.RequestException as e:
        logger.error("Failed to send results to API: {}", str(e))
    except Exception as e:
        logger.error("Unexpected error processing message: {}", str(e))
