"""
Serial Port Listener for Blood Analyzer Machines.

Listens on a serial port (RS-232) for incoming HL7/ASTM messages,
detects complete messages, and dispatches them for processing.
Supports automatic reconnection on port disconnect.
"""

import os
import time
import threading
from datetime import datetime
from typing import Callable, Optional

import serial
from loguru import logger

from backend.config import get_settings


# ASTM/HL7 control characters
ENQ = b"\x05"  # Enquiry
ACK = b"\x06"  # Acknowledge
NAK = b"\x15"  # Negative Acknowledge
STX = b"\x02"  # Start of Text
ETX = b"\x03"  # End of Text
EOT = b"\x04"  # End of Transmission
ETB = b"\x17"  # End of Transmission Block
CR = b"\r"  # Carriage Return
LF = b"\n"  # Line Feed
FS = b"\x1c"  # File Separator (HL7 end of message)


class SerialListener:
    """
    Listens on a serial port for incoming messages from blood analyzer machines.

    Supports both HL7 (ending with \\x1c\\r) and ASTM (ENQ/ACK handshake) protocols.
    Runs as a background daemon thread with automatic reconnection.
    """

    def __init__(
        self,
        port: Optional[str] = None,
        baud_rate: Optional[int] = None,
        on_message: Optional[Callable[[str], None]] = None,
        log_dir: Optional[str] = None,
    ):
        settings = get_settings()
        self.port = port or settings.SERIAL_PORT
        self.baud_rate = baud_rate or settings.SERIAL_BAUD_RATE
        self.on_message = on_message or self._default_message_handler
        self.log_dir = log_dir or settings.LOG_DIR

        self._serial: Optional[serial.Serial] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._buffer = b""
        self._reconnect_delay = 5  # seconds

        # Setup logging directory
        os.makedirs(self.log_dir, exist_ok=True)
        self._setup_file_logger()

    def _setup_file_logger(self):
        """Configure file-based logging for raw serial data."""
        log_file = os.path.join(self.log_dir, "serial_{time:YYYY-MM-DD}.log")
        logger.add(
            log_file,
            rotation="1 day",
            retention="30 days",
            level="DEBUG",
            filter=lambda record: "serial_data" in record["extra"],
        )

    def start(self):
        """Start the serial listener in a background daemon thread."""
        if self._running:
            logger.warning("Serial listener is already running")
            return

        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="serial-listener")
        self._thread.start()
        logger.info("Serial listener started on {} at {} baud", self.port, self.baud_rate)

    def stop(self):
        """Stop the serial listener and close the port."""
        self._running = False
        if self._serial and self._serial.is_open:
            self._serial.close()
        if self._thread:
            self._thread.join(timeout=10)
        logger.info("Serial listener stopped")

    def _run_loop(self):
        """Main loop: connect, read, reconnect on failure."""
        while self._running:
            try:
                self._connect()
                self._read_loop()
            except serial.SerialException as e:
                logger.error("Serial port error: {}. Reconnecting in {}s...", str(e), self._reconnect_delay)
                self._close_port()
                time.sleep(self._reconnect_delay)
            except Exception as e:
                logger.error("Unexpected error in serial listener: {}", str(e))
                self._close_port()
                time.sleep(self._reconnect_delay)

    def _connect(self):
        """Open the serial port connection."""
        self._serial = serial.Serial(
            port=self.port,
            baudrate=self.baud_rate,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            timeout=1,  # 1 second read timeout
        )
        logger.info("Connected to serial port {}", self.port)
        self._buffer = b""

    def _close_port(self):
        """Safely close the serial port."""
        try:
            if self._serial and self._serial.is_open:
                self._serial.close()
        except Exception:
            pass
        self._serial = None

    def _read_loop(self):
        """Continuously read data from serial port and detect complete messages."""
        while self._running and self._serial and self._serial.is_open:
            try:
                # Read available data
                if self._serial.in_waiting > 0:
                    data = self._serial.read(self._serial.in_waiting)
                else:
                    data = self._serial.read(1)  # Blocking read with timeout

                if not data:
                    continue

                # Log raw data
                logger.bind(serial_data=True).debug(
                    "RAW [{}]: {}",
                    datetime.now().isoformat(),
                    data.hex(),
                )

                # Handle ASTM handshake
                if data == ENQ:
                    logger.info("Received ENQ - sending ACK")
                    self._serial.write(ACK)
                    continue

                if data == EOT:
                    logger.info("Received EOT - transmission complete")
                    if self._buffer:
                        self._dispatch_message()
                    continue

                # Accumulate data in buffer
                self._buffer += data

                # Check for complete HL7 message (ends with \x1c\r)
                if self._buffer.endswith(FS + CR) or self._buffer.endswith(FS + CR + LF):
                    self._dispatch_message()

                # Check for complete ASTM frame (STX...ETX/ETB + checksum + CR + LF)
                elif ETX in self._buffer or ETB in self._buffer:
                    # Send ACK for ASTM frame
                    self._serial.write(ACK)
                    # Check if this is end of full message
                    if ETX in self._buffer:
                        self._dispatch_message()

                # Check for simple CR-terminated message
                elif self._buffer.endswith(CR) and len(self._buffer) > 100:
                    # Only dispatch if buffer is substantial (avoid partial messages)
                    if b"MSH|" in self._buffer:
                        self._dispatch_message()

            except serial.SerialException:
                raise  # Let the outer loop handle reconnection
            except Exception as e:
                logger.error("Error reading serial data: {}", str(e))

    def _dispatch_message(self):
        """Process the accumulated buffer as a complete message."""
        if not self._buffer:
            return

        try:
            # Decode and clean the message
            message = self._buffer.decode("ascii", errors="replace")
            message = message.strip("\x0b\x1c\r\n")  # Strip HL7 wrapper chars

            if message:
                logger.info("Complete message received ({} bytes)", len(self._buffer))

                # Log complete message to file
                self._log_message_to_file(message)

                # Call the message handler
                self.on_message(message)

        except Exception as e:
            logger.error("Error dispatching message: {}", str(e))
        finally:
            self._buffer = b""

    def _log_message_to_file(self, message: str):
        """Log complete messages to a dedicated file."""
        log_file = os.path.join(self.log_dir, "messages.log")
        timestamp = datetime.now().isoformat()
        try:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(f"\n{'='*60}\n")
                f.write(f"Timestamp: {timestamp}\n")
                f.write(f"Port: {self.port}\n")
                f.write(f"Length: {len(message)} chars\n")
                f.write(f"{'='*60}\n")
                f.write(message)
                f.write(f"\n{'='*60}\n")
        except IOError as e:
            logger.error("Failed to write message log: {}", str(e))

    def _default_message_handler(self, message: str):
        """Default handler - just logs the message. Override with on_message callback."""
        logger.info("Received message ({} chars) - no handler configured", len(message))


class TCPListener:
    """
    Listens on a TCP socket for incoming HL7 messages.
    Many modern analyzers use TCP/IP instead of serial ports.
    """

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 2575,  # Standard HL7 MLLP port
        on_message: Optional[Callable[[str], None]] = None,
        log_dir: Optional[str] = None,
    ):
        import socket

        self.host = host
        self.port = port
        self.on_message = on_message or (lambda msg: logger.info("TCP message: {} bytes", len(msg)))
        self.log_dir = log_dir or get_settings().LOG_DIR

        self._socket: Optional[socket.socket] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None

        os.makedirs(self.log_dir, exist_ok=True)

    def start(self):
        """Start the TCP listener in a background thread."""
        import socket

        if self._running:
            return

        self._running = True
        self._socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._socket.bind((self.host, self.port))
        self._socket.listen(5)
        self._socket.settimeout(1)

        self._thread = threading.Thread(target=self._accept_loop, daemon=True, name="tcp-listener")
        self._thread.start()
        logger.info("TCP listener started on {}:{}", self.host, self.port)

    def stop(self):
        """Stop the TCP listener."""
        self._running = False
        if self._socket:
            self._socket.close()
        if self._thread:
            self._thread.join(timeout=10)
        logger.info("TCP listener stopped")

    def _accept_loop(self):
        """Accept incoming TCP connections."""
        import socket

        while self._running:
            try:
                client, addr = self._socket.accept()
                logger.info("TCP connection from {}", addr)
                handler = threading.Thread(
                    target=self._handle_client,
                    args=(client, addr),
                    daemon=True,
                )
                handler.start()
            except socket.timeout:
                continue
            except OSError:
                if self._running:
                    logger.error("TCP socket error")
                break

    def _handle_client(self, client, addr):
        """Handle a single TCP client connection (MLLP protocol)."""
        buffer = b""
        try:
            client.settimeout(30)
            while self._running:
                data = client.recv(4096)
                if not data:
                    break

                buffer += data

                # Check for complete MLLP message: \x0b ... \x1c\r
                while b"\x0b" in buffer and b"\x1c\r" in buffer:
                    start = buffer.index(b"\x0b")
                    end = buffer.index(b"\x1c\r") + 2

                    message = buffer[start + 1 : end - 2].decode("ascii", errors="replace")
                    buffer = buffer[end:]

                    if message:
                        logger.info("TCP message from {}: {} bytes", addr, len(message))
                        self.on_message(message)

                        # Send ACK
                        ack = b"\x0bMSH|^~\\&|LIS||ANALYZER||||||ACK||P|2.3\rMSA|AA\r\x1c\r"
                        client.send(ack)

        except Exception as e:
            logger.error("TCP client error from {}: {}", addr, str(e))
        finally:
            client.close()
