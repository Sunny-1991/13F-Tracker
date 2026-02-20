# 13F Tracker

A two-step web dashboard for tracking institutional 13F portfolios from SEC EDGAR:

1. Institution card catalog
2. Institution detail page (holdings, pie chart, and quarter-over-quarter changes)

The app is a static frontend (`index.html` + `app.js` + `styles.css`) powered by local JSON data files generated from SEC filings.

## What You Can Do

- Browse institutions in a clean card grid
- Open any institution and review:
  - Quarterly holdings table
  - Interactive pie chart
  - Holdings net asset trend
  - Quarter-over-quarter add/trim ranking
- Compare SEC-reported holdings history back to 2016 (where available)
- Expand holdings lists beyond the default top rows

## Data Sources

- SEC EDGAR submissions and filing index
- SEC 13F information table XML files
- SEC ticker mapping file

Primary local data files:

- `data/sec-13f-history.json`
- `data/sec-13f-latest.json`

## Quick Start

### 1) Run the site locally

```bash
cd "/Users/coattail/Documents/New project/guru-13f-monitor"
./start-site.sh 9010
```

Open:

- `http://127.0.0.1:9010/`

### 2) Force refresh when UI changes

Use hard refresh in browser:

- macOS: `Cmd + Shift + R`

The project uses cache-busting query params in `index.html` (`?v=...`) for `app.js` and `styles.css`.

## Refresh SEC Data

From project root:

```bash
cd "/Users/coattail/Documents/New project/guru-13f-monitor"
```

### Fetch full history

```bash
/usr/bin/python3 scripts/fetch_sec_13f_history.py
```

### Fetch latest snapshot

```bash
/usr/bin/python3 scripts/fetch_sec_13f_latest.py
```

### Enrich holdings (ticker/share normalization helpers)

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

## Notes and Caveats

- 13F data is filing-based and can include reporting lags.
- Some filings contain multiple share classes, notes, warrants, or ADR forms for one issuer.
- The frontend includes de-duplication and label disambiguation logic for recurring SEC naming/ticker inconsistencies.
- Historic filing value units can differ across periods; normalization logic is applied in the app.

## Common Troubleshooting

- Page does not update after code changes:
  - Hard refresh (`Cmd + Shift + R`)
  - Confirm `index.html` references updated `?v=...` versions
- Wrong project appears on `127.0.0.1`:
  - Make sure you started this project directory, not another local server
- SEC fetch script rate-limit or network retries:
  - Re-run script and allow cooldown between runs

## Intended Audience

- Investors and research users who want a practical, visual monitor for major managers' 13F holdings and changes over time.
