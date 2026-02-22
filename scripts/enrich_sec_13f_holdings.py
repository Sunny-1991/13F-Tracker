#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import pathlib
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET


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
    last_error = None
    for attempt in range(1, 7):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json,text/xml,*/*",
                },
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            if b"Request Rate Threshold Exceeded" in data:
                raise RuntimeError("sec-rate-limit")
            time.sleep(0.15)
            return data
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, RuntimeError) as exc:
            last_error = exc
            wait_seconds = min(12, 1.8 * attempt)
            print(f"[retry {attempt}] {url} -> {exc}; wait {wait_seconds:.1f}s")
            time.sleep(wait_seconds)
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


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


def main() -> None:
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    by_name = choose_best_tickers()

    total_filings = sum(len(m.get("filings", [])) for m in payload.get("managers", []))
    filing_counter = 0
    share_success = 0
    share_failed = 0

    for manager in payload.get("managers", []):
        manager_id = manager.get("id")
        for filing in manager.get("filings", []):
            filing_counter += 1
            quarter = filing.get("quarter")
            info_table_url = filing.get("info_table_url", "")
            shares_by_code: dict[str, float] = {}
            if info_table_url:
                try:
                    xml_bytes = fetch_bytes(info_table_url)
                    shares_by_code = parse_info_table_shares(xml_bytes)
                    share_success += 1
                except Exception as exc:
                    share_failed += 1
                    print(f"[warn] shares fetch failed {manager_id} {quarter}: {exc}")

            for holding in filing.get("holdings", []):
                code = (holding.get("code") or "").strip()
                issuer = (holding.get("issuer") or "").strip()
                if code in shares_by_code:
                    holding["shares"] = normalize_shares_number(shares_by_code[code])
                elif "shares" not in holding:
                    holding["shares"] = None

                ticker = resolve_ticker(code, issuer, by_name)
                if ticker:
                    holding["ticker"] = ticker
                else:
                    holding.pop("ticker", None)

            print(f"[{filing_counter}/{total_filings}] {manager_id} {quarter} holdings={len(filing.get('holdings', []))}")

    payload["generated_at_utc"] = payload.get("generated_at_utc")
    payload["ticker_mapping_note"] = "Ticker resolved from SEC company_tickers_exchange.json plus local overrides."
    payload["shares_note"] = "shares parsed from infoTable shrsOrPrnAmt/sshPrnamt."

    DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {DATA_PATH}")
    print(f"Shares fetch success={share_success}, failed={share_failed}")


if __name__ == "__main__":
    main()
