"""Keep connection credentials out of Uvicorn's WebSocket handshake messages."""
import logging
import re

class ConnectionCredentialFilter(logging.Filter):
    def filter(self, record):
        message = record.getMessage()
        record.msg = re.sub(r'([?&](?:token|reconnect_token)=)[^&\s"\']+', r'\1[redacted]', message, flags=re.IGNORECASE)
        record.args = ()
        return True

def protect_connection_logs():
    for name in ("uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        if not any(isinstance(item, ConnectionCredentialFilter) for item in logger.filters):
            logger.addFilter(ConnectionCredentialFilter())
