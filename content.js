(() => {
  const PROCESSED_ATTR = "data-wjp-processed";
  const BADGE_CLASS = "wjp-badge";
  const DETAIL_BADGE_PREFIX = "wjp-detail-";

  // ---------- concurrency-limited queue ----------
  const MAX_CONCURRENT = 4;
  let inflight = 0;
  const queue = [];
  const enqueue = (task) =>
    new Promise((resolve) => {
      queue.push({ task, resolve });
      drain();
    });
  const drain = () => {
    while (inflight < MAX_CONCURRENT && queue.length > 0) {
      const { task, resolve } = queue.shift();
      inflight++;
      task()
        .then(resolve)
        .finally(() => {
          inflight--;
          drain();
        });
    }
  };

  const requestSource = (company, type) =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, company }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, message: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false });
      });
    });

  // ---------- formatters ----------
  const formatReviewCount = (n) => {
    if (n == null || n === 0) return null;
    if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")}만`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}천`;
    return String(n);
  };

  const formatSalary = (salaryStr) => {
    if (!salaryStr) return null;
    // "8,700만원" → "8,700"
    const m = salaryStr.match(/([\d,]+)/);
    return m ? m[1] : salaryStr;
  };

  // ---------- tier classification ----------
  const tierClass = (rating) => {
    if (rating >= 4.0) return "wjp-tier-excellent";
    if (rating >= 3.5) return "wjp-tier-good";
    if (rating >= 3.0) return "wjp-tier-ok";
    if (rating >= 2.5) return "wjp-tier-caution";
    return "wjp-tier-bad";
  };

  // ---------- JobPlanet badge ----------
  const makeJpBadge = (payload, query, opts = {}) => {
    const badge = document.createElement("a");
    badge.target = "_blank";
    badge.rel = "noopener noreferrer";
    badge.className = `${BADGE_CLASS} wjp-jp`;
    badge.dataset.wjpSource = "jp";
    if (opts.compact) badge.classList.add("wjp-compact");

    if (payload.state === "loading") {
      badge.classList.add("wjp-loading");
      badge.textContent = opts.compact ? "…" : "잡플래닛 조회 중…";
    } else if (payload.state === "not_found") {
      badge.classList.add("wjp-empty");
      badge.textContent = opts.compact ? "—" : "잡플래닛 정보 없음";
      badge.href = `https://www.jobplanet.co.kr/search?query=${encodeURIComponent(
        query
      )}`;
    } else if (payload.state === "error") {
      badge.classList.add("wjp-error");
      badge.textContent = opts.compact ? "!" : "잡플래닛 조회 실패";
      badge.title = payload.message || "";
    } else if (payload.state === "ok") {
      const rounded = Math.round(payload.rating);
      const stars = "★".repeat(rounded) + "☆".repeat(5 - rounded);
      const reviewStr = formatReviewCount(payload.reviewCount);
      badge.classList.add("wjp-ok", tierClass(payload.rating));
      badge.innerHTML =
        `<span class="wjp-mark" aria-hidden="true">JP</span>` +
        (opts.compact ? "" : `<span class="wjp-stars">${stars}</span>`) +
        `<span class="wjp-rating">${payload.rating.toFixed(1)}</span>` +
        (reviewStr ? `<span class="wjp-reviews">${reviewStr}</span>` : "") +
        (payload.strength && !opts.compact
          ? `<span class="wjp-strength">${payload.strength}</span>`
          : "");
      badge.href = payload.url;
      const titleParts = [`잡플래닛 평점 ${payload.rating.toFixed(1)} / 5`];
      if (payload.reviewCount != null) titleParts.push(`리뷰 ${payload.reviewCount.toLocaleString()}건`);
      if (payload.matchedName && payload.matchedName !== query) titleParts.push(`매칭: ${payload.matchedName}`);
      if (payload.strength) titleParts.push(`강점: ${payload.strength}`);
      badge.title = titleParts.join(" · ");
    }
    return badge;
  };

  // ---------- Saramin badge ----------
  const makeSrBadge = (payload, query, opts = {}) => {
    const badge = document.createElement("a");
    badge.target = "_blank";
    badge.rel = "noopener noreferrer";
    badge.className = `${BADGE_CLASS} wjp-sr`;
    badge.dataset.wjpSource = "sr";
    if (opts.compact) badge.classList.add("wjp-compact");

    if (payload.state !== "ok") return null; // hide when no data

    const salaryStr = formatSalary(payload.salary);
    const profit = payload.profit;

    if (!salaryStr && !profit) return null;

    badge.classList.add("wjp-ok");
    badge.innerHTML =
      `<span class="wjp-mark" aria-hidden="true">SR</span>` +
      (salaryStr
        ? `<span class="wjp-rating">${salaryStr}</span><span class="wjp-unit">만</span>`
        : "") +
      (profit && !opts.compact
        ? `<span class="wjp-strength">영업 ${profit}</span>`
        : "");
    badge.href = payload.url;

    const titleParts = [];
    if (payload.salary) titleParts.push(`사람인 평균연봉 ${payload.salary}`);
    if (profit) titleParts.push(`영업이익 ${profit}`);
    if (payload.matchedName && payload.matchedName !== query) titleParts.push(`매칭: ${payload.matchedName}`);
    badge.title = titleParts.join(" · ");

    return badge;
  };

  // ---------- detail page (single company) ----------
  let currentDetailCompany = null;

  const findDetailAnchor = () => {
    const companyPageH = document.querySelector(
      'h1[class*="CompanyInfo"], h2[class*="CompanyInfo"], h1[class*="company"], h2[class*="company"]'
    );
    if (companyPageH && companyPageH.textContent.trim()) {
      return { el: companyPageH, name: companyPageH.textContent.trim() };
    }
    const jobCompanyLink = document.querySelector(
      'a[data-attribute-id="company__click"], a[class*="CompanyInfo_link"], a[href^="/company/"]'
    );
    if (jobCompanyLink && jobCompanyLink.textContent.trim()) {
      return { el: jobCompanyLink, name: jobCompanyLink.textContent.trim() };
    }
    return null;
  };

  const renderDetailJp = (anchor, payload) => {
    document.querySelector(`#${DETAIL_BADGE_PREFIX}jp`)?.remove();
    const badge = makeJpBadge(payload, anchor.name);
    badge.id = `${DETAIL_BADGE_PREFIX}jp`;
    anchor.el.insertAdjacentElement("afterend", badge);
    return badge;
  };

  const renderDetailSr = (anchor, payload) => {
    document.querySelector(`#${DETAIL_BADGE_PREFIX}sr`)?.remove();
    const badge = makeSrBadge(payload, anchor.name);
    if (!badge) return;
    badge.id = `${DETAIL_BADGE_PREFIX}sr`;
    const jpEl = document.querySelector(`#${DETAIL_BADGE_PREFIX}jp`);
    (jpEl || anchor.el).insertAdjacentElement("afterend", badge);
  };

  const processDetail = () => {
    const anchor = findDetailAnchor();
    if (!anchor) return;
    if (
      anchor.name === currentDetailCompany &&
      document.querySelector(`#${DETAIL_BADGE_PREFIX}jp`)
    ) {
      return;
    }
    currentDetailCompany = anchor.name;
    renderDetailJp(anchor, { state: "loading" });

    enqueue(() => requestSource(anchor.name, "FETCH_JOBPLANET_SCORE")).then((res) => {
      if (anchor.name !== currentDetailCompany) return;
      renderDetailJp(anchor, res?.ok ? res : { state: "error", message: res?.message });
    });

    enqueue(() => requestSource(anchor.name, "FETCH_SARAMIN_INFO")).then((res) => {
      if (anchor.name !== currentDetailCompany) return;
      if (res?.ok) renderDetailSr(anchor, res);
    });
  };

  // ---------- list / home (cards with [data-company-name]) ----------
  const findEntities = () =>
    document.querySelectorAll(`[data-company-name]:not([${PROCESSED_ATTR}])`);

  const findCompanyTextInCard = (card, companyName) => {
    const semantic = card.querySelector(
      'span[class*="CompanyNameWithLocationPeriod"]'
    );
    if (semantic) return semantic;

    const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (node.children.length > 0) continue;
      const t = node.textContent?.trim();
      if (!t) continue;
      if (t === companyName || t.startsWith(companyName)) return node;
    }
    return null;
  };

  const processEntity = (el) => {
    el.setAttribute(PROCESSED_ATTR, "1");
    const companyName = el.getAttribute("data-company-name");
    if (!companyName) return;

    const card =
      el.closest('li[class*="Card_Card"]') ||
      el.closest("li") ||
      el.closest('article, [class*="Card"]') ||
      el.parentElement;
    if (!card) return;

    if (card.querySelector(`.${BADGE_CLASS}`)) return;

    const target = findCompanyTextInCard(card, companyName);
    if (!target) return;

    // JobPlanet placeholder (always visible during loading)
    const jpPlaceholder = makeJpBadge({ state: "loading" }, companyName, { compact: true });
    target.insertAdjacentElement("afterend", jpPlaceholder);

    enqueue(() => requestSource(companyName, "FETCH_JOBPLANET_SCORE")).then((res) => {
      const badge = res?.ok
        ? makeJpBadge(res, companyName, { compact: true })
        : makeJpBadge({ state: "error", message: res?.message }, companyName, { compact: true });
      jpPlaceholder.replaceWith(badge);
    });

    enqueue(() => requestSource(companyName, "FETCH_SARAMIN_INFO")).then((res) => {
      if (!res?.ok || res.state !== "ok") return;
      const srBadge = makeSrBadge(res, companyName, { compact: true });
      if (!srBadge) return;
      const jpBadge =
        card.querySelector(`.${BADGE_CLASS}[data-wjp-source="jp"]`) || target;
      jpBadge.insertAdjacentElement("afterend", srBadge);
    });
  };

  const processAllCards = () => {
    findEntities().forEach(processEntity);
  };

  // ---------- main loop ----------
  const tick = () => {
    processDetail();
    processAllCards();
  };

  const observer = new MutationObserver(() => tick());
  observer.observe(document.body, { childList: true, subtree: true });

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      currentDetailCompany = null;
      document
        .querySelectorAll(`[id^="${DETAIL_BADGE_PREFIX}"]`)
        .forEach((el) => el.remove());
      document
        .querySelectorAll(`[${PROCESSED_ATTR}]`)
        .forEach((el) => el.removeAttribute(PROCESSED_ATTR));
      document
        .querySelectorAll(`.${BADGE_CLASS}`)
        .forEach((el) => el.remove());
    }
  }, 500);

  tick();
})();
