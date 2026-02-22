#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import json
import pathlib
import time
import urllib.request
import xml.etree.ElementTree as ET

USER_AGENT = "guru13f-monitor/1.0 (contact: local-dev@example.com)"
BASE_DIR = pathlib.Path(__file__).resolve().parents[1]
OUTPUT_PATH = BASE_DIR / "data" / "sec-13f-latest.json"

MANAGERS = [
    {"id": "buffett", "name": "巴菲特", "org": "Berkshire Hathaway Inc", "cik": 1067983},
    {"id": "soros", "name": "索罗斯", "org": "Soros Fund Management LLC", "cik": 1029160},
    {"id": "duanyongping", "name": "段永平", "org": "H&H International Investment, LLC", "cik": 1759760},
    {"id": "bridgewater", "name": "桥水", "org": "Bridgewater Associates, LP", "cik": 1350694},
    {"id": "ark", "name": "ARK", "org": "ARK Investment Management LLC", "cik": 1697748},
    {"id": "softbank", "name": "软银", "org": "SoftBank Group Corp", "cik": 1065521},
    {"id": "pershing", "name": "Pershing Square", "org": "Pershing Square Capital Management, L.P.", "cik": 1336528},
    {"id": "himalaya", "name": "Himalaya", "org": "Himalaya Capital Management LLC", "cik": 1709323},
    {"id": "tigerglobal", "name": "Tiger Global", "org": "Tiger Global Management LLC", "cik": 1167483},
    {"id": "gates", "name": "Gates Foundation", "org": "Gates Foundation Trust", "cik": 1166559},
    {"id": "elliott", "name": "Elliott", "org": "Elliott Investment Management, L.P.", "cik": 1791786},
    {"id": "tci", "name": "TCI", "org": "TCI Fund Management Ltd", "cik": 1647251},
]


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json,text/xml,*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = resp.read()
    time.sleep(0.1)
    return data


def fetch_json(url: str) -> dict:
    return json.loads(fetch_bytes(url))


def quarter_from_date(date_str: str) -> str:
    y, m, _ = map(int, date_str.split("-"))
    q = (m - 1) // 3 + 1
    return f"{y}Q{q}"


def latest_13f_meta(cik: int) -> dict:
    j = fetch_json(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
    f = j["filings"]["recent"]
    for i, form in enumerate(f["form"]):
        if str(form) in ("13F-HR", "13F-HR/A"):
            return {
                "entity_name": j.get("name", ""),
                "form": f["form"][i],
                "accession": f["accessionNumber"][i],
                "filing_date": f["filingDate"][i],
                "report_date": f["reportDate"][i],
                "primary_doc": f["primaryDocument"][i],
                "quarter": quarter_from_date(f["reportDate"][i]),
            }
    raise RuntimeError(f"No 13F found for CIK {cik}")


def load_info_table(cik: int, accession: str) -> tuple[str, bytes]:
    nodash = accession.replace("-", "")
    idx = fetch_json(f"https://www.sec.gov/Archives/edgar/data/{cik}/{nodash}/index.json")
    for item in idx.get("directory", {}).get("item", []):
        name = item.get("name", "")
        if not name.lower().endswith(".xml") or name.lower() == "primary_doc.xml":
            continue
        url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{nodash}/{name}"
        raw = fetch_bytes(url)
        try:
            root = ET.fromstring(raw)
        except Exception:
            continue
        if root.tag.lower().endswith("informationtable"):
            return name, raw
    raise RuntimeError(f"No information table xml for {cik} {accession}")


def parse_info_table(xml_bytes: bytes) -> tuple[list[dict], int]:
    root = ET.fromstring(xml_bytes)
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"

    agg: dict[tuple[str, str], int] = {}
    for it in root.findall(f"{ns}infoTable"):
        issuer = (it.findtext(f"{ns}nameOfIssuer") or "").strip()
        code = (it.findtext(f"{ns}cusip") or "").strip() or issuer
        value_txt = (it.findtext(f"{ns}value") or "0").replace(",", "").strip()
        if not code:
            continue
        try:
            value = int(value_txt)
        except ValueError:
            continue
        key = (code, issuer)
        agg[key] = agg.get(key, 0) + value

    rows = [{"code": code, "issuer": issuer, "value_usd": value} for (code, issuer), value in agg.items()]
    rows.sort(key=lambda x: x["value_usd"], reverse=True)
    total = sum(r["value_usd"] for r in rows)
    for r in rows:
        r["weight"] = (r["value_usd"] / total) if total > 0 else 0
    return rows, total


def main() -> None:
    payload = {
        "generated_at_utc": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "source": "SEC EDGAR",
        "managers": [],
    }
    for manager in MANAGERS:
        cik = manager["cik"]
        meta = latest_13f_meta(cik)
        xml_name, xml_bytes = load_info_table(cik, meta["accession"])
        holdings, total = parse_info_table(xml_bytes)
        payload["managers"].append(
            {
                "id": manager["id"],
                "name": manager["name"],
                "org": manager["org"],
                "cik": f"{cik:010d}",
                "sec_entity_name": meta["entity_name"],
                "latest_filing": {
                    **meta,
                    "info_table_file": xml_name,
                    "holdings_count": len(holdings),
                    "total_value_usd": total,
                    "holdings": holdings,
                },
            }
        )
        print(f"[ok] {manager['id']} {meta['quarter']} holdings={len(holdings)}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
