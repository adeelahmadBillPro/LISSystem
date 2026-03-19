"""
Start the serial port listener as a standalone process.
Connects to blood analyzer machines and forwards results to the API.
"""

from loguru import logger
from backend.serial_listener import SerialListener
from backend.message_processor import process_message


def main():
    logger.info("Starting blood analyzer listener...")

    listener = SerialListener(on_message=process_message)
    listener.start()

    logger.info("Listener is running. Press Ctrl+C to stop.")
    try:
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        listener.stop()


if __name__ == "__main__":
    main()
