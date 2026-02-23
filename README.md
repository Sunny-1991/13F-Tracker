# 13F Tracker

13F Tracker is a SEC-driven dashboard for following major institutions' US equity holdings from Form 13F filings.

It is a static web app (`index.html`, `app.js`, `styles.css`) backed by locally prepared SEC JSON datasets.

- 中文文档: [`README.zh-CN.md`](./README.zh-CN.md)

## Highlights

- Two-step workflow: institution catalog -> institution detail
- Data-backed quarter selector per institution (uses each manager's actual available quarter range)
- Treemap with coverage/weight/value heat scoring and cross-institution focus mode
- Detailed holdings, quarter-over-quarter change rankings, and snapshot export
- Improved ticker normalization and style classification with SEC-centric fallbacks

## Product Workflow

### Step 1: Institution Catalog

- Institution cards with manager info, AUM snapshot, and style tags
- Search/filter by institution, manager, style, and major ticker keywords
- Popular holdings treemap:
  - Interactive hover + click focus
  - Unified ticker labels inside blocks
  - Focus mode to highlight institutions sharing the selected holding

### Step 2: Institution Detail

- Quarter selector (auto-limited to that institution's available SEC quarters)
- Official website links (when available)
- Portfolio evolution + style snapshot:
  - Holdings net asset trend chart
  - Institution style radar vs S&P 500 benchmark profile
- Quarterly holdings overview:
  - Holdings table (top 15 default, expandable)
  - Interactive pie with ticker/weight cues
- Quarter-over-quarter changes:
  - Add/Trim ranking panels
  - Share-count-aware change classification when possible
- One-click detail snapshot export (PNG)

## Data Coverage

- Source: SEC EDGAR 13F filings
- Coverage baseline: quarter history from `1999Q1` onward (institution-dependent)
- Main files:
  - `data/sec-13f-history.json`
  - `data/sec-13f-latest.json`

Current earliest quarter per tracked institution (from local dataset):

- Berkshire Hathaway: `1999Q1`
- Soros Fund Management: `1999Q1`
- Tiger Global: `2001Q4`
- Gates Foundation Trust: `2002Q3`
- Bridgewater: `2005Q4`
- Pershing Square: `2005Q4`
- SoftBank Group: `2013Q4`
- TCI: `2015Q2`
- ARK: `2016Q4`
- Himalaya: `2016Q4`
- H&H International (Duan Yongping): `2018Q4`
- Elliott: `2020Q1`

## Treemap Method

Treemap block area uses a heat metric with weighted components:

- Coverage count across institutions: `0.3`
- Average holding weight across institutions: `0.4`
- Aggregated market value: `0.3`

Additional nonlinear contrast scaling is applied so relative differences are easier to read.

## Institution Style Classification

Style radar currently uses 7 buckets:

- `technology`
- `financials`
- `consumer`
- `healthcare`
- `industrials`
- `energy`
- `other`

Classification logic combines several layers:

1. Direct ticker bucket mapping (`STYLE_BUCKET_BY_TICKER`)
2. CUSIP/issuer-to-ticker recovery and normalization
3. Keyword fallback from issuer/security class text
4. Broad benchmark ETF proxy allocation (e.g. SPY/IVV-style positions distributed by S&P 500 profile)
5. Exclusion of clear non-equity debt-like instruments (e.g. notes/bonds/loan-like classes) from style denominator

This substantially reduces artificial `other` spikes caused by raw SEC naming variance.

## Quick Start

```bash
git clone https://github.com/Sunny-1991/13F-Tracker.git
cd 13F-Tracker
./start-site.sh 9012
```

Open:

- `http://127.0.0.1:9012/`

Use another port if needed:

```bash
./start-site.sh 9010
```

## Data Refresh

From the repository root:

```bash
cd 13F-Tracker
```

Fetch full historical filings:

```bash
python3 scripts/fetch_sec_13f_history.py
```

Fetch latest snapshot payload:

```bash
python3 scripts/fetch_sec_13f_latest.py
```

Optional enrichment pass (ticker/shares helper pipeline):

```bash
python3 scripts/enrich_sec_13f_holdings.py
```

## Automated Quarterly Updates

This repository now includes a built-in GitHub Actions workflow:

- Workflow file: `.github/workflows/auto-update-sec-13f.yml`
- Trigger modes:
  - Weekly baseline refresh
  - Higher-frequency refresh during 13F due-month windows (Feb/May/Aug/Nov)
  - Manual trigger via `workflow_dispatch`
- Behavior:
  - Runs history/latest/enrichment scripts
  - Commits and pushes only when dataset files changed
  - Push target: `main`

Recommended setup:

1. Go to repository `Settings -> Secrets and variables -> Actions`.
2. Add secret `SEC_USER_AGENT` with a compliant SEC User-Agent string, for example:
   - `13F-Tracker-AutoUpdate/1.0 (contact: your-email@example.com)`
3. (Optional, recommended) Add secret `SEC_CONTACT_EMAIL` with a real contact mailbox.  
   The fetch layer auto-normalizes User-Agent and uses this as fallback contact.
4. Run the workflow manually once from the Actions tab to verify.

Important:

- Avoid GitHub no-reply mailbox domains (for example `users.noreply.github.com`) in SEC contact headers.
- The updater now auto-normalizes blocked/missing contact headers to keep jobs from failing with hard 403s.
- If SEC rejects live fetches, the history pipeline reuses cached filings so the job remains available.

## Project Structure

```text
guru-13f-monitor/
  .github/
    workflows/
      auto-update-sec-13f.yml
  index.html
  app.js
  styles.css
  start-site.sh
  data/
    sec-13f-history.json
    sec-13f-latest.json
  scripts/
    sec_http.py
    fetch_sec_13f_history.py
    fetch_sec_13f_latest.py
    enrich_sec_13f_holdings.py
  assets/
    avatars/
```

## Troubleshooting

- UI appears stale after code changes:
  - Hard refresh (`Cmd + Shift + R` on macOS)
  - Confirm cache-busting query versions in `index.html`
- Wrong project page is served:
  - Start server from this directory
  - Verify URL/port matches active process
- SEC fetch intermittency / rate-limit:
  - Wait briefly, then rerun fetch scripts

## Notes

- 13F is filing-based data and inherently delayed vs real-time positioning.
- Historical disclosures vary in formatting quality (ticker blank, naming drift, share-class noise).
- The app includes normalization logic, but unusual filings may still require mapping updates over time.
