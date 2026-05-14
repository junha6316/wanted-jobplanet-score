# Privacy Policy / 개인정보 처리방침

**Last updated / 최종 수정일: 2026-05-14**

## English

### What we collect
**Nothing.** This extension does not collect, store, or transmit any personal data about you.

### What we do
When you visit a page on `wanted.co.kr`, the extension:
1. Reads the company name from the page DOM.
2. Sends a request **directly from your browser** to `jobplanet.co.kr` to look up that company's public rating and review count.
3. Displays the result as a badge next to the company name on the Wanted page.

That's it. There is no analytics, no telemetry, no third-party tracking, no remote server operated by us.

### Data storage
Lookup results are cached **locally on your device only** via `chrome.storage.local` for up to 30 days, then automatically discarded. The cache contains:
- Company name (as it appears on Wanted)
- JobPlanet company ID
- Rating, review count, strength keyword

You can clear this cache at any time:
```js
chrome.storage.local.clear()
```
or by removing the extension.

### Network requests
All network requests go to `https://www.jobplanet.co.kr` only, using your existing browser session (cookies). The extension does not contact any other server.

### Third parties
JobPlanet may log your request as it would any normal browser visit to their site. JobPlanet's own privacy policy applies to those interactions. We do not have an agreement with JobPlanet or Wanted; this is an unofficial extension.

### Permissions justification
- `storage`: cache lookup results locally
- `host_permissions: wanted.co.kr`: inject the badge into Wanted pages
- `host_permissions: jobplanet.co.kr`: fetch ratings on your behalf

### Contact
Issues and questions: https://github.com/junha6316/wanted-jobplanet-score/issues

---

## 한국어

### 수집하는 정보
**없음.** 이 확장 프로그램은 어떠한 개인 정보도 수집·저장·전송하지 않습니다.

### 동작 방식
`wanted.co.kr` 페이지를 방문하면 확장 프로그램은 다음을 수행합니다:
1. 페이지 DOM에서 회사명을 읽음
2. **사용자 브라우저에서 직접** `jobplanet.co.kr`로 해당 회사의 공개 평점·리뷰 수를 조회
3. 결과를 회사명 옆에 배지로 표시

이게 전부입니다. 자체 분석, 텔레메트리, 외부 추적, 자체 운영 서버 모두 없습니다.

### 데이터 저장
조회 결과는 **사용자 기기 내**에서만 `chrome.storage.local`을 통해 최대 30일간 캐시되며 이후 자동 폐기됩니다. 캐시 내용:
- 회사명 (원티드에 표시된 그대로)
- 잡플래닛 회사 ID
- 평점, 리뷰 수, 강점 키워드

캐시는 언제든 직접 삭제 가능:
```js
chrome.storage.local.clear()
```
또는 확장 프로그램 제거.

### 네트워크 요청
모든 요청은 `https://www.jobplanet.co.kr`로만 향하며, 사용자의 기존 브라우저 세션(쿠키)을 사용합니다. 다른 서버와는 통신하지 않습니다.

### 제3자
잡플래닛은 일반 브라우저 방문과 동일하게 요청 로그를 남길 수 있습니다. 이 상호작용에는 잡플래닛의 개인정보 처리방침이 적용됩니다. 이 확장 프로그램은 잡플래닛 및 원티드와 어떠한 제휴 관계도 없는 비공식 도구입니다.

### 권한 사용 이유
- `storage`: 조회 결과 로컬 캐싱
- `host_permissions: wanted.co.kr`: 원티드 페이지에 배지 삽입
- `host_permissions: jobplanet.co.kr`: 사용자 대신 평점 조회

### 문의
이슈·문의: https://github.com/junha6316/wanted-jobplanet-score/issues
