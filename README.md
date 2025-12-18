# Nadi Beauty Academy MVP

간단한 Node HTTP 서버와 정적 프론트엔드(SPA)로 아카데미 MVP를 제공합니다. 데이터는 `data/db.json`에 저장됩니다.

## 실행
1. Node 18+ 설치
2. 초기 시드 생성
```bash
npm run migrate
```
3. 서버 실행
```bash
npm run dev
```
4. 브라우저에서 `http://localhost:3000/academy` 접속

## 기본 계정
- ADMIN: admin@nadi.com / admin123
- COACH: coach@nadi.com / coach123
- OWNER: owner@nadi.com / owner123
- LEARNER: learner@nadi.com / learner123

## 환경 변수
`.env.example` 참고
- `PORT`: 서버 포트
- `JWT_SECRET`: 세션 토큰 서명

## 주요 기능
- 역할 기반 인증 및 브랜치 단위 접근제어
- 코스/레슨/챕터, 영상 진행률 추적 및 퀴즈 통과 여부
- 과제 업로드(베이스64 변환)와 루브릭 기반 코치 피드백
- 재훈련 추천 및 SOP 확인 기록
- 역할별 대시보드(학습자/오너/어드민/코치)

## 마이그레이션/시드
`npm run migrate` 실행 시 `data/db.json`을 생성하며 샘플 브랜치, 유저, 코스, 레슨, 퀴즈, 루브릭을 포함합니다.

## 테스트
간단한 스모크 스크립트가 `/scripts/smoke-test.js`에 포함되어 있으며, 주요 흐름(권한 가드, 진행률 저장, 과제 제출)을 확인합니다.
```bash
npm run test
```

## 제한 사항 및 다음 단계
- 파일 업로드는 베이스64로 저장하며, 대용량 업로드/클라우드 스토리지는 포함되지 않았습니다.
- 동시 세션 강제 로그아웃은 동일 계정 로그인 시 이전 세션을 무효화하는 방식으로 간단히 구현되었습니다.
- 다음 단계: 월간 재테스트 자동화, 자격 갱신 배지, 다국어 UI, 영상 CDN 및 워터마크 강화, 어드민 CRUD UI 강화 등이 필요합니다.
