const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const normalize = (name) =>
  name
    .replace(/\(주\)|주식회사|㈜|\(유\)|\(재\)|\(사\)|유한회사|재단법인|사단법인/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(inc|incorporated|ltd|limited|co|corp|corporation|llc)\b\.?/gi, "")
    .replace(/[,\.\-_/]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

const getCached = async (key) => {
  const data = await chrome.storage.local.get(key);
  const entry = data[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.value;
};

const setCached = async (key, value) => {
  await chrome.storage.local.set({ [key]: { ts: Date.now(), value } });
};

const pickBest = (companies, query) => {
  if (companies.length === 0) return null;
  const qn = normalize(query);
  if (qn.length < 2) return null;

  const exact = companies.find((c) => normalize(c.name) === qn);
  if (exact) return exact;

  for (const c of companies) {
    const cn = normalize(c.name);
    if (cn.length === 0) continue;
    const [longer, shorter] = cn.length >= qn.length ? [cn, qn] : [qn, cn];
    if (
      longer.includes(shorter) &&
      shorter.length >= 4 &&
      longer.length - shorter.length <= 2
    ) {
      return c;
    }
  }

  return null;
};

// =================== JobPlanet ===================

const parseJobPlanetCompanies = (rscText) => {
  const re = /\{"company_id":(\d+),"name":"([^"]+)"[^}]*?"rate_total_avg":([\d.]+)(?:[^}]*?"strength_keyword":"([^"]*)")?/g;
  const out = [];
  let m;
  while ((m = re.exec(rscText)) !== null) {
    out.push({
      id: m[1],
      name: m[2],
      rating: parseFloat(m[3]),
      strength: m[4] || null,
    });
  }
  return out;
};

const fetchJobPlanetReviewCount = async (companyId) => {
  try {
    const res = await fetch(
      `https://www.jobplanet.co.kr/api/v4/companies/reviews/list?device=desktop&company_id=${companyId}&page=1`,
      { credentials: "include", headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.total_count ?? null;
  } catch (err) {
    console.warn("[WJP] review count fetch failed", err);
    return null;
  }
};

const fetchJobPlanet = async (rawName) => {
  const cacheKey = `jp:${normalize(rawName)}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const url = `https://www.jobplanet.co.kr/search/companies?query=${encodeURIComponent(rawName)}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: { RSC: "1", Accept: "*/*", "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  const companies = parseJobPlanetCompanies(text);
  const best = pickBest(companies, rawName);

  if (!best) {
    const result = { state: "not_found" };
    await setCached(cacheKey, result);
    return result;
  }

  const reviewCount = await fetchJobPlanetReviewCount(best.id);
  const result = {
    state: "ok",
    rating: best.rating,
    strength: best.strength,
    reviewCount,
    matchedName: best.name,
    url: `https://www.jobplanet.co.kr/companies/${best.id}`,
  };
  await setCached(cacheKey, result);
  return result;
};

// =================== Saramin ===================

const parseSaraminCompanies = (html) => {
  const nameRe = /<a[^>]+href="\/zf_user\/company-info\/view\?csn=([^"&]+)"[^>]*class="[^"]*company_nm[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  const positions = [];
  let m;
  while ((m = nameRe.exec(html)) !== null) {
    positions.push({
      csn: m[1],
      name: m[2].replace(/<[^>]+>/g, "").trim(),
      pos: m.index,
    });
  }

  const seen = new Set();
  const unique = positions.filter((p) => {
    if (seen.has(p.csn)) return false;
    seen.add(p.csn);
    return true;
  });

  return unique.map((p, i) => {
    const nextPos = unique[i + 1]?.pos ?? p.pos + 4000;
    const block = html.slice(p.pos, nextPos);
    const salaryMatch = block.match(
      /평균연봉<\/dt>\s*<dd[^>]*>\s*([\d,]+\s*만원|[\d,]+\s*억)/
    );
    const profitMatch = block.match(
      /영업이익<\/dt>\s*<dd[^>]*>\s*(-?\s*[\d,.]+\s*(?:억|만원|천만원))/
    );
    return {
      id: p.csn,
      name: p.name,
      salary: salaryMatch?.[1]?.replace(/\s+/g, "") || null,
      profit: profitMatch?.[1]?.replace(/\s+/g, "") || null,
    };
  });
};

const fetchSaramin = async (rawName) => {
  const cacheKey = `sr:${normalize(rawName)}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const url = `https://www.saramin.co.kr/zf_user/search/company?searchword=${encodeURIComponent(rawName)}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "text/html", "Accept-Language": "ko-KR,ko;q=0.9" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const companies = parseSaraminCompanies(html);
  console.log("[WJP] saramin parsed", companies.length, companies.slice(0, 3));

  const best = pickBest(companies, rawName);
  if (!best || (!best.salary && !best.profit)) {
    const result = { state: "not_found" };
    await setCached(cacheKey, result);
    return result;
  }

  const result = {
    state: "ok",
    salary: best.salary,
    profit: best.profit,
    matchedName: best.name,
    url: `https://www.saramin.co.kr/zf_user/company-info/view?csn=${encodeURIComponent(best.id)}`,
  };
  await setCached(cacheKey, result);
  return result;
};

// =================== message handler ===================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "FETCH_JOBPLANET_SCORE") {
    fetchJobPlanet(msg.company)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => {
        console.error("[WJP] jobplanet fetch failed", err);
        sendResponse({ ok: false, message: err.message || String(err) });
      });
    return true;
  }
  if (msg?.type === "FETCH_SARAMIN_INFO") {
    fetchSaramin(msg.company)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => {
        console.error("[WJP] saramin fetch failed", err);
        sendResponse({ ok: false, message: err.message || String(err) });
      });
    return true;
  }
});
