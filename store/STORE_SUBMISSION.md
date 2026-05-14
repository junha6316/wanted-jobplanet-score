# Chrome Web Store 제출 가이드

> 자동 제출은 불가능합니다. Google 계정으로 직접 진행하셔야 해요. ($5 등록비)
> 이 폴더에는 제출에 필요한 자산이 모두 준비되어 있습니다.

## 0. 사전 준비

### 한 번만 하면 되는 것
- [ ] Google Chrome Web Store 개발자 계정 만들기 — https://chrome.google.com/webstore/devconsole/
- [ ] **$5 일회성 등록비** 결제 (Google Pay)
- [ ] (선택) D-U-N-S 번호 — 회사 명의로 게시할 경우만 필요. 개인은 불필요.

### 매번 필요한 것
- [ ] `wanted-jobplanet-score.zip` (루트 폴더에서 빌드)

## 1. zip 빌드

```bash
cd /Users/parkjunhada/Projects/my/wanted-jobplanet-score
zip -r wanted-jobplanet-score.zip manifest.json content.js background.js styles.css icons/ -x "*.DS_Store"
```

또는 GitHub Release에 첨부된 zip 사용.

## 2. 자산 업로드

개발자 대시보드 → "새 항목" → zip 업로드 후 다음 정보 입력.

### 기본 정보

| 필드 | 값 |
|---|---|
| 이름 (Name) | `Wanted × JobPlanet Score` (또는 상표권 회피 시: `채용공고 평점 보조 도구`) |
| 요약 (Summary, ≤132자) | 아래 "요약" 섹션 참고 |
| 설명 (Description) | 아래 "설명" 섹션 참고 |
| 카테고리 | 생산성 (Productivity) |
| 언어 | 한국어 |

### 이미지

| 위치 | 파일 | 크기 |
|---|---|---|
| 아이콘 | `icons/icon128.png` | 128×128 |
| 작은 프로모 타일 (필수) | `store/promo-440x280.png` | 440×280 |
| 마퀴 프로모 (선택, 추천) | `store/promo-1400x560.png` | 1400×560 |
| 스크린샷 1 (필수) | `images/screenshot-list.png` | 1280×800 |
| 스크린샷 2 (선택) | `images/screenshot-detail.png` | 1280×800 |

### 개인정보 처리방침 URL

> 필수입니다. GitHub의 PRIVACY.md를 그대로 사용 가능.

```
https://github.com/junha6316/wanted-jobplanet-score/blob/main/PRIVACY.md
```

### 권한 정당화 (Permissions justification)

`host_permissions`와 `storage` 권한이 왜 필요한지 적는 칸. 짧은 한 줄로:

```
원티드 페이지에 배지를 표시하고(wanted.co.kr), 잡플래닛에서 공개 평점을 조회하기 위함(jobplanet.co.kr). 결과는 chrome.storage.local에 30일 캐시됨.
```

### 단일 목적 (Single purpose)

```
원티드(wanted.co.kr) 채용공고에 잡플래닛 평점·리뷰 수를 자동으로 표시합니다.
```

### 데이터 사용 공시 (Data usage disclosure)

| 카테고리 | 응답 |
|---|---|
| 개인 식별 정보 수집 | ❌ 아니오 |
| 건강 정보 | ❌ |
| 금융/결제 정보 | ❌ |
| 인증 정보 | ❌ |
| 개인 통신 | ❌ |
| 위치 | ❌ |
| 웹 활동 (방문 기록 등) | ❌ |
| 사용자 콘텐츠 | ❌ |

체크박스에 모두 "아니오" 선택. 우리는 정말로 아무것도 수집/전송하지 않습니다.

### 게시 범위
- **공개** (Public) 또는 **공개 안 함, 링크로만 공유** (Unlisted) 중 선택.
- ⚠️ 상표권/스크래핑 리스크를 고려하면 **Unlisted**가 더 안전. 검색에 안 잡히고, 링크 아는 사람만 설치 가능.

## 3. 심사

- 보통 1~3일 내 자동 심사 결과 옴
- 거절 사유가 트레이드마크 또는 스크래핑이면 → 이름 변경, 설명 수정 후 재제출
- 심사 통과해도 사후 takedown 가능. GitHub Release를 백업 채널로 유지하는 게 안전

## 4. 업데이트

- `manifest.json`의 `version` 올리고 새 zip 만들어 같은 화면에서 업로드
- 자동 업데이트 됨 (사용자 별도 작업 X)

---

## 요약 (Summary, ≤132자)

```
원티드 채용공고에 잡플래닛 평점·리뷰 수를 자동으로 표시. 회사명 옆 작은 배지로 한눈에. 비공식 도구.
```

## 설명 (Description, KO)

```
원티드(wanted.co.kr)에서 채용공고를 볼 때, 회사명 옆에 잡플래닛 평점과 리뷰 수를 자동으로 표시합니다.

✨ 주요 기능
- 채용공고 리스트 / 공고 상세 / 회사 페이지 / 홈 화면 모두 지원
- 평점 구간별 색상 (🔵 4.0+ / 🟢 3.5+ / 🟡 3.0+ / 🟠 2.5+ / 🔴 <2.5)
- 회사명, 평점, 리뷰 수, 강점 키워드(워라밸/복지 등) 한 번에 표시
- 배지 클릭 시 잡플래닛 회사 페이지로 이동
- 결과 30일 로컬 캐시 → 빠른 응답

🔒 개인정보
- 어떠한 정보도 수집/전송하지 않습니다.
- 모든 통신은 사용자 브라우저 ↔ 잡플래닛 사이에서만 일어납니다.
- 캐시는 본인 기기 내에만 저장됩니다.

⚠️ 비공식
- 이 확장 프로그램은 원티드(주식회사 원티드랩), 잡플래닛(주식회사 브레인커머스)과 어떠한 제휴 관계도 없는 개인 프로젝트입니다.
- 모든 상표권은 각 권리자에게 있습니다.

📂 오픈소스: https://github.com/junha6316/wanted-jobplanet-score
```

## Description (EN, optional)

```
Automatically shows JobPlanet ratings and review counts next to company names on Wanted (wanted.co.kr) — Korea's leading job platform.

Features
- Works on job listings, job details, company pages, and the home page
- Color-coded by rating tier (🔵 4.0+ / 🟢 3.5+ / 🟡 3.0+ / 🟠 2.5+ / 🔴 <2.5)
- Shows rating, review count, and strength keyword (work-life balance, benefits, etc.)
- Click the badge to jump to the company's JobPlanet page
- 30-day local cache for fast repeat lookups

Privacy
- No data collection. No telemetry. No third-party tracking.
- All communication happens between your browser and JobPlanet only.
- Cache is stored locally on your device only.

Unofficial
This extension is an independent personal project, not affiliated with Wanted Lab Inc. or BrainCommerce Inc. (JobPlanet). All trademarks belong to their respective owners.

Open source: https://github.com/junha6316/wanted-jobplanet-score
```
