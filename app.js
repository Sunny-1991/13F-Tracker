const START_YEAR = 2016;
const END_YEAR = 2025;

function createQuarterRange(startYear, endYear) {
  const quarters = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (let q = 1; q <= 4; q += 1) {
      quarters.push(`${year}Q${q}`);
    }
  }
  return quarters;
}

const QUARTERS = createQuarterRange(START_YEAR, END_YEAR);
const LATEST_QUARTER = QUARTERS[QUARTERS.length - 1];
const QUARTER_INDEX = new Map(QUARTERS.map((quarter, idx) => [quarter, idx]));

function quarterIndex(quarter) {
  return QUARTER_INDEX.has(quarter) ? QUARTER_INDEX.get(quarter) : -1;
}

function parseQuarter(quarter) {
  return {
    year: Number(quarter.slice(0, 4)),
    q: Number(quarter.slice(5)),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function round(value, digits = 2) {
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateLabel(text, maxLength) {
  const value = String(text || "").trim();
  if (!value || value.length <= maxLength) {
    return value;
  }
  if (maxLength <= 1) {
    return value.slice(0, 1);
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

function fitTextSize(text, maxWidth, minSize, maxSize, charFactor = 0.56) {
  const safe = String(text || "").trim();
  if (!safe) {
    return minSize;
  }
  const length = Math.max(1, safe.length);
  const widthBound = maxWidth / (length * charFactor);
  return clamp(widthBound, minSize, maxSize);
}

function formatB(value) {
  const digits = value >= 100 ? 1 : value >= 10 ? 2 : 3;
  return `${round(value, digits).toLocaleString()}`;
}

function formatPct(value, digits = 1, signed = false) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${round(value * 100, digits)}%`;
}

function standardDeviation(values) {
  const nums = (values || []).filter((value) => Number.isFinite(value));
  if (!nums.length) {
    return 0;
  }
  const mean = nums.reduce((acc, value) => acc + value, 0) / nums.length;
  const variance = nums.reduce((acc, value) => acc + (value - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function getValuationUnit(totalInBillion) {
  if (totalInBillion >= 50) {
    return { label: "USD Billions", divisor: 1, digits: 2, short: "B" };
  }
  if (totalInBillion >= 1) {
    return { label: "USD 100M", divisor: 0.1, digits: 1, short: "100M" };
  }
  return { label: "USD Millions", divisor: 0.001, digits: 1, short: "M" };
}

function formatByUnit(valueInBillion, unit) {
  return round(valueInBillion / unit.divisor, unit.digits).toLocaleString();
}

function formatDeltaByUnit(valueInBillion, unit) {
  const sign = valueInBillion > 0 ? "+" : "-";
  const absValue = round(Math.abs(valueInBillion) / unit.divisor, unit.digits);
  return `${sign}${absValue}${unit.short}`;
}

function formatQuarter(quarter) {
  const year = quarter.slice(0, 4);
  const q = quarter.slice(4);
  return `${year} ${q}`;
}

function formatAssetLabel(company, ticker) {
  const safeCompany = (company || "").trim();
  const safeTicker = (ticker || "").trim();
  if (!safeCompany && !safeTicker) {
    return "--";
  }
  if (!safeTicker) {
    return safeCompany;
  }
  if (!safeCompany || safeCompany === safeTicker) {
    return safeTicker;
  }
  return `${safeCompany} (${safeTicker})`;
}

function toTitleCase(text) {
  return text
    .toLowerCase()
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function cleanCompanyName(company) {
  let text = (company || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }

  text = text.replace(
    /\bCOM\b(?=\s+(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|PLC|LLC|LP|LTD|DEL|DELAWARE|NEW)\b)/gi,
    ""
  );
  text = text.replace(
    /\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|PLC|LLC|LP|LTD|DEL|DELAWARE|NEW)\b/gi,
    ""
  );
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/\bCom\b/gi, "").replace(/\s+/g, " ").trim();

  if (/^[A-Z0-9 .,&'/-]+$/.test(text)) {
    text = toTitleCase(text);
  }

  return text || (company || "").trim();
}

function extractClassTag(securityClass) {
  const raw = (securityClass || "").trim();
  if (!raw) {
    return "";
  }
  const upper = raw.toUpperCase();
  if (/\bNOTE\b/.test(upper)) {
    const noteDetail = upper.match(/\bNOTE\s+([0-9][0-9.%/ ]+)/);
    if (noteDetail && noteDetail[1]) {
      return `NOTE ${noteDetail[1].replace(/\s+/g, " ").trim()}`;
    }
    return "NOTE";
  }
  if (/\bW(?:T|TS|ARRANT|\/SH)\b|\*W EXP/.test(upper)) {
    const wtExp = upper.match(/\bEXP\s+([0-9/]+)/);
    if (wtExp && wtExp[1]) {
      return `WT ${wtExp[1]}`;
    }
    return "WT";
  }
  if (/\bUNIT\b/.test(upper)) {
    return "UNIT";
  }
  if (/\bPFD|PREF\b/.test(upper)) {
    return "PFD";
  }
  if (/\bADR\b/.test(upper)) {
    return "ADR";
  }
  const classMatch = upper.match(/\b(?:CLASS|CL|SERIES|SER|SHS\s+SER|S)\s*([A-Z])\b/);
  if (classMatch && classMatch[1] && /^[A-Z]$/.test(classMatch[1])) {
    const letter = classMatch[1];
    if (/\bFRMLA\b/.test(upper)) {
      return `${letter} (FRMLA)`;
    }
    if (/\bLBTY\s+LIV\b|\bLIBERTY\s+LIVE\b/.test(upper)) {
      return `${letter} (LIV)`;
    }
    if (/\bLBTY\s+SRM\b|\bSIRIUSXM\b/.test(upper)) {
      return `${letter} (SXM)`;
    }
    if (/\bLILAC\b/.test(upper)) {
      return `${letter} (LILAC)`;
    }
    if (/\bMEDIA\b/.test(upper)) {
      return `${letter} (MEDIA)`;
    }
    return letter;
  }
  return "";
}

function formatAssetLabelWithClass(company, ticker, securityClass) {
  const base = formatAssetLabel(cleanCompanyName(company), ticker);
  const classTag = extractClassTag(securityClass);
  if (!classTag) {
    return base;
  }
  return `${base} · ${classTag}`;
}

function getHoldingDisplayLabel(item) {
  if (item && item.displayLabel) {
    return item.displayLabel;
  }
  return formatAssetLabelWithClass(item?.company, item?.ticker, item?.securityClass);
}

function formatCusipHint(code) {
  const normalized = (code || "").trim().toUpperCase();
  if (!normalized) {
    return "";
  }
  if (/^[A-Z0-9]{9}$/.test(normalized)) {
    return `CUSIP ${normalized.slice(-4)}`;
  }
  return normalized.length > 10 ? normalized.slice(0, 10) : normalized;
}

function applyUniqueHoldingLabels(holdings) {
  const baseLabelCount = new Map();
  holdings.forEach((item) => {
    const baseLabel = formatAssetLabelWithClass(item.company, item.ticker, item.securityClass);
    item.displayLabel = baseLabel;
    baseLabelCount.set(baseLabel, (baseLabelCount.get(baseLabel) || 0) + 1);
  });

  const used = new Set();
  holdings.forEach((item) => {
    const baseLabel = item.displayLabel;
    if ((baseLabelCount.get(baseLabel) || 0) <= 1) {
      used.add(baseLabel);
      return;
    }

    const hint = formatCusipHint(item.code);
    let candidate = hint ? `${baseLabel} · ${hint}` : `${baseLabel} · Holding`;
    let bump = 2;
    while (used.has(candidate)) {
      candidate = `${hint ? `${baseLabel} · ${hint}` : `${baseLabel} · Holding`} #${bump}`;
      bump += 1;
    }
    item.displayLabel = candidate;
    used.add(candidate);
  });
}

function looksLikeUsTicker(value) {
  const text = (value || "").trim().toUpperCase();
  if (!text) {
    return false;
  }
  return /^[A-Z][A-Z0-9.-]{0,6}$/.test(text);
}

const CUSIP_TICKER_OVERRIDES = {
  "02079K107": "GOOG",
  "02079K305": "GOOGL",
  "98954M101": "ZG",
  "98954M200": "Z",
  "G5480U104": "LBTYA",
  "G5480U120": "LBTYK",
  "G5480U138": "LILAA",
  "G5480U153": "LILAK",
  "G9001E102": "LILA",
  "G9001E128": "LILAK",
  "30303M102": "META",
  "88160R101": "TSLA",
  "82509L107": "SHOP",
  "77543R102": "ROKU",
  "19260Q107": "COIN",
  "69608A108": "PLTR",
  H17182108: "CRSP",
  "007903107": "AMD",
  "770700102": "HOOD",
  "880770102": "TER",
  "88023B103": "TEM",
  "771049103": "RBLX",
  "872590104": "TMUS",
  "458140100": "INTC",
  "87151X101": "SYM",
  "90138L109": "XXI",
  "874039100": "TSM",
  G4R20B107: "INTR",
  G5279N105: "KLAR",
  "94845U105": "WBTN",
  "78468R556": "SPY",
  "84921RAB6": "SPOT",
  "548661107": "LOW",
  "902973304": "USB",
  "46090E103": "QQQ",
  "78463V107": "GLD",
  "72766Q105": "PAH",
  N31738102: "FCAU",
  "339041105": "FLT",
  "23331A109": "DHI",
  "85207U105": "S",
  "053015103": "ADP",
  "46185L103": "NVTA",
  "90184L102": "TWTR",
  "741503403": "BKNG",
  "13646K108": "CP",
  "127686103": "CZR",
  "31816QAB7": "FEYE",
  "021346101": "AABA",
  "04685W103": "ATHN",
  "67020YAF7": "NUAN",
  G81477104: "SINA",
  "13645T100": "CP",
  "913017109": "UTX",
  "46612JAF8": "JDSU",
  "28106W103": "EDIT",
  "91911K102": "VRX",
  G46188101: "HZNP",
  G27358103: "DESP",
  "90214J101": "TWOU",
  G47567105: "INFO",
  "464285105": "IAU",
  "88032Q109": "TCEHY",
  "00507V109": "ATVI",
  "743713109": "PRLB",
  "73935A104": "QQQ",
  G11196105: "BHVN",
  "96209A104": "WE",
  "26886C107": "EQRX",
  "983919101": "XLNX",
  "017175100": "Y",
  "48205A109": "JUNO",
  N00985106: "AER",
  "07373V105": "BEAM",
  "067901108": "GOLD",
  "16117M305": "CHTR",
  "264411505": "DRE",
  "848637104": "SPLK",
  "156782104": "CERN",
  "26916J106": "GWH",
  "92556H206": "VIAB",
  "92339V308": "VER",
  "024835100": "ACC",
  "09173T108": "GBTC",
  "151020104": "CELG",
  "500767306": "KWEB",
  "96145D105": "WRK",
  "52603B107": "TREE",
  "67020Y100": "NUAN",
  "63009R109": "NSTG",
  "90184D100": "TWST",
  "440894103": "HDP",
  "58471A105": "MDSO",
  "922042858": "VWO",
  "690370101": "OSTK",
  "37940XAU6": "GPN",
  "12768T103": "CACQ",
  "46123DAB2": "INVN",
  "81763UAB6": "SREV",
  "345370CZ1": "F",
  "780153BB7": "RCL",
  "779376AD4": "ROVI",
  "M78465107": "PTNR",
  G0698L103: "AURC",
};

const ISSUER_TICKER_OVERRIDES = {
  "LOWES COS": "LOW",
  "US BANCORP": "USB",
  "INVESCO QQQ": "QQQ",
  "SPDR GOLD TRUST": "GLD",
  "FIAT CHRYSLER AUTOMOBILES": "FCAU",
  "FLEETCOR TECHNOLOGIES": "FLT",
  "D R HORTON": "DHI",
  "SPRINT CORP": "S",
  "SPRINT CORPORATION": "S",
  "AUTOMATIC DATA PROCESSING": "ADP",
  INVITAE: "NVTA",
  TWITTER: "TWTR",
  "PRICELINE GRP": "BKNG",
  "BOOKING HOLDINGS": "BKNG",
  "CAESARS ENTMT": "CZR",
  FIREEYE: "FEYE",
  ALTABA: "AABA",
  ATHENAHEALTH: "ATHN",
  "NUANCE COMMUNICATIONS": "NUAN",
  "SINA CORP": "SINA",
  "CANADIAN PAC RY": "CP",
  "CANADIAN PACIFIC KANSAS CITY": "CP",
  "UNITED TECHNOLOGIES": "UTX",
  "JDS UNIPHASE": "JDSU",
  "EDITAS MEDICINE": "EDIT",
  "VALEANT PHARMACEUTICALS INTL": "VRX",
  "HORIZON THERAPEUTICS": "HZNP",
  DESPEGAR: "DESP",
  "2U INC": "TWOU",
  "IHS MARKIT": "INFO",
  "ISHARES GOLD TRUST": "IAU",
  "TENCENT HOLDINGS": "TCEHY",
  "ACTIVISION BLIZZARD": "ATVI",
  "PROTO LABS": "PRLB",
  "BIOHAVEN PHARMACTL HLDG": "BHVN",
  "WEWORK INC": "WE",
  "EQRX INC": "EQRX",
  "XILINX INC": "XLNX",
  "ALLEGHANY CORP": "Y",
  "JUNO THERAPEUTICS": "JUNO",
  "AERCAP HOLDINGS": "AER",
  "BEAM THERAPEUTICS": "BEAM",
  "BARRICK GOLD": "GOLD",
  "CHARTER COMMUNICATIONS": "CHTR",
  "DUKE REALTY": "DRE",
  "SPLUNK INC": "SPLK",
  "CERNER CORP": "CERN",
  "ESS TECH": "GWH",
  "VIACOMCBS INC": "VIAB",
  VEREIT: "VER",
  "AMERICAN CAMPUS": "ACC",
  "BITCOIN INVESTMENT TRUST": "GBTC",
  "CELGENE CORP": "CELG",
  KRANESHARES: "KWEB",
  "WESTROCK CO": "WRK",
  LENDINGTREE: "TREE",
  "NANOSTRING TECHNOLOGIES": "NSTG",
  "TWIST BIOSCIENCE": "TWST",
  HORTONWORKS: "HDP",
  "MEDIDATA SOLUTIONS": "MDSO",
  "VANGUARD INTL EQUITY INDEX": "VWO",
  "OVERSTOCK COM": "OSTK",
  "GLOBAL PMTS": "GPN",
  "CAESARS ACQUISITION": "CACQ",
  INVENSENSE: "INVN",
  SERVICESOURCE: "SREV",
  "FORD MTR": "F",
  "ROYAL CARIBBEAN GROUP": "RCL",
  "ROVI CORP": "ROVI",
  "PARTNER COMMUNICATIONS": "PTNR",
  "AURORA ACQUISITION": "AURC",
};

const ISSUER_TICKER_STOPWORDS = new Set([
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
]);

const ISSUER_TICKER_TOKEN_REPLACEMENTS = {
  INTL: "INTERNATIONAL",
  MTRS: "MOTORS",
  MATLS: "MATERIALS",
  TECHS: "TECHNOLOGIES",
  PPTY: "PROPERTY",
  FINL: "FINANCIAL",
  SYS: "SYSTEMS",
  LABS: "LABORATORIES",
  MGMT: "MANAGEMENT",
  SVCS: "SERVICES",
  ELEC: "ELECTRIC",
  WKS: "WORKS",
  CHEMS: "CHEMICALS",
  PRODS: "PRODUCTS",
  WHSL: "WHOLESALE",
  CTLS: "CONTROLS",
};

function normalizeIssuerForTicker(value) {
  const text = (value || "").toUpperCase().replace(/&/g, " AND ");
  const compact = text
    .replace(/\([^)]*\)/g, " ")
    .replace(/[\/.,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) {
    return "";
  }
  const tokens = compact
    .split(" ")
    .map((token) => ISSUER_TICKER_TOKEN_REPLACEMENTS[token] || token)
    .filter((token) => token && !ISSUER_TICKER_STOPWORDS.has(token));
  return tokens.join(" ").trim();
}

function bestTickerFromVotes(voteMap) {
  const candidates = Array.from(voteMap.entries());
  if (!candidates.length) {
    return "";
  }
  candidates.sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    if (a[0].length !== b[0].length) {
      return a[0].length - b[0].length;
    }
    return a[0].localeCompare(b[0]);
  });
  return candidates[0][0];
}

function buildDerivedSecTickerMaps(managers) {
  const votesByCode = new Map();
  const votesByIssuer = new Map();

  (managers || []).forEach((manager) => {
    (manager.filings || []).forEach((filing) => {
      (filing.holdings || []).forEach((item) => {
        const code = (item.code || item.cusip || "").trim().toUpperCase();
        const rawTicker = (item.ticker || "").trim().toUpperCase().replace(/\./g, "-");
        const normalizedCode = code.replace(/\./g, "-");
        const seededTicker = CUSIP_TICKER_OVERRIDES[code] || "";
        const ticker = seededTicker
          ? seededTicker
          : looksLikeUsTicker(rawTicker)
            ? rawTicker
            : looksLikeUsTicker(normalizedCode)
              ? normalizedCode
              : "";
        if (!ticker) {
          return;
        }

        if (code) {
          if (!votesByCode.has(code)) {
            votesByCode.set(code, new Map());
          }
          const codeVotes = votesByCode.get(code);
          codeVotes.set(ticker, (codeVotes.get(ticker) || 0) + 1);
        }

        const issuerKey = normalizeIssuerForTicker(item.issuer || "");
        if (issuerKey) {
          if (!votesByIssuer.has(issuerKey)) {
            votesByIssuer.set(issuerKey, new Map());
          }
          const issuerVotes = votesByIssuer.get(issuerKey);
          issuerVotes.set(ticker, (issuerVotes.get(ticker) || 0) + 1);
        }
      });
    });
  });

  const byCode = new Map();
  votesByCode.forEach((voteMap, code) => {
    const best = bestTickerFromVotes(voteMap);
    if (best) {
      byCode.set(code, best);
    }
  });

  const byIssuer = new Map();
  votesByIssuer.forEach((voteMap, issuerKey) => {
    const best = bestTickerFromVotes(voteMap);
    if (best) {
      byIssuer.set(issuerKey, best);
    }
  });

  return { byCode, byIssuer };
}

function polarToCartesian(cx, cy, radius, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function buildPieSlicePath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${round(cx, 2)} ${round(cy, 2)} L ${round(start.x, 2)} ${round(start.y, 2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${round(end.x, 2)} ${round(end.y, 2)} Z`;
}

function makeRangeSeries({
  start,
  end,
  amp = 0,
  phase = 0,
  freq = 0.36,
  curve = 1,
  min = -Infinity,
  max = Infinity,
  decimals = 3,
}) {
  const size = QUARTERS.length;
  const span = Math.max(1, size - 1);
  const values = [];

  for (let idx = 0; idx < size; idx += 1) {
    const t = idx / span;
    const base = lerp(start, end, t ** curve);
    const wave = amp * Math.sin(idx * freq + phase) + amp * 0.42 * Math.cos(idx * freq * 0.63 + phase * 0.7);
    values.push(round(clamp(base + wave, min, max), decimals));
  }

  return values;
}

function makeIntSeries(spec) {
  return makeRangeSeries({ ...spec, decimals: 0 }).map((value) => Math.round(value));
}

function marketShock(year, q, beta = 1) {
  let shock = 0;
  if (year === 2018 && q === 4) {
    shock -= 0.03;
  }
  if (year === 2020 && q === 1) {
    shock -= 0.11;
  }
  if (year === 2020 && q === 2) {
    shock -= 0.05;
  }
  if (year === 2020 && q === 3) {
    shock += 0.08;
  }
  if (year === 2020 && q === 4) {
    shock += 0.04;
  }
  if (year === 2022) {
    shock -= 0.022;
  }
  if (year === 2023 && q <= 2) {
    shock += 0.02;
  }
  if (year === 2024 && q >= 2) {
    shock += 0.012;
  }
  return shock * beta;
}

function makeNavSeries({ avg, amp, phase = 0, freq = 0.53, shockBeta = 1 }) {
  const values = [1];

  for (let idx = 1; idx < QUARTERS.length; idx += 1) {
    const { year, q } = parseQuarter(QUARTERS[idx]);
    const cycle = amp * Math.sin(idx * freq + phase);
    const cycle2 = amp * 0.45 * Math.cos(idx * 0.19 + phase * 0.8);
    let quarterReturn = avg + cycle + cycle2 + marketShock(year, q, shockBeta);
    quarterReturn = clamp(quarterReturn, -0.28, 0.27);
    values.push(round(Math.max(values[idx - 1] * (1 + quarterReturn), 0.35), 4));
  }

  return values;
}

function makeWeightSeries(spec) {
  const values = Array(QUARTERS.length).fill(0);
  const startIdx = spec.appearAt ? quarterIndex(spec.appearAt) : 0;
  const endIdx = spec.disappearAt ? quarterIndex(spec.disappearAt) : QUARTERS.length - 1;
  const safeStart = startIdx >= 0 ? startIdx : 0;
  const safeEnd = endIdx >= safeStart ? endIdx : QUARTERS.length - 1;
  const span = Math.max(1, safeEnd - safeStart);

  for (let idx = safeStart; idx <= safeEnd; idx += 1) {
    const t = (idx - safeStart) / span;
    const base = lerp(spec.start, spec.end, t ** (spec.curve || 1));
    const wave = (spec.amp || 0) * Math.sin((idx - safeStart) * (spec.freq || 0.43) + (spec.phase || 0));
    values[idx] = round(clamp(base + wave, spec.min || 0, spec.max || 0.58), 4);
  }

  return values;
}

function buildWeightMap(weightSpecs, maxTrackedWeight = 0.88) {
  const weights = {};
  Object.entries(weightSpecs).forEach(([ticker, spec]) => {
    weights[ticker] = makeWeightSeries(spec);
  });

  for (let idx = 0; idx < QUARTERS.length; idx += 1) {
    const tickers = Object.keys(weights);
    const sum = tickers.reduce((acc, ticker) => acc + weights[ticker][idx], 0);
    if (sum > maxTrackedWeight) {
      const scale = maxTrackedWeight / sum;
      tickers.forEach((ticker) => {
        weights[ticker][idx] = round(weights[ticker][idx] * scale, 4);
      });
    }
  }

  return weights;
}

function buildInvestor(def) {
  return {
    id: def.id,
    name: def.name,
    org: def.org,
    manager: def.manager || "",
    disclosure: def.disclosure,
    color: def.color,
    filedLagDays: def.filedLagDays,
    names: def.names,
    nav: makeNavSeries(def.nav),
    aum: makeRangeSeries({ ...def.aum, min: 0.02, decimals: 3 }),
    positionCounts: makeIntSeries({ ...def.positions, min: 4, max: 260 }),
    weights: buildWeightMap(def.weightSpecs, def.maxTrackedWeight || 0.88),
  };
}

const INVESTOR_DEFS = [
  {
    id: "buffett",
    name: "Buffett",
    org: "Berkshire Hathaway",
    disclosure: "13F-HR",
    color: "#0f766e",
    filedLagDays: 45,
    nav: { avg: 0.019, amp: 0.028, phase: 0.4, shockBeta: 0.85 },
    aum: { start: 121, end: 381, amp: 8.8, phase: 0.6, curve: 1.06 },
    positions: { start: 68, end: 42, amp: 2.8, phase: 0.8, curve: 1.1 },
    maxTrackedWeight: 0.9,
    names: {
      AAPL: "Apple",
      AXP: "American Express",
      BAC: "Bank of America",
      KO: "Coca-Cola",
      CVX: "Chevron",
      OXY: "Occidental",
      MCO: "Moody's",
      KHC: "Kraft Heinz",
      AMZN: "Amazon",
      DVA: "DaVita",
      HPQ: "HP",
      SIRI: "Sirius XM",
    },
    weightSpecs: {
      AAPL: { start: 0.21, end: 0.36, amp: 0.013, phase: 0.2 },
      AXP: { start: 0.05, end: 0.15, amp: 0.009, phase: 1.1 },
      BAC: { start: 0.16, end: 0.07, amp: 0.011, phase: 1.7 },
      KO: { start: 0.08, end: 0.08, amp: 0.004, phase: 0.9 },
      CVX: { start: 0.03, end: 0.07, amp: 0.008, phase: 1.8, appearAt: "2018Q1" },
      OXY: { start: 0.02, end: 0.1, amp: 0.01, phase: 0.5, appearAt: "2020Q3" },
      MCO: { start: 0.02, end: 0.04, amp: 0.005, phase: 1.3 },
      KHC: { start: 0.1, end: 0.03, amp: 0.008, phase: 2.1 },
      AMZN: { start: 0.01, end: 0.02, amp: 0.004, phase: 0.9 },
      DVA: { start: 0.03, end: 0.025, amp: 0.004, phase: 1.4 },
      HPQ: { start: 0.04, end: 0.015, amp: 0.005, phase: 2.4 },
      SIRI: { start: 0.012, end: 0.018, amp: 0.003, phase: 2.9 },
    },
  },
  {
    id: "soros",
    name: "Soros",
    org: "Soros Fund Management",
    disclosure: "13F-HR",
    color: "#1d4e89",
    filedLagDays: 43,
    nav: { avg: 0.024, amp: 0.055, phase: 0.9, shockBeta: 1.28 },
    aum: { start: 2.9, end: 8.0, amp: 0.42, phase: 1.2, curve: 1.1 },
    positions: { start: 180, end: 103, amp: 7, phase: 0.5, curve: 1.07 },
    maxTrackedWeight: 0.87,
    names: {
      NVDA: "NVIDIA",
      AMZN: "Amazon",
      MSFT: "Microsoft",
      GOOGL: "Alphabet",
      TSLA: "Tesla",
      SMCI: "Super Micro",
      QQQ: "Invesco QQQ",
      PLTR: "Palantir",
      META: "Meta",
      NFLX: "Netflix",
      ADBE: "Adobe",
      XLF: "Financial Select Sector SPDR",
    },
    weightSpecs: {
      NVDA: { start: 0.04, end: 0.18, amp: 0.014, phase: 0.3 },
      AMZN: { start: 0.05, end: 0.12, amp: 0.01, phase: 1.2 },
      MSFT: { start: 0.06, end: 0.11, amp: 0.008, phase: 1.7 },
      GOOGL: { start: 0.05, end: 0.1, amp: 0.009, phase: 2.1 },
      TSLA: { start: 0.03, end: 0.06, amp: 0.012, phase: 2.5 },
      SMCI: { start: 0.01, end: 0.04, amp: 0.009, phase: 1.6, appearAt: "2023Q1" },
      QQQ: { start: 0.04, end: 0.05, amp: 0.006, phase: 0.8 },
      PLTR: { start: 0.01, end: 0.05, amp: 0.01, phase: 2.8, appearAt: "2021Q1" },
      META: { start: 0.04, end: 0.07, amp: 0.009, phase: 1.9 },
      NFLX: { start: 0.03, end: 0.05, amp: 0.007, phase: 2.3 },
      ADBE: { start: 0.03, end: 0.04, amp: 0.006, phase: 0.7 },
      XLF: { start: 0.02, end: 0.03, amp: 0.004, phase: 2.7 },
    },
  },
  {
    id: "duanyongping",
    name: "Duan Yongping",
    org: "H&H International Investment, LLC",
    disclosure: "13F-HR",
    color: "#245f3a",
    filedLagDays: 46,
    nav: { avg: 0.026, amp: 0.044, phase: 0.5, shockBeta: 1.02 },
    aum: { start: 2.6, end: 12.2, amp: 0.58, phase: 1.1, curve: 1.12 },
    positions: { start: 9, end: 13, amp: 1.1, phase: 2.3, curve: 1.05 },
    maxTrackedWeight: 0.88,
    names: {
      AAPL: "Apple",
      "BRK.B": "Berkshire B",
      PDD: "PDD",
      TSM: "TSMC",
      META: "Meta",
      GOOGL: "Alphabet",
      BABA: "Alibaba",
      JD: "JD.com",
      BIDU: "Baidu",
      NTES: "NetEase",
      PYPL: "PayPal",
      QCOM: "Qualcomm",
    },
    weightSpecs: {
      AAPL: { start: 0.17, end: 0.28, amp: 0.014, phase: 0.4 },
      "BRK.B": { start: 0.14, end: 0.17, amp: 0.009, phase: 2.0 },
      PDD: { start: 0.04, end: 0.18, amp: 0.012, phase: 1.2 },
      TSM: { start: 0.15, end: 0.09, amp: 0.01, phase: 2.8 },
      META: { start: 0.03, end: 0.1, amp: 0.01, phase: 1.7 },
      GOOGL: { start: 0.1, end: 0.05, amp: 0.008, phase: 2.4 },
      BABA: { start: 0.11, end: 0.03, amp: 0.012, phase: 0.9 },
      JD: { start: 0.05, end: 0.02, amp: 0.006, phase: 2.2 },
      BIDU: { start: 0.07, end: 0.03, amp: 0.008, phase: 1.4 },
      NTES: { start: 0.05, end: 0.04, amp: 0.007, phase: 2.8 },
      PYPL: { start: 0.03, end: 0.02, amp: 0.005, phase: 0.8, appearAt: "2018Q1" },
      QCOM: { start: 0.03, end: 0.04, amp: 0.006, phase: 2.1 },
    },
  },
  {
    id: "bridgewater",
    name: "Bridgewater",
    org: "Bridgewater Associates, LP",
    disclosure: "13F-HR",
    color: "#255f99",
    filedLagDays: 44,
    nav: { avg: 0.017, amp: 0.037, phase: 0.8, shockBeta: 1.08 },
    aum: { start: 45, end: 27.4, amp: 2.8, phase: 0.9, curve: 0.96 },
    positions: { start: 620, end: 740, amp: 28, phase: 1.1, curve: 1.02 },
    maxTrackedWeight: 0.86,
    names: {
      SPY: "SPDR S&P 500 ETF",
      IVV: "iShares Core S&P 500",
      NVDA: "NVIDIA",
      LRCX: "Lam Research",
      CRM: "Salesforce",
      GOOGL: "Alphabet A",
      MSFT: "Microsoft",
      AMZN: "Amazon",
      ADBE: "Adobe",
      GEV: "GE Vernova",
      BKNG: "Booking",
      AVGO: "Broadcom",
    },
    weightSpecs: {
      SPY: { start: 0.16, end: 0.11, amp: 0.012, phase: 1.2 },
      IVV: { start: 0.08, end: 0.1, amp: 0.011, phase: 2.3, appearAt: "2018Q1" },
      NVDA: { start: 0.02, end: 0.026, amp: 0.006, phase: 0.6 },
      LRCX: { start: 0.012, end: 0.019, amp: 0.004, phase: 2.6 },
      CRM: { start: 0.011, end: 0.019, amp: 0.004, phase: 1.9 },
      GOOGL: { start: 0.016, end: 0.018, amp: 0.005, phase: 0.4 },
      MSFT: { start: 0.012, end: 0.017, amp: 0.004, phase: 1.6 },
      AMZN: { start: 0.012, end: 0.016, amp: 0.004, phase: 2.1 },
      ADBE: { start: 0.011, end: 0.016, amp: 0.003, phase: 2.8 },
      GEV: { start: 0.0, end: 0.016, amp: 0.003, phase: 1.7, appearAt: "2024Q2" },
      BKNG: { start: 0.013, end: 0.015, amp: 0.003, phase: 2.4 },
      AVGO: { start: 0.008, end: 0.014, amp: 0.003, phase: 0.8 },
    },
  },
  {
    id: "ark",
    name: "ARK",
    org: "ARK Investment Management LLC",
    disclosure: "13F-HR",
    color: "#3c58a8",
    filedLagDays: 45,
    nav: { avg: 0.028, amp: 0.082, phase: 1.4, shockBeta: 1.48 },
    aum: { start: 5.2, end: 20.4, amp: 1.1, phase: 0.7, curve: 1.15 },
    positions: { start: 32, end: 48, amp: 4.8, phase: 2.0, curve: 1.06 },
    maxTrackedWeight: 0.9,
    names: {
      TSLA: "Tesla",
      ROKU: "Roku",
      COIN: "Coinbase",
      CRSP: "CRISPR Therapeutics",
      SQ: "Block",
      PATH: "UiPath",
      U: "Unity",
      ZM: "Zoom",
      SHOP: "Shopify",
      NTLA: "Intellia",
      HOOD: "Robinhood",
      PLTR: "Palantir",
    },
    weightSpecs: {
      TSLA: { start: 0.14, end: 0.15, amp: 0.012, phase: 1.2 },
      ROKU: { start: 0.08, end: 0.09, amp: 0.01, phase: 0.9 },
      COIN: { start: 0.0, end: 0.08, amp: 0.012, phase: 2.1, appearAt: "2021Q2" },
      CRSP: { start: 0.06, end: 0.07, amp: 0.009, phase: 1.5 },
      SQ: { start: 0.08, end: 0.06, amp: 0.008, phase: 2.8 },
      PATH: { start: 0.0, end: 0.06, amp: 0.008, phase: 1.9, appearAt: "2021Q1" },
      U: { start: 0.0, end: 0.05, amp: 0.008, phase: 0.6, appearAt: "2020Q4" },
      ZM: { start: 0.0, end: 0.05, amp: 0.009, phase: 2.4, appearAt: "2020Q3" },
      SHOP: { start: 0.05, end: 0.04, amp: 0.007, phase: 2.2 },
      NTLA: { start: 0.03, end: 0.04, amp: 0.006, phase: 1.1 },
      HOOD: { start: 0.0, end: 0.03, amp: 0.006, phase: 2.7, appearAt: "2024Q2" },
      PLTR: { start: 0.0, end: 0.03, amp: 0.006, phase: 0.5, appearAt: "2023Q3" },
    },
  },
  {
    id: "softbank",
    name: "SoftBank",
    org: "SoftBank Group Corp",
    disclosure: "13F-HR",
    color: "#2f5f8a",
    filedLagDays: 46,
    nav: { avg: 0.023, amp: 0.068, phase: 0.9, shockBeta: 1.24 },
    aum: { start: 18.0, end: 66.0, amp: 3.0, phase: 1.1, curve: 1.1 },
    positions: { start: 28, end: 56, amp: 3.2, phase: 2.0, curve: 1.06 },
    maxTrackedWeight: 0.9,
    names: {
      BABA: "Alibaba",
      TMUS: "T-Mobile US",
      DTEGY: "Deutsche Telekom",
      NVDA: "NVIDIA",
      ARM: "Arm Holdings",
      DASH: "DoorDash",
      UBER: "Uber",
      CRWD: "CrowdStrike",
      AMZN: "Amazon",
      MSFT: "Microsoft",
      QCOM: "Qualcomm",
      PLTR: "Palantir",
    },
    weightSpecs: {
      BABA: { start: 0.26, end: 0.08, amp: 0.014, phase: 0.9 },
      TMUS: { start: 0.04, end: 0.12, amp: 0.009, phase: 2.3, appearAt: "2018Q1" },
      DTEGY: { start: 0.0, end: 0.08, amp: 0.008, phase: 1.4, appearAt: "2019Q1" },
      NVDA: { start: 0.02, end: 0.11, amp: 0.012, phase: 2.6, appearAt: "2017Q4" },
      ARM: { start: 0.0, end: 0.1, amp: 0.012, phase: 1.3, appearAt: "2023Q3" },
      DASH: { start: 0.0, end: 0.07, amp: 0.009, phase: 0.6, appearAt: "2021Q4" },
      UBER: { start: 0.0, end: 0.06, amp: 0.009, phase: 2.1, appearAt: "2019Q4" },
      CRWD: { start: 0.0, end: 0.06, amp: 0.009, phase: 2.8, appearAt: "2020Q1" },
      AMZN: { start: 0.05, end: 0.04, amp: 0.007, phase: 1.1 },
      MSFT: { start: 0.04, end: 0.03, amp: 0.006, phase: 1.8 },
      QCOM: { start: 0.03, end: 0.05, amp: 0.006, phase: 2.1 },
      PLTR: { start: 0.0, end: 0.04, amp: 0.007, phase: 0.8, appearAt: "2023Q1" },
    },
  },
  {
    id: "pershing",
    name: "Pershing Square",
    org: "Pershing Square Capital Management, L.P.",
    disclosure: "13F-HR",
    color: "#7b2f3a",
    filedLagDays: 47,
    nav: { avg: 0.023, amp: 0.047, phase: 0.6, shockBeta: 1.12 },
    aum: { start: 6.5, end: 15.5, amp: 0.72, phase: 1.1, curve: 1.12 },
    positions: { start: 8, end: 11, amp: 0.8, phase: 2.1, curve: 1.03 },
    maxTrackedWeight: 0.9,
    names: {
      BN: "Brookfield Corp",
      UBER: "Uber",
      AMZN: "Amazon",
      GOOGL: "Alphabet A",
      META: "Meta",
      QSR: "Restaurant Brands",
      HHH: "Howard Hughes",
      HLT: "Hilton",
      GOOG: "Alphabet C",
      SEG: "Seaport Entmt Group",
      HTZ: "Hertz",
    },
    weightSpecs: {
      BN: { start: 0.14, end: 0.18, amp: 0.012, phase: 1.2 },
      UBER: { start: 0.04, end: 0.16, amp: 0.011, phase: 2.3, appearAt: "2019Q2" },
      AMZN: { start: 0.07, end: 0.14, amp: 0.009, phase: 0.8 },
      GOOGL: { start: 0.09, end: 0.125, amp: 0.01, phase: 1.7 },
      META: { start: 0.07, end: 0.114, amp: 0.01, phase: 2.5 },
      QSR: { start: 0.16, end: 0.1, amp: 0.008, phase: 0.6 },
      HHH: { start: 0.2, end: 0.097, amp: 0.009, phase: 2.0 },
      HLT: { start: 0.04, end: 0.056, amp: 0.006, phase: 1.1 },
      GOOG: { start: 0.02, end: 0.014, amp: 0.004, phase: 2.9 },
      SEG: { start: 0.0, end: 0.006, amp: 0.003, phase: 1.4, appearAt: "2024Q4" },
      HTZ: { start: 0.01, end: 0.005, amp: 0.003, phase: 2.7, appearAt: "2021Q1" },
    },
  },
  {
    id: "himalaya",
    name: "Himalaya",
    org: "Himalaya Capital Management LLC",
    disclosure: "13F-HR",
    color: "#4a5f27",
    filedLagDays: 48,
    nav: { avg: 0.02, amp: 0.041, phase: 0.3, shockBeta: 1.05 },
    aum: { start: 0.9, end: 3.57, amp: 0.19, phase: 1.7, curve: 1.18 },
    positions: { start: 4, end: 9, amp: 0.9, phase: 0.9, curve: 1.04 },
    maxTrackedWeight: 0.92,
    names: {
      GOOGL: "Alphabet A",
      GOOG: "Alphabet C",
      BAC: "Bank of America",
      PDD: "PDD",
      "BRK.B": "Berkshire B",
      EWBC: "East West Bancorp",
      OXY: "Occidental",
      CROX: "Crocs",
      AAPL: "Apple",
      BABA: "Alibaba",
    },
    weightSpecs: {
      GOOGL: { start: 0.18, end: 0.223, amp: 0.008, phase: 1.2 },
      GOOG: { start: 0.14, end: 0.216, amp: 0.008, phase: 2.0 },
      BAC: { start: 0.21, end: 0.161, amp: 0.008, phase: 0.7 },
      PDD: { start: 0.02, end: 0.146, amp: 0.01, phase: 2.2, appearAt: "2018Q3" },
      "BRK.B": { start: 0.08, end: 0.126, amp: 0.007, phase: 1.4 },
      EWBC: { start: 0.06, end: 0.087, amp: 0.006, phase: 2.7 },
      OXY: { start: 0.0, end: 0.017, amp: 0.004, phase: 0.5, appearAt: "2020Q3" },
      CROX: { start: 0.0, end: 0.015, amp: 0.004, phase: 2.9, appearAt: "2021Q1" },
      AAPL: { start: 0.03, end: 0.008, amp: 0.003, phase: 1.8 },
      BABA: { start: 0.11, end: 0.0, amp: 0.006, phase: 1.1, disappearAt: "2023Q4" },
    },
  },
  {
    id: "tigerglobal",
    name: "Tiger Global",
    org: "Tiger Global Management LLC",
    disclosure: "13F-HR",
    color: "#6b3b1f",
    filedLagDays: 47,
    nav: { avg: 0.022, amp: 0.06, phase: 1.5, shockBeta: 1.35 },
    aum: { start: 14, end: 29.7, amp: 1.6, phase: 0.9, curve: 1.08 },
    positions: { start: 45, end: 118, amp: 8, phase: 1.9, curve: 1.1 },
    maxTrackedWeight: 0.88,
    names: {
      GOOGL: "Alphabet A",
      MSFT: "Microsoft",
      AMZN: "Amazon",
      NVDA: "NVIDIA",
      SE: "Sea",
      META: "Meta",
      TTWO: "Take-Two",
      TSM: "TSMC",
      AVGO: "Broadcom",
      APO: "Apollo",
      RDDT: "Reddit",
      APP: "AppLovin",
    },
    weightSpecs: {
      GOOGL: { start: 0.07, end: 0.112, amp: 0.011, phase: 0.9 },
      MSFT: { start: 0.05, end: 0.089, amp: 0.01, phase: 2.2 },
      AMZN: { start: 0.06, end: 0.078, amp: 0.01, phase: 1.1 },
      NVDA: { start: 0.03, end: 0.069, amp: 0.011, phase: 2.7 },
      SE: { start: 0.0, end: 0.066, amp: 0.01, phase: 1.6, appearAt: "2017Q4" },
      META: { start: 0.02, end: 0.061, amp: 0.01, phase: 0.4 },
      TTWO: { start: 0.015, end: 0.05, amp: 0.009, phase: 2.9 },
      TSM: { start: 0.03, end: 0.038, amp: 0.006, phase: 1.8 },
      AVGO: { start: 0.01, end: 0.033, amp: 0.007, phase: 2.4 },
      APO: { start: 0.0, end: 0.03, amp: 0.006, phase: 0.8, appearAt: "2020Q4" },
      RDDT: { start: 0.0, end: 0.03, amp: 0.006, phase: 1.9, appearAt: "2024Q2" },
      APP: { start: 0.0, end: 0.029, amp: 0.006, phase: 2.6, appearAt: "2023Q3" },
    },
  },
];

const MANAGER_BY_ID = {
  buffett: "Warren Buffett",
  soros: "George Soros",
  duanyongping: "Duan Yongping",
  bridgewater: "Ray Dalio",
  ark: "Cathie Wood",
  softbank: "Masayoshi Son",
  pershing: "Bill Ackman",
  himalaya: "Li Lu",
  tigerglobal: "Chase Coleman",
};

INVESTOR_DEFS.forEach((def) => {
  if (!def.manager) {
    def.manager = MANAGER_BY_ID[def.id] || def.name;
  }
});

const INVESTORS = INVESTOR_DEFS.map((def) => buildInvestor(def));

const state = {
  activeInvestorId: "buffett",
  quarter: LATEST_QUARTER,
  expanded: new Set(),
  view: "list",
  catalogTreemapItemsByKey: new Map(),
  catalogTreemapCoveredInstitutions: 0,
  catalogTreemapFocusKey: "",
  catalogTreemapFocusInstitutionIds: new Set(),
  secHistoryById: new Map(),
  derivedSecTickerByCode: new Map(),
  derivedSecTickerByIssuer: new Map(),
  managerMetaById: new Map(),
  secHistoryLoaded: false,
  styleRadarScaleCap: 0.36,
};

const elements = {
  listView: document.querySelector("#listView"),
  detailView: document.querySelector("#detailView"),
  institutionGrid: document.querySelector("#institutionGrid"),
  institutionTreemapMeta: document.querySelector("#institutionTreemapMeta"),
  institutionTreemap: document.querySelector("#institutionTreemap"),
  catalogMeta: document.querySelector("#catalogMeta"),
  backToListBtn: document.querySelector("#backToListBtn"),
  detailOrgTitle: document.querySelector("#detailOrgTitle"),
  detailManagerLine: document.querySelector("#detailManagerLine"),
  detailLinks: document.querySelector("#detailLinks"),
  detailQuickStats: document.querySelector("#detailQuickStats"),
  styleRadarPanel: document.querySelector("#styleRadarPanel"),
  aumTrendPanel: document.querySelector("#aumTrendPanel"),
  quarterSelect: document.querySelector("#quarterSelect"),
  holdingsCards: document.querySelector("#holdingsCards"),
  changesCards: document.querySelector("#changesCards"),
  snapshotBtn: document.querySelector("#snapshotBtn"),
};

const STYLE_TAG_BY_ID = {
  buffett: "Value",
  soros: "Macro",
  duanyongping: "Focused",
  bridgewater: "Systematic",
  ark: "Disruptive",
  softbank: "Aggressive",
  pershing: "Activist",
  himalaya: "Concentrated",
  tigerglobal: "Growth",
};

const OFFICIAL_WEBSITE_BY_ID = {
  buffett: "https://www.berkshirehathaway.com/",
  soros: "https://www.soros.com/",
  bridgewater: "https://www.bridgewater.com/",
  ark: "https://ark-invest.com/",
  softbank: "https://group.softbank/en/",
  pershing: "https://www.persq.com/",
  himalaya: "https://www.himcap.com/",
  tigerglobal: "https://www.tigerglobal.com/",
};

const STYLE_RADAR_AXES = [
  { key: "technology", label: "Technology" },
  { key: "financials", label: "Financials" },
  { key: "consumer", label: "Consumer" },
  { key: "healthcare", label: "Healthcare" },
  { key: "industrials", label: "Industrials" },
  { key: "energy", label: "Energy & Utilities" },
  { key: "other", label: "Other" },
];

const STYLE_BUCKET_BY_TICKER = {
  AAPL: "technology",
  MSFT: "technology",
  NVDA: "technology",
  GOOGL: "technology",
  GOOG: "technology",
  META: "technology",
  ADBE: "technology",
  AVGO: "technology",
  LRCX: "technology",
  TSM: "technology",
  QCOM: "technology",
  SMCI: "technology",
  PLTR: "technology",
  ARM: "technology",
  CRWD: "technology",
  APP: "technology",
  U: "technology",
  ZM: "technology",
  PATH: "technology",

  BAC: "financials",
  AXP: "financials",
  COIN: "financials",
  MCO: "financials",
  XLF: "financials",
  BN: "financials",
  BRKB: "financials",
  "BRK-B": "financials",
  EWBC: "financials",
  APO: "financials",
  HOOD: "financials",
  USB: "financials",
  GS: "financials",
  JPM: "financials",

  AMZN: "consumer",
  TSLA: "consumer",
  KO: "consumer",
  KHC: "consumer",
  BABA: "consumer",
  JD: "consumer",
  PDD: "consumer",
  BIDU: "consumer",
  NTES: "consumer",
  NFLX: "consumer",
  ROKU: "consumer",
  DASH: "consumer",
  UBER: "consumer",
  QSR: "consumer",
  HLT: "consumer",
  HTZ: "consumer",
  CROX: "consumer",
  SE: "consumer",
  TTWO: "consumer",
  BKNG: "consumer",
  SIRI: "consumer",
  SHOP: "consumer",
  RDDT: "consumer",
  TMUS: "consumer",
  DTEGY: "consumer",
  SEG: "consumer",

  DVA: "healthcare",
  CRSP: "healthcare",
  NTLA: "healthcare",

  GEV: "industrials",
  HHH: "industrials",
  TER: "industrials",

  CVX: "energy",
  OXY: "energy",
  XOM: "energy",
};

const STYLE_BUCKET_KEYWORDS = [
  {
    bucket: "financials",
    terms: [
      "BANK",
      "BANCORP",
      "FINANCIAL",
      "CAPITAL",
      "INSURANCE",
      "PAYMENT",
      "CREDIT",
      "ASSET MGMT",
      "INVESTMENT",
      "BROKER",
      "TRUST",
      "ETF",
      "FUND",
    ],
  },
  {
    bucket: "healthcare",
    terms: [
      "HEALTH",
      "PHARMA",
      "THERAPEUT",
      "BIOTECH",
      "BIO ",
      "MEDICAL",
      "LIFE SCI",
      "DIAGNOST",
      "HOSPITAL",
      "DRUG",
    ],
  },
  {
    bucket: "energy",
    terms: [
      "ENERGY",
      "OIL",
      "PETROLE",
      "NATURAL GAS",
      "UTILITY",
      "UTILITIES",
      "POWER",
      "SOLAR",
      "RENEWABLE",
      "PIPELINE",
    ],
  },
  {
    bucket: "industrials",
    terms: [
      "INDUSTRIAL",
      "AEROSPACE",
      "DEFENSE",
      "MACHIN",
      "RAIL",
      "LOGISTICS",
      "TRANSPORT",
      "CONSTRUCT",
      "ENGINEERING",
      "INFRASTRUCT",
      "AIRLINES",
      "SHIPPING",
    ],
  },
  {
    bucket: "technology",
    terms: [
      "TECHNOLOGY",
      "SOFTWARE",
      "SEMICON",
      "MICRO",
      "CYBER",
      "CLOUD",
      "DATA",
      "INTERNET",
      "DIGITAL",
      "ELECTRON",
      "COMPUT",
      "AI ",
      "ARTIFICIAL INTELLIGENCE",
      "PLATFORM",
    ],
  },
  {
    bucket: "consumer",
    terms: [
      "CONSUMER",
      "RETAIL",
      "E COMMERCE",
      "E-COMMERCE",
      "APPAREL",
      "FOOD",
      "BEVERAGE",
      "RESTAURANT",
      "HOTEL",
      "TRAVEL",
      "AUTO",
      "AUTOMOT",
      "ENTERTAIN",
      "MEDIA",
      "STREAM",
      "LEISURE",
    ],
  },
];

const SP500_STYLE_PROFILE = Object.freeze({
  technology: 0.31,
  financials: 0.14,
  consumer: 0.16,
  healthcare: 0.11,
  industrials: 0.09,
  energy: 0.07,
  other: 0.12,
});

const STYLE_RADAR_GLOBAL_GAMMA = 0.62;
const STYLE_RADAR_FALLBACK_CAP = 0.36;
const STYLE_RADAR_PRIMARY_STROKE = "rgb(201, 126, 75)";
const STYLE_RADAR_PRIMARY_FILL = "rgba(201, 126, 75, 0.24)";
const STYLE_RADAR_BENCHMARK_STROKE = "rgb(121, 219, 210)";
const STYLE_RADAR_BENCHMARK_FILL = "rgba(121, 219, 210, 0.15)";

const AVATAR_CACHE_VERSION = "20260220-ui29";

const FOUNDER_AVATAR_BY_ID = {
  buffett: "./assets/avatars/buffett.jpg",
  soros: "./assets/avatars/soros.jpg",
  duanyongping: "./assets/avatars/duanyongping.jpg",
  bridgewater: "./assets/avatars/bridgewater.jpg",
  ark: "./assets/avatars/ark.jpg",
  softbank: "./assets/avatars/softbank.jpg",
  pershing: "./assets/avatars/pershing.jpg",
  himalaya: "./assets/avatars/himalaya.png",
  tigerglobal: "./assets/avatars/tigerglobal.jpg",
};

function quarterEndDate(quarter) {
  const year = Number(quarter.slice(0, 4));
  const q = quarter.slice(5);
  const monthByQuarter = { "1": 2, "2": 5, "3": 8, "4": 11 };
  const dayByQuarter = { "1": 31, "2": 30, "3": 30, "4": 31 };
  return new Date(Date.UTC(year, monthByQuarter[q], dayByQuarter[q]));
}

function filedDate(quarter, lagDays) {
  const base = quarterEndDate(quarter);
  const next = new Date(base.getTime() + lagDays * 86400000);
  return next.toISOString().slice(0, 10);
}

function activeInvestor() {
  return INVESTORS.find((inv) => inv.id === state.activeInvestorId) || null;
}

function selectedInvestors() {
  const investor = activeInvestor();
  return investor ? [investor] : [];
}

function buildSnapshot(investor, quarter) {
  const idx = quarterIndex(quarter);
  const safeIdx = idx >= 0 ? idx : investor.aum.length - 1;
  const total = investor.aum[safeIdx];
  const holdings = Object.entries(investor.weights)
    .map(([ticker, arr]) => {
      const weight = arr[safeIdx] || 0;
      return {
        key: ticker,
        ticker,
        code: ticker,
        company: investor.names[ticker] || ticker,
        securityClass: "",
        weight,
        value: total * weight,
        shares: null,
      };
    })
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.value - a.value);

  const used = holdings.reduce((acc, item) => acc + item.weight, 0);
  if (used < 0.999) {
    holdings.push({
      key: "OTHER",
      ticker: "OTHER",
      code: "OTHER",
      company: "Other Holdings",
      securityClass: "",
      weight: round(1 - used, 4),
      value: total * (1 - used),
      shares: null,
    });
  }

  return {
    holdings: holdings.sort((a, b) => b.value - a.value),
    total,
    positions: investor.positionCounts[safeIdx],
    top3Weight: holdings
      .filter((item) => item.ticker !== "OTHER")
      .slice(0, 3)
      .reduce((acc, item) => acc + item.weight, 0),
    filingDate: filedDate(quarter, investor.filedLagDays),
    source: "model",
  };
}

function getSecQuarterFiling(investor, quarter) {
  if (!state.secHistoryLoaded) {
    return null;
  }
  const quarterMap = state.secHistoryById.get(investor.id);
  if (!quarterMap) {
    return null;
  }
  return quarterMap.get(quarter) || null;
}

function detectFilingValueScales(filings) {
  const ordered = [...(filings || [])]
    .filter((filing) => filing && filing.quarter && quarterIndex(filing.quarter) >= 0)
    .sort((a, b) => quarterIndex(a.quarter) - quarterIndex(b.quarter));

  const scales = new Map();
  ordered.forEach((filing) => {
    scales.set(filing.quarter, 1);
  });

  let pivotIndex = -1;
  for (let idx = 1; idx < ordered.length; idx += 1) {
    const prev = Number(ordered[idx - 1].total_value_usd) || 0;
    const curr = Number(ordered[idx].total_value_usd) || 0;
    if (prev <= 0 || curr <= 0) {
      continue;
    }
    const jumpRatio = curr / prev;
    if (jumpRatio >= 200) {
      pivotIndex = idx;
      break;
    }
  }

  if (pivotIndex > 0) {
    for (let idx = 0; idx < pivotIndex; idx += 1) {
      scales.set(ordered[idx].quarter, 1000);
    }
  }

  return scales;
}

function snapshotFromSecFiling(filing) {
  const valueScale = filing.value_scale || 1;
  const total = ((Number(filing.total_value_usd) || 0) * valueScale) / 1e9;
  const holdings = (filing.holdings || [])
    .map((item) => {
      const code = (item.code || item.cusip || item.issuer || "").trim();
      const normalizedCode = code.toUpperCase();
      const normalizedIssuer = normalizeIssuerForTicker(item.issuer || "");
      const rawTicker = (item.ticker || "").trim().toUpperCase().replace(/\./g, "-");
      const codeAsTicker = code.toUpperCase().replace(/\./g, "-");
      const overrideTicker = CUSIP_TICKER_OVERRIDES[normalizedCode] || "";
      const ticker = overrideTicker
        ? overrideTicker
        : looksLikeUsTicker(rawTicker)
          ? rawTicker
          : looksLikeUsTicker(codeAsTicker)
            ? codeAsTicker
            : state.derivedSecTickerByCode.get(normalizedCode) ||
                ISSUER_TICKER_OVERRIDES[normalizedIssuer] ||
                state.derivedSecTickerByIssuer.get(normalizedIssuer) ||
                "";
      return {
        key: code || ticker || (item.issuer || "N/A"),
        code,
        ticker,
        company: item.issuer || code || "N/A",
        securityClass: item.title_of_class || "",
        weight: item.weight || 0,
        value: ((Number(item.value_usd) || 0) * valueScale) / 1e9,
        shares: typeof item.shares === "number" ? item.shares : null,
      };
    })
    .sort((a, b) => b.value - a.value);
  applyUniqueHoldingLabels(holdings);

  return {
    holdings,
    total,
    positions: filing.holdings_count || holdings.length,
    top3Weight: holdings.slice(0, 3).reduce((acc, item) => acc + item.weight, 0),
    filingDate: filing.filed_date || filing.filing_date || "--",
    source: "sec",
  };
}

function getDisplaySnapshot(investor, quarter) {
  const filing = getSecQuarterFiling(investor, quarter);
  if (filing) {
    return snapshotFromSecFiling(filing);
  }
  return null;
}

function getHoldingValue(snapshot, holdingKey) {
  const target = snapshot.holdings.find((item) => item.key === holdingKey);
  return target ? target.value : 0;
}

function getHoldingShares(snapshot, holdingKey) {
  const target = snapshot.holdings.find((item) => item.key === holdingKey);
  if (!target || typeof target.shares !== "number") {
    return null;
  }
  return target.shares;
}

function inferTradeAmount(currValue, prevValue, currShares, prevShares, shareDelta) {
  if (
    typeof currShares !== "number" ||
    typeof prevShares !== "number" ||
    typeof shareDelta !== "number" ||
    Math.abs(shareDelta) < 1e-9
  ) {
    return Math.abs(currValue - prevValue);
  }

  let refPrice = 0;
  if (shareDelta > 0) {
    if (currShares > 0) {
      refPrice = currValue / currShares;
    }
    if ((!Number.isFinite(refPrice) || refPrice <= 0) && prevShares > 0) {
      refPrice = prevValue / prevShares;
    }
  } else {
    if (prevShares > 0) {
      refPrice = prevValue / prevShares;
    }
    if ((!Number.isFinite(refPrice) || refPrice <= 0) && currShares > 0) {
      refPrice = currValue / currShares;
    }
  }

  if (!Number.isFinite(refPrice) || refPrice <= 0) {
    return Math.abs(currValue - prevValue);
  }
  return Math.abs(shareDelta) * refPrice;
}

function getQuarterChanges(investor, quarter) {
  const idx = quarterIndex(quarter);
  if (idx <= 0) {
    return [];
  }

  const current = getDisplaySnapshot(investor, quarter);
  const previous = getDisplaySnapshot(investor, QUARTERS[idx - 1]);
  if (!current || !previous) {
    return [];
  }

  const allKeys = new Set([
    ...current.holdings.map((item) => item.key),
    ...previous.holdings.map((item) => item.key),
  ]);
  allKeys.delete("OTHER");

  const rows = [];
  allKeys.forEach((holdingKey) => {
    const currHolding = current.holdings.find((item) => item.key === holdingKey);
    const prevHolding = previous.holdings.find((item) => item.key === holdingKey);
    const curr = getHoldingValue(current, holdingKey);
    const prev = getHoldingValue(previous, holdingKey);
    const currShares = getHoldingShares(current, holdingKey);
    const prevShares = getHoldingShares(previous, holdingKey);

    let action = "Add";
    let direction = 1;
    let changeRatio = null;
    let ratioSource = "none";

    let delta = curr - prev;
    let changeAmount = Math.abs(delta);

    if (typeof currShares === "number" && typeof prevShares === "number") {
      const shareDelta = currShares - prevShares;
      if (Math.abs(shareDelta) < 1e-9) {
        return;
      }

      direction = shareDelta > 0 ? 1 : -1;
      if (prevShares === 0 && currShares > 0) {
        action = "New";
      } else if (currShares === 0 && prevShares > 0) {
        action = "Exit";
      } else if (shareDelta < 0) {
        action = "Trim";
      }

      if (prevShares > 0) {
        changeRatio = shareDelta / prevShares;
      } else {
        changeRatio = null;
      }

      ratioSource = "shares";
      changeAmount = inferTradeAmount(curr, prev, currShares, prevShares, shareDelta);
      delta = direction * changeAmount;
    } else {
      if (Math.abs(delta) < 0.008) {
        return;
      }
      if (prev === 0 && curr > 0) {
        action = "New";
        direction = 1;
        changeRatio = null;
      } else if (curr === 0 && prev > 0) {
        action = "Exit";
        direction = -1;
        changeRatio = -1;
      } else if (delta < 0) {
        action = "Trim";
        direction = -1;
        changeRatio = prev > 0 ? delta / prev : null;
      } else {
        direction = 1;
        changeRatio = prev > 0 ? delta / prev : null;
      }
      ratioSource = "value";
    }

    rows.push({
      key: holdingKey,
      ticker: (currHolding && currHolding.ticker) || (prevHolding && prevHolding.ticker) || "",
      company:
        (currHolding && currHolding.company) ||
        (prevHolding && prevHolding.company) ||
        investor.names[holdingKey] ||
        holdingKey,
      securityClass:
        (currHolding && currHolding.securityClass) ||
        (prevHolding && prevHolding.securityClass) ||
        "",
      displayLabel:
        (currHolding && getHoldingDisplayLabel(currHolding)) ||
        (prevHolding && getHoldingDisplayLabel(prevHolding)) ||
        formatAssetLabelWithClass(
          (currHolding && currHolding.company) || (prevHolding && prevHolding.company) || holdingKey,
          (currHolding && currHolding.ticker) || (prevHolding && prevHolding.ticker) || "",
          (currHolding && currHolding.securityClass) || (prevHolding && prevHolding.securityClass) || ""
        ),
      action,
      delta,
      direction,
      changeAmount,
      changeRatio,
      ratioSource,
    });
  });

  rows.sort((a, b) => b.changeAmount - a.changeAmount);
  return rows;
}

function getHoldingDelta(investor, holdingKey, quarter, unit = { divisor: 1, digits: 2, short: "B" }) {
  const idx = quarterIndex(quarter);
  if (idx <= 0) {
    return { text: "--", cls: "neutral" };
  }
  const current = getDisplaySnapshot(investor, quarter);
  const previous = getDisplaySnapshot(investor, QUARTERS[idx - 1]);
  if (!current || !previous) {
    return { text: "--", cls: "neutral" };
  }

  const curr = getHoldingValue(current, holdingKey);
  const prev = getHoldingValue(previous, holdingKey);
  const delta = curr - prev;

  if (Math.abs(delta) < 0.008) {
    return { text: "Flat", cls: "neutral" };
  }
  if (prev === 0 && curr > 0) {
    return { text: "New", cls: "up" };
  }
  if (curr === 0 && prev > 0) {
    return { text: "Exit", cls: "down" };
  }
  return {
    text: formatDeltaByUnit(delta, unit),
    cls: delta > 0 ? "up" : "down",
  };
}

function hexToRgb(hexColor) {
  const clean = hexColor.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(rgb) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
    } else if (max === gn) {
      h = ((bn - rn) / delta + 2) / 6;
    } else {
      h = ((rn - gn) / delta + 4) / 6;
    }
    s = delta / (1 - Math.abs(2 * l - 1));
  }

  return { h: h * 360, s, l };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hp >= 0 && hp < 1) {
    r = c;
    g = x;
  } else if (hp >= 1 && hp < 2) {
    r = x;
    g = c;
  } else if (hp >= 2 && hp < 3) {
    g = c;
    b = x;
  } else if (hp >= 3 && hp < 4) {
    g = x;
    b = c;
  } else if (hp >= 4 && hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const m = l - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function makeVividPalette(baseColor, count) {
  const hsl = rgbToHsl(hexToRgb(baseColor));
  const shifts = [0, 34, -26, 62, -48, 96, -72, 128];
  return Array.from({ length: count }, (_, idx) => {
    const hue = (hsl.h + shifts[idx % shifts.length] + idx * 9 + 360) % 360;
    const sat = clamp(hsl.s * 100 + 10 + (idx % 3) * 4, 58, 86) / 100;
    const light = clamp(42 + (idx % 4) * 6, 38, 66) / 100;
    return rgbToHex(hslToRgb(hue, sat, light));
  });
}

function buildPieSweeps(segments, minSweepDeg = 0.35) {
  const base = segments.map((item) => Math.max(0, (item.weight || 0) * 360));
  if (!base.length) {
    return [];
  }
  if (minSweepDeg <= 0) {
    return base;
  }

  const adjusted = [...base];
  let need = 0;
  let reducible = 0;

  for (let idx = 0; idx < adjusted.length; idx += 1) {
    if (adjusted[idx] < minSweepDeg) {
      need += minSweepDeg - adjusted[idx];
      adjusted[idx] = minSweepDeg;
    } else if (adjusted[idx] > minSweepDeg) {
      reducible += adjusted[idx] - minSweepDeg;
    }
  }

  if (need > 0 && reducible >= need) {
    for (let idx = 0; idx < adjusted.length; idx += 1) {
      const value = adjusted[idx];
      if (value > minSweepDeg) {
        const room = value - minSweepDeg;
        adjusted[idx] = value - (room / reducible) * need;
      }
    }
  } else if (need > 0) {
    return base;
  }

  const sum = adjusted.reduce((acc, value) => acc + value, 0) || 1;
  return adjusted.map((value) => (value / sum) * 360);
}

function renderInteractivePie(segments, palette) {
  const cx = 280;
  const cy = 236;
  const radius = 204;
  const baseRadius = radius + 2;
  const labelRadius = 244;
  const centerCount = segments.length;
  let startAngle = -90;
  const sweeps = buildPieSweeps(segments, 0.35);

  const arcs = segments
    .map((item, idx) => {
      const label = getHoldingDisplayLabel(item);
      const sweep = Math.max(0.0001, sweeps[idx] || 0);
      const endAngle = startAngle + sweep;
      const middleAngle = startAngle + sweep / 2;
      const rad = ((middleAngle - 90) * Math.PI) / 180;
      const dx = round(Math.cos(rad) * 10, 2);
      const dy = round(Math.sin(rad) * 10, 2);
      const guideFrom = polarToCartesian(cx, cy, radius + 4, middleAngle);
      const guideTo = polarToCartesian(cx, cy, labelRadius, middleAngle);
      const anchor = Math.cos(rad) >= 0 ? "start" : "end";
      const hoverName = cleanCompanyName(item.company) || item.ticker || label;
      const actualWeight = typeof item.rawWeight === "number" ? item.rawWeight : item.weight;
      const hoverWeight = formatPct(actualWeight, 1, false);
      const labelX = guideTo.x + (anchor === "start" ? 8 : -8);
      const labelY = guideTo.y + 3;
      const code = (item.ticker || "").trim().toUpperCase();
      const showInsideCode = code && actualWeight >= 0.02;
      const insideRadiusFactor = actualWeight >= 0.05 ? 0.64 : actualWeight >= 0.03 ? 0.69 : 0.74;
      const insidePos = polarToCartesian(cx, cy, radius * insideRadiusFactor, middleAngle);
      const sizeByWeight = 9.2 + Math.sqrt(Math.max(actualWeight, 0)) * 20;
      const sizeBySweep = 8.2 + sweep * 0.15;
      const sizeByTickerLength = Math.max(0, code.length - 4) * 0.45;
      const insideFontSize = clamp(Math.min(sizeByWeight, sizeBySweep) - sizeByTickerLength, 8.2, 18.5);
      const insideStrokeWidth = clamp(1.5 + insideFontSize * 0.06, 1.7, 2.8);
      const path = buildPieSlicePath(cx, cy, radius, startAngle, endAngle);
      startAngle = endAngle;

      return `
        <g class="pie-segment" style="--dx:${dx}px; --dy:${dy}px">
          <path d="${path}" fill="${palette[idx]}" />
          <title>${label}</title>
          <line class="slice-hover-guide" x1="${round(guideFrom.x, 2)}" y1="${round(guideFrom.y, 2)}" x2="${round(
            guideTo.x,
            2
          )}" y2="${round(guideTo.y, 2)}"></line>
          <text class="slice-hover-label-name" x="${round(labelX, 2)}" y="${round(labelY, 2)}" text-anchor="${anchor}">${hoverName}</text>
          <text class="slice-hover-label-pct" x="${round(labelX, 2)}" y="${round(labelY + 14, 2)}" text-anchor="${anchor}">${hoverWeight}</text>
          ${
            showInsideCode
              ? `<text class="slice-inside-label" x="${round(insidePos.x, 2)}" y="${round(
                  insidePos.y + insideFontSize * 0.28,
                  2
                )}" text-anchor="middle" style="font-size:${round(insideFontSize, 2)}px;stroke-width:${round(
                  insideStrokeWidth,
                  2
                )}px;">${code}</text>`
              : ""
          }
        </g>
      `;
    })
    .join("");

  return `
    <svg class="pie-svg" viewBox="0 0 580 500" role="img" aria-label="Portfolio pie chart">
      <circle class="pie-halo" cx="${cx}" cy="${cy}" r="${baseRadius + 10}"></circle>
      <circle class="pie-base" cx="${cx}" cy="${cy}" r="${baseRadius}"></circle>
      <circle class="pie-ring" cx="${cx}" cy="${cy}" r="${radius - 14}"></circle>
      ${arcs}
      <circle class="pie-center" cx="${cx}" cy="${cy}" r="45"></circle>
      <text class="pie-center-value" x="${cx}" y="${cy - 2}" text-anchor="middle">${centerCount}</text>
      <text class="pie-center-label" x="${cx}" y="${cy + 17}" text-anchor="middle">Holdings</text>
    </svg>
  `;
}

function bindHoldingsCardActions() {
  elements.holdingsCards.addEventListener("click", (event) => {
    const btn = event.target.closest(".expand-btn");
    if (!btn) {
      return;
    }
    const investorId = btn.dataset.investor;
    if (state.expanded.has(investorId)) {
      state.expanded.delete(investorId);
    } else {
      state.expanded.add(investorId);
    }
    renderHoldingsCards();
  });
}

async function loadSecHistoryData() {
  try {
    const resp = await fetch("./data/sec-13f-history.json?v=20260220-enriched2", {
      cache: "no-store",
    });
    if (!resp.ok) {
      return;
    }
    const payload = await resp.json();
    const historyById = new Map();
    const availableIds = new Set();
    const managerMetaById = new Map();

    (payload.managers || []).forEach((manager) => {
      const qMap = new Map();
      const scaleByQuarter = detectFilingValueScales(manager.filings || []);
      (manager.filings || []).forEach((filing) => {
        if (filing.quarter) {
          filing.value_scale = scaleByQuarter.get(filing.quarter) || 1;
          qMap.set(filing.quarter, filing);
        }
      });
      historyById.set(manager.id, qMap);
      managerMetaById.set(manager.id, manager);
      availableIds.add(manager.id);
    });
    const derivedTickerMaps = buildDerivedSecTickerMaps(payload.managers || []);
    state.secHistoryById = historyById;
    state.derivedSecTickerByCode = derivedTickerMaps.byCode;
    state.derivedSecTickerByIssuer = derivedTickerMaps.byIssuer;
    state.managerMetaById = managerMetaById;
    state.secHistoryLoaded = true;
    state.styleRadarScaleCap = computeGlobalStyleRadarScaleCap();

    if (!availableIds.has(state.activeInvestorId)) {
      if (availableIds.has("buffett")) {
        state.activeInvestorId = "buffett";
      } else {
        const firstId = (payload.managers || [])[0]?.id;
        state.activeInvestorId = firstId || "";
      }
    }
    const active = activeInvestor();
    const quarters = active ? getAvailableQuartersForInvestor(active) : [];
    state.quarter = quarters.length ? quarters[quarters.length - 1] : LATEST_QUARTER;

    renderInstitutionGrid();
    renderAll();
  } catch (error) {
    console.warn("SEC history data not loaded", error);
  }
}

function getAvailableQuartersForInvestor(investor) {
  if (!investor) {
    return [];
  }
  const qMap = state.secHistoryById.get(investor.id);
  if (!qMap) {
    return [];
  }
  return Array.from(qMap.keys())
    .filter((quarter) => quarterIndex(quarter) >= 0)
    .sort((a, b) => quarterIndex(a) - quarterIndex(b));
}

function getLatestQuarterForInvestor(investor) {
  const quarters = getAvailableQuartersForInvestor(investor);
  return quarters.length ? quarters[quarters.length - 1] : null;
}

function getLatestSnapshotForInvestor(investor) {
  const latestQuarter = getLatestQuarterForInvestor(investor);
  if (!latestQuarter) {
    return null;
  }
  const snapshot = getDisplaySnapshot(investor, latestQuarter);
  if (!snapshot) {
    return null;
  }
  return { quarter: latestQuarter, snapshot };
}

function getInvestorAumSeries(investor) {
  if (!investor) {
    return [];
  }
  const quarters = getAvailableQuartersForInvestor(investor);
  return quarters
    .map((quarter) => {
      const snapshot = getDisplaySnapshot(investor, quarter);
      if (!snapshot || !Number.isFinite(snapshot.total) || snapshot.total <= 0) {
        return null;
      }
      return {
        quarter,
        total: snapshot.total,
        filingDate: snapshot.filingDate || "--",
      };
    })
    .filter(Boolean);
}

function buildSvgPath(points) {
  if (!points.length) {
    return "";
  }
  return points.map((point, idx) => `${idx === 0 ? "M" : "L"} ${round(point.x, 2)} ${round(point.y, 2)}`).join(" ");
}

function createStyleBucketTotals() {
  const totals = {};
  STYLE_RADAR_AXES.forEach((axis) => {
    totals[axis.key] = 0;
  });
  return totals;
}

function normalizeTickerForStyle(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "-");
}

function classifyHoldingStyleBucket(item) {
  const ticker = normalizeTickerForStyle(item?.ticker || "");
  const tickerCompact = ticker.replace(/-/g, "");
  if (ticker && STYLE_BUCKET_BY_TICKER[ticker]) {
    return STYLE_BUCKET_BY_TICKER[ticker];
  }
  if (tickerCompact && STYLE_BUCKET_BY_TICKER[tickerCompact]) {
    return STYLE_BUCKET_BY_TICKER[tickerCompact];
  }

  const keyTicker = normalizeTickerForStyle(item?.key || "");
  const keyCompact = keyTicker.replace(/-/g, "");
  if (keyTicker && STYLE_BUCKET_BY_TICKER[keyTicker]) {
    return STYLE_BUCKET_BY_TICKER[keyTicker];
  }
  if (keyCompact && STYLE_BUCKET_BY_TICKER[keyCompact]) {
    return STYLE_BUCKET_BY_TICKER[keyCompact];
  }

  const normalizedText = ` ${String(`${item?.company || ""} ${item?.securityClass || ""}`)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()} `;

  if (normalizedText.trim()) {
    const isIndexLike =
      /( ETF | INDEX | TRUST | FUND )/.test(normalizedText) &&
      /( SPDR | ISHARES | VANGUARD | INVESCO | CORE S P | TOTAL MARKET | INDEX )/.test(normalizedText);
    if (isIndexLike) {
      if (normalizedText.includes(" FINANCIAL ")) {
        return "financials";
      }
      if (normalizedText.includes(" ENERGY ") || normalizedText.includes(" UTILIT")) {
        return "energy";
      }
      if (normalizedText.includes(" TECHNOLOGY ")) {
        return "technology";
      }
      if (normalizedText.includes(" HEALTHCARE ")) {
        return "healthcare";
      }
      return "other";
    }

    for (const rule of STYLE_BUCKET_KEYWORDS) {
      if (rule.terms.some((term) => normalizedText.includes(` ${term} `) || normalizedText.includes(term))) {
        return rule.bucket;
      }
    }
  }

  return "other";
}

function buildStyleProfileFromSnapshot(snapshot) {
  const totals = createStyleBucketTotals();
  if (!snapshot || !Array.isArray(snapshot.holdings)) {
    return totals;
  }

  let usedWeight = 0;
  snapshot.holdings.forEach((item) => {
    if (!item || item.key === "OTHER") {
      return;
    }
    const weight = Number(item.weight) || 0;
    if (weight <= 0) {
      return;
    }
    const bucket = classifyHoldingStyleBucket(item);
    totals[bucket] = (totals[bucket] || 0) + weight;
    usedWeight += weight;
  });

  if (usedWeight <= 0) {
    return totals;
  }

  STYLE_RADAR_AXES.forEach((axis) => {
    totals[axis.key] = totals[axis.key] / usedWeight;
  });
  return totals;
}

function getQuarterAverageStyleProfile(quarter) {
  const sum = createStyleBucketTotals();
  let covered = 0;

  INVESTORS.forEach((inv) => {
    const snapshot = getDisplaySnapshot(inv, quarter);
    if (!snapshot) {
      return;
    }
    const profile = buildStyleProfileFromSnapshot(snapshot);
    const coverage = STYLE_RADAR_AXES.reduce((acc, axis) => acc + (profile[axis.key] || 0), 0);
    if (coverage <= 0) {
      return;
    }
    covered += 1;
    STYLE_RADAR_AXES.forEach((axis) => {
      sum[axis.key] += profile[axis.key] || 0;
    });
  });

  if (covered > 0) {
    STYLE_RADAR_AXES.forEach((axis) => {
      sum[axis.key] /= covered;
    });
  }

  return { profile: sum, covered };
}

function getSp500StyleProfile() {
  return { ...SP500_STYLE_PROFILE };
}

function createStyleRadarScale(primaryProfile, benchmarkProfile, gamma = STYLE_RADAR_GLOBAL_GAMMA, fixedCap = null) {
  const values = [];
  [primaryProfile, benchmarkProfile].forEach((profile) => {
    if (!profile) {
      return;
    }
    STYLE_RADAR_AXES.forEach((axis) => {
      const value = Number(profile[axis.key]) || 0;
      if (value > 0) {
        values.push(value);
      }
    });
  });
  const dynamicCap = values.length ? Math.max(...values) : STYLE_RADAR_FALLBACK_CAP;
  const cap = fixedCap && Number.isFinite(fixedCap) ? fixedCap : dynamicCap;
  const safeCap = cap > 0 ? cap : STYLE_RADAR_FALLBACK_CAP;
  const safeGamma = clamp(gamma, 0.45, 1);
  return {
    cap: safeCap,
    gamma: safeGamma,
    toScaled: (value) => Math.pow(clamp((Number(value) || 0) / safeCap, 0, 1), safeGamma),
    toRaw: (scaledValue) => safeCap * Math.pow(clamp(Number(scaledValue) || 0, 0, 1), 1 / safeGamma),
  };
}

function computeGlobalStyleRadarScaleCap() {
  let maxWeight = STYLE_RADAR_FALLBACK_CAP;
  const sp500 = getSp500StyleProfile();
  STYLE_RADAR_AXES.forEach((axis) => {
    maxWeight = Math.max(maxWeight, Number(sp500[axis.key]) || 0);
  });

  INVESTORS.forEach((inv) => {
    const quarters = getAvailableQuartersForInvestor(inv);
    quarters.forEach((quarter) => {
      const snapshot = getDisplaySnapshot(inv, quarter);
      if (!snapshot) {
        return;
      }
      const profile = buildStyleProfileFromSnapshot(snapshot);
      STYLE_RADAR_AXES.forEach((axis) => {
        maxWeight = Math.max(maxWeight, Number(profile[axis.key]) || 0);
      });
    });
  });

  return round(clamp(maxWeight, 0.2, 0.8), 4);
}

function buildClosedPath(points) {
  if (!points.length) {
    return "";
  }
  return `${points
    .map((point, idx) => `${idx === 0 ? "M" : "L"} ${round(point.x, 2)} ${round(point.y, 2)}`)
    .join(" ")} Z`;
}

function buildStyleRadarSeriesPoints(profile, cx, cy, radius, scaleFn = (value) => value) {
  const count = STYLE_RADAR_AXES.length;
  const step = 360 / count;
  return STYLE_RADAR_AXES.map((axis, idx) => {
    const angle = -90 + idx * step;
    const rawValue = clamp(profile[axis.key] || 0, 0, 1);
    const value = clamp(scaleFn(rawValue), 0, 1);
    const point = polarToCartesian(cx, cy, radius * value, angle);
    const outer = polarToCartesian(cx, cy, radius, angle);
    const label = polarToCartesian(cx, cy, radius + 18, angle);
    const radians = ((angle - 90) * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const anchor = cos > 0.24 ? "start" : cos < -0.24 ? "end" : "middle";
    const labelDy = sin > 0.52 ? 9 : sin < -0.52 ? -4 : 3;
    return {
      axis,
      value,
      rawValue,
      angle,
      point,
      outer,
      label,
      anchor,
      labelDy,
    };
  });
}

function renderStyleRadarPanel() {
  if (!elements.styleRadarPanel) {
    return;
  }
  const investor = activeInvestor();
  if (!investor) {
    elements.styleRadarPanel.innerHTML = `<div class="empty">Please select an institution</div>`;
    return;
  }

  const snapshot = getDisplaySnapshot(investor, state.quarter);
  if (!snapshot) {
    elements.styleRadarPanel.innerHTML = `<div class="empty">No 13F holdings data available for this quarter.</div>`;
    return;
  }

  const profile = buildStyleProfileFromSnapshot(snapshot);
  const peerProfile = getSp500StyleProfile();
  const peerCovered = 500;
  const radarScale = createStyleRadarScale(
    profile,
    peerProfile,
    STYLE_RADAR_GLOBAL_GAMMA,
    state.styleRadarScaleCap || STYLE_RADAR_FALLBACK_CAP
  );

  const width = 560;
  const height = 408;
  const cx = 280;
  const cy = 194;
  const radius = 166;

  const rings = [0.2, 0.4, 0.6, 0.8, 1];
  const ringPaths = rings
    .map((level) => {
      const points = STYLE_RADAR_AXES.map((_, idx) => {
        const angle = -90 + (360 / STYLE_RADAR_AXES.length) * idx;
        return polarToCartesian(cx, cy, radius * level, angle);
      });
      return `<path class="style-radar-ring" d="${buildClosedPath(points)}"></path>`;
    })
    .join("");

  const ringLabels = rings
    .map((level) => {
      const y = cy - radius * level;
      const rawWeight = radarScale.toRaw(level);
      return `<text class="style-radar-ring-label" x="${cx + 8}" y="${round(y, 2)}">${round(rawWeight * 100, 1)}%</text>`;
    })
    .join("");

  const primaryPoints = buildStyleRadarSeriesPoints(profile, cx, cy, radius, radarScale.toScaled);
  const peerPoints = buildStyleRadarSeriesPoints(peerProfile, cx, cy, radius, radarScale.toScaled);
  const primaryPath = buildClosedPath(primaryPoints.map((item) => item.point));
  const peerPath = buildClosedPath(peerPoints.map((item) => item.point));

  const axisMarkup = primaryPoints
    .map(
      (item) => `
        <line class="style-radar-axis-line" x1="${cx}" y1="${cy}" x2="${round(item.outer.x, 2)}" y2="${round(item.outer.y, 2)}"></line>
        <text class="style-radar-axis-label" x="${round(item.label.x, 2)}" y="${round(item.label.y + item.labelDy, 2)}" text-anchor="${
          item.anchor
        }">${item.axis.label}</text>
      `
    )
    .join("");

  const primaryStroke = STYLE_RADAR_PRIMARY_STROKE;
  const primaryFill = STYLE_RADAR_PRIMARY_FILL;
  const peerStroke = STYLE_RADAR_BENCHMARK_STROKE;
  const peerFill = STYLE_RADAR_BENCHMARK_FILL;

  const nodesMarkup = primaryPoints
    .map(
      (point, idx) => `
        <circle class="style-radar-node primary" cx="${round(point.point.x, 2)}" cy="${round(point.point.y, 2)}" r="${
          idx % 2 === 0 ? 3.3 : 2.8
        }"></circle>
      `
    )
    .join("");

  const peerNodesMarkup = peerPoints
    .map(
      (point, idx) => `
        <circle class="style-radar-node peer" cx="${round(point.point.x, 2)}" cy="${round(point.point.y, 2)}" r="${
          idx % 2 === 0 ? 3 : 2.6
        }"></circle>
      `
    )
    .join("");

  const ranked = STYLE_RADAR_AXES.map((axis, idx) => ({
    ...axis,
    order: idx,
    value: profile[axis.key] || 0,
  })).sort((a, b) => b.value - a.value || a.order - b.order);
  const top = ranked[0] || { label: "--", value: 0 };
  const second = ranked[1] || { value: 0 };
  const concentration = top.value + second.value;
  const breadth = ranked.filter((item) => item.value >= 0.1).length;

  const breakdownRows = ranked
    .map((axis) => {
      const value = axis.value || 0;
      const peer = peerProfile[axis.key] || 0;
      const delta = value - peer;
      const deltaClass = delta > 0.012 ? "up" : delta < -0.012 ? "down" : "flat";
      const deltaLabel = Math.abs(delta) < 0.001 ? "Near S&P" : `${delta > 0 ? "+" : ""}${round(delta * 100, 1)}%`;
      return `
        <div class="style-breakdown-row">
          <span class="style-breakdown-name">${axis.label}</span>
          <span class="style-breakdown-value">${formatPct(value, 1, false)}</span>
          <span class="style-breakdown-delta ${deltaClass}">${deltaLabel}</span>
        </div>
      `;
    })
    .join("");

  elements.styleRadarPanel.innerHTML = `
    <div class="style-radar-shell">
      <div class="style-radar-figure">
        <svg class="style-radar-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${investor.org} style polygon chart">
          <g class="style-radar-grid">
            ${ringPaths}
            ${axisMarkup}
            ${ringLabels}
          </g>
          <path class="style-radar-area peer" d="${peerPath}" fill="${peerFill}" stroke="${peerStroke}"></path>
          <path class="style-radar-area primary" d="${primaryPath}" fill="${primaryFill}" stroke="${primaryStroke}"></path>
          ${peerNodesMarkup}
          ${nodesMarkup}
          <circle class="style-radar-center" cx="${cx}" cy="${cy}" r="3.4"></circle>
        </svg>
        <div class="style-radar-legend">
          <span><i class="style-line primary"></i>${investor.org}</span>
          <span><i class="style-line peer"></i>S&P 500 Benchmark (${peerCovered} names)</span>
        </div>
        <p class="style-radar-scale-note">Global normalized scale: cap ${round(
          radarScale.cap * 100,
          1
        )}%, gamma ${radarScale.gamma}).</p>
      </div>
      <aside class="style-radar-side">
        <div class="style-summary-cards">
          <div class="style-summary-card">
            <span>Dominant Style</span>
            <strong>${top.label}</strong>
            <em>${formatPct(top.value, 1, false)}</em>
          </div>
          <div class="style-summary-card">
            <span>Top-2 Concentration</span>
            <strong>${formatPct(concentration, 1, false)}</strong>
            <em>Combined style weight</em>
          </div>
          <div class="style-summary-card">
            <span>Style Breadth</span>
            <strong>${breadth}</strong>
            <em>Segments above 10%</em>
          </div>
        </div>
        <div class="style-breakdown">
          <div class="style-breakdown-head">
            <span>Segment</span>
            <span>Weight</span>
            <span>vs S&P 500</span>
          </div>
          ${breakdownRows}
        </div>
      </aside>
    </div>
  `;
}

function niceStep(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;
  let nice = 1;
  if (normalized <= 1.6) {
    nice = 1;
  } else if (normalized <= 2.6) {
    nice = 2;
  } else if (normalized <= 3.6) {
    nice = 2.5;
  } else if (normalized <= 7.6) {
    nice = 5;
  } else {
    nice = 10;
  }
  return nice * magnitude;
}

function createTrendAxisFormatter(maxValueBillion) {
  if (maxValueBillion >= 1) {
    return {
      divisor: 1,
      suffix: "B",
      digits: maxValueBillion >= 100 ? 0 : 1,
      title: "USD (Billions)",
    };
  }
  return {
    divisor: 0.001,
    suffix: "M",
    digits: maxValueBillion >= 0.1 ? 0 : 1,
    title: "USD (Millions)",
  };
}

function formatTrendAxisValue(valueInBillion, formatter) {
  const scaled = valueInBillion / formatter.divisor;
  return `${round(scaled, formatter.digits).toLocaleString()}${formatter.suffix}`;
}

function bindAumTrendHover(points, chartMeta) {
  if (!elements.aumTrendPanel || !points.length) {
    return;
  }
  const wrap = elements.aumTrendPanel.querySelector(".mountain-wrap");
  if (!wrap) {
    return;
  }

  const svg = wrap.querySelector(".mountain-chart");
  const hoverLayer = wrap.querySelector(".mountain-hover-layer");
  const focusLine = wrap.querySelector(".mountain-focus-line");
  const focusDot = wrap.querySelector(".mountain-focus-point");
  const tooltip = wrap.querySelector(".mountain-tooltip");
  if (!svg || !hoverLayer || !focusLine || !focusDot || !tooltip) {
    return;
  }

  const { width, height, padding, baseY, axisFormatter } = chartMeta;

  const findNearestIndex = (targetX) => {
    let bestIdx = 0;
    let bestDiff = Number.POSITIVE_INFINITY;
    points.forEach((point, idx) => {
      const diff = Math.abs(point.x - targetX);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    });
    return bestIdx;
  };

  const setFocus = (idx) => {
    const point = points[idx];
    if (!point) {
      return;
    }

    focusLine.setAttribute("x1", round(point.x, 2));
    focusLine.setAttribute("x2", round(point.x, 2));
    focusLine.setAttribute("y1", round(padding.top, 2));
    focusLine.setAttribute("y2", round(baseY, 2));
    focusLine.classList.add("visible");

    focusDot.setAttribute("cx", round(point.x, 2));
    focusDot.setAttribute("cy", round(point.y, 2));
    focusDot.classList.add("visible");

    const pointNodes = wrap.querySelectorAll(".mountain-node");
    pointNodes.forEach((node) => {
      node.classList.remove("active");
      const baseRadius = Number(node.getAttribute("data-r")) || 2.1;
      node.setAttribute("r", `${baseRadius}`);
    });
    const activeNode = wrap.querySelector(`.mountain-node[data-index="${idx}"]`);
    if (activeNode) {
      activeNode.classList.add("active");
      const baseRadius = Number(activeNode.getAttribute("data-r")) || 2.1;
      activeNode.setAttribute("r", `${round(baseRadius + 1.8, 2)}`);
    }

    tooltip.innerHTML = `
      <strong>${formatQuarter(point.quarter)}</strong>
      <span>${formatTrendAxisValue(point.total, axisFormatter)}</span>
      <em>Filed: ${point.filingDate}</em>
    `;
    tooltip.classList.add("visible");

    const rect = svg.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const px = (point.x / width) * rect.width;
    const py = (point.y / height) * rect.height;
    const horizontalMargin = 10;
    const half = tipRect.width / 2;
    const left = clamp(px, horizontalMargin + half, rect.width - horizontalMargin - half);
    let top = py - 18;
    if (top - tipRect.height < 8) {
      top = py + 12;
      tooltip.classList.add("below");
    } else {
      tooltip.classList.remove("below");
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  const clearFocus = () => {
    focusLine.classList.remove("visible");
    focusDot.classList.remove("visible");
    tooltip.classList.remove("visible", "below");
    const pointNodes = wrap.querySelectorAll(".mountain-node.active");
    pointNodes.forEach((node) => {
      node.classList.remove("active");
      const baseRadius = Number(node.getAttribute("data-r")) || 2.1;
      node.setAttribute("r", `${baseRadius}`);
    });
  };

  const handlePointerMove = (event) => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    const scaleX = width / rect.width;
    const x = (event.clientX - rect.left) * scaleX;
    const nearestIdx = findNearestIndex(x);
    setFocus(nearestIdx);
  };

  hoverLayer.addEventListener("pointermove", handlePointerMove);
  hoverLayer.addEventListener("pointerleave", clearFocus);
  hoverLayer.addEventListener("pointerdown", handlePointerMove);
}

function renderAumTrendPanel() {
  if (!elements.aumTrendPanel) {
    return;
  }
  const investor = activeInvestor();
  if (!investor) {
    elements.aumTrendPanel.innerHTML = `<div class="empty">Please select an institution</div>`;
    return;
  }

  const series = getInvestorAumSeries(investor);
  if (series.length < 2) {
    elements.aumTrendPanel.innerHTML = `<div class="empty">Insufficient filing history to draw this trend.</div>`;
    return;
  }

  const width = 960;
  const height = 466;
  const padding = { top: 14, right: 18, bottom: 64, left: 56 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const baseY = padding.top + innerHeight;

  const values = series.map((item) => item.total);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const lowerBound = Math.max(0, minValue * 0.84);
  let upperBound = maxValue * 1.08;
  if (upperBound - lowerBound < 0.2) {
    upperBound = lowerBound + 0.2;
  }

  const axisStep = niceStep((upperBound - lowerBound) / 4);
  let yMin = Math.max(0, Math.floor(lowerBound / axisStep) * axisStep);
  let yMax = Math.ceil(upperBound / axisStep) * axisStep;
  if (yMax <= yMin) {
    yMax = yMin + axisStep;
  }
  const range = yMax - yMin;
  const axisFormatter = createTrendAxisFormatter(yMax);

  const points = series.map((item, idx) => {
    const x = padding.left + (idx / (series.length - 1)) * innerWidth;
    const y = padding.top + ((yMax - item.total) / range) * innerHeight;
    return { ...item, x, y };
  });

  const linePath = buildSvgPath(points);
  const areaPath = `${linePath} L ${round(points[points.length - 1].x, 2)} ${round(baseY, 2)} L ${round(points[0].x, 2)} ${round(baseY, 2)} Z`;

  const yTickValues = [];
  let yCursor = yMin;
  while (yCursor <= yMax + axisStep * 0.001 && yTickValues.length < 12) {
    yTickValues.push(round(yCursor, 6));
    yCursor += axisStep;
  }
  if (!yTickValues.length || yTickValues[yTickValues.length - 1] < yMax - 1e-6) {
    yTickValues.push(round(yMax, 6));
  }
  const axisTicks = yTickValues
    .slice()
    .reverse()
    .map((tick) => ({
      value: tick,
      y: padding.top + ((yMax - tick) / range) * innerHeight,
    }));

  let xLabelEntries = points
    .filter((point) => point.quarter.endsWith("Q1"))
    .map((point) => ({
      x: point.x,
      year: parseQuarter(point.quarter).year,
    }));
  if (!xLabelEntries.length) {
    xLabelEntries = [points[0], points[points.length - 1]].map((point) => ({
      x: point.x,
      year: parseQuarter(point.quarter).year,
    }));
  }
  const seenYear = new Set();
  xLabelEntries = xLabelEntries.filter((entry) => {
    if (seenYear.has(entry.year)) {
      return false;
    }
    seenYear.add(entry.year);
    return true;
  });
  const latestYear = parseQuarter(series[series.length - 1].quarter).year;
  const tailYear = Math.max(2026, latestYear);
  if (!seenYear.has(tailYear)) {
    xLabelEntries.push({
      x: width - padding.right,
      year: tailYear,
    });
  }
  xLabelEntries.sort((a, b) => a.x - b.x);

  const first = series[0];
  const last = series[series.length - 1];
  const cumulative = first.total > 0 ? last.total / first.total - 1 : 0;
  const multiple = first.total > 0 ? last.total / first.total : 0;
  const positiveTone = cumulative >= 0;
  const quarterlyReturns = [];
  for (let idx = 1; idx < series.length; idx += 1) {
    const prev = series[idx - 1].total;
    const curr = series[idx].total;
    if (prev > 0 && Number.isFinite(curr) && Number.isFinite(prev)) {
      quarterlyReturns.push(curr / prev - 1);
    }
  }
  const quarterlyVolatility = standardDeviation(quarterlyReturns);
  const oneYearBaseIdx = Math.max(0, series.length - 5);
  const oneYearBase = series[oneYearBaseIdx];
  const oneYearChange = oneYearBase && oneYearBase.total > 0 ? last.total / oneYearBase.total - 1 : 0;
  let peak = values[0] || 0;
  let maxDrawdown = 0;
  values.forEach((value) => {
    if (value > peak) {
      peak = value;
    }
    if (peak > 0) {
      const drawdown = value / peak - 1;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  });
  const trough = Math.min(...values);
  const reboundFromTrough = trough > 0 ? last.total / trough - 1 : 0;

  const lineColor = "hsl(184 76% 62%)";
  const glowColor = "hsla(184 90% 70% / 0.38)";
  const areaTop = "hsla(184 82% 64% / 0.36)";
  const areaBottom = "hsla(190 72% 34% / 0.08)";
  const pointColor = "hsl(184 92% 92%)";
  const valueText = (valueInBillion) => formatTrendAxisValue(valueInBillion, axisFormatter);

  const axisMarkup = axisTicks
    .map(
      (tick) => `
        <g class="mountain-axis-row">
          <line x1="${padding.left}" y1="${round(tick.y, 2)}" x2="${width - padding.right}" y2="${round(tick.y, 2)}"></line>
          <text x="${padding.left - 12}" y="${round(tick.y, 2)}" text-anchor="end" dominant-baseline="middle">${valueText(
            tick.value
          )}</text>
        </g>
      `
    )
    .join("");

  const xAxisMarkup = xLabelEntries
    .map(
      (entry) => `
        <g class="mountain-x-row">
          <line class="mountain-x-grid" x1="${round(entry.x, 2)}" y1="${padding.top}" x2="${round(entry.x, 2)}" y2="${baseY}"></line>
          <line class="mountain-x-mark" x1="${round(entry.x, 2)}" y1="${baseY}" x2="${round(entry.x, 2)}" y2="${baseY + 6}"></line>
          <text class="mountain-quarter" x="${round(entry.x, 2)}" y="${height - 24}" text-anchor="middle">${entry.year}</text>
        </g>
      `
    )
    .join("");

  const nodesMarkup = points
    .map(
      (point, idx) => `
        <circle class="mountain-node ${idx === 0 ? "start" : ""} ${idx === points.length - 1 ? "end" : ""}" data-index="${idx}" data-r="${
          idx === 0 || idx === points.length - 1 ? 2.8 : 2.1
        }" cx="${round(
          point.x,
          2
        )}" cy="${round(point.y, 2)}" r="${idx === 0 || idx === points.length - 1 ? 2.8 : 2.1}"></circle>
      `
    )
    .join("");

  elements.aumTrendPanel.innerHTML = `
    <div class="aum-trend-shell">
      <div class="aum-trend-summary">
        <div class="trend-metric">
          <span>Starting Holdings Net Assets</span>
          <strong>${valueText(first.total)}</strong>
          <em>${formatQuarter(first.quarter)}</em>
        </div>
        <div class="trend-metric">
          <span>Latest Holdings Net Assets</span>
          <strong>${valueText(last.total)}</strong>
          <em>${formatQuarter(last.quarter)} · ${last.filingDate}</em>
        </div>
        <div class="trend-metric ${positiveTone ? "up" : "down"}">
          <span>Cumulative Change</span>
          <strong>${formatPct(cumulative, 1, false)}</strong>
          <em>${multiple > 0 ? `${round(multiple, 2)}x` : "--"} since inception</em>
        </div>
      </div>
      <div class="mountain-wrap">
        <svg class="mountain-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${investor.org} holdings net asset trend">
          <defs>
            <linearGradient id="mountainFill-${investor.id}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${areaTop}"></stop>
              <stop offset="100%" stop-color="${areaBottom}"></stop>
            </linearGradient>
          </defs>
          ${axisMarkup}
          ${xAxisMarkup}
          <path class="mountain-area" d="${areaPath}" fill="url(#mountainFill-${investor.id})"></path>
          <path class="mountain-line" d="${linePath}" stroke="${lineColor}" style="--mountain-glow:${glowColor}"></path>
          ${nodesMarkup}
          <line class="mountain-y-axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${baseY}"></line>
          <line class="mountain-baseline" x1="${padding.left}" y1="${baseY}" x2="${width - padding.right}" y2="${baseY}"></line>
          <text class="mountain-axis-title" x="${padding.left}" y="${padding.top + 4}" text-anchor="start" dominant-baseline="hanging">${axisFormatter.title}</text>
          <text class="mountain-axis-title x" x="${width - padding.right}" y="${height - 6}" text-anchor="end">Year (Q1)</text>
          <line class="mountain-focus-line" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${baseY}"></line>
          <circle class="mountain-focus-point" cx="${padding.left}" cy="${baseY}" r="5.2" fill="${pointColor}"></circle>
          <rect class="mountain-hover-layer" x="${padding.left}" y="${padding.top}" width="${innerWidth}" height="${innerHeight}"></rect>
        </svg>
        <div class="mountain-tooltip" aria-live="polite"></div>
      </div>
      <div class="trend-insights">
        <div class="trend-insight ${oneYearChange >= 0 ? "up" : "down"}">
          <span>1Y Change</span>
          <strong>${formatPct(oneYearChange, 1, false)}</strong>
          <em>${formatQuarter(oneYearBase.quarter)} to ${formatQuarter(last.quarter)}</em>
        </div>
        <div class="trend-insight ${maxDrawdown < -0.001 ? "down" : "flat"}">
          <span>Max Drawdown</span>
          <strong>${formatPct(maxDrawdown, 1, false)}</strong>
          <em>Peak-to-trough decline</em>
        </div>
        <div class="trend-insight">
          <span>Quarterly Volatility</span>
          <strong>${formatPct(quarterlyVolatility, 1, false)}</strong>
          <em>Std. dev. of QoQ changes</em>
        </div>
        <div class="trend-insight ${reboundFromTrough >= 0 ? "up" : "down"}">
          <span>Rebound from Trough</span>
          <strong>${formatPct(reboundFromTrough, 1, false)}</strong>
          <em>From historical low point</em>
        </div>
      </div>
    </div>
  `;
  bindAumTrendHover(points, { width, height, padding, baseY, axisFormatter });
}

function managerInitials(name) {
  const text = (name || "").trim();
  if (!text) {
    return "NA";
  }
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "NA";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function bindFounderAvatarFallback() {
  if (!elements.institutionGrid) {
    return;
  }
  elements.institutionGrid.querySelectorAll(".founder-photo").forEach((img) => {
    if (img.dataset.bound === "1") {
      return;
    }
    img.dataset.bound = "1";
    img.addEventListener("error", () => {
      const wrap = img.closest(".founder-avatar");
      if (wrap) {
        wrap.classList.add("fallback");
      }
    });
  });
}

function showCatalogView() {
  state.view = "list";
  if (elements.listView) {
    elements.listView.hidden = false;
  }
  if (elements.detailView) {
    elements.detailView.hidden = true;
  }
  if (elements.snapshotBtn) {
    elements.snapshotBtn.hidden = true;
  }
}

function showDetailView() {
  state.view = "detail";
  if (elements.listView) {
    elements.listView.hidden = true;
  }
  if (elements.detailView) {
    elements.detailView.hidden = false;
  }
  if (elements.snapshotBtn) {
    elements.snapshotBtn.hidden = false;
  }
}

function renderInstitutionGrid() {
  if (!elements.institutionGrid) {
    return;
  }
  const focusActive = Boolean(state.catalogTreemapFocusKey && state.catalogTreemapFocusInstitutionIds.size);
  const sortedInvestors = INVESTORS.map((inv) => {
    const latest = getLatestSnapshotForInvestor(inv);
    return {
      inv,
      latest,
      latestTotal: latest?.snapshot?.total ?? -1,
    };
  }).sort((a, b) => b.latestTotal - a.latestTotal);

  const cards = sortedInvestors.map(({ inv, latest }) => {
    const latestQuarter = latest ? formatQuarter(latest.quarter) : "--";
    const latestAum = latest ? `${formatB(latest.snapshot.total)}B AUM` : "AUM --";
    const holdingsCount = latest ? latest.snapshot.holdings.filter((item) => item.key !== "OTHER").length : 0;
    const styleTag = STYLE_TAG_BY_ID[inv.id] || "Multi-Strategy";
    const avatarUrl = FOUNDER_AVATAR_BY_ID[inv.id] || "";
    const initials = managerInitials(inv.manager);
    const avatarClass = avatarUrl ? "founder-avatar" : "founder-avatar fallback";
    const isTreemapHit = !focusActive || state.catalogTreemapFocusInstitutionIds.has(inv.id);
    const cardToneClass = focusActive ? (isTreemapHit ? " treemap-hit" : " treemap-muted") : "";

    return `
      <button class="institution-card${cardToneClass}" type="button" data-investor="${inv.id}" style="--card-color:${inv.color}">
        <div class="institution-top">
          <div class="institution-main">
            <p class="institution-org">${inv.org}</p>
            <p class="institution-manager">${inv.manager}</p>
          </div>
          <div class="${avatarClass}" title="${inv.manager}">
            ${
              avatarUrl
                ? `<img class="founder-photo" src="${avatarUrl}?v=${AVATAR_CACHE_VERSION}" alt="${inv.manager} profile photo" loading="lazy" referrerpolicy="no-referrer" />`
                : ""
            }
            <span>${initials}</span>
          </div>
        </div>
        <div class="institution-divider"></div>
        <div class="institution-foot">
          <span class="institution-aum">${latestAum}</span>
          <span class="institution-quarter">${latestQuarter}</span>
          <span class="institution-tag">${styleTag}</span>
          <span class="institution-holdings">${holdingsCount} Holdings${focusActive && isTreemapHit ? " · Match" : ""}</span>
        </div>
      </button>
    `;
  });

  elements.institutionGrid.innerHTML = cards.length
    ? cards.join("")
    : `<div class="empty catalog-empty">No institutions available.</div>`;
  bindFounderAvatarFallback();

  if (elements.catalogMeta) {
    elements.catalogMeta.textContent = `${cards.length} institutions available`;
  }
}

function buildTreemapLayout(items, width, height, metricKey = "value") {
  const total = items.reduce((sum, item) => sum + (Number(item[metricKey]) || 0), 0) || 1;
  const scaled = items.map((item) => ({
    ...item,
    area: ((Number(item[metricKey]) || 0) / total) * width * height,
  }));
  const layout = [];

  const place = (subset, x, y, w, h) => {
    if (!subset.length || w <= 0 || h <= 0) {
      return;
    }
    if (subset.length === 1) {
      layout.push({
        ...subset[0],
        x,
        y,
        w,
        h,
      });
      return;
    }

    const subsetArea = subset.reduce((sum, item) => sum + item.area, 0) || 1;
    let split = 1;
    let leftArea = subset[0].area;
    const half = subsetArea / 2;

    while (split < subset.length - 1 && leftArea < half) {
      leftArea += subset[split].area;
      split += 1;
    }

    const left = subset.slice(0, split);
    const right = subset.slice(split);
    const leftTotal = left.reduce((sum, item) => sum + item.area, 0);

    if (w >= h) {
      const leftWidth = subsetArea > 0 ? (leftTotal / subsetArea) * w : w / 2;
      place(left, x, y, leftWidth, h);
      place(right, x + leftWidth, y, w - leftWidth, h);
    } else {
      const leftHeight = subsetArea > 0 ? (leftTotal / subsetArea) * h : h / 2;
      place(left, x, y, w, leftHeight);
      place(right, x, y + leftHeight, w, h - leftHeight);
    }
  };

  place(scaled, 0, 0, width, height);
  return layout;
}

function getInvestorById(investorId) {
  return INVESTORS.find((inv) => inv.id === investorId) || null;
}

function applyCatalogTreemapFocus(nextKey) {
  const focusKey = nextKey && state.catalogTreemapItemsByKey.has(nextKey) ? nextKey : "";
  state.catalogTreemapFocusKey = focusKey;
  if (focusKey) {
    const focusItem = state.catalogTreemapItemsByKey.get(focusKey);
    state.catalogTreemapFocusInstitutionIds = new Set((focusItem?.holders || []).map((holder) => holder.id));
  } else {
    state.catalogTreemapFocusInstitutionIds = new Set();
  }
  renderInstitutionGrid();
  renderCatalogTreemap();
}

function renderTreemapTooltip(item, coveredInstitutions) {
  const heatPercent = round((Number(item.heatScore) || 0) * 100, 1);
  const holders = (item.holders || [])
    .slice(0, 4)
    .map((holder, idx) => {
      const investor = getInvestorById(holder.id);
      const org = investor ? investor.org : holder.id;
      return `<li><span>${idx + 1}. ${escapeHtml(org)}</span><strong>${formatB(holder.value)}B</strong></li>`;
    })
    .join("");

  return `
    <p class="treemap-tooltip-title">${escapeHtml(item.display)}</p>
    <p class="treemap-tooltip-metric">Heat Score: <strong>${heatPercent}%</strong></p>
    <p class="treemap-tooltip-metric">Coverage: <strong>${item.institutions}/${coveredInstitutions}</strong> institutions</p>
    <p class="treemap-tooltip-metric">Average Weight (All Institutions): <strong>${formatPct(item.avgWeight || 0, 2, false)}</strong></p>
    <p class="treemap-tooltip-metric">Aggregated Value: <strong>${formatB(item.value)}B</strong></p>
    ${holders ? `<ul class="treemap-tooltip-list">${holders}</ul>` : ""}
  `;
}

function renderCatalogTreemap() {
  if (!elements.institutionTreemap) {
    return;
  }

  const aggregate = new Map();
  let coveredInstitutions = 0;

  INVESTORS.forEach((investor) => {
    const latest = getLatestSnapshotForInvestor(investor);
    if (!latest || !latest.snapshot) {
      return;
    }
    coveredInstitutions += 1;
    const seen = new Set();
    latest.snapshot.holdings
      .filter((item) => item && item.key !== "OTHER" && Number.isFinite(item.value) && item.value > 0)
      .forEach((item) => {
        const key = ((item.ticker || "").trim().toUpperCase() || item.key || item.code || item.company || "").trim();
        if (!key) {
          return;
        }
        const company = cleanCompanyName(item.company || "");
        const ticker = (item.ticker || "").trim().toUpperCase();
        const display = ticker ? formatAssetLabel(company, ticker) : getHoldingDisplayLabel(item);
        if (!aggregate.has(key)) {
          aggregate.set(key, {
            key,
            ticker: ticker || key,
            company: company || cleanCompanyName(display) || key,
            display,
            value: 0,
            weightSum: 0,
            avgWeight: 0,
            institutions: 0,
            holderValueById: new Map(),
          });
        }
        const row = aggregate.get(key);
        row.value += item.value;
        row.weightSum += Number(item.weight) || 0;
        row.holderValueById.set(investor.id, (row.holderValueById.get(investor.id) || 0) + item.value);
        if (!seen.has(key)) {
          row.institutions += 1;
          seen.add(key);
        }
      });
  });

  const avgWeightDenominator = Math.max(1, coveredInstitutions);
  const rawItems = Array.from(aggregate.values()).map((item) => ({
    ...item,
    avgWeight: item.weightSum / avgWeightDenominator,
    holders: Array.from(item.holderValueById.entries())
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => b.value - a.value),
  }));

  const maxInstitutions = rawItems.reduce((max, item) => Math.max(max, item.institutions || 0), 0) || 1;
  const maxAvgWeight = rawItems.reduce((max, item) => Math.max(max, Number(item.avgWeight) || 0), 0) || 1;
  const maxValue = rawItems.reduce((max, item) => Math.max(max, Number(item.value) || 0), 0) || 1;

  const scoredItems = rawItems.map((item) => {
    const countNorm = (item.institutions || 0) / maxInstitutions;
    const avgWeightNorm = (Number(item.avgWeight) || 0) / maxAvgWeight;
    const valueNorm = (Number(item.value) || 0) / maxValue;
    const countBoost = Math.pow(clamp(countNorm, 0, 1), 1.8);
    const avgWeightBoost = Math.pow(clamp(avgWeightNorm, 0, 1), 1.55);
    const valueBoost = Math.pow(clamp(valueNorm, 0, 1), 2.2);
    const rawHeat = countBoost * 0.3 + avgWeightBoost * 0.4 + valueBoost * 0.3;
    return {
      ...item,
      rawHeat,
      countNorm,
      avgWeightNorm,
      valueNorm,
      countBoost,
      avgWeightBoost,
      valueBoost,
    };
  });

  const rawHeatMin = scoredItems.reduce((min, item) => Math.min(min, item.rawHeat), Number.POSITIVE_INFINITY);
  const rawHeatMax = scoredItems.reduce((max, item) => Math.max(max, item.rawHeat), 0);
  const rawHeatRange = Math.max(rawHeatMax - rawHeatMin, 1e-9);
  const heatFloor = 0.045;
  const contrastGamma = 1.68;
  const items = scoredItems
    .map((item) => {
      const normalized = clamp((item.rawHeat - rawHeatMin) / rawHeatRange, 0, 1);
      const contrasted = Math.pow(normalized, contrastGamma);
      return {
        ...item,
        heatScore: heatFloor + contrasted * (1 - heatFloor),
      };
    })
    .sort((a, b) => b.heatScore - a.heatScore || b.institutions - a.institutions || b.avgWeight - a.avgWeight || b.value - a.value)
    .slice(0, 24);

  state.catalogTreemapCoveredInstitutions = coveredInstitutions;
  state.catalogTreemapItemsByKey = new Map(items.map((item) => [item.key, item]));
  if (state.catalogTreemapFocusKey && !state.catalogTreemapItemsByKey.has(state.catalogTreemapFocusKey)) {
    state.catalogTreemapFocusKey = "";
    state.catalogTreemapFocusInstitutionIds = new Set();
  } else if (state.catalogTreemapFocusKey) {
    const focusItem = state.catalogTreemapItemsByKey.get(state.catalogTreemapFocusKey);
    state.catalogTreemapFocusInstitutionIds = new Set((focusItem?.holders || []).map((holder) => holder.id));
  }

  if (elements.institutionTreemapMeta) {
    if (state.catalogTreemapFocusKey) {
      const focusItem = state.catalogTreemapItemsByKey.get(state.catalogTreemapFocusKey);
      const chips = (focusItem?.holders || [])
        .slice(0, 8)
        .map((holder) => {
          const investor = getInvestorById(holder.id);
          const org = investor ? investor.org : holder.id;
          return `<span class="treemap-focus-chip">${escapeHtml(org)}</span>`;
        })
        .join("");
      elements.institutionTreemapMeta.innerHTML = `
        <div class="treemap-focus-row">
          <span class="treemap-focus-title">Focused:</span>
          <span class="treemap-focus-value">${escapeHtml(focusItem?.display || state.catalogTreemapFocusKey)}</span>
          <span class="treemap-focus-value">Heat ${round(((focusItem && focusItem.heatScore) || 0) * 100, 1)}%</span>
          <span class="treemap-focus-value">${formatPct(focusItem?.avgWeight || 0, 2, false)} avg (all)</span>
          <span class="treemap-focus-value">${formatB(focusItem?.value || 0)}B</span>
          <span class="treemap-focus-value">${focusItem?.institutions || 0} institutions</span>
          <button type="button" class="treemap-clear-btn" data-action="clear-treemap-focus">Clear</button>
        </div>
        ${chips ? `<div class="treemap-focus-chips">${chips}</div>` : ""}
      `;
    } else {
      elements.institutionTreemapMeta.innerHTML = `
        <div class="treemap-hint-row">
          <span>Area metric: weighted heat score from coverage, average weight (all institutions), and aggregated value.</span>
          <span class="treemap-hint-next">Click a block to highlight related institutions.</span>
        </div>
      `;
    }
  }

  if (!items.length) {
    if (elements.institutionTreemapMeta) {
      elements.institutionTreemapMeta.innerHTML = "";
    }
    elements.institutionTreemap.innerHTML = `<div class="treemap-empty">Treemap will appear after SEC filing data is loaded.</div>`;
    return;
  }

  const width = 1200;
  const height = 420;
  const cellGap = 2;
  const cells = buildTreemapLayout(items, width, height, "heatScore");
  const palette = makeVividPalette("#6f7ce9", cells.length);

  const gradientDefs = cells
    .map((_, idx) => {
      const baseHsl = rgbToHsl(hexToRgb(palette[idx]));
      const hueShiftSeq = [0, 14, -12, 22, -18, 30, -24, 38];
      const hue = (baseHsl.h + hueShiftSeq[idx % hueShiftSeq.length] + Math.floor(idx / hueShiftSeq.length) * 5 + 360) % 360;
      const topColor = rgbToHex(
        hslToRgb(hue, clamp(baseHsl.s * 0.92 + 0.04, 0.46, 0.95), clamp(baseHsl.l + 0.18, 0.5, 0.82))
      );
      const midColor = rgbToHex(
        hslToRgb((hue + 10) % 360, clamp(baseHsl.s * 0.84 + 0.03, 0.42, 0.9), clamp(baseHsl.l + 0.02, 0.36, 0.72))
      );
      const bottomColor = rgbToHex(
        hslToRgb((hue - 6 + 360) % 360, clamp(baseHsl.s * 0.88 + 0.04, 0.44, 0.92), clamp(baseHsl.l - 0.08, 0.28, 0.62))
      );
      return `
        <linearGradient id="tm-grad-${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${topColor}" />
          <stop offset="55%" stop-color="${midColor}" />
          <stop offset="100%" stop-color="${bottomColor}" />
        </linearGradient>
        <linearGradient id="tm-sheen-${idx}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="24%" stop-color="#ffffff" stop-opacity="0.08" />
          <stop offset="46%" stop-color="#ffffff" stop-opacity="0.3" />
          <stop offset="62%" stop-color="#ffffff" stop-opacity="0.11" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="tm-rim-${idx}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#eef4ff" stop-opacity="0.58" />
          <stop offset="100%" stop-color="#d4e0ff" stop-opacity="0.12" />
        </linearGradient>
      `;
    })
    .join("");

  const markup = cells
    .map((cell, idx) => {
      const x = round(cell.x + cellGap, 2);
      const y = round(cell.y + cellGap, 2);
      const w = round(Math.max(0, cell.w - cellGap * 2), 2);
      const h = round(Math.max(0, cell.h - cellGap * 2), 2);
      if (w <= 1 || h <= 1) {
        return "";
      }

      const cornerRadius = round(clamp(Math.min(w, h) * 0.1, 8, 16), 2);
      const padding = round(clamp(Math.min(w, h) * 0.085, 7, 14), 2);
      const innerWidth = Math.max(20, w - padding * 2);
      const innerHeight = Math.max(18, h - padding * 2);
      const rowGap = round(clamp(Math.min(w, h) * 0.042, 3.2, 8), 2);
      const nameGap = round(clamp(rowGap * 1.35 + 1.1, 4.6, 11.4), 2);
      const areaScale = clamp(Math.sqrt((w * h) / (132 * 84)), 0.72, 1.28);
      const widthScale = clamp(w / 220, 0.7, 1.22);
      const textScale = round(clamp(areaScale * 0.64 + widthScale * 0.36, 0.72, 1.28), 3);
      const textWidthBudget = Math.max(18, innerWidth * 0.94);

      const tickerRaw = cell.ticker || cell.display;
      const tickerMax = round(clamp(21.5 * textScale, 10, 24), 2);
      const tickerBaseSize = fitTextSize(tickerRaw, textWidthBudget, 7.4, tickerMax, 0.56);
      const tickerCharLimit = Math.max(4, Math.floor(textWidthBudget / Math.max(tickerBaseSize * 0.56, 4.4)));
      const mainLabel = truncateLabel(tickerRaw, tickerCharLimit);
      const tickerSize = round(
        clamp(Math.min(fitTextSize(mainLabel, textWidthBudget, 7.4, tickerMax, 0.56), innerHeight * 0.36), 7.4, tickerMax),
        2
      );
      const tickerStroke = round(clamp(tickerSize * 0.1, 0.72, 1.32), 2);

      const companyRaw = cell.company || cleanCompanyName(cell.display || "") || cell.key || "Unknown";
      const nameMax = round(clamp(13.2 * textScale, 8.2, Math.min(15.2, tickerSize * 0.76)), 2);
      const nameBaseSize = fitTextSize(companyRaw, textWidthBudget, 6.8, nameMax, 0.54);
      const nameCharLimit = Math.max(10, Math.floor(textWidthBudget / Math.max(nameBaseSize * 0.56, 4.5)));
      const secondaryLabel = truncateLabel(companyRaw, nameCharLimit);
      const nameSize = round(
        clamp(Math.min(fitTextSize(secondaryLabel, textWidthBudget, 6.8, nameMax, 0.54), innerHeight * 0.22), 6.8, nameMax),
        2
      );
      const nameStroke = round(clamp(nameSize * 0.08, 0.56, 0.9), 2);

      const valueLabel = `${formatB(cell.value)}B`;
      const heatPct = round((cell.heatScore || 0) * 100, 1);
      const heatLabel = `Heat ${heatPct}`;
      const avgWeightLabel = `Avg ${formatPct(cell.avgWeight || 0, 2, false)}`;
      const instLabel = `${cell.institutions}/${coveredInstitutions} inst`;
      let metaLines = innerWidth >= 128 && innerHeight >= 64 ? 2 : innerWidth >= 78 && innerHeight >= 34 ? 1 : 0;
      let metaLine1 = `${heatLabel} · ${avgWeightLabel}`;
      let metaLine2 = `${valueLabel} · ${instLabel}`;
      if (metaLines === 1) {
        metaLine1 = innerWidth < 92 ? `H ${heatPct}% · ${instLabel}` : `${heatLabel} · ${valueLabel}`;
      }
      const metaMax = round(clamp(10.8 * textScale, 7.1, 11.8), 2);
      let metaSize = round(
        clamp(
          Math.min(
            fitTextSize(
              metaLines === 2 ? (metaLine1.length >= metaLine2.length ? metaLine1 : metaLine2) : metaLine1,
              textWidthBudget,
              6.5,
              metaMax,
              0.56
            ),
            innerHeight * 0.14
          ),
          6.5,
          metaMax
        ),
        2
      );
      let metaStroke = round(clamp(metaSize * 0.08, 0.52, 0.84), 2);

      let showTicker = innerWidth >= 30 && innerHeight >= 15;
      let showName = innerWidth >= 78 && innerHeight >= 33;
      if (!showTicker) {
        showName = false;
        metaLines = 0;
      }

      const requiredHeight = (withName, metaCount, metaFontSize) => {
        const tickerPart = showTicker ? tickerSize * 1.02 : 0;
        const namePart = withName ? nameGap + nameSize * 1.14 : 0;
        const metaPart = metaCount > 0 ? rowGap + metaFontSize * 1.14 * metaCount : 0;
        return tickerPart + namePart + metaPart;
      };

      if (requiredHeight(showName, metaLines, metaSize) > innerHeight && metaLines === 2) {
        metaLines = 1;
        metaLine1 = innerWidth < 92 ? `H ${heatPct}% · ${instLabel}` : `${heatLabel} · ${valueLabel}`;
        metaSize = round(clamp(Math.min(fitTextSize(metaLine1, textWidthBudget, 6.5, metaMax, 0.56), innerHeight * 0.14), 6.5, metaMax), 2);
        metaStroke = round(clamp(metaSize * 0.08, 0.52, 0.84), 2);
      }
      if (requiredHeight(showName, metaLines, metaSize) > innerHeight && showName) {
        showName = false;
      }
      if (requiredHeight(showName, metaLines, metaSize) > innerHeight) {
        metaLines = 0;
      }

      const metaCharLimit = Math.max(11, Math.floor(textWidthBudget / Math.max(metaSize * 0.56, 4.2)));
      metaLine1 = truncateLabel(metaLine1, metaCharLimit);
      if (metaLines === 2) {
        metaLine2 = truncateLabel(metaLine2, metaCharLimit);
      }

      const contentHeight = requiredHeight(showName, metaLines, metaSize);
      const textX = round(x + w / 2, 2);
      const startY = y + padding + Math.max(0, (innerHeight - contentHeight) / 2);
      let cursor = startY;
      const tickerY = round(cursor + tickerSize * 0.52, 2);
      cursor += tickerSize * 1.02;
      let nameY = 0;
      if (showName) {
        cursor += nameGap;
        nameY = round(cursor + nameSize * 0.52, 2);
        cursor += nameSize * 1.12;
      }
      let metaY1 = 0;
      let metaY2 = 0;
      if (metaLines > 0) {
        cursor += rowGap;
        metaY1 = round(cursor + metaSize * 0.5, 2);
        if (metaLines === 2) {
          cursor += metaSize * 1.08;
          metaY2 = round(cursor + metaSize * 0.5, 2);
        }
      }

      const isActive = state.catalogTreemapFocusKey && state.catalogTreemapFocusKey === cell.key;
      const isMuted = state.catalogTreemapFocusKey && state.catalogTreemapFocusKey !== cell.key;
      const title = `${cell.display} | ${heatLabel} | ${avgWeightLabel} | ${valueLabel} | ${instLabel}`;

      return `
        <g class="treemap-cell${isActive ? " is-active" : ""}${isMuted ? " is-muted" : ""}" data-key="${escapeHtml(cell.key)}">
          <rect class="treemap-block" x="${x}" y="${y}" width="${w}" height="${h}" rx="${cornerRadius}" ry="${cornerRadius}" fill="url(#tm-grad-${idx})" />
          <rect class="treemap-metal-sheen" x="${x}" y="${y}" width="${w}" height="${h}" rx="${cornerRadius}" ry="${cornerRadius}" fill="url(#tm-sheen-${idx})"></rect>
          <rect class="treemap-rim" x="${x}" y="${y}" width="${w}" height="${h}" rx="${cornerRadius}" ry="${cornerRadius}" stroke="url(#tm-rim-${idx})"></rect>
          <title>${escapeHtml(title)}</title>
          ${
            showTicker
              ? `<text class="treemap-ticker" x="${textX}" y="${tickerY}" style="font-size:${tickerSize}px; letter-spacing:${round(
                  clamp(tickerSize / 650, 0.012, 0.045),
                  3
                )}em; stroke-width:${tickerStroke}px;" text-anchor="middle" dominant-baseline="middle">${escapeHtml(mainLabel)}</text>`
              : ""
          }
          ${
            showName
              ? `<text class="treemap-name" x="${textX}" y="${nameY}" style="font-size:${nameSize}px; stroke-width:${nameStroke}px;" text-anchor="middle" dominant-baseline="middle">${escapeHtml(
                  secondaryLabel
                )}</text>`
              : ""
          }
          ${
            metaLines > 0
              ? `<text class="treemap-meta" x="${textX}" y="${metaY1}" style="font-size:${metaSize}px; stroke-width:${metaStroke}px;" text-anchor="middle" dominant-baseline="middle">${escapeHtml(
                  metaLine1
                )}</text>
                 ${
                   metaLines === 2
                     ? `<text class="treemap-meta" x="${textX}" y="${metaY2}" style="font-size:${metaSize}px; stroke-width:${metaStroke}px;" text-anchor="middle" dominant-baseline="middle">${escapeHtml(
                         metaLine2
                       )}</text>`
                     : ""
                 }`
              : ""
          }
        </g>
      `;
    })
    .join("");

  elements.institutionTreemap.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Popular holdings treemap">
      <defs>
        ${gradientDefs}
      </defs>
      ${markup}
    </svg>
    <div class="treemap-tooltip" hidden></div>
  `;
}

function bindCatalogTreemapInteractions() {
  if (elements.institutionTreemap && elements.institutionTreemap.dataset.bound !== "1") {
    elements.institutionTreemap.dataset.bound = "1";
    elements.institutionTreemap.addEventListener("pointermove", (event) => {
      const target = event.target;
      const cell = target && typeof target.closest === "function" ? target.closest(".treemap-cell[data-key]") : null;
      const tooltip = elements.institutionTreemap.querySelector(".treemap-tooltip");
      if (!tooltip) {
        return;
      }
      if (!cell) {
        tooltip.hidden = true;
        return;
      }

      const key = cell.dataset.key || "";
      const item = state.catalogTreemapItemsByKey.get(key);
      if (!item) {
        tooltip.hidden = true;
        return;
      }

      tooltip.innerHTML = renderTreemapTooltip(item, Math.max(1, state.catalogTreemapCoveredInstitutions || INVESTORS.length));
      tooltip.hidden = false;
      const box = elements.institutionTreemap.getBoundingClientRect();
      const desiredLeft = event.clientX - box.left + 14;
      const desiredTop = event.clientY - box.top + 14;
      const maxLeft = Math.max(8, box.width - tooltip.offsetWidth - 8);
      const maxTop = Math.max(8, box.height - tooltip.offsetHeight - 8);
      const left = clamp(desiredLeft, 8, maxLeft);
      const top = clamp(desiredTop, 8, maxTop);
      tooltip.style.left = `${round(left, 1)}px`;
      tooltip.style.top = `${round(top, 1)}px`;
    });

    elements.institutionTreemap.addEventListener("pointerleave", () => {
      const tooltip = elements.institutionTreemap.querySelector(".treemap-tooltip");
      if (tooltip) {
        tooltip.hidden = true;
      }
    });

    elements.institutionTreemap.addEventListener("click", (event) => {
      const target = event.target;
      const cell = target && typeof target.closest === "function" ? target.closest(".treemap-cell[data-key]") : null;
      if (!cell) {
        return;
      }
      const key = cell.dataset.key || "";
      applyCatalogTreemapFocus(state.catalogTreemapFocusKey === key ? "" : key);
    });
  }

  if (elements.institutionTreemapMeta && elements.institutionTreemapMeta.dataset.bound !== "1") {
    elements.institutionTreemapMeta.dataset.bound = "1";
    elements.institutionTreemapMeta.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action='clear-treemap-focus']");
      if (!btn) {
        return;
      }
      applyCatalogTreemapFocus("");
    });
  }
}

function renderQuarterSelector() {
  if (!elements.quarterSelect) {
    return;
  }
  const investor = activeInvestor();
  const availableQuarters = investor ? getAvailableQuartersForInvestor(investor) : [];
  const options = availableQuarters.length
    ? [...availableQuarters].sort((a, b) => quarterIndex(b) - quarterIndex(a))
    : [LATEST_QUARTER];

  if (!options.includes(state.quarter)) {
    state.quarter = options[0];
  }

  elements.quarterSelect.innerHTML = options.map((quarter) => `<option value="${quarter}">${formatQuarter(quarter)}</option>`).join("");
  elements.quarterSelect.value = state.quarter;
  elements.quarterSelect.disabled = !investor || !availableQuarters.length;
}

function bindControlActions() {
  if (elements.institutionGrid) {
    elements.institutionGrid.addEventListener("click", (event) => {
      const card = event.target.closest(".institution-card");
      if (!card) {
        return;
      }
      const investorId = card.dataset.investor || "";
      if (!investorId) {
        return;
      }

      state.activeInvestorId = investorId;
      state.expanded.clear();

      const investor = activeInvestor();
      const availableQuarters = investor ? getAvailableQuartersForInvestor(investor) : [];
      state.quarter = availableQuarters.length ? availableQuarters[availableQuarters.length - 1] : LATEST_QUARTER;

      showDetailView();
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (elements.backToListBtn) {
    elements.backToListBtn.addEventListener("click", () => {
      showCatalogView();
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (elements.quarterSelect) {
    elements.quarterSelect.addEventListener("change", (event) => {
      state.quarter = event.target.value;
      renderAll();
    });
  }
}

function renderDetailHeader() {
  const investor = activeInvestor();
  if (!investor) {
    if (elements.detailOrgTitle) {
      elements.detailOrgTitle.textContent = "--";
    }
    if (elements.detailManagerLine) {
      elements.detailManagerLine.textContent = "--";
    }
    if (elements.detailLinks) {
      elements.detailLinks.innerHTML = "";
      elements.detailLinks.hidden = true;
    }
    if (elements.detailQuickStats) {
      elements.detailQuickStats.innerHTML = "";
    }
    return;
  }

  const latest = getLatestSnapshotForInvestor(investor);
  const current = getDisplaySnapshot(investor, state.quarter);
  const meta = state.managerMetaById.get(investor.id);
  const cikText = meta?.cik ? `CIK ${meta.cik}` : "CIK --";

  if (elements.detailOrgTitle) {
    elements.detailOrgTitle.textContent = investor.org;
  }
  if (elements.detailManagerLine) {
    elements.detailManagerLine.innerHTML = `<span class="detail-manager-name">${investor.manager}</span> · ${cikText} · SEC 13F`;
  }
  if (elements.detailLinks) {
    const website = OFFICIAL_WEBSITE_BY_ID[investor.id] || "";
    if (website) {
      elements.detailLinks.innerHTML = `<a class="detail-link-btn" href="${website}" target="_blank" rel="noopener noreferrer">Official Website</a>`;
      elements.detailLinks.hidden = false;
    } else {
      elements.detailLinks.innerHTML = "";
      elements.detailLinks.hidden = true;
    }
  }

  const statRows = [
    { label: "Current Quarter", value: formatQuarter(state.quarter) },
    { label: "Quarter-End Net Assets", value: current ? `${formatB(current.total)}B` : "--" },
    {
      label: "Holdings Count",
      value: current ? `${current.holdings.filter((item) => item.key !== "OTHER").length}` : "--",
    },
    {
      label: "Latest Filing",
      value: latest ? `${formatQuarter(latest.quarter)} (${latest.snapshot.filingDate})` : "--",
    },
  ];

  if (elements.detailQuickStats) {
    elements.detailQuickStats.innerHTML = statRows
      .map(
        (item) => `
          <div class="detail-stat">
            <span>${item.label}</span>
            <strong>${item.value}</strong>
          </div>
        `
      )
      .join("");
  }
}

function renderHoldingsCards() {
  const selected = selectedInvestors();
  if (!selected.length) {
    elements.holdingsCards.innerHTML = `<div class="empty">Please select an institution</div>`;
    return;
  }

  elements.holdingsCards.innerHTML = selected
    .map((inv) => {
      const snapshot = getDisplaySnapshot(inv, state.quarter);
      if (!snapshot) {
        return `
          <article class="holding-card">
            <div class="holding-card-head">
              <span class="investor-tag" style="--tag-color:${inv.color}">${inv.org}</span>
              <div class="holding-card-actions">
                <p class="holding-card-meta">${formatQuarter(state.quarter)} | No 13F filing for this quarter</p>
              </div>
            </div>
            <div class="empty">No 13F holdings data available for this quarter</div>
          </article>
        `;
      }

      const unit = getValuationUnit(snapshot.total);
      const companyHoldings = snapshot.holdings.filter((item) => item.key !== "OTHER");
      const expanded = state.expanded.has(inv.id);
      const visibleCompanies = expanded ? companyHoldings : companyHoldings.slice(0, 15);
      const displayRows = visibleCompanies;

      const rows = displayRows
        .map((item) => {
          const label = getHoldingDisplayLabel(item);
          if (item.key === "OTHER") {
            return `
              <tr>
                <td>${label}</td>
                <td>${formatPct(item.weight)}</td>
                <td>${formatByUnit(item.value, unit)}</td>
                <td><span class="delta neutral">--</span></td>
              </tr>
            `;
          }

          const delta = getHoldingDelta(inv, item.key, state.quarter, unit);
          return `
            <tr>
              <td>${label}</td>
              <td>${formatPct(item.weight)}</td>
              <td>${formatByUnit(item.value, unit)}</td>
              <td><span class="delta ${delta.cls}">${delta.text}</span></td>
            </tr>
          `;
        })
        .join("");

      const pieMaxSegments = 220;
      const pieRaw = companyHoldings.length > pieMaxSegments ? companyHoldings.slice(0, pieMaxSegments) : companyHoldings;
      const pieRawWeightSum = pieRaw.reduce((acc, item) => acc + item.weight, 0) || 1;
      const pieSegments = pieRaw.map((item) => ({
        ...item,
        pieWeight: item.weight / pieRawWeightSum,
      }));
      const palette = makeVividPalette(inv.color, pieSegments.length);
      const pieMarkup = renderInteractivePie(
        pieSegments.map((item) => ({
          ...item,
          weight: item.pieWeight,
          rawWeight: item.weight,
        })),
        palette
      );

      return `
        <article class="holding-card ${expanded ? "expanded" : ""}">
          <div class="holding-card-head">
            <span class="investor-tag" style="--tag-color:${inv.color}">
              ${inv.org}
            </span>
            <div class="holding-card-actions">
              <p class="holding-card-meta">
                ${inv.manager} | ${formatQuarter(state.quarter)} | Net Assets ${formatB(snapshot.total)}B | ${companyHoldings.length} holdings | SEC 13F
              </p>
            </div>
          </div>
          <div class="holding-card-body">
            <div>
              <div class="table-wrap holding-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Security</th>
                      <th>Weight</th>
                      <th>Mkt Value (${unit.short})</th>
                      <th>QoQ Delta</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>
              ${
                companyHoldings.length > 15
                  ? `
                <div class="table-actions">
                  <button class="expand-btn" data-investor="${inv.id}">
                    ${expanded ? "Collapse" : "Expand All"}
                  </button>
                </div>
              `
                  : ""
              }
            </div>
            <div class="holding-pie">
              <div class="pie-content">
                ${pieMarkup}
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function formatChangeAmplitude(change) {
  if (change.action === "New") {
    return "New";
  }
  if (change.action === "Exit") {
    return "-100%";
  }
  if (typeof change.changeRatio === "number") {
    const absRatio = Math.abs(change.changeRatio);
    if (absRatio > 0 && absRatio < 0.001) {
      return change.changeRatio > 0 ? "+<0.1%" : "-<0.1%";
    }
    return formatPct(change.changeRatio, 1, true);
  }
  if (change.ratioSource === "value" && change.changeRatio !== null) {
    return formatPct(change.changeRatio, 1, true);
  }
  return "Not Disclosed";
}

function renderChangesCards() {
  const idx = quarterIndex(state.quarter);
  const selected = selectedInvestors();
  if (!selected.length) {
    elements.changesCards.innerHTML = `<div class="empty">Please select an institution</div>`;
    return;
  }

  if (idx <= 0) {
    elements.changesCards.innerHTML = `<div class="empty">No prior quarter available for comparison.</div>`;
    return;
  }

  const cards = selected.map((inv) => {
    const snapshot = getDisplaySnapshot(inv, state.quarter);
    if (!snapshot) {
      return `
        <article class="change-card">
          <div class="change-card-head">
            <span class="investor-tag" style="--tag-color:${inv.color}">${inv.org}</span>
            <p>${inv.manager}</p>
          </div>
          <div class="changes-empty">No 13F holdings data available for this quarter</div>
        </article>
      `;
    }

    const unit = getValuationUnit(snapshot.total);
    const allChanges = getQuarterChanges(inv, state.quarter);
    const addRows = allChanges.filter((item) => item.direction > 0).sort((a, b) => b.changeAmount - a.changeAmount);
    const cutRows = allChanges.filter((item) => item.direction < 0).sort((a, b) => b.changeAmount - a.changeAmount);
    const addTotal = addRows.reduce((sum, item) => sum + item.changeAmount, 0);
    const cutTotal = cutRows.reduce((sum, item) => sum + item.changeAmount, 0);
    const netFlow = addTotal - cutTotal;
    const weightByKey = new Map(snapshot.holdings.map((item) => [item.key, item.weight]));
    const topAdd = addRows[0] ? addRows[0].displayLabel : "--";
    const topCut = cutRows[0] ? cutRows[0].displayLabel : "--";

    const renderGroup = (title, tone, rows) => {
      const toneClass = tone === "up" ? "up" : "down";
      const total = rows.reduce((sum, item) => sum + item.changeAmount, 0);
      if (!rows.length) {
        return `
          <section class="change-group ${toneClass}">
            <h4>${title}</h4>
            <p class="changes-empty">No material changes this quarter</p>
          </section>
        `;
      }
      const list = rows
        .map(
          (change, rankIdx) => `
            <li class="change-pro-row">
              <span class="col-rank">${rankIdx + 1}</span>
              <div class="col-name">
                <strong>${change.displayLabel}</strong>
                <em class="action-pill ${change.action === "New" ? "new" : change.action === "Exit" ? "exit" : toneClass}">
                  ${change.action}
                </em>
              </div>
              <span class="col-amount">${formatByUnit(change.changeAmount, unit)}</span>
              <span class="col-share ${toneClass}">${formatChangeAmplitude(change)}</span>
              <span class="col-weight">${weightByKey.has(change.key) ? formatPct(weightByKey.get(change.key), 2) : "--"}</span>
            </li>
          `
        )
        .join("");

      return `
        <section class="change-group ${toneClass}">
          <div class="change-group-head">
            <h4>${title}</h4>
            <p>${rows.length} items | Total ${formatByUnit(total, unit)} ${unit.short}</p>
          </div>
          <div class="change-grid-head">
            <span>#</span>
            <span>Company</span>
            <span>Amount <em>(${unit.short})</em></span>
            <span>Share Change</span>
            <span>Current Weight</span>
          </div>
          <ol class="change-pro-list">${list}</ol>
        </section>
      `;
    };

    return `
      <article class="change-card">
        <div class="change-card-head">
          <div>
            <span class="investor-tag" style="--tag-color:${inv.color}">${inv.org}</span>
            <p>${inv.manager} · ${formatQuarter(state.quarter)}</p>
          </div>
          <div class="change-metrics">
            <div class="change-metric up">
              <span>Total Adds</span>
              <strong>${formatByUnit(addTotal, unit)} ${unit.short}</strong>
              <em>${addRows.length} items</em>
            </div>
            <div class="change-metric down">
              <span>Total Trims</span>
              <strong>${formatByUnit(cutTotal, unit)} ${unit.short}</strong>
              <em>${cutRows.length} items</em>
            </div>
            <div class="change-metric ${netFlow >= 0 ? "up" : "down"}">
              <span>Net Change</span>
              <strong>${formatDeltaByUnit(netFlow, unit)}</strong>
            </div>
          </div>
        </div>
        <div class="change-highlights">
          <span>Top Add: ${topAdd}</span>
          <span>Top Trim: ${topCut}</span>
        </div>
        <div class="change-groups">
          ${renderGroup("Add Ranking (by buy intensity)", "up", addRows)}
          ${renderGroup("Trim Ranking (by sell intensity)", "down", cutRows)}
        </div>
      </article>
    `;
  });

  elements.changesCards.innerHTML = cards.join("");
}

function renderAll() {
  renderInstitutionGrid();
  renderCatalogTreemap();
  if (state.view === "list") {
    showCatalogView();
    return;
  }
  showDetailView();
  renderDetailHeader();
  renderQuarterSelector();
  renderStyleRadarPanel();
  renderAumTrendPanel();
  renderHoldingsCards();
  renderChangesCards();
}

function snapshotFilename() {
  const investor = activeInvestor();
  const investorId = investor?.id || "institution";
  const quarter = state.quarter || "quarter";
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes()
  )}${pad(now.getSeconds())}`;
  return `13f-${investorId}-${quarter}-snapshot-${stamp}.png`;
}

function waitDoubleFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function waitMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function captureDetailSnapshot() {
  const btn = elements.snapshotBtn;
  if (!btn || !elements.detailView || state.view !== "detail") {
    return;
  }
  if (typeof window.html2canvas !== "function") {
    btn.textContent = "Snapshot tool unavailable";
    setTimeout(() => {
      btn.textContent = "Download Snapshot";
    }, 1200);
    return;
  }

  const prevScrollX = window.scrollX;
  const prevScrollY = window.scrollY;

  btn.disabled = true;
  btn.textContent = "Rendering...";

  try {
    document.body.classList.add("snapshot-mode");
    await waitDoubleFrame();
    await waitMs(260);

    const target = elements.detailView;
    const width = Math.ceil(target.scrollWidth);
    const height = Math.ceil(target.scrollHeight);
    const canvas = await window.html2canvas(target, {
      backgroundColor: "#0f1730",
      useCORS: true,
      allowTaint: true,
      logging: false,
      scale: Math.min(2, window.devicePixelRatio || 1),
      width,
      height,
      windowWidth: Math.max(width, document.documentElement.clientWidth),
      windowHeight: Math.max(height, document.documentElement.clientHeight),
      scrollX: 0,
      scrollY: 0,
    });

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = snapshotFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();

    btn.textContent = "Snapshot Downloaded";
    setTimeout(() => {
      btn.textContent = "Download Snapshot";
    }, 1000);
  } catch (error) {
    console.error("snapshot capture failed", error);
    btn.textContent = "Snapshot Failed";
    setTimeout(() => {
      btn.textContent = "Download Snapshot";
    }, 1200);
  } finally {
    document.body.classList.remove("snapshot-mode");
    window.scrollTo(prevScrollX, prevScrollY);
    btn.disabled = false;
  }
}

function bindSnapshotAction() {
  if (!elements.snapshotBtn) {
    return;
  }
  elements.snapshotBtn.addEventListener("click", () => {
    void captureDetailSnapshot();
  });
}

bindControlActions();
bindHoldingsCardActions();
bindCatalogTreemapInteractions();
bindSnapshotAction();
showCatalogView();
renderAll();
loadSecHistoryData();
