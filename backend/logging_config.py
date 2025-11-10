import logging
import re
from typing import Iterable


PHI_HINTS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"patient",
        r"diagnosis",
        r"mrn",
        r"ssn",
        r"dob",
        r"address",
    ]
]


class RedactingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        msg = super().format(record)
        for pattern in PHI_HINTS:
            if pattern.search(msg):
                msg = pattern.sub("[REDACTED]", msg)
        return msg


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setLevel(logging.INFO)
    handler.setFormatter(
        RedactingFormatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    )
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if not root.handlers:
        root.addHandler(handler)
