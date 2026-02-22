#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import json
import pathlib


BASE_DIR = pathlib.Path(__file__).resolve().parents[1]
HISTORY_PATH = BASE_DIR / "data" / "sec-13f-history.json"
OUTPUT_PATH = BASE_DIR / "data" / "sec-13f-latest.json"


def latest_filing_of(filings: list[dict]) -> dict | None:
    if not filings:
        return None
    return max(
        filings,
        key=lambda row: (
            row.get("report_date", ""),
            row.get("filed_date", ""),
            row.get("accession", ""),
        ),
    )


def main() -> None:
    history_payload = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    managers = history_payload.get("managers", [])

    payload = {
        "generated_at_utc": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "source": "Derived from sec-13f-history.json (SEC EDGAR upstream)",
        "managers": [],
    }

    for manager in managers:
        latest = latest_filing_of(manager.get("filings", []))
        if latest is None:
            print(f"[warn] no filings for {manager.get('id')}")
            continue

        latest_filing = dict(latest)
        latest_filing.setdefault("entity_name", manager.get("sec_entity_name", ""))

        payload["managers"].append(
            {
                "id": manager.get("id"),
                "name": manager.get("name"),
                "org": manager.get("org"),
                "cik": manager.get("cik"),
                "sec_entity_name": manager.get("sec_entity_name"),
                "latest_filing": latest_filing,
            }
        )
        print(
            f"[ok] {manager.get('id')} {latest_filing.get('quarter')} holdings={latest_filing.get('holdings_count', 0)}"
        )

    if not payload["managers"]:
        raise RuntimeError("No manager latest filings generated from history dataset.")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
