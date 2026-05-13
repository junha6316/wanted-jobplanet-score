# Wanted × JobPlanet Score

원티드(wanted.co.kr) 채용공고 / 회사 페이지에 잡플래닛(jobplanet.co.kr) 평점·리뷰 수를 자동으로 표시하는 **비공식** 크롬 확장 프로그램.

> ⚠️ **Unofficial / Personal use.** 원티드, 잡플래닛과 어떠한 제휴 관계도 없습니다. 잡플래닛 내부 엔드포인트를 사용하므로 언제든 동작이 깨질 수 있고, 잡플래닛 ToS에 따라 사용이 제한될 수 있습니다. 본인 책임으로 사용하세요.

## 기능

- 채용 리스트(`/wdlist/*`), 검색, 공고 상세(`/wd/*`), 회사 페이지(`/company/*`) 모두 지원
- 평점 구간별 색상 (🔵 4.0+ / 🟢 3.5+ / 🟡 3.0+ / 🟠 2.5+ / 🔴 <2.5)
- 회사명 옆에 평점 + 리뷰 수 + 강점 키워드(워라밸/복지 등)
- 회사명 매칭은 `(주)`, `주식회사`, `㈜` 등 정규화 후 비교
- 24시간 결과 캐시 (`chrome.storage.local`)
- 동시 요청 4개 제한 + MutationObserver로 무한 스크롤 대응
- 클릭 시 잡플래닛 회사 페이지로 이동

## 설치

```bash
git clone https://github.com/junha6316/wanted-jobplanet-score.git
```

1. Chrome에서 `chrome://extensions` 접속
2. 우상단 **개발자 모드** 토글 ON
3. **압축해제된 확장 프로그램을 로드합니다** 클릭 → 클론한 폴더 선택
4. 원티드 페이지 방문하면 자동으로 배지 표시

## 동작 방식

1. **content script**가 페이지에서 회사명 추출
   - 리스트: 각 카드의 `button[data-company-name]` 속성
   - 상세: `a[href^="/company/"]` 또는 회사 정보 헤더
2. **background service worker**로 메시지 전달
3. 잡플래닛 `/search/companies?query=...` (Next.js RSC) 호출 → 회사 ID + 평점 추출
4. 잡플래닛 `/api/v4/companies/reviews/list?company_id=...` 호출 → 리뷰 수 추출
5. content script가 회사명 옆에 배지 inject

모든 요청은 사용자 브라우저의 잡플래닛 세션 쿠키를 사용합니다 (`credentials: include`).

## 한계

- 잡플래닛 내부 API/RSC 포맷이 바뀌면 깨짐
- 회사명 매칭이 100% 정확하지 않음 (영문/한글 법인명 차이 등)
- 회사당 fetch 2회 발생 (검색 + 리뷰 수)
- 잡플래닛에서 의도적으로 차단할 경우 동작 불가

## 디버깅

`chrome://extensions` → 카드의 **서비스 워커** 클릭 → Console에서 `[WJP]` 로그 확인.

캐시 비우기:
```js
chrome.storage.local.clear()
```

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

이 프로젝트는 원티드(주식회사 원티드랩) 및 잡플래닛(주식회사 브레인커머스)과 무관한 개인 프로젝트입니다. 모든 상표권은 각 권리자에게 있습니다. 이 소프트웨어는 학습 및 개인 사용 목적으로 제공되며, 작성자는 사용으로 인한 어떠한 책임도 지지 않습니다.
