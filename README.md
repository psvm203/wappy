# Wappy

친구들의 캐릭터를 화면 한쪽에 놓아두는 macOS·Windows용 Tauri 사이드바입니다.
초대 코드로 친구를 연결하고, 이름·캐릭터·상태 메시지와 접속 상태를 공유합니다.

## 실행

Node.js **24 이상**, pnpm 11.25.0, Rust stable과 [Tauri 개발 환경](https://v2.tauri.app/start/prerequisites/)이 필요합니다. macOS는 Xcode Command Line Tools, Windows는 Visual Studio C++ Build Tools와 WebView2를 설치하세요.

```sh
pnpm install
pnpm desktop
```

공통 API를 빌드하고 서버(`localhost:3001`), Vite(`localhost:1420`), Tauri 앱을 함께 실행합니다. 처음 실행할 때는 Rust 의존성 컴파일에 시간이 걸립니다.

브라우저에서 UI와 친구 연결을 확인하려면 `pnpm dev` 실행 후 `http://localhost:1420`을 여세요. 일반 창과 시크릿 창을 사용하면 서로 다른 두 프로필로 테스트할 수 있습니다. 고정·최소화·종료·창 크기 변경은 Tauri 앱에서 동작합니다.

1. 이름과 캐릭터를 선택합니다. 최초 화면의 **연결할 서버**에서 친구와 같은 서버를 지정할 수 있습니다.
2. **초대하기 → 초대 코드 만들기**에서 코드를 복사해 친구에게 서버 주소와 함께 전달합니다.
3. 친구가 **초대를 받았나요?**에 코드를 입력하면 서로의 캐릭터가 표시됩니다.
4. **내 모습**에서 캐릭터와 상태를 바꾸거나 **접기**로 캐릭터만 볼 수 있습니다.

친구 탭의 산책 공간에서는 나와 접속 중인 친구들의 캐릭터가 각자 다른 경로와 속도로 돌아다닙니다. 접은 사이드바에서도 움직이며, 오프라인 친구는 제자리에서 쉽니다. **잠깐 쉬기** 버튼으로 움직임을 멈출 수 있고 OS의 동작 줄이기 설정도 따릅니다.

창은 현재 모니터의 작업 영역 오른쪽에 배치되며, 화면 배율·작업 표시줄·Dock을 고려합니다. 상단 로고를 드래그해 옮길 수 있고, 접거나 펼치면 현재 모니터 오른쪽으로 다시 정렬됩니다. 항상 위에 표시 설정은 상단 버튼으로 바꿀 수 있습니다.

## 구조와 공통 API

| 경로           | 역할                                                                 |
| -------------- | -------------------------------------------------------------------- |
| `apps/client`  | React UI, Tauri 오버레이, 기기 내 세션 저장                          |
| `apps/server`  | Node HTTP API, SQLite 영속 저장, 접속 상태                           |
| `packages/api` | `@wappy/api`: 메서드·경로별 요청/응답 타입, 캐릭터 목록, 프로필 검증 |

클라이언트의 `request()`와 서버의 `reply()`가 같은 `ApiRoutes`를 참조합니다. 타입 변경은 두 앱의 타입 검사에 반영되며, 서버는 외부 JSON을 런타임에도 검증합니다. 모든 요청과 응답은 JSON입니다.

| 메서드·경로            | 요청                          | 응답                                                           |
| ---------------------- | ----------------------------- | -------------------------------------------------------------- |
| `POST /session`        | `{ name, character, status }` | `{ token, profile }` (201)                                     |
| `GET /state`           | 없음                          | `{ self, friends: [{ id, name, character, status, online }] }` |
| `PATCH /profile`       | `{ name, character, status }` | 프로필                                                         |
| `POST /invites`        | `{}`                          | `{ code, expiresAt }` (201)                                    |
| `POST /invites/accept` | `{ code }`                    | 연결된 친구의 프로필                                           |
| `POST /friends/remove` | `{ friendId }`                | `{ ok: true }`                                                 |
| `GET /health`          | 없음                          | `{ ok: true }`                                                 |

`/session`, `/health`, CORS preflight를 제외한 요청은 `Authorization: Bearer <token>`이 필요합니다. 오류는 `{ error: string }`과 400/401/403/404/409/413/415/429/500 상태 코드로 반환합니다. 이름은 1–24자, 상태는 최대 60자, 캐릭터는 `bunny`, `cat`, `bear`, `frog` 중 하나입니다.

초대 코드는 24시간 동안 한 번만 사용할 수 있습니다. 다시 만들면 이전 코드가 무효화되며, 본인 초대와 중복 연결은 거부합니다. 친구 연결과 코드 소비는 하나의 SQLite 트랜잭션으로 처리됩니다. 연결 해제는 양쪽 목록에 반영됩니다.

상태는 5초마다 가져오며 마지막 조회로부터 30초가 지나면 오프라인으로 표시됩니다. 네트워크가 끊기면 재시도하고 오래된 접속 상태를 온라인으로 표시하지 않습니다. 접속 상태는 메모리에만 저장하므로 서버 재시작 직후에는 각 앱이 다시 조회할 때 갱신됩니다. 단일 서버 프로세스를 기준으로 합니다. Windows와 구형 macOS에서는 최소화한 WebView의 타이머가 OS에 의해 늦춰질 수 있어 접속 상태가 오프라인으로 바뀔 수 있습니다.

## 서버 설정과 데이터

`apps/server/.env.example`을 `apps/server/.env`로 복사해 설정할 수 있습니다.

| 변수              | 기본값                | 설명                                 |
| ----------------- | --------------------- | ------------------------------------ |
| `HOST`            | `127.0.0.1`           | 외부 연결을 받으려면 `0.0.0.0` 사용  |
| `PORT`            | `3001`                | API 포트                             |
| `DATABASE_PATH`   | `./data/wappy.sqlite` | 서버 작업 디렉터리 기준 SQLite 경로  |
| `ALLOWED_ORIGINS` | 없음                  | 추가 웹 클라이언트 Origin, 쉼표 구분 |

Tauri의 macOS·Windows Origin과 로컬 Vite Origin은 기본 허용됩니다. 운영 서버는 HTTPS 리버스 프록시 뒤에 두고, 친구 모두 접근할 수 있는 **동일한 서버 주소**를 사용하세요. 클라이언트 기본 주소는 `apps/client/.env`의 `VITE_API_URL`로 지정하거나 최초 화면에서 입력합니다. `localhost`는 각자의 컴퓨터이므로 서로 다른 기기에서 사용할 공용 서버 주소가 아닙니다. 서버는 자동으로 배포되지 않습니다.

```sh
pnpm build
pnpm --filter server start
```

서버는 별도 프레임워크나 DB 서비스 없이 Node의 [내장 SQLite](https://nodejs.org/api/sqlite.html)를 사용합니다. 사용자·친구·유효한 초대는 SQLite에 저장하며 세션 토큰과 초대 코드는 SHA-256 해시로 저장합니다. 쓰기 요청은 4KB로 제한하고 IP별 요청 횟수를 제한합니다. 프록시의 전달 헤더는 신뢰하지 않으므로 프록시 뒤에서는 애플리케이션의 IP별 제한이 합산될 수 있습니다.

클라이언트의 기기별 토큰은 로컬 WebView 저장소에 남습니다. 앱 재실행 시 같은 프로필로 돌아오지만, 저장소를 지우면 복구할 수 없습니다. 브라우저·Tauri 개발 모드·빌드된 앱은 서로 다른 Origin의 저장소를 사용하므로 프로필도 각각 만들어집니다. 이메일 로그인·계정 복구·기기 간 계정 공유는 제공하지 않습니다. 서버 백업 시 실행을 중지한 뒤 데이터 디렉터리 전체를 보관하세요.

## 빌드와 검증

```sh
pnpm build
pnpm check-types
pnpm test
pnpm lint
cargo fmt --manifest-path apps/client/src-tauri/Cargo.toml --check
cargo check --manifest-path apps/client/src-tauri/Cargo.toml
pnpm --filter client tauri build
```

Tauri 패키지는 해당 운영체제에서 빌드합니다. `.github/workflows/check.yml`은 macOS·Windows 각각에서 타입 검사, 빌드, API 통합 테스트, 네이티브 디버그 빌드를 실행합니다. 실제 배포 서명·공증 인증서는 별도로 설정해야 합니다.

macOS의 투명 창은 `macOSPrivateApi`를 사용하므로 직접 배포를 전제로 합니다. Mac App Store 배포에는 투명 창 설정을 변경해야 합니다. [Tauri 설정 문서](https://v2.tauri.app/reference/config/#macosprivateapi)
