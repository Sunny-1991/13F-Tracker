#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import os
import re
import time
import urllib.error
import urllib.request
from email.utils import parsedate_to_datetime
from typing import Callable


_CONTACT_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_LAST_REQUEST_TS = 0.0
_UA_WARNED = False

DEFAULT_CONTACT_EMAIL = os.environ.get("SEC_CONTACT_EMAIL", "maintainer@example.com").strip() or "maintainer@example.com"
DEFAULT_USER_AGENT_PRODUCT = "13F-Tracker-AutoUpdate/1.0"
BLOCKED_EMAIL_DOMAIN_SUFFIXES = ("users.noreply.github.com", "noreply.github.com")


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


def _is_blocked_contact_email(email: str | None) -> bool:
    if not email or "@" not in email:
        return False
    domain = email.rsplit("@", 1)[-1].strip().lower()
    return any(domain.endswith(suffix) for suffix in BLOCKED_EMAIL_DOMAIN_SUFFIXES)


def normalize_user_agent(raw_user_agent: str) -> tuple[str, str | None]:
    compact = " ".join((raw_user_agent or "").split()).strip()
    if not compact:
        return f"{DEFAULT_USER_AGENT_PRODUCT} {DEFAULT_CONTACT_EMAIL}", "SEC_USER_AGENT empty, applied fallback format."

    contact_email = _extract_contact_email(compact)
    if contact_email and not _is_blocked_contact_email(contact_email):
        return compact, None

    base = compact
    if contact_email:
        base = base.replace(contact_email, " ")
    base = re.sub(r"[\(\)]", " ", base)
    base = re.sub(r"\bcontact\s*:\s*", " ", base, flags=re.IGNORECASE)
    base = re.sub(r"\s+", " ", base).strip()
    if not base:
        base = DEFAULT_USER_AGENT_PRODUCT

    normalized = f"{base} {DEFAULT_CONTACT_EMAIL}"
    if contact_email and _is_blocked_contact_email(contact_email):
        reason = f"SEC_USER_AGENT email domain blocked ({contact_email}); replaced with fallback contact."
    elif not contact_email:
        reason = "SEC_USER_AGENT missing contact email; appended fallback contact."
    else:
        reason = "SEC_USER_AGENT normalized to fallback contact."
    return normalized, reason


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
    global _UA_WARNED

    normalized_user_agent, ua_warning = normalize_user_agent(user_agent)
    if ua_warning and logger is not None and not _UA_WARNED:
        logger(f"[sec-http] {ua_warning}")
        logger(f"[sec-http] Using User-Agent: {normalized_user_agent}")
        _UA_WARNED = True

    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        _throttle(min_interval_seconds)
        request = urllib.request.Request(url, headers=_build_headers(normalized_user_agent, accept))
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
