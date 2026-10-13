# Wappy

친구들과 같은 방에 모여 캐릭터를 바탕화면에 띄우고, 접속 상태와 짧은 대화를 나누는 데스크톱 앱입니다. React와 Tauri 2로 만든 클라이언트, Node.js와 SQLite로 만든 API 서버를 pnpm·Turborepo 모노레포로 관리합니다.

## 주요 기능

- 치이카와, 산리오, 어벤져스, 메이플스토리 캐릭터로 프로필 만들기
- 5자리 초대 코드로 방에 참여하고 친구들의 접속 상태 확인하기
- 바탕화면 캐릭터 이동, 표시 여부 설정, 움직임 일시정지
- 캐릭터 말풍선 채팅과 온라인 친구 간 공격 효과
- 접속 상태 숨기기와 프로필 차단
- 메뉴 막대·시스템 트레이, 로그인 시 자동 실행, 앱 업데이트

## 앱 사용하기

[GitHub Releases](https://github.com/psvm203/wappy/releases)에서 설치 파일을 확인할 수 있습니다. 릴리스 워크플로는 macOS Universal(Apple Silicon·Intel)용 `.dmg`와 Windows x64용 설치 파일을 빌드합니다.

1. 앱에서 **처음이에요**를 선택하고 이름과 캐릭터로 프로필을 만듭니다.
2. **방 초대 코드**를 친구에게 공유합니다.
3. 친구는 **초대받았어요**에서 코드를 확인하고 프로필을 만들어 같은 방에 참여합니다.

기본 서버 주소는 `https://wappy-api.waps.im`입니다. 친구와 함께 사용하려면 같은 서버에 연결해야 합니다. 다른 방의 초대를 수락하면 기존 방에서 나와 새 방에 참여합니다.

캐릭터가 다른 앱 창과 겹친 곳을 클릭하면 뒤쪽 앱이 우선적으로 입력을 받습니다. 빈 바탕화면에서는 캐릭터를 클릭하거나 드래그할 수 있고, 이미 시작한 드래그와 열린 채팅 입력창은 계속 조작할 수 있습니다.

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

클라이언트가 로컬 API를 사용하도록 `apps/client/.env.local` 파일을 만들고 다음 내용을 넣습니다.

```dotenv
VITE_API_URL=http://127.0.0.1:3001
```

이 설정이 없으면 개발 중에도 기본 공용 서버로 연결합니다. 이미 저장된 프로필은 해당 프로필의 서버 주소를 계속 사용합니다.

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
- API 서버: `http://127.0.0.1:3001`
- 서버 상태 확인: `GET http://127.0.0.1:3001/health`

브라우저에서는 프로필, 초대, 친구 목록, 채팅을 확인할 수 있습니다. 바탕화면 오버레이와 OS 연동 기능은 데스크톱 앱에서 제공합니다.

### 환경 변수

클라이언트 설정은 `apps/client/.env.local`, 서버 설정은 `apps/server/.env`에 작성합니다.

| 변수              | 기본값                      | 용도                                                      |
| ----------------- | --------------------------- | --------------------------------------------------------- |
| `VITE_API_URL`    | `https://wappy-api.waps.im` | 클라이언트의 기본 API 서버 주소. 실행·빌드 시 적용됩니다. |
| `HOST`            | `127.0.0.1`                 | API 서버가 요청을 받을 주소                               |
| `PORT`            | `3001`                      | API 서버 포트                                             |
| `DATABASE_PATH`   | `./data/wappy.sqlite`       | 서버 작업 디렉터리 기준 SQLite 파일 경로                  |
| `ALLOWED_ORIGINS` | 추가 허용 없음              | 쉼표로 구분한 추가 브라우저 Origin                        |
| `TRUST_PROXY`     | 비활성                      | 신뢰하는 리버스 프록시 하나 뒤에서 실행할 때 `1`로 설정   |

Tauri 앱과 `http://localhost:1420`, `http://127.0.0.1:1420`은 기본 허용 Origin에 포함됩니다. 로컬 실행 시 데이터는 기본적으로 `apps/server/data/wappy.sqlite`에 저장되며 별도 DB 설치는 필요하지 않습니다. `TRUST_PROXY=1`은 API 포트에 직접 접근할 수 없도록 구성한 프록시 환경에서 사용합니다.

## 개발 명령

| 명령                               | 설명                                             |
| ---------------------------------- | ------------------------------------------------ |
| `pnpm desktop`                     | API 서버와 데스크톱 개발 앱 실행                 |
| `pnpm dev`                         | API 서버와 Vite 개발 서버 실행                   |
| `pnpm build`                       | 공유 API 패키지, 웹 클라이언트, 서버 빌드        |
| `pnpm test`                        | 클라이언트·서버의 Node.js 테스트 실행            |
| `pnpm check-types`                 | 워크스페이스 타입 검사                           |
| `pnpm performance`                 | 서버 상태 조회의 응답 크기·지연·메모리 성능 검사 |
| `pnpm format`                      | TypeScript·TSX·Markdown 파일 포맷                |
| `pnpm --filter server start`       | 빌드된 API 서버 실행                             |
| `pnpm --filter client tauri build` | 현재 플랫폼의 데스크톱 배포 파일 빌드            |

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
curl http://127.0.0.1:3001/health
```

API는 호스트의 `127.0.0.1:3001`에 연결되고, SQLite 데이터는 `wappy-data` 볼륨에 저장됩니다. 공개 포트를 바꾸려면 저장소 루트의 `.env`에 `WAPPY_PORT`를 설정합니다. 이 구성은 API 서버를 실행합니다.

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

API 계약은 [packages/api/src/index.ts](packages/api/src/index.ts), 서버 환경 변수 예시는 [apps/server/.env.example](apps/server/.env.example)에서 확인할 수 있습니다.
