from __future__ import annotations
import json, logging, sys
from datetime import UTC, datetime
from typing import Any
from app.core.request_id import current_request_id
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any]={'timestamp':datetime.now(UTC).isoformat(),'level':record.levelname,'logger':record.name,'message':record.getMessage()}
        if current_request_id(): payload['request_id']=current_request_id()
        if record.exc_info: payload['exception']=self.formatException(record.exc_info)
        return json.dumps(payload, sort_keys=True)
def configure_logging(level: str='INFO', json_logs: bool=True) -> None:
    root=logging.getLogger(); root.handlers.clear(); handler=logging.StreamHandler(sys.stdout); handler.setFormatter(JsonFormatter() if json_logs else logging.Formatter('%(levelname)s %(message)s')); root.addHandler(handler); root.setLevel(level.upper())
def get_logger(name: str) -> logging.Logger: return logging.getLogger(name)
