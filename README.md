# BOJ Forcer Extension

BOJ 문제를 하루 1개 강제로 풀게 만드는 Chrome 확장 프로그램입니다.

English subtitle: **Random BOJ Problem Picker & Focus Enforcer**

## 설치 (일반 사용자)
Chrome 웹스토어에서 설치하는 것을 권장합니다.

- 다운로드: https://chromewebstore.google.com/detail/gjbmnjppfipmgenfbcgnaabgbokpaipk?utm_source=item-share-cb

## 왜 만들었나
알고리즘 공부를 꾸준히 하려고 해도, 실제로는 "나중에 풀자"를 반복하면서 루틴이 쉽게 무너졌습니다.
이 프로젝트는 의지에만 의존하지 않고, 브라우저 사용 자체를 문제 풀이와 연결해서
"하루 1문제"를 강제로 실행 가능한 습관으로 만들기 위해 시작했습니다.

## 문제 해결 과정
- 문제 정의: 공부 루틴 실패 원인은 실력보다 `진입 마찰`과 `즉시 보상(딴짓)`에 있었습니다.
- 접근 방식: "풀기 전에는 웹 탐색 제한"이라는 강한 제약을 브라우저 레벨에서 적용했습니다.
- 구현 포인트:
  - solved.ac 기반으로 매일 문제를 자동 선정해 시작 비용을 낮춤
  - 미해결 상태에서는 허용 사이트 외 이동을 문제 페이지로 리다이렉트
  - 검사/일일 reroll/emergency 같은 예외 흐름을 넣어 강제성과 실사용성을 균형화
- 결과: "무엇을 풀지 고민"과 "미루기"를 줄이고, 매일 최소 1문제 착수 확률을 높였습니다.

## 핵심 기능
- solved.ac 필터 기반 오늘의 문제 자동 선정
- 미해결 상태에서 비허용 사이트 접근 시 문제 페이지로 리다이렉트
- 일일 Reroll 제한, Emergency 시간, 자동 검사
- 옵션 페이지에서 티어/언어/태그/화이트리스트 설정

## 아키텍처 요약
- `manifest.json`: MV3 확장 설정
- `src/background/sw.js`: 리다이렉트/락 로직과 상태 흐름 관리
- `src/popup/*`: 오늘의 문제 확인, 검사, emergency 동작
- `src/options/*`: 백준 ID, 난이도/태그, 화이트리스트 설정
- `src/shared/*`: solved.ac 호출, 문제 선택, 스토리지 유틸

## 로컬 개발 실행
1. 크롬에서 `chrome://extensions` 접속
2. 우측 상단 개발자 모드 활성화
3. `압축해제된 확장 프로그램 로드` 클릭
4. 저장소 루트(`manifest.json` 위치) 선택

## 프로젝트 구조
```text
.
|- manifest.json
|- src/
|  |- background/
|  |  |- sw.js
|  |- popup/
|  |  |- popup.html
|  |  |- popup.js
|  |- options/
|  |  |- options.html
|  |  |- options.js
|  |- shared/
|  |  |- picker.js
|  |  |- solvedac-api.js
|  |  |- storage.js
|  |- styles/
|     |- styles.css
|- assets/
|  |- icons/
|- docs/
|  |- CHANGELOG.md
```

## 협업 규칙
- 브랜치: `feat/*`, `fix/*`, `chore/*`, `release/*`
- 커밋 예시: `feat: 랜덤 태그 필터 추가`
- 이슈/PR 템플릿: `.github/ISSUE_TEMPLATE`, `.github/pull_request_template.md`

## License
MIT
