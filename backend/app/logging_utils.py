"""Keep connection credentials out of Uvicorn's WebSocket handshake messages."""
import logging
import re

class ConnectionCredentialFilter(logging.Filter):
    def filter(self, record):
        def redact(value):
            return re.sub(r'([?&](?:token|reconnect_token)=)[^&\s"\']+', r'\1[redacted]', value, flags=re.IGNORECASE) if isinstance(value, str) else value
        # AccessFormatter unpacks the five typed arguments itself. Preserve the
        # logging call's shape while sanitizing paths, rather than flattening it.
        record.msg = redact(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(redact(value) for value in record.args)
        elif isinstance(record.args, dict):
            record.args = {key: redact(value) for key, value in record.args.items()}
        return True

def protect_connection_logs():
    for name in ("uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        if not any(isinstance(item, ConnectionCredentialFilter) for item in logger.filters):
            logger.addFilter(ConnectionCredentialFilter())
