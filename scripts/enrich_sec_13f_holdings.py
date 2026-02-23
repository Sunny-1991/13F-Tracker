#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import pathlib
import re
import xml.etree.ElementTree as ET

from sec_http import fetch_bytes as fetch_sec_bytes

USER_AGENT = os.environ.get(
    "SEC_USER_AGENT",
    "13F-Tracker-AutoUpdate/1.0 (contact: maintainer@example.com)",
)
BASE_DIR = pathlib.Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "data" / "sec-13f-history.json"
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers_exchange.json"

MANUAL_CODE_TICKERS = {
    "060505104": "BAC",
    "22160K105": "COST",
    "949746101": "WFC",
    "674599105": "OXY",
    "002824100": "ABT",
    "G1151C101": "ACN",
    "459200101": "IBM",
    "882508104": "TXN",
    "369604301": "GE",
    "907818108": "UNP",
    "743315103": "PGR",
    "127387108": "CDNS",
    "94106L109": "WM",
    "452308109": "ITW",
    "26875P101": "EOG",
    "253868103": "DLR",
    "67103H107": "ORLY",
    "806857108": "SLB",
    "009158106": "APD",
    "45168D104": "IDXX",
    "56585A102": "MPC",
    "025537101": "AEP",
    "291011104": "EMR",
    "G51502105": "JCI",
    "744573106": "PEG",
    "192446102": "CTSH",
    "31620M106": "FIS",
    "370334104": "GIS",
    "609839105": "MPWR",
    "655844108": "NSC",
    "00724F101": "ADBE",
    "16119P108": "CHTR",
    "925652109": "VICI",
    "053484101": "AVB",
    "874039100": "TSM",
    "42809H107": "HES",
}

MANUAL_ISSUER_KEYWORDS = {
    "BANK AMER": "BAC",
    "BANK AMERICA": "BAC",
    "COSTCO WHSL": "COST",
    "WELLS FARGO": "WFC",
    "OCCIDENTAL PETE": "OXY",
    "ACCENTURE IRELAND": "ACN",
    "INTERNATIONAL BUSINESS MACHS": "IBM",
    "TEXAS INSTRS": "TXN",
    "UNION PAC": "UNP",
    "WASTE MGMT": "WM",
    "ILLINOIS TOOL WKS": "ITW",
    "DIGITAL RLTY": "DLR",
    "AIR PRODS CHEMS": "APD",
    "IDEXX LABS": "IDXX",
    "MARATHON PETE": "MPC",
    "AMERICAN ELEC PWR": "AEP",
    "EMERSON ELEC": "EMR",
    "GENERAL MLS": "GIS",
    "MONOLITHIC PWR SYS": "MPWR",
    "NORFOLK SOUTHN": "NSC",
}

GENERIC_PREFIXES = {
    "ISHARES",
    "SPDR",
    "VANGUARD",
    "INVESCO",
    "PROSHARES",
    "DIREXION",
    "FRANKLIN",
    "FIDELITY",
    "ARK",
}

STOPWORDS = {
    "INC",
    "INCORPORATED",
    "CORP",
    "CORPORATION",
    "COMPANY",
    "CO",
    "COS",
    "HOLDINGS",
    "HLDGS",
    "LIMITED",
    "LTD",
    "PLC",
    "LLC",
    "LP",
    "SA",
    "NV",
    "AG",
    "NEW",
    "THE",
    "GROUP",
    "HOLDING",
    "TRUST",
    "ETF",
    "ETN",
    "CL",
    "CLASS",
    "COM",
    "ORD",
    "SHS",
    "ADR",
    "SPONSORED",
    "DE",
    "DEL",
    "A",
    "B",
    "C",
    "N",
    "TR",
    "FUND",
    "SERIES",
}

TOKEN_REPLACEMENTS = {
    "INTL": "INTERNATIONAL",
    "MTRS": "MOTORS",
    "MATLS": "MATERIALS",
    "TECHS": "TECHNOLOGIES",
    "PPTY": "PROPERTY",
    "FINL": "FINANCIAL",
    "SYS": "SYSTEMS",
    "LABS": "LABORATORIES",
    "MGMT": "MANAGEMENT",
    "SVCS": "SERVICES",
    "ELEC": "ELECTRIC",
    "WKS": "WORKS",
    "CHEMS": "CHEMICALS",
    "PRODS": "PRODUCTS",
    "WHSL": "WHOLESALE",
    "CTLS": "CONTROLS",
}

EXCHANGE_PRIORITY = {
    "NYSE": 0,
    "Nasdaq": 1,
    "NYSE American": 2,
    "NYSE Arca": 3,
    "NYSEMKT": 4,
    "OTC": 9,
    None: 9,
}


def fetch_bytes(url: str) -> bytes:
    return fetch_sec_bytes(
        url,
        user_agent=USER_AGENT,
        timeout=75,
        max_attempts=5,
        min_interval_seconds=0.7,
        success_pause_seconds=0.2,
        logger=print,
    )


def normalize_issuer_name(value: str) -> str:
    text = value.upper().replace("&", " AND ")
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"[/.,\-]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    tokens = []
    for token in text.split():
        token = TOKEN_REPLACEMENTS.get(token, token)
        if token in STOPWORDS:
            continue
        tokens.append(token)
    return " ".join(tokens)


def looks_like_ticker(value: str) -> bool:
    text = (value or "").strip().upper()
    if not text:
        return False
    if re.fullmatch(r"[A-Z][A-Z0-9.\-]{0,6}", text):
        return True
    return False


def parse_float(text: str) -> float:
    if not text:
        return 0.0
    clean = text.replace(",", "").strip()
    if not clean:
        return 0.0
    return float(clean)


def parse_info_table_shares(xml_bytes: bytes) -> dict[str, float]:
    root = ET.fromstring(xml_bytes)
    if not root.tag.lower().endswith("informationtable"):
        return {}

    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"

    result: dict[str, float] = {}
    for item in root.findall(f"{ns}infoTable"):
        issuer = (item.findtext(f"{ns}nameOfIssuer") or "").strip()
        cusip = (item.findtext(f"{ns}cusip") or "").strip()
        code = cusip or issuer
        if not code:
            continue

        shares_node = item.find(f"{ns}shrsOrPrnAmt")
        if shares_node is None:
            continue
        shares_text = (shares_node.findtext(f"{ns}sshPrnamt") or "").strip()
        if not shares_text:
            continue
        try:
            shares = parse_float(shares_text)
        except ValueError:
            continue
        result[code] = result.get(code, 0.0) + shares
    return result


def choose_best_tickers() -> dict[str, str]:
    payload = json.loads(fetch_bytes(SEC_TICKERS_URL))
    best_by_name: dict[str, tuple[tuple[int, int, str], str]] = {}
    for row in payload.get("data", []):
        if len(row) < 4:
            continue
        _, name, ticker, exchange = row
        if not ticker:
            continue
        normalized = normalize_issuer_name(name or "")
        if not normalized:
            continue
        candidate = (EXCHANGE_PRIORITY.get(exchange, 8), len(ticker), ticker)
        current = best_by_name.get(normalized)
        if current is None or candidate < current[0]:
            best_by_name[normalized] = (candidate, ticker.replace(".", "-"))
    return {name: value[1] for name, value in best_by_name.items()}


def resolve_ticker(code: str, issuer: str, by_name: dict[str, str]) -> str:
    cleaned_code = (code or "").strip().upper()
    normalized_issuer = normalize_issuer_name(issuer or "")

    if cleaned_code in MANUAL_CODE_TICKERS:
        return MANUAL_CODE_TICKERS[cleaned_code]

    if looks_like_ticker(cleaned_code):
        return cleaned_code.replace(".", "-")

    for keyword, ticker in MANUAL_ISSUER_KEYWORDS.items():
        if keyword in normalized_issuer:
            return ticker

    first_token = normalized_issuer.split(" ", 1)[0] if normalized_issuer else ""
    if first_token in GENERIC_PREFIXES:
        return ""

    return by_name.get(normalized_issuer, "")


def normalize_shares_number(value: float):
    if abs(value - round(value)) < 1e-6:
        return int(round(value))
    return round(value, 4)


def build_cached_ticker_map(payload: dict) -> dict[str, str]:
    cached: dict[str, str] = {}
    for manager in payload.get("managers", []):
        for filing in manager.get("filings", []):
            for holding in filing.get("holdings", []):
                ticker = (holding.get("ticker") or "").strip().upper().replace(".", "-")
                issuer = (holding.get("issuer") or "").strip()
                if not ticker or not issuer:
                    continue
                normalized_issuer = normalize_issuer_name(issuer)
                if not normalized_issuer:
                    continue
                cached.setdefault(normalized_issuer, ticker)
    return cached


def normalize_ticker(value: str) -> str:
    return (value or "").strip().upper().replace(".", "-")


def filing_needs_ticker_update(filing: dict) -> bool:
    for holding in filing.get("holdings", []):
        if not normalize_ticker(holding.get("ticker") or ""):
            return True
    return False


LEGACY_NOISE_CODES = {
    "SPONSORED",
    "COMPANIES",
    "COMPANY",
    "SEPTEMBER",
    "JUNE",
    "MARCH",
    "DECEMBER",
}


def holding_value_usd(holding: dict) -> float:
    value = holding.get("value_usd")
    if isinstance(value, (int, float)):
        return float(value) if value > 0 else 0.0
    try:
        parsed = float(str(value).replace(",", "").strip())
        return parsed if parsed > 0 else 0.0
    except Exception:
        return 0.0


def holding_shares_count(holding: dict) -> float:
    shares = holding.get("shares")
    if isinstance(shares, (int, float)):
        return float(shares) if shares > 0 else 0.0
    try:
        parsed = float(str(shares).replace(",", "").strip())
        return parsed if parsed > 0 else 0.0
    except Exception:
        return 0.0


def is_legacy_noise_holding(holding: dict, filing_total_value: float) -> bool:
    code = str(holding.get("code") or "").strip().upper()
    if not code:
        return False

    has_digit = any(ch.isdigit() for ch in code)
    value = holding_value_usd(holding)
    shares = holding_shares_count(holding)

    if code in LEGACY_NOISE_CODES and not has_digit:
        if value <= 1000:
            return True
        if shares >= 1900 and shares <= 2105:
            return True
        if filing_total_value > 0 and value >= filing_total_value * 0.9:
            return True

    if not has_digit and len(code) >= 7 and filing_total_value > 0 and value >= filing_total_value * 0.9 and shares > 0:
        implied_value_per_share = value / shares
        if implied_value_per_share > 100000:
            return True

    return False


def filing_needs_sanitization(filing: dict) -> bool:
    holdings = filing.get("holdings", [])
    if not isinstance(holdings, list) or not holdings:
        return False
    filing_total = sum(holding_value_usd(holding) for holding in holdings)
    return any(is_legacy_noise_holding(holding, filing_total) for holding in holdings)


def sanitize_filing_holdings(filing: dict) -> int:
    holdings = filing.get("holdings", [])
    if not isinstance(holdings, list) or not holdings:
        return 0

    filing_total = sum(holding_value_usd(holding) for holding in holdings)
    sanitized: list[dict] = []
    removed = 0
    for holding in holdings:
        if is_legacy_noise_holding(holding, filing_total):
            removed += 1
            continue
        sanitized.append(holding)

    if removed == 0:
        return 0

    total_value = sum(holding_value_usd(holding) for holding in sanitized)
    for holding in sanitized:
        value = holding_value_usd(holding)
        holding["weight"] = (value / total_value) if total_value > 0 else 0

    filing["holdings"] = sanitized
    filing["holdings_count"] = len(sanitized)
    filing["total_value_usd"] = int(round(total_value))
    return removed


def main() -> None:
    refresh_shares = os.environ.get("REFRESH_SHARES_FROM_SEC", "").strip() == "1"
    original_text = DATA_PATH.read_text(encoding="utf-8")
    payload = json.loads(original_text)

    needs_ticker_updates = any(
        filing_needs_ticker_update(filing)
        for manager in payload.get("managers", [])
        for filing in manager.get("filings", [])
    )

    cached_tickers = build_cached_ticker_map(payload)
    by_name = dict(cached_tickers)
    if needs_ticker_updates:
        try:
            sec_tickers = choose_best_tickers()
            by_name.update(sec_tickers)
            print(f"[info] ticker map loaded from SEC ({len(sec_tickers)}), cached ({len(cached_tickers)})")
        except Exception as exc:
            print(f"[warn] ticker map fetch failed; using cached mappings only: {exc}")
    else:
        print(f"[info] no missing tickers detected; using cached ticker map only ({len(cached_tickers)})")

    total_filings = sum(len(m.get("filings", [])) for m in payload.get("managers", []))
    filing_counter = 0
    processed_filings = 0
    skipped_unchanged_filings = 0
    share_success = 0
    share_failed = 0
    share_skipped = 0
    ticker_updates = 0
    sanitized_rows_removed = 0

    for manager in payload.get("managers", []):
        manager_id = manager.get("id")
        for filing in manager.get("filings", []):
            filing_counter += 1
            quarter = filing.get("quarter")
            info_table_url = filing.get("info_table_url", "")
            needs_ticker_update = filing_needs_ticker_update(filing)
            needs_share_refresh = refresh_shares and bool(info_table_url)
            needs_sanitization = filing_needs_sanitization(filing)

            if not needs_ticker_update and not needs_share_refresh and not needs_sanitization:
                skipped_unchanged_filings += 1
                continue

            processed_filings += 1
            removed_noise_rows = sanitize_filing_holdings(filing)
            if removed_noise_rows:
                sanitized_rows_removed += removed_noise_rows

            shares_by_code: dict[str, float] = {}
            if needs_share_refresh:
                try:
                    xml_bytes = fetch_bytes(info_table_url)
                    shares_by_code = parse_info_table_shares(xml_bytes)
                    share_success += 1
                except Exception as exc:
                    share_failed += 1
                    print(f"[warn] shares fetch failed {manager_id} {quarter}: {exc}")
            elif not refresh_shares:
                share_skipped += 1

            for holding in filing.get("holdings", []):
                code = (holding.get("code") or "").strip()
                issuer = (holding.get("issuer") or "").strip()
                if code in shares_by_code:
                    next_shares = normalize_shares_number(shares_by_code[code])
                    if holding.get("shares") != next_shares:
                        holding["shares"] = next_shares
                elif "shares" not in holding:
                    holding["shares"] = None

                existing_ticker = normalize_ticker(holding.get("ticker") or "")
                if existing_ticker:
                    if holding.get("ticker") != existing_ticker:
                        holding["ticker"] = existing_ticker
                    continue

                ticker = normalize_ticker(resolve_ticker(code, issuer, by_name))
                if ticker:
                    holding["ticker"] = ticker
                    ticker_updates += 1
                elif "ticker" in holding:
                    holding.pop("ticker", None)

            print(f"[{filing_counter}/{total_filings}] {manager_id} {quarter} holdings={len(filing.get('holdings', []))}")

    payload["generated_at_utc"] = payload.get("generated_at_utc")
    ticker_mapping_note = (
        "Ticker resolved from SEC company_tickers_exchange.json when available, plus local overrides and cached fallback."
    )
    if payload.get("ticker_mapping_note") != ticker_mapping_note:
        payload["ticker_mapping_note"] = ticker_mapping_note

    if refresh_shares:
        shares_note = "shares refreshed from infoTable shrsOrPrnAmt/sshPrnamt when fetch succeeds."
    else:
        shares_note = "shares reused from history dataset; set REFRESH_SHARES_FROM_SEC=1 to force SEC re-fetch."
    if payload.get("shares_note") != shares_note:
        payload["shares_note"] = shares_note

    output_text = json.dumps(payload, ensure_ascii=False, indent=2)
    if output_text != original_text:
        DATA_PATH.write_text(output_text, encoding="utf-8")
        print(f"Wrote {DATA_PATH}")
    else:
        print(f"No file changes for {DATA_PATH}")

    print(
        f"Enrich summary: processed={processed_filings}, skipped={skipped_unchanged_filings}, ticker_updates={ticker_updates}, sanitized_rows={sanitized_rows_removed}"
    )
    if refresh_shares:
        print(f"Shares fetch success={share_success}, failed={share_failed}")
    else:
        print(f"Shares refresh skipped by default for {share_skipped} filings")


if __name__ == "__main__":
    main()
