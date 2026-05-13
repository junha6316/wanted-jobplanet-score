const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const normalize = (name) =>
  name
    .replace(/\(주\)|주식회사|㈜|\(유\)|\(재\)/g, "")
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

const parseCompanies = (rscText) => {
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

const pickBest = (companies, query) => {
  if (companies.length === 0) return null;
  const qn = normalize(query);
  const exact = companies.find((c) => normalize(c.name) === qn);
  if (exact) return exact;
  const containsQuery = companies.find((c) => normalize(c.name).includes(qn));
  if (containsQuery) return containsQuery;
  const queryContains = companies.find((c) => qn.includes(normalize(c.name)) && normalize(c.name).length >= 2);
  if (queryContains) return queryContains;
  return companies[0];
};

const fetchReviewCount = async (companyId) => {
  try {
    const res = await fetch(
      `https://www.jobplanet.co.kr/api/v4/companies/reviews/list?device=desktop&company_id=${companyId}&page=1`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.total_count ?? null;
  } catch (err) {
    console.warn("[WJP] review count fetch failed", err);
    return null;
  }
};

const fetchScore = async (rawName) => {
  const cacheKey = `score:${normalize(rawName)}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    console.log("[WJP] cache hit", rawName);
    return cached;
  }

  const url = `https://www.jobplanet.co.kr/search/companies?query=${encodeURIComponent(rawName)}`;
  console.log("[WJP] fetching", url);

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      RSC: "1",
      Accept: "*/*",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    },
  });

  console.log("[WJP] response", res.status);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  const companies = parseCompanies(text);
  console.log("[WJP] parsed companies", companies.length, companies.slice(0, 3));

  if (companies.length === 0) {
    const result = { state: "not_found" };
    await setCached(cacheKey, result);
    return result;
  }

  const best = pickBest(companies, rawName);
  const reviewCount = await fetchReviewCount(best.id);

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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "FETCH_JOBPLANET_SCORE") return;

  fetchScore(msg.company)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => {
      console.error("[WJP] fetch failed", err);
      sendResponse({ ok: false, message: err.message || String(err) });
    });

  return true;
});
