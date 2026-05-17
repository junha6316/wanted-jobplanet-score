const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Per-source cache versions. Bump only the source whose parser/URL changed,
// so unrelated sources keep their cached entries.
const CACHE_VERSION = { jp: 3, bl: 3, sr: 4 };

const normalize = (name) =>
  name
    .replace(/\(주\)|주식회사|㈜|\(유\)|\(재\)|\(사\)|유한회사|재단법인|사단법인/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(inc|incorporated|ltd|limited|co|corp|corporation|llc)\b\.?/gi, "")
    .replace(/[,\.\-_/]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

const stripParens = (name) => name.replace(/\([^)]*\)/g, "").trim();

// key: Wanted 회사명의 normalize() 결과
// jpId/srId: 검색 결과 중 해당 ID를 가진 회사를 직접 선택 (pickBest 우회)
// jpSearch/srSearch: 원티드 이름 대신 사용할 검색 쿼리
// blAlias: 블라인드 /kr/company/<alias> URL에 들어갈 회사 등록명
const COMPANY_MAP = {
  "넷플릭스": { jpId: "333564", jpSearch: "넷플릭스서비시스코리아" },
  "구글": { jpId: "44566", jpSearch: "구글코리아" },
  "애플": { jpId: "21479", jpSearch: "애플코리아" },
  "테슬라": { jpId: "324204", jpSearch: "테슬라코리아" },
  "나이키": { jpId: "3719", jpSearch: "나이키코리아" },
  "효성itx": { jpId: "285", jpSearch: "효성아이티엑스" },
  "펑타이그레이터차이나": { jpId: "310604", jpSearch: "펑타이그레이터차이나" },
  "글루가": { jpId: "355986", jpSearch: "오호라" },
  "네이버": { blAlias: "NAVER" },
  "쿠팡": { blAlias: "Coupang" },
  "토스": { blAlias: "비바리퍼블리카" },
  "라인": { blAlias: "라인플러스" },
  "당근": { blAlias: "당근마켓" },
  "배민": { blAlias: "우아한형제들" },
  "배달의민족": { blAlias: "우아한형제들" },
};

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

// 같은 cacheKey로 동시에 들어온 요청은 첫 Promise를 공유한다.
// 캐시 hit 경로(storage.local.get)와 네트워크 fetch 경로 모두를 묶기 위해
// 각 fetcher의 최외곽을 감싼다. 같은 회사가 한 페이지에 여러 번 노출돼
// 동시에 요청될 때 storage 조회/네트워크 호출의 중복을 모두 제거한다.
const inflight = new Map();
const dedupe = (key, work) => {
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = work();
  inflight.set(key, p);
  p.finally(() => inflight.delete(key));
  return p;
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
  const normalized = normalize(rawName);
  const cacheKey = `jp:v${CACHE_VERSION.jp}:${normalized}`;

  return dedupe(cacheKey, async () => {
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const override = COMPANY_MAP[normalized];
    const searchQuery = override?.jpSearch || stripParens(rawName) || rawName;

    const url = `https://www.jobplanet.co.kr/search/companies?query=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(url, {
      credentials: "include",
      headers: { RSC: "1", Accept: "*/*", "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    const companies = parseJobPlanetCompanies(text);
    const overrideMatch = override?.jpId
      ? companies.find((c) => c.id === override.jpId)
      : null;
    const best = overrideMatch ?? pickBest(companies, searchQuery);

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
  });
};

// =================== Saramin ===================

const parseSaraminCompanies = (html) => {
  // Saramin가 2026년 들어 검색결과 마크업을 바꿨음:
  //   - 회사 anchor: class="company_nm" → <h2 class="corp_name"><a ... class="company_popup">
  //   - 영업이익: <dt>/<dd> → 숨김 <li>, 단위 "만원/천만원" → "만/억"
  const nameRe = /<h2[^>]+class="[^"]*corp_name[^"]*"[^>]*>\s*<a[^>]+href="\/zf_user\/company-info\/view\?csn=([^"&]+)"[^>]*>([\s\S]*?)<\/a>/g;
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
      /<li[^>]*>\s*영업이익\s+(-?\s*[\d,.]+\s*(?:억|만|조))/
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
  const normalized = normalize(rawName);
  const cacheKey = `sr:v${CACHE_VERSION.sr}:${normalized}`;

  return dedupe(cacheKey, async () => {
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const override = COMPANY_MAP[normalized];
    const searchQuery = override?.srSearch || stripParens(rawName) || rawName;

    const url = `https://www.saramin.co.kr/zf_user/search/company?searchword=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "text/html", "Accept-Language": "ko-KR,ko;q=0.9" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const companies = parseSaraminCompanies(html);
    console.log("[WJP] saramin parsed", companies.length, companies.slice(0, 3));

    const overrideMatch = override?.srId
      ? companies.find((c) => c.id === override.srId)
      : null;
    const best = overrideMatch ?? pickBest(companies, searchQuery);
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
  });
};

// =================== Blind ===================

const parseBlindRating = (html) => {
  // SSR JSON-LD: {"@type":"EmployerAggregateRating","ratingValue":"3.8","ratingCount":20,
  //   "itemReviewed":{"@type":"Organization","name":"...","sameAs":"..."}}
  const re = /"@type"\s*:\s*"EmployerAggregateRating"[\s\S]*?"ratingValue"\s*:\s*"?([\d.]+)"?[\s\S]*?"ratingCount"\s*:\s*(\d+)[\s\S]*?"itemReviewed"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]+)"/;
  const m = re.exec(html);
  if (!m) return null;
  return {
    rating: parseFloat(m[1]),
    reviewCount: parseInt(m[2], 10),
    matchedName: m[3],
  };
};

const fetchBlind = async (rawName) => {
  const normalized = normalize(rawName);
  const cacheKey = `bl:v${CACHE_VERSION.bl}:${normalized}`;

  return dedupe(cacheKey, async () => {
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const override = COMPANY_MAP[normalized];
    const query = override?.blAlias || stripParens(rawName) || rawName;
    const url = `https://www.teamblind.com/kr/company/${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      credentials: "omit",
      headers: { Accept: "text/html", "Accept-Language": "ko-KR,ko;q=0.9" },
    });

    if (res.status === 404) {
      const result = { state: "not_found" };
      await setCached(cacheKey, result);
      return result;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const parsed = parseBlindRating(html);
    if (!parsed) {
      const result = { state: "not_found" };
      await setCached(cacheKey, result);
      return result;
    }

    const result = {
      state: "ok",
      rating: parsed.rating,
      reviewCount: parsed.reviewCount,
      matchedName: parsed.matchedName,
      url,
    };
    await setCached(cacheKey, result);
    return result;
  });
};

// =================== Update check (GitHub Releases) ===================

const UPDATE_REPO = "junha6316/wanted-jobplanet-score";
const UPDATE_ALARM_NAME = "wjp-update-check";
const UPDATE_CHECK_PERIOD_MIN = 24 * 60; // 1 day
const UPDATE_NOTIF_ID_PREFIX = "wjp-update-";

const parseSemver = (v) => String(v).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
const isStrictlyNewer = (latest, current) => {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
};

const checkForUpdate = async () => {
  try {
    const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const json = await res.json();
    const latestTag = json?.tag_name;
    const releaseUrl = json?.html_url;
    if (!latestTag) return;

    const current = chrome.runtime.getManifest().version;
    if (!isStrictlyNewer(latestTag, current)) {
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "Wanted × JobPlanet Score" });
      return;
    }

    chrome.action.setBadgeText({ text: "NEW" });
    chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
    chrome.action.setTitle({
      title: `새 버전 ${latestTag} 사용 가능 (현재 ${current}) — 클릭하여 받기`,
    });
    await chrome.storage.local.set({ latestReleaseUrl: releaseUrl, latestVersion: latestTag });

    // 한 번 본 버전은 토스트로 다시 알리지 않음 (배지는 계속 유지)
    const { notifiedVersion } = await chrome.storage.local.get("notifiedVersion");
    if (notifiedVersion !== latestTag) {
      chrome.notifications.create(UPDATE_NOTIF_ID_PREFIX + latestTag, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: `새 버전 ${latestTag}`,
        message: "Wanted × JobPlanet Score 업데이트가 있습니다. 확장 아이콘을 클릭하면 받는 페이지로 이동합니다.",
        priority: 1,
      });
      await chrome.storage.local.set({ notifiedVersion: latestTag });
    }
  } catch (err) {
    console.warn("[WJP] update check failed", err);
  }
};

const openReleasePage = async () => {
  const { latestReleaseUrl } = await chrome.storage.local.get("latestReleaseUrl");
  const url = latestReleaseUrl || `https://github.com/${UPDATE_REPO}/releases`;
  await chrome.tabs.create({ url });
  chrome.action.setBadgeText({ text: "" });
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(UPDATE_ALARM_NAME, { periodInMinutes: UPDATE_CHECK_PERIOD_MIN });
  checkForUpdate();
});
chrome.runtime.onStartup.addListener(() => {
  checkForUpdate();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM_NAME) checkForUpdate();
});
chrome.action.onClicked.addListener(openReleasePage);
chrome.notifications.onClicked.addListener((notifId) => {
  if (!notifId.startsWith(UPDATE_NOTIF_ID_PREFIX)) return;
  chrome.notifications.clear(notifId);
  openReleasePage();
});

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
  if (msg?.type === "FETCH_BLIND_SCORE") {
    fetchBlind(msg.company)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => {
        console.error("[WJP] blind fetch failed", err);
        sendResponse({ ok: false, message: err.message || String(err) });
      });
    return true;
  }
});
