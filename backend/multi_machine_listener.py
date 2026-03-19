"""
Multi-Machine Listener — runs multiple serial/TCP listeners simultaneously.

Each machine gets its own listener thread. Configuration is defined in
MACHINE_CONFIG below. Add/remove machines as needed for each lab.
"""

from loguru import logger
from backend.serial_listener import SerialListener, TCPListener
from backend.message_processor import process_message


# =============================================
# MACHINE CONFIGURATION — Edit for each lab
# =============================================
MACHINE_CONFIG = [
    {
        "name": "Sysmex XN-1000",
        "type": "serial",
        "port": "COM3",
        "baud_rate": 9600,
        "department": "Hematology",
    },
    {
        "name": "Mindray BS-230",
        "type": "serial",
        "port": "COM4",
        "baud_rate": 9600,
        "department": "Biochemistry",
    },
    {
        "name": "Erba XL-200",
        "type": "serial",
        "port": "COM5",
        "baud_rate": 9600,
        "department": "Biochemistry",
    },
    {
        "name": "Roche Cobas e411",
        "type": "tcp",
        "host": "0.0.0.0",
        "port": 9100,
        "department": "Immunoassay",
    },
]


class MultiMachineManager:
    """Manages multiple machine listeners simultaneously."""

    def __init__(self, machines: list[dict] = None):
        self.machines = machines or MACHINE_CONFIG
        self.listeners = []

    def start_all(self):
        """Start listeners for all configured machines."""
        for machine in self.machines:
            try:
                name = machine["name"]
                dept = machine.get("department", "General")

                # Create a machine-specific message handler that tags the source
                def make_handler(machine_name):
                    def handler(raw_message):
                        logger.info("Message from [{}]", machine_name)
                        process_message(raw_message)
                    return handler

                if machine["type"] == "serial":
                    listener = SerialListener(
                        port=machine["port"],
                        baud_rate=machine.get("baud_rate", 9600),
                        on_message=make_handler(name),
                    )
                    listener.start()
                    self.listeners.append({"name": name, "dept": dept, "listener": listener})
                    logger.info("Started SERIAL listener: {} ({}) on {}",
                                name, dept, machine["port"])

                elif machine["type"] == "tcp":
                    listener = TCPListener(
                        host=machine.get("host", "0.0.0.0"),
                        port=machine["port"],
                        on_message=make_handler(name),
                    )
                    listener.start()
                    self.listeners.append({"name": name, "dept": dept, "listener": listener})
                    logger.info("Started TCP listener: {} ({}) on port {}",
                                name, dept, machine["port"])

            except Exception as e:
                logger.error("Failed to start listener for {}: {}", machine.get("name"), str(e))

        logger.info("Multi-machine manager: {}/{} listeners active",
                     len(self.listeners), len(self.machines))

    def stop_all(self):
        """Stop all running listeners."""
        for item in self.listeners:
            try:
                item["listener"].stop()
                logger.info("Stopped listener: {}", item["name"])
            except Exception as e:
                logger.error("Error stopping {}: {}", item["name"], str(e))
        self.listeners.clear()

    def status(self) -> list[dict]:
        """Get status of all listeners."""
        return [
            {"name": item["name"], "department": item["dept"], "active": True}
            for item in self.listeners
        ]


def main():
    """Start all machine listeners."""
    logger.info("Starting Multi-Machine Listener Manager...")

    manager = MultiMachineManager()
    manager.start_all()

    logger.info("All listeners running. Press Ctrl+C to stop.")
    try:
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down all listeners...")
        manager.stop_all()


if __name__ == "__main__":
    main()
