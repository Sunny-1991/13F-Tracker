#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import re
import time
import urllib.error
import urllib.request
from email.utils import parsedate_to_datetime
from typing import Callable


_CONTACT_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_LAST_REQUEST_TS = 0.0


def _extract_contact_email(user_agent: str) -> str | None:
    match = _CONTACT_EMAIL_RE.search(user_agent or "")
    return match.group(0) if match else None


def _build_headers(user_agent: str, accept: str) -> dict[str, str]:
    headers = {
        "User-Agent": user_agent,
        "Accept": accept,
        "Accept-Language": "en-US,en;q=0.8",
        "Accept-Encoding": "identity",
        "Referer": "https://www.sec.gov/",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
    }
    contact_email = _extract_contact_email(user_agent)
    if contact_email:
        headers["From"] = contact_email
    return headers


def _parse_retry_after_seconds(raw_value: str | None) -> float | None:
    if not raw_value:
        return None

    value = raw_value.strip()
    if not value:
        return None

    if value.isdigit():
        return max(0.0, float(value))

    try:
        target = parsedate_to_datetime(value)
    except Exception:
        return None

    if target.tzinfo is None:
        target = target.replace(tzinfo=dt.timezone.utc)
    now = dt.datetime.now(dt.timezone.utc)
    return max(0.0, (target - now).total_seconds())


def _compute_wait_seconds(attempt: int, http_code: int | None, retry_after_seconds: float | None) -> float:
    if http_code in (403, 429):
        base = 4.0 + (attempt * 4.0)
    else:
        base = 1.5 * attempt
    wait_seconds = min(45.0, base)
    if retry_after_seconds is not None:
        wait_seconds = max(wait_seconds, min(60.0, retry_after_seconds))
    return wait_seconds


def _throttle(min_interval_seconds: float) -> None:
    global _LAST_REQUEST_TS

    now = time.monotonic()
    gap = (_LAST_REQUEST_TS + min_interval_seconds) - now
    if gap > 0:
        time.sleep(gap)
    _LAST_REQUEST_TS = time.monotonic()


def fetch_bytes(
    url: str,
    *,
    user_agent: str,
    accept: str = "application/json,text/xml,*/*",
    timeout: float = 60,
    max_attempts: int = 10,
    min_interval_seconds: float = 0.65,
    success_pause_seconds: float = 0.2,
    logger: Callable[[str], None] | None = print,
) -> bytes:
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        _throttle(min_interval_seconds)
        request = urllib.request.Request(url, headers=_build_headers(user_agent, accept))
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                data = response.read()
            if b"Request Rate Threshold Exceeded" in data:
                raise RuntimeError("sec-rate-limit")
            time.sleep(success_pause_seconds)
            return data
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise

            last_error = exc
            body = b""
            try:
                body = exc.read()
            except Exception:
                body = b""

            is_threshold = b"Request Rate Threshold Exceeded" in body
            retry_after = _parse_retry_after_seconds(exc.headers.get("Retry-After"))
            wait_seconds = _compute_wait_seconds(attempt, exc.code, retry_after)
            if logger is not None:
                detail = f"HTTP Error {exc.code}"
                if is_threshold:
                    detail += " (rate-limit)"
                logger(f"[retry {attempt}/{max_attempts}] {url} -> {detail}; wait {wait_seconds:.1f}s")
            time.sleep(wait_seconds)
        except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
            last_error = exc
            wait_seconds = _compute_wait_seconds(attempt, None, None)
            if logger is not None:
                logger(f"[retry {attempt}/{max_attempts}] {url} -> {exc}; wait {wait_seconds:.1f}s")
            time.sleep(wait_seconds)

    raise RuntimeError(f"Failed to fetch {url}: {last_error}")
