import logging
from app.logging_utils import ConnectionCredentialFilter

def test_websocket_query_credentials_are_redacted_after_log_formatting():
    record = logging.LogRecord("uvicorn.error",logging.INFO,"",0,'WebSocket %s [accepted]',
                               ("/ws/rooms/QA123?player_id=example&token=secret-value",),None)
    assert ConnectionCredentialFilter().filter(record)
    assert "secret-value" not in record.getMessage()
    assert "token=[redacted]" in record.getMessage()
    assert "player_id=example" in record.getMessage()


def test_access_formatter_keeps_typed_arguments_without_exposing_credentials():
    from uvicorn.logging import AccessFormatter
    record = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, '%s - "%s %s HTTP/%s" %d',
        ("127.0.0.1:1234", "GET", "/api/health?token=secret-value", "1.1", 200), None)
    ConnectionCredentialFilter().filter(record)
    formatted = AccessFormatter('%(client_addr)s - "%(request_line)s" %(status_code)s', use_colors=False).format(record)
    assert "secret-value" not in formatted and "token=[redacted]" in formatted
    assert "200 OK" in formatted
    assert len(record.args) == 5 and record.args[-1] == 200
