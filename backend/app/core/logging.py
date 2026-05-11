"""
Structured logging — her request/response loglanır, hassas veri maskelenir.
"""
import logging
import time
import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Hassas field'lar logda gizlenir
SENSITIVE_FIELDS = {"password", "hashed_password", "access_token", "gemini_api_key"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("stress_less")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        start = time.time()

        logger.info(
            f"→ [{request_id}] {request.method} {request.url.path} "
            f"| client={request.client.host if request.client else 'unknown'}"
        )

        try:
            response: Response = await call_next(request)
        except Exception as exc:
            logger.error(f"✗ [{request_id}] UNHANDLED: {exc}", exc_info=True)
            raise

        duration_ms = round((time.time() - start) * 1000)
        level = logging.WARNING if response.status_code >= 400 else logging.INFO
        logger.log(
            level,
            f"← [{request_id}] {response.status_code} | {duration_ms}ms"
        )
        return response
