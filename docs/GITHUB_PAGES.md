# GitHub Pages 배포

배포 대상: GitHub 계정 `nigasaa`, 신규 공개 저장소 `gym-heeje`.
배포 주소: `https://nigasaa.github.io/gym-heeje/`.
저장소: `https://github.com/nigasaa/gym-heeje`.

2026-09-30: GitHub 저장소를 생성했다. 배포 설정 준비 후 로컬 단위 검사 59개, Edge 브라우저 검사 11개를 다시 실행해 모두 통과했다. 실제 배포 완료 여부는 GitHub Actions의 성공 상태와 공개 주소 접속으로 확인한다.

## 최초 배포

1. `nigasaa/gym-heeje` 저장소를 생성하고 앱 소스와 `.github/workflows/deploy-pages.yml`을 main에 올린다.
2. 저장소 Settings → Pages → Source를 GitHub Actions로 설정한다.
3. Actions에서 Deploy Gym희제 to GitHub Pages가 성공했는지 확인한다.
4. 위 HTTPS 주소에서 앱·manifest·아이콘·sw.js·삭제 버튼·오프라인 재실행을 확인한다.

워크플로는 잠긴 의존성 설치, 단위 테스트, 임시 Chromium에서 전체 사용 흐름·기록 보존·삭제·업데이트 검증을 통과한 뒤 `dist`만 배포한다. CI의 `edge-mobile-size` 테스트 프로젝트는 호환성을 위해 Chromium을 사용하며 로컬 Windows에서는 Edge를 사용한다.

## 아이폰 홈 화면

1. 배포가 완료된 주소를 아이폰 Safari에서 연다.
2. 공유 메뉴 → 홈 화면에 추가를 선택한다.
3. ‘웹 앱으로 열기’가 보이면 켠 상태로 두고 이름 Gym희제를 확인한 뒤 추가한다.
4. 홈 화면 아이콘으로 실행하고 오프라인 사용 준비 완료를 확인한 후 기록한다.

PC의 localhost와 공개 주소는 별도 저장 공간이다. 기존 PC 기록을 지우지 않지만 자동으로 아이폰에 복사하지도 않는다. 실제 기록은 서버/GitHub로 전송하지 않으며, 홈 화면 앱에서 입력을 시작하면 된다.

## 이후 업데이트

같은 저장소·주소·manifest id·서비스 워커 scope·IndexedDB 이름을 유지한다. 업데이트를 이유로 브라우저 데이터 삭제 또는 앱 재설치를 안내하지 않는다. 기능 수정 후 검증을 통과한 main 커밋을 배포하고, 앱에 ‘업데이트’가 보이면 적용한다. 운동 기록을 초기화하는 배포 코드는 추가하지 않는다.

참고: [GitHub 공식 배포 지침](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Apple 홈 화면 웹 앱 안내](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).
