# 견적서 작성기 MVP

문자 또는 한국어 실시간 음성 입력을 OpenRouter로 구조화하고, 사용자가 검토한 견적을 HWPX 문서로 내려받는 웹 서비스입니다.

## 실행

Node.js 22 이상이 필요합니다. 외부 패키지는 없습니다.

1. `.env.example`을 `.env`로 복사합니다.
2. `OPENROUTER_API_KEY`에 OpenRouter 키를 넣습니다.
3. 아래 명령을 실행하고 `http://localhost:3000`을 엽니다.

```powershell
npm start
```

개발 중에는 `npm run dev`, 검증에는 `npm test`를 사용합니다. OpenRouter 모델은 `.env`의 `OPENROUTER_MODEL`로 바꿀 수 있으며 구조화 출력을 지원해야 합니다.

OpenRouter 오류가 보이면 다음을 확인합니다.

- `OpenRouter API 키를 확인해 주세요.`: `.env`의 `OPENROUTER_API_KEY`가 유효한지 확인합니다.
- `크레딧 또는 결제 상태`: OpenRouter 계정의 잔액을 확인합니다.
- `모델 또는 구조화 출력 요청`: 현재 모델이 JSON Schema 구조화 출력을 지원하지 않거나, 해당 기능을 지원하는 제공자가 없습니다. `OPENROUTER_MODEL=openai/gpt-4.1-mini`로 두고 다시 시도합니다.

## 현재 범위

- 문자 입력 및 Chrome/Edge의 Web Speech API를 통한 한국어 실시간 자막
- OpenRouter 구조화 출력으로 거래처·품목·수량·단가 추출
- 누락 항목 표시, 품목 추가·삭제·수정, 공급가액·부가세·합계 계산
- 서버 재검증 후 HWPX 다운로드
- 공급자 정보는 현재 브라우저에만 저장

실시간 음성은 브라우저가 제공하는 음성 인식 서비스를 사용합니다. Safari·Firefox까지 같은 품질로 지원하거나 음성 파일을 직접 관리하려면 별도 스트리밍 STT 제공자와 서버 WebSocket 경로가 필요합니다.

HWPX 견적서는 한글에서 열어 편집할 수 있도록 서버에서 생성합니다.

## 환경변수

| 이름 | 용도 | 기본값 |
|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API 키 | 필수 |
| `OPENROUTER_MODEL` | 구조화 출력을 지원하는 모델 | `openai/gpt-4.1-mini` |
| `APP_URL` | OpenRouter 앱 출처 표시 | `http://localhost:3000` |
| `PORT` | 웹 서버 포트 | `3000` |
