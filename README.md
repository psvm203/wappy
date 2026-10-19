# Wappy

친구들과 같은 방에 모여 캐릭터를 바탕화면에 띄우고, 접속 상태와 짧은 대화를 나누는 데스크톱 앱입니다. React와 Tauri 2로 만든 클라이언트, Node.js와 SQLite로 만든 API 서버를 pnpm·Turborepo 모노레포로 관리합니다.

## 주요 기능

- 치이카와, 산리오, 어벤져스, 메이플스토리, 짱구는 못말려 캐릭터로 프로필 만들기
- 5자리 초대 코드로 방에 참여하고 친구들의 접속 상태 확인하기
- 바탕화면 캐릭터 이동, 표시 여부 설정, 움직임 일시정지
- 캐릭터 말풍선 채팅과 친구 캐릭터 공격 효과(수면 중에도 가능)
- 접속 상태 숨기기
- 선택적인 카카오 로그인으로 프로필과 방 다시 불러오기
- 메뉴 막대·시스템 트레이, 로그인 시 자동 실행, 앱 업데이트

## 앱 사용하기

[GitHub Releases](https://github.com/psvm203/wappy/releases)에서 설치 파일을 확인할 수 있습니다. 릴리스 워크플로는 macOS Universal(Apple Silicon·Intel)용 `.dmg`와 Windows x64용 설치 파일을 빌드합니다.

1. 앱에서 **처음이에요**를 선택하고 이름과 캐릭터로 프로필을 만듭니다.
2. **방 초대 코드**를 친구에게 공유합니다.
3. 친구는 **초대받았어요**에서 코드를 확인하고 프로필을 만들어 같은 방에 참여합니다.

기본 서버 주소는 `http://localhost:3001`입니다. 다른 기기의 친구와 함께 사용하려면 모두 접속할 수 있는 같은 서버에 연결해야 합니다. 다른 방의 초대를 수락하면 기존 방에서 나와 새 방에 참여합니다.

## 로컬 개발

### 준비 사항

- Node.js **24 이상**
- pnpm **11.25.0** (`package.json`의 `packageManager` 기준)
- 데스크톱 앱 개발 시 Rust stable과 OS별 Tauri 2 빌드 환경
- 컨테이너로 서버를 실행하려면 Docker와 Docker Compose

아래 명령은 저장소 루트에서 실행합니다.

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
```

### 로컬 서버 연결 설정

서버 설정 파일을 준비합니다. 기본값으로 실행할 때는 생략할 수 있습니다.

```sh
cp apps/server/.env.example apps/server/.env
```

클라이언트는 기본적으로 로컬 API에 연결합니다. 서버 주소를 명시하거나 변경하려면 예시 파일을 복사하고 `VITE_API_URL`을 원하는 서버의 기본 주소로 설정합니다.

```sh
cp apps/client/.env.example apps/client/.env.local
```

```dotenv
VITE_API_URL=http://localhost:3001
```

이 설정을 생략하거나 빈 값으로 두면 `http://localhost:3001`에 연결합니다. 지정한 주소는 API 연결, 초대 코드, 화면의 기본 서버 판단에 함께 적용됩니다. 이미 저장된 프로필은 해당 프로필의 서버 주소를 계속 사용합니다.

실행 명령에 환경변수를 전달할 수도 있습니다. 아래 예시 주소를 사용할 서버 주소로 바꿉니다.

```sh
VITE_API_URL=https://api.example.com pnpm dev
VITE_API_URL=https://api.example.com pnpm build
```

실행 명령의 환경변수가 `.env` 파일보다 우선합니다. `.env` 파일을 변경하면 개발 서버를 다시 시작해야 하며, 배포 앱에 반영하려면 해당 값으로 다시 빌드해야 합니다. 자세한 동작은 [Vite 환경변수 문서](https://vite.dev/guide/env-and-mode)를 참고합니다. 서버가 요청을 받을 호스트와 포트는 별도로 `apps/server/.env`의 `HOST`, `PORT`로 설정합니다.

### 데스크톱 앱 실행

```sh
pnpm desktop
```

API 서버와 Tauri 개발 앱이 함께 실행됩니다. 바탕화면 오버레이, 트레이, 자동 실행 등 데스크톱 기능을 확인할 수 있습니다.

### 브라우저에서 실행

```sh
pnpm dev
```

- 클라이언트: `http://localhost:1420`
- API 서버: `http://localhost:3001`
- 서버 상태 확인: `GET http://localhost:3001/health`

브라우저에서는 프로필, 초대, 친구 목록, 채팅을 확인할 수 있습니다. 바탕화면 오버레이와 OS 연동 기능은 데스크톱 앱에서 제공합니다.

### 환경 변수

클라이언트 설정은 `apps/client/.env.local`, 서버 설정은 `apps/server/.env`에 작성합니다.

| 변수              | 기본값                  | 용도                                                      |
| ----------------- | ----------------------- | --------------------------------------------------------- |
| `VITE_API_URL`    | `http://localhost:3001` | 클라이언트의 기본 API 서버 주소. 실행·빌드 시 적용됩니다. |
| `HOST`            | `localhost`             | API 서버가 요청을 받을 주소                               |
| `PORT`            | `3001`                  | API 서버 포트                                             |
| `DATABASE_PATH`   | `./data/wappy.sqlite`   | 서버 작업 디렉터리 기준 SQLite 파일 경로                  |
| `ALLOWED_ORIGINS` | 추가 허용 없음          | 쉼표로 구분한 추가 브라우저 Origin                        |
| `TRUST_PROXY`     | 비활성                  | 신뢰하는 리버스 프록시 하나 뒤에서 실행할 때 `1`로 설정   |

Tauri 앱과 `http://localhost:1420`은 기본 허용 Origin에 포함됩니다. 로컬 실행 시 데이터는 기본적으로 `apps/server/data/wappy.sqlite`에 저장되며 별도 DB 설치는 필요하지 않습니다. `TRUST_PROXY=1`은 API 포트에 직접 접근할 수 없도록 구성한 프록시 환경에서 사용합니다.

### 카카오 로그인 설정

**계정** 메뉴는 **설정** 왼쪽에 있습니다. 로그인 없이도 프로필 생성, 방 참여, 채팅과 캐릭터 기능을 사용할 수 있습니다. 시작 화면의 **계정**에서도 로그인할 수 있습니다.

처음 카카오 로그인하면 현재 게스트 프로필과 방을 연결합니다. 이미 연결된 카카오 계정으로 로그인하면 해당 프로필을 불러오며, 이전 게스트 로그인 정보는 이 기기에 보관했다가 로그아웃 시 복원합니다. 현재 프로필을 처음 연결한 경우에는 로그아웃 후 시작 화면으로 돌아갑니다. 로그인마다 별도 세션을 발급하므로 다른 기기에서 새로 로그인해도 기존 로그인은 유지됩니다. 로그아웃은 해당 기기의 세션만 종료합니다.

[카카오 로그인 설정 문서](https://developers.kakao.com/docs/ko/kakaologin/prerequisite)에 따라 카카오 로그인을 활성화하고 REST API 키의 Redirect URI에 다음 주소를 등록합니다.

```text
http://localhost:3001/auth/kakao/callback
```

서버의 `apps/server/.env`에 아래 세 환경 변수를 설정합니다. 이 파일은 Git에서 제외됩니다. 키와 시크릿을 클라이언트의 `VITE_*` 변수에 넣지 않습니다.

```dotenv
KAKAO_REST_API_KEY=your-rest-api-key
KAKAO_CLIENT_SECRET=your-client-secret
KAKAO_REDIRECT_URI=http://localhost:3001/auth/kakao/callback
```

다른 API 서버를 사용한다면 Redirect URI의 서버 주소를 해당 서버에 맞추고 카카오 개발자 콘솔에도 같은 주소를 등록합니다. 클라이언트의 API 주소와 Redirect URI의 서버 주소는 같아야 합니다. Docker Compose 배포에서는 위 세 변수를 서버 환경 변수 또는 루트 `.env`로 전달합니다. 운영 서버에도 변경된 코드와 환경 변수를 배포해야 로그인할 수 있습니다.

설정을 생략하면 게스트 기능은 동작하고 카카오 로그인 시 설정 안내가 표시됩니다. 인증은 기본 브라우저에서 진행하며 카카오 토큰은 서버에서만 사용합니다. 이메일·전화번호는 저장하지 않고 카카오 회원번호와 Wappy 프로필만 연결합니다.

### 스타일

클라이언트는 Tailwind CSS v4와 `@tailwindcss/vite`를 사용합니다. 컴포넌트 스타일은 TSX의 `className`에 유틸리티 클래스로 작성합니다. CSS 진입점은 `apps/client/src/tailwind.css` 하나이며, `main.tsx`에서 불러옵니다.

`tailwind.css`에는 전역 기본 스타일, `@theme` 애니메이션, 물리 엔진과 연동하는 `resident-motion`·`resident-caption` 유틸리티만 둡니다. 모션 유틸리티는 이동·공격·피격 상태의 우선순위와 모션 감소 설정을 보존합니다. 기존 화면을 유지하기 위해 Preflight는 사용하지 않습니다.

## 개발 명령

| 명령                               | 설명                                                |
| ---------------------------------- | --------------------------------------------------- |
| `pnpm desktop`                     | API 서버와 데스크톱 개발 앱 실행                    |
| `pnpm dev`                         | API 서버와 Vite 개발 서버 실행                      |
| `pnpm build`                       | 공유 API 패키지, 웹 클라이언트, 서버 빌드           |
| `pnpm test`                        | 클라이언트·서버의 Node.js 테스트 실행               |
| `pnpm check-types`                 | 워크스페이스 타입 검사                              |
| `pnpm performance`                 | 서버 상태 조회의 응답 크기·지연·메모리 성능 검사    |
| `pnpm format`                      | oxfmt로 소스·설정·문서 포맷 및 Tailwind 클래스 정렬 |
| `pnpm format:check`                | 파일 수정 없이 포맷 검사                            |
| `pnpm lint`                        | oxlint로 JavaScript·TypeScript·React 코드 검사      |
| `pnpm lint:fix`                    | 자동 수정 가능한 린트 오류 수정                     |
| `pnpm --filter server start`       | 빌드된 API 서버 실행                                |
| `pnpm --filter client tauri build` | 현재 플랫폼의 데스크톱 배포 파일 빌드               |

포맷·린트 설정은 루트의 `.oxfmtrc.json`, `.oxlintrc.json`에서 관리합니다. Git에서 제외한 빌드 산출물은 자동으로 제외하며, CI에서도 `format:check`와 `lint`를 실행합니다. TypeScript 타입 검사는 `pnpm check-types`로 별도 실행합니다.

Rust 코드 검사는 별도로 실행합니다.

```sh
cargo fmt --manifest-path apps/client/src-tauri/Cargo.toml --check
cargo test --manifest-path apps/client/src-tauri/Cargo.toml --lib --locked
```

창·트레이·자동 실행을 검증하는 네이티브 통합 테스트는 프런트엔드를 빌드한 뒤 데스크톱 환경에서 명시적으로 실행합니다.

```sh
pnpm build
cargo test --manifest-path apps/client/src-tauri/Cargo.toml --test lifecycle --features tauri/custom-protocol --locked
```

## Docker로 서버 실행

```sh
docker compose up -d --build
curl http://localhost:3001/health
```

API는 호스트의 IPv6 루프백 `[::1]:3001`에 바인딩되며 `http://localhost:3001`로 접속합니다. 호스트의 IPv6 루프백 지원이 필요합니다. SQLite 데이터는 `wappy-data` 볼륨에 저장됩니다. 공개 포트를 바꾸려면 저장소 루트의 `.env`에 `WAPPY_PORT`를 설정합니다. 이 구성은 API 서버를 실행합니다.

외부 기기에서 접속할 HTTPS 서버는 [compose.https.yaml](compose.https.yaml)을 함께 사용합니다. 서버를 가리키는 도메인과 80·443 포트가 필요합니다. 저장소 루트의 `.env`에 다음 값을 설정합니다.

```dotenv
WAPPY_DOMAIN=wappy.example.com
```

```sh
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

Caddy가 HTTPS를 처리하며 API 포트는 컨테이너 내부에서만 접근할 수 있습니다. 클라이언트의 `VITE_API_URL`을 해당 HTTPS 주소로 설정합니다. 접속 상태와 요청 제한은 서버 프로세스 메모리에 있으므로 현재 구성은 서버 인스턴스 하나를 기준으로 합니다.

## 릴리스와 자동 업데이트

[릴리스 워크플로](.github/workflows/release.yml)는 `v*` 태그를 푸시하면 실행됩니다. 태그는 [tauri.conf.json](apps/client/src-tauri/tauri.conf.json)의 안정 버전과 일치해야 합니다. 예를 들어 버전이 `1.0.0`이면 태그는 `v1.0.0`입니다.

GitHub 저장소에 다음 값을 설정해야 합니다.

| 종류     | 이름                                 | 값                                       |
| -------- | ------------------------------------ | ---------------------------------------- |
| Variable | `TAURI_SIGNING_PUBLIC_KEY`           | 생성한 공개 키 `.pub` 파일의 전체 내용   |
| Secret   | `TAURI_SIGNING_PRIVATE_KEY`          | 업데이트 서명용 개인 키                  |
| Secret   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 개인 키에 설정한 비밀번호(사용하는 경우) |

배포 앱의 기본 API 서버는 GitHub 저장소의 선택적 Variable `VITE_API_URL`로 설정합니다. 릴리스 빌드에 이 값이 전달되며, 설정하지 않으면 `http://localhost:3001`을 사용합니다.

워크플로는 검사를 통과한 뒤 macOS·Windows 설치 파일과 업데이트 파일을 Draft Release에 올립니다. 두 플랫폼의 파일, 서명, `latest.json` 검증까지 성공하면 릴리스를 공개합니다. 선택적인 macOS 코드 서명 설정도 워크플로에 포함되어 있습니다.

공개 키가 포함된 앱은 시작 시와 이후 1시간 간격으로 새 버전을 확인합니다. 사용자가 **업데이트하고 재시작**을 선택하면 다운로드·설치 후 다시 시작합니다. 기본 로컬 빌드와 CI 미리보기 빌드는 공개 키가 없어 자동 업데이트가 비활성화됩니다.

## 저장소 구조

```text
apps/
  client/                  React·Vite 클라이언트
    src-tauri/             Tauri·Rust 데스크톱 기능
      tests/               네이티브 통합 테스트와 Windows 매니페스트
    tests/                 클라이언트 테스트
  server/                  Node.js HTTP API와 SQLite 저장소
    scripts/               성능 검사
packages/
  api/                     공유 API 타입, 입력 검증, 캐릭터 정의
  typescript-config/       공유 TypeScript 설정
.github/
  workflows/               검사·릴리스 워크플로
  scripts/                 컨테이너·설치 파일·릴리스 검증
```

API 계약은 [packages/api/src/index.ts](packages/api/src/index.ts), 환경 변수 예시는 [클라이언트](apps/client/.env.example)와 [서버](apps/server/.env.example)에서 확인할 수 있습니다.

## 상태 동기화

채팅·공격·프로필·방 변경은 기존 HTTP API로 전송하고, `GET /events`의 SSE 연결로 변경된 상태를 받습니다. 연결 시와 재연결 시에는 해당 사용자에게 허용된 전체 상태를 보내며, 이후에는 상태가 바뀔 때만 전송합니다. Tauri에서는 Rust가 연결을 유지하고 IPC로 화면에 전달하므로 WebView 타이머에 의존하지 않습니다. 브라우저는 Bearer 인증을 포함한 `fetch` 스트리밍을 사용합니다.

클라이언트는 10초마다 `POST /heartbeat`에 빈 JSON 객체를 보내 접속을 확인합니다. 30초 동안 접속 확인이 없으면 오프라인으로 처리하며, SSE 연결 유지용 주석은 접속 시간을 갱신하지 않습니다. 공격·채팅의 유효기간과 접속 만료도 서버에서 상태에 반영합니다.

연결이 끊기면 지연을 늘려 재시도하고, 인증이 취소되면 중단합니다. SSE 경로가 없는 구버전 서버(`404`, `405`, `501`)에는 기존 5초 간격의 ETag 폴링을 사용합니다. 서버는 구버전 클라이언트의 `GET /state`도 계속 지원합니다. 현재 SSE 연결 한도는 서버 전체 1,024개, 프로필당 4개이며, 느린 연결의 전송 버퍼가 쌓이면 연결을 종료하고 새 상태로 재연결합니다.
