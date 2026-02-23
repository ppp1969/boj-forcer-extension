# BOJ Forcer Extension

BOJ 문제를 하루 1개 강제로 풀게 만들어주는 Chrome Extension입니다.

English subtitle: **Random BOJ Problem Picker & Focus Enforcer**

## 주요 기능
- solved.ac 필터 기반 오늘의 문제 자동 선정
- 미해결 상태에서 비허용 사이트 접근 시 문제 페이지로 리다이렉트
- 일일 Reroll 제한, Emergency 시간, 자동 재검사
- 옵션 페이지에서 티어/언어/태그/화이트리스트 설정

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

## 로컬 실행
1. 크롬에서 `chrome://extensions` 접속
2. 우측 상단 개발자 모드 활성화
3. `압축해제된 확장 프로그램 로드` 클릭
4. 이 저장소 루트(`manifest.json` 있는 폴더) 선택

## GitHub 레포 생성 시 권장 옵션
- Visibility: 개인용이면 `Private`, 오픈소스면 `Public`
- Add README: `Off` (이미 이 파일 사용)
- Add .gitignore: `None` (이미 추가)
- Add license: `None` (이미 MIT 추가)

## 브랜치/커밋 규칙
- 브랜치: `feature/*`, `fix/*`, `chore/*`
- 커밋 예시: `feat: 랜덤 태그 필터 추가`

## License
MIT
