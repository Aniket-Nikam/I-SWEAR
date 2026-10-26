import logging
from app.logging_utils import ConnectionCredentialFilter

def test_websocket_query_credentials_are_redacted_after_log_formatting():
    record = logging.LogRecord("uvicorn.error",logging.INFO,"",0,'WebSocket %s [accepted]',
                               ("/ws/rooms/QA123?player_id=example&token=secret-value",),None)
    assert ConnectionCredentialFilter().filter(record)
    assert "secret-value" not in record.getMessage()
    assert "token=[redacted]" in record.getMessage()
    assert "player_id=example" in record.getMessage()
