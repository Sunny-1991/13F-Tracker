# 13F Tracker

13F Tracker is a two-step, SEC-driven dashboard for monitoring leading institutions' US equity holdings from Form 13F filings.

It is built as a static web app (`index.html`, `app.js`, `styles.css`) with locally prepared SEC JSON datasets.

## Core Workflow

### Step 1: Institution Catalog

- Professional card grid for institution selection (3x3 layout)
- Founder avatars and style labels for quick recognition
- Popular Holdings Treemap:
  - Interactive hover/click behavior
  - Heat-based block sizing (coverage + average weight + aggregated value)
  - Focus mode to highlight institutions sharing the same holding

### Step 2: Institution Detail

- Quarter selector with automatic data refresh
- Official website entry (shown only when available)
- Portfolio Evolution & Style Snapshot:
  - Holdings net asset trend (interactive mountain chart)
  - Institution Style polygon vs S&P 500 benchmark
  - Segment table sorted by current segment weight
- Quarterly Holdings Overview:
  - Holdings table (default top 15, expandable to full list)
  - Interactive pie chart with hover labels
  - US ticker labels and cleaned company naming
- Quarter-over-Quarter Position Changes:
  - Add and Trim panels shown side by side
  - Ranked by trade amount
  - Share-count delta and change-rate indicators
- Snapshot export for the current detail view (non-expanded holdings layout)

## Data Coverage and Source

- Source: SEC EDGAR Form 13F filings
- Coverage target: quarterly history from 2016 onward (by institution availability)
- Main data files:
  - `data/sec-13f-history.json`
  - `data/sec-13f-latest.json`

## Heat Metric (Treemap)

Treemap block size uses a weighted heat score based on:

- Institution coverage count
- Average holding weight (averaged across all tracked institutions)
- Aggregated market value

Current weight mix in code:

- Coverage count: `0.3`
- Average holding weight: `0.4`
- Aggregated value: `0.3`

Additional nonlinear scaling and contrast normalization are applied so block-size differences are visually clearer.

## Quick Start

```bash
cd "/Users/coattail/Documents/New project/guru-13f-monitor"
./start-site.sh 9012
```

Open:

- `http://127.0.0.1:9012/`

If you use another port:

```bash
./start-site.sh 9010
```

## Data Update Scripts

From project root:

```bash
cd "/Users/coattail/Documents/New project/guru-13f-monitor"
```

Fetch full filing history:

```bash
/usr/bin/python3 scripts/fetch_sec_13f_history.py
```

Fetch latest filing snapshot:

```bash
/usr/bin/python3 scripts/fetch_sec_13f_latest.py
```

Run enrichment (ticker and holdings normalization helpers):

```bash
/usr/bin/python3 scripts/enrich_sec_13f_holdings.py
```

## Project Structure

```text
guru-13f-monitor/
  index.html
  app.js
  styles.css
  start-site.sh
  data/
    sec-13f-history.json
    sec-13f-latest.json
  scripts/
    fetch_sec_13f_history.py
    fetch_sec_13f_latest.py
    enrich_sec_13f_holdings.py
  assets/
    avatars/
```

## Troubleshooting

- Page shows old UI after edits:
  - Hard refresh in browser (`Cmd + Shift + R` on macOS)
  - Confirm version query params in `index.html` (`styles.css?v=...`, `app.js?v=...`)
- Wrong local project appears:
  - Ensure server is started from this project directory
  - Verify the URL/port matches the running server
- SEC fetch issues (rate limit/network):
  - Re-run scripts after a short cooldown

## Notes

- 13F is filing-based and inherently delayed versus real-time positions.
- Share classes, ADRs, and naming variants are normalized in the frontend/pipeline as much as possible.
- Historical SEC filing value scales may differ in old records; normalization is handled in app logic.
