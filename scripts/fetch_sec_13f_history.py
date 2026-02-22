#!/usr/bin/env python3
"""
Fetch 13F holdings history from SEC EDGAR and write normalized JSON for the dashboard.

Usage:
  /usr/bin/python3 scripts/fetch_sec_13f_history.py
"""

from __future__ import annotations

import datetime as dt
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
OUTPUT_PATH = BASE_DIR / "data" / "sec-13f-history.json"

MIN_REPORT_DATE = dt.date(1999, 1, 1)

MANAGERS = [
    {
        "id": "buffett",
        "name": "巴菲特",
        "org": "Berkshire Hathaway Inc",
        "cik": 1067983,
        "disclosure": "13F-HR",
        "color": "#0f766e",
    },
    {
        "id": "soros",
        "name": "索罗斯",
        "org": "Soros Fund Management LLC",
        "cik": 1029160,
        "disclosure": "13F-HR",
        "color": "#1d4e89",
    },
    {
        "id": "duanyongping",
        "name": "段永平",
        "org": "H&H International Investment, LLC",
        "cik": 1759760,
        "disclosure": "13F-HR",
        "color": "#245f3a",
    },
    {
        "id": "bridgewater",
        "name": "桥水",
        "org": "Bridgewater Associates, LP",
        "cik": 1350694,
        "disclosure": "13F-HR",
        "color": "#255f99",
    },
    {
        "id": "ark",
        "name": "ARK",
        "org": "ARK Investment Management LLC",
        "cik": 1697748,
        "disclosure": "13F-HR",
        "color": "#3c58a8",
    },
    {
        "id": "softbank",
        "name": "软银",
        "org": "SoftBank Group Corp",
        "cik": 1065521,
        "disclosure": "13F-HR",
        "color": "#2f5f8a",
    },
    {
        "id": "pershing",
        "name": "Pershing Square",
        "org": "Pershing Square Capital Management, L.P.",
        "cik": 1336528,
        "disclosure": "13F-HR",
        "color": "#7b2f3a",
    },
    {
        "id": "himalaya",
        "name": "Himalaya",
        "org": "Himalaya Capital Management LLC",
        "cik": 1709323,
        "disclosure": "13F-HR",
        "color": "#4a5f27",
    },
    {
        "id": "tigerglobal",
        "name": "Tiger Global",
        "org": "Tiger Global Management LLC",
        "cik": 1167483,
        "disclosure": "13F-HR",
        "color": "#6b3b1f",
    },
    {
        "id": "gates",
        "name": "Gates Foundation",
        "org": "Gates Foundation Trust",
        "cik": 1166559,
        "disclosure": "13F-HR",
        "color": "#2e6f97",
    },
    {
        "id": "elliott",
        "name": "Elliott",
        "org": "Elliott Investment Management, L.P.",
        "cik": 1791786,
        "disclosure": "13F-HR",
        "color": "#7a3b79",
    },
    {
        "id": "tci",
        "name": "TCI",
        "org": "TCI Fund Management Ltd",
        "cik": 1647251,
        "disclosure": "13F-HR",
        "color": "#1f5d5b",
    },
]


def quarter_from_date(date_str: str) -> str:
    year, month, _ = map(int, date_str.split("-"))
    q = ((month - 1) // 3) + 1
    return f"{year}Q{q}"


def estimate_report_date_from_filing(filing_date: str) -> str:
    if not filing_date:
        return ""
    filing_dt = dt.date.fromisoformat(filing_date)
    if filing_dt.month <= 3:
        return f"{filing_dt.year - 1}-12-31"
    if filing_dt.month <= 6:
        return f"{filing_dt.year}-03-31"
    if filing_dt.month <= 9:
        return f"{filing_dt.year}-06-30"
    return f"{filing_dt.year}-09-30"


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

            time.sleep(0.12)
            return data
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise
            last_error = exc
            wait_seconds = min(12, 1.6 * attempt)
            print(f"[retry {attempt}] {url} -> {exc}; wait {wait_seconds:.1f}s")
            time.sleep(wait_seconds)
        except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
            last_error = exc
            wait_seconds = min(12, 1.6 * attempt)
            print(f"[retry {attempt}] {url} -> {exc}; wait {wait_seconds:.1f}s")
            time.sleep(wait_seconds)

    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def fetch_json(url: str) -> dict:
    return json.loads(fetch_bytes(url))


def submission_rows(submission_obj: dict) -> list[dict]:
    if "filings" in submission_obj and isinstance(submission_obj.get("filings"), dict):
        recent = submission_obj.get("filings", {}).get("recent", {})
    else:
        recent = submission_obj
    forms = recent.get("form", [])
    rows: list[dict] = []
    for i, form in enumerate(forms):
        rows.append(
            {
                "form": form or "",
                "accession": recent.get("accessionNumber", [""])[i] or "",
                "filing_date": recent.get("filingDate", [""])[i] or "",
                "report_date": recent.get("reportDate", [""])[i] or "",
                "primary_doc": recent.get("primaryDocument", [""])[i] or "",
            }
        )
    return rows


def load_all_submission_rows(cik: int) -> tuple[str, list[dict]]:
    cik_padded = f"{cik:010d}"
    base_url = f"https://data.sec.gov/submissions/CIK{cik_padded}.json"
    base_obj = fetch_json(base_url)
    entity_name = base_obj.get("name", "")

    rows = submission_rows(base_obj)
    for file_meta in base_obj.get("filings", {}).get("files", []):
        name = file_meta.get("name")
        if not name:
            continue
        extra_url = f"https://data.sec.gov/submissions/{name}"
        extra_obj = fetch_json(extra_url)
        rows.extend(submission_rows(extra_obj))

    dedup = {}
    for row in rows:
        acc = row["accession"]
        if acc:
            dedup[acc] = row

    return entity_name, list(dedup.values())


def choose_quarter_filings(rows: list[dict]) -> list[dict]:
    selected: list[dict] = []
    for row in rows:
        form = row["form"]
        if form not in ("13F-HR", "13F-HR/A"):
            continue
        filing_date = row["filing_date"]
        report_date = row["report_date"] or estimate_report_date_from_filing(filing_date)
        if not report_date or not filing_date:
            continue

        report_dt = dt.date.fromisoformat(report_date)
        if report_dt < MIN_REPORT_DATE:
            continue

        quarter = quarter_from_date(report_date)
        copied = dict(row)
        copied["quarter"] = quarter
        copied["report_date"] = report_date
        selected.append(copied)

    selected.sort(key=lambda x: (x["report_date"], x["filing_date"], x["accession"]))
    return selected


def parse_info_table_xml(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    if not root.tag.lower().endswith("informationtable"):
        return []

    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"

    aggregated: dict[str, dict] = {}
    for item in root.findall(f"{ns}infoTable"):
        issuer = (item.findtext(f"{ns}nameOfIssuer") or "").strip()
        cusip = (item.findtext(f"{ns}cusip") or "").strip()
        value_txt = (item.findtext(f"{ns}value") or "0").replace(",", "").strip()
        title_of_class = (item.findtext(f"{ns}titleOfClass") or "").strip()
        shares_txt = (item.findtext(f"{ns}shrsOrPrnAmt/{ns}sshPrnamt") or "").replace(",", "").strip()
        code = cusip or issuer
        if not code:
            continue
        try:
            value_usd = int(value_txt)
        except ValueError:
            continue
        shares = None
        if shares_txt:
            try:
                shares = int(float(shares_txt))
            except ValueError:
                shares = None

        if code not in aggregated:
            aggregated[code] = {
                "code": code,
                "cusip": cusip,
                "issuer": issuer,
                "title_of_class": title_of_class,
                "value_usd": 0,
                "shares": 0 if shares is not None else None,
            }
        aggregated[code]["value_usd"] += value_usd
        if shares is not None:
            if aggregated[code]["shares"] is None:
                aggregated[code]["shares"] = 0
            aggregated[code]["shares"] += shares

    holdings = list(aggregated.values())
    holdings.sort(key=lambda x: x["value_usd"], reverse=True)
    total_value = sum(x["value_usd"] for x in holdings)
    for h in holdings:
        h["weight"] = (h["value_usd"] / total_value) if total_value > 0 else 0
    return holdings


def split_issuer_and_class(prefix: str) -> tuple[str, str]:
    text = " ".join((prefix or "").split()).strip()
    if not text:
        return "", ""

    class_suffixes = [
        "SPONSORED ADR",
        "SPON ADR",
        "CL A",
        "CL B",
        "CL C",
        "CL D",
        "CLASS A",
        "CLASS B",
        "CLASS C",
        "CLASS D",
        "PREF SHS",
        "PFD",
        "ADR",
        "COM",
        "ORD",
        "UNIT",
        "SHS",
        "NOTE",
    ]
    upper = text.upper()
    for suffix in class_suffixes:
        if upper.endswith(f" {suffix}") or upper == suffix:
            title = suffix
            issuer = text[: -len(suffix)].strip()
            if not issuer:
                issuer = text
            return issuer, title
    return text, ""


def parse_info_table_legacy(raw_bytes: bytes) -> list[dict]:
    text = raw_bytes.decode("utf-8", "ignore")
    table_blocks = re.findall(r"<TABLE>(.*?)</TABLE>", text, flags=re.IGNORECASE | re.DOTALL)
    if not table_blocks:
        upper = text.upper()
        if "NAME OF ISSUER" in upper and "CUSIP" in upper:
            table_blocks = [text]

    aggregated: dict[str, dict] = {}

    def add_row(prefix: str, cusip: str, value_str: str, shares_str: str) -> None:
        clean_prefix = " ".join((prefix or "").replace(".", " ").split()).strip()
        issuer, title_of_class = split_issuer_and_class(clean_prefix)
        code = (cusip or issuer or "").strip()
        if not code:
            return
        try:
            value_usd = int(value_str.replace(",", ""))
        except ValueError:
            return
        shares = None
        try:
            shares = int(float(shares_str.replace(",", "")))
        except ValueError:
            shares = None

        if code not in aggregated:
            aggregated[code] = {
                "code": code,
                "cusip": cusip,
                "issuer": issuer or code,
                "title_of_class": title_of_class,
                "value_usd": 0,
                "shares": 0 if shares is not None else None,
            }
        aggregated[code]["value_usd"] += value_usd
        if shares is not None:
            if aggregated[code]["shares"] is None:
                aggregated[code]["shares"] = 0
            aggregated[code]["shares"] += shares

    full_row_pattern = re.compile(r"^(?P<prefix>.+?)\s+(?P<cusip>[0-9A-Z]{9})\s+(?P<value>[0-9,]+)\s+(?P<shares>[0-9,]+)\b")
    continuation_pattern = re.compile(r"^(?P<value>[0-9,]+)\s+(?P<shares>[0-9,]+)\b")

    for block in table_blocks:
        pending_name_parts: list[str] = []
        current_security: tuple[str, str] | None = None

        for raw_line in block.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            upper = line.upper()
            if line.startswith("<"):
                continue
            if upper.startswith("NAME OF ISSUER") or upper.startswith("VOTING AUTHORITY"):
                pending_name_parts = []
                continue
            if upper.startswith("MARKET VALUE") or upper.startswith("SHARES OR"):
                pending_name_parts = []
                continue
            if upper.startswith("<S>") or upper.startswith("REPORT SUMMARY"):
                pending_name_parts = []
                continue
            if upper.startswith("LIST OF OTHER INCLUDED MANAGERS"):
                pending_name_parts = []
                continue
            if upper.startswith("COLUMN "):
                pending_name_parts = []
                continue
            if "INVESTMENT" in upper and "DISCRETION" in upper:
                pending_name_parts = []
                continue
            if re.fullmatch(r"[-=*_\s]+", line):
                pending_name_parts = []
                continue

            normalized_line = re.sub(r"\b([0-9A-Z]{6})\s+([0-9A-Z]{2})\s+([0-9A-Z])\b", r"\1\2\3", line.upper())
            full_match = full_row_pattern.match(normalized_line)
            if full_match:
                combined_prefix = " ".join(
                    part for part in [*pending_name_parts, full_match.group("prefix")] if part
                )
                cusip = full_match.group("cusip")
                value_str = full_match.group("value")
                shares_str = full_match.group("shares")
                add_row(combined_prefix, cusip, value_str, shares_str)
                current_security = (combined_prefix, cusip)
                pending_name_parts = []
                continue

            cont_match = continuation_pattern.match(normalized_line)
            if cont_match and current_security:
                add_row(current_security[0], current_security[1], cont_match.group("value"), cont_match.group("shares"))
                continue

            pending_name_parts.append(line)

    holdings = list(aggregated.values())
    holdings.sort(key=lambda x: x["value_usd"], reverse=True)
    total_value = sum(x["value_usd"] for x in holdings)
    for h in holdings:
        h["weight"] = (h["value_usd"] / total_value) if total_value > 0 else 0
    return holdings


def load_holding_list(cik: int, accession: str) -> tuple[str, list[dict]]:
    cik_nozero = str(cik)
    accession_nodash = accession.replace("-", "")
    index_url = f"https://www.sec.gov/Archives/edgar/data/{cik_nozero}/{accession_nodash}/index.json"
    index_obj = fetch_json(index_url)
    items = index_obj.get("directory", {}).get("item", [])
    xml_candidates = [x.get("name", "") for x in items if x.get("name", "").lower().endswith(".xml")]

    best_xml_name = ""
    best_holdings: list[dict] = []
    best_score = (-1, -1)

    for xml_name in xml_candidates:
        if xml_name.lower() == "primary_doc.xml":
            continue
        xml_url = f"https://www.sec.gov/Archives/edgar/data/{cik_nozero}/{accession_nodash}/{xml_name}"
        try:
            holdings = parse_info_table_xml(fetch_bytes(xml_url))
        except Exception:
            holdings = []
        if not holdings:
            continue
        total_value = sum(h["value_usd"] for h in holdings)
        score = (len(holdings), total_value)
        if score > best_score:
            best_score = score
            best_xml_name = xml_name
            best_holdings = holdings

    if best_holdings:
        return best_xml_name, best_holdings

    text_candidates = [
        x.get("name", "")
        for x in items
        if x.get("name", "").lower().endswith((".txt", ".htm", ".html"))
        and "index-headers" not in x.get("name", "").lower()
        and not x.get("name", "").lower().endswith("-index.html")
    ]
    for text_name in text_candidates:
        text_url = f"https://www.sec.gov/Archives/edgar/data/{cik_nozero}/{accession_nodash}/{text_name}"
        try:
            holdings = parse_info_table_legacy(fetch_bytes(text_url))
        except Exception:
            holdings = []
        if not holdings:
            continue
        total_value = sum(h["value_usd"] for h in holdings)
        score = (len(holdings), total_value)
        if score > best_score:
            best_score = score
            best_xml_name = text_name
            best_holdings = holdings

    return best_xml_name, best_holdings


def manager_ciks(manager_def: dict) -> list[int]:
    raw = manager_def.get("ciks")
    if raw:
        ordered = []
        seen = set()
        for cik in raw:
            if cik not in seen:
                seen.add(cik)
                ordered.append(cik)
        return ordered
    return [manager_def["cik"]]


def build_filing_payload(cik: int, row: dict) -> dict:
    xml_name, holdings = load_holding_list(cik, row["accession"])
    total_value = sum(h["value_usd"] for h in holdings)
    accession_nodash = row["accession"].replace("-", "")
    return {
        "quarter": row["quarter"],
        "report_date": row["report_date"],
        "filed_date": row["filing_date"],
        "form": row["form"],
        "accession": row["accession"],
        "primary_doc": row["primary_doc"],
        "source_cik": f"{cik:010d}",
        "info_table_file": xml_name,
        "filing_url": f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_nodash}/{row['primary_doc']}",
        "info_table_url": (
            f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_nodash}/{xml_name}"
            if xml_name
            else ""
        ),
        "holdings_count": len(holdings),
        "total_value_usd": total_value,
        "holdings": holdings,
    }


def choose_best_by_quarter(filings: list[dict]) -> list[dict]:
    by_quarter: dict[str, dict] = {}
    for filing in filings:
        amend_score = 1 if filing["form"].endswith("/A") else 0
        score = (
            filing["total_value_usd"],
            filing["holdings_count"],
            filing["filed_date"],
            amend_score,
            filing["accession"],
        )
        current = by_quarter.get(filing["quarter"])
        if not current or score > current["_score"]:
            copied = dict(filing)
            copied["_score"] = score
            by_quarter[filing["quarter"]] = copied

    selected = list(by_quarter.values())
    selected.sort(key=lambda x: x["report_date"])
    for row in selected:
        row.pop("_score", None)
    return selected


def build_manager_payload(manager_def: dict) -> dict:
    ciks = manager_ciks(manager_def)
    entity_names: list[str] = []
    all_payload_rows: list[dict] = []
    total_ciks = len(ciks)

    for idx, cik in enumerate(ciks, start=1):
        print(f"    - [{idx}/{total_ciks}] CIK {cik:010d}")
        entity_name, rows = load_all_submission_rows(cik)
        if entity_name:
            entity_names.append(entity_name)
        filings = choose_quarter_filings(rows)
        for row in filings:
            all_payload_rows.append(build_filing_payload(cik, row))

    filing_payloads = choose_best_by_quarter(all_payload_rows)

    return {
        "id": manager_def["id"],
        "name": manager_def["name"],
        "org": manager_def["org"],
        "sec_entity_name": " | ".join(dict.fromkeys(entity_names)),
        "cik": f"{ciks[0]:010d}",
        "ciks": [f"{cik:010d}" for cik in ciks],
        "color": manager_def["color"],
        "disclosure": manager_def["disclosure"],
        "filings": filing_payloads,
    }


def main() -> None:
    only_manager_ids_raw = os.environ.get("ONLY_MANAGER_IDS", "").strip()
    if only_manager_ids_raw:
        wanted = {x.strip() for x in only_manager_ids_raw.split(",") if x.strip()}
        manager_defs = [m for m in MANAGERS if m["id"] in wanted]
    else:
        manager_defs = MANAGERS

    managers = []
    total = len(manager_defs)
    for idx, manager_def in enumerate(manager_defs, start=1):
        ciks = manager_ciks(manager_def)
        if len(ciks) == 1:
            cik_desc = f"CIK {ciks[0]:010d}"
        else:
            cik_desc = f"{len(ciks)} CIKs"
        print(f"[{idx}/{total}] Fetching {manager_def['org']} ({cik_desc}) ...")
        payload = build_manager_payload(manager_def)
        managers.append(payload)
        print(f"[{idx}/{total}] Done {manager_def['name']}: {len(payload['filings'])} quarters")
    quarters = sorted(
        {f["quarter"] for m in managers for f in m["filings"]},
        key=lambda q: (int(q[:4]), int(q[-1])),
    )

    payload = {
        "generated_at_utc": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "source": "SEC EDGAR (data.sec.gov + sec.gov/Archives)",
        "note": "Nancy Pelosi does not file Form 13F as an institutional investment manager; no SEC 13F dataset is included for her.",
        "quarters": quarters,
        "managers": managers,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    for manager in managers:
        latest = manager["filings"][-1] if manager["filings"] else None
        if not latest:
            print(f"- {manager['name']}: no filings")
            continue
        print(
            f"- {manager['name']}: {len(manager['filings'])} filings, latest {latest['quarter']} filed {latest['filed_date']} ({latest['accession']})"
        )


if __name__ == "__main__":
    main()
