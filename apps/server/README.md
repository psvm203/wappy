# 서버 실행과 HTTPS 배포

친구와 연결하려면 모두 같은 API 주소를 사용해야 합니다. 이 구성은 한 서버의 한 프로세스와 SQLite 볼륨으로 실행합니다. Docker Engine과 Docker Compose **2.24.4 이상**이 필요하며, 명령은 저장소 루트에서 실행합니다. 서버 이미지에는 Node 24와 빌드된 API만 포함하며, 별도의 Node·pnpm 설치는 필요하지 않습니다.

## 내 컴퓨터에서 확인

```sh
docker compose up -d --build --wait
curl --fail http://127.0.0.1:3001/health
docker compose logs --tail 50 server
```

정상 응답은 `{"ok":true}`입니다. API는 내 컴퓨터의 `127.0.0.1:3001`에만 열립니다. 같은 컴퓨터의 Wappy 앱에서 이 주소를 입력해 사용할 수 있습니다. 다른 기기의 친구와 연결하려면 아래 HTTPS 구성을 사용하세요. 포트 충돌 시 루트 `.env`에 `WAPPY_PORT=3002`처럼 지정할 수 있습니다.

데이터는 Compose 프로젝트의 `wappy-data` 볼륨에 저장합니다. 기본 프로젝트 이름은 `wappy`입니다. 컨테이너를 교체하거나 `docker compose down` 후 다시 실행해도 데이터는 유지됩니다. **`down --volumes`는 데이터까지 삭제하므로 운영 서버에서 사용하지 마세요.** 이미지 빌드에는 소스와 의존성 명세만 전달하며 로컬 `.env`, SQLite 파일, 데스크톱 빌드 결과는 포함하지 않습니다.

## 친구가 접속할 HTTPS 서버

공인 서버와 연결할 도메인을 준비하고, 도메인의 DNS A 레코드를 서버의 IPv4 주소로 지정하세요. AAAA 레코드를 사용한다면 해당 IPv6 주소도 실제 서버로 연결되어야 합니다. 서버의 TCP 80·443 포트를 열고, 다른 웹 서버가 이 포트를 사용하지 않는지 확인하세요. 이 구성이 [Caddy의 인증서 자동 발급·갱신](https://caddyserver.com/docs/quick-starts/https)을 사용하기 위한 조건입니다.

서버의 저장소 루트에 `.env` 파일을 만들고 **보유한 호스트 이름**으로 바꾸세요. `https://`나 경로는 넣지 않습니다.

```dotenv
WAPPY_DOMAIN=wappy.example.com
```

```sh
docker compose -f compose.yaml -f compose.https.yaml up -d --build --wait
curl --fail https://wappy.example.com/health
```

마지막 확인은 실제 도메인으로 실행하세요. `--wait`는 API의 준비 상태를 확인하지만 외부 DNS·인증서 발급 성공까지 보장하지 않습니다. 접속되지 않으면 `docker compose -f compose.yaml -f compose.https.yaml logs --tail 80 proxy`에서 확인하세요.

친구 모두 앱의 **연결할 서버**에 `https://보유한-호스트-이름`을 입력합니다. 한 명이 프로필과 초대장을 만들고 다른 사람이 초대장을 확인해 연결하면 됩니다. 이미 앱을 설치했다면 앱을 다시 빌드할 필요는 없습니다.

HTTPS 구성은 Caddy의 80·443 포트만 공개하고 API의 3001 포트는 컨테이너 네트워크에서만 사용합니다. `TRUST_PROXY=1`은 단일 프록시가 덧붙인 `X-Forwarded-For`의 마지막 주소를 IP별 요청 제한에 사용합니다. 유효한 IP가 없으면 소켓 주소로 제한합니다. 기본 직접 실행에서는 전달 헤더를 무시합니다.

**`TRUST_PROXY=1`을 켠 API에 사용자가 직접 접속하게 열지 마세요.** 이 모드는 모든 연결이 신뢰하는 프록시를 거친다는 전제입니다. 제공한 Caddy 설정은 사용자가 보낸 전달 헤더를 신뢰하지 않습니다. CDN이나 추가 프록시를 앞에 둘 경우 실제 사용자 대신 그 중간 프록시의 IP별로 제한되므로 별도 구성이 필요합니다. [Caddy 전달 헤더 처리](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#headers)

Tauri 앱 Origin은 기본 허용됩니다. 별도로 호스팅한 웹 클라이언트가 있다면 루트 `.env`에 `ALLOWED_ORIGINS=https://웹-클라이언트-호스트`를 추가하세요. API 서버 도메인은 이 항목에 넣을 필요가 없습니다. `apps/server/.env`는 직접 Node 실행용이며 Compose가 자동으로 읽지 않습니다.

## 카카오 로그인 설정

직접 Node로 실행할 때는 `apps/server/.env`에 다음 세 값을 함께 설정하세요. REST API 키와 Client secret은 서버에만 보관하며, `.env`는 Git에서 제외됩니다. 값이 모두 없으면 기존 프로필·복구 코드 로그인만 사용할 수 있습니다.

```dotenv
KAKAO_REST_API_KEY=카카오_앱의_REST_API_키
KAKAO_CLIENT_SECRET=카카오_앱의_Client_secret
KAKAO_REDIRECT_URI=http://localhost:3001/auth/kakao/callback
```

[카카오디벨로퍼스](https://developers.kakao.com/console/app)에서 해당 앱의 카카오 로그인을 활성화하고 위 주소를 리다이렉트 URI로 등록하세요. Client secret도 활성화해야 합니다. 닉네임 동의항목을 설정하면 첫 프로필 이름으로 사용하고, 제공되지 않으면 `카카오 친구`로 시작합니다. 이메일이나 친구 목록 권한은 필요하지 않습니다. 로그인 후 **내 모습**에서 이름과 캐릭터를 바꿀 수 있습니다. [공식 REST API 안내](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)

앱의 **연결할 서버**와 리다이렉트 URI의 기본 주소는 정확히 같아야 합니다. 로컬 기본값은 `http://localhost:3001`이며 `127.0.0.1`은 다른 주소로 취급합니다. 운영 환경은 `https://서버-도메인/auth/kakao/callback`을 등록하고 사용하세요. HTTP는 로컬 개발 주소에서만 허용합니다. Compose에서는 같은 세 값을 저장소 루트 `.env`에 넣고 컨테이너를 다시 생성합니다. `apps/server/.env`는 Compose가 자동으로 읽지 않습니다.

첫 화면의 **카카오 로그인**은 브라우저에서 인증한 뒤 원래 앱이나 탭에서 완료됩니다. 웹에서는 팝업을 허용해야 하며 인증 브라우저의 쿠키가 필요합니다. 인증 요청은 10분 후 만료되고, 앱에서 취소하거나 서버가 재시작되면 다시 시작해야 합니다. 서버는 카카오 사용자 ID와 Wappy 프로필의 연결만 저장하며 카카오 액세스·리프레시 토큰은 저장하거나 앱에 전달하지 않습니다.

같은 서버에서 같은 카카오 계정으로 로그인하면 이름·캐릭터·친구·복구 코드를 유지하고 기존 Wappy 로그인 토큰을 교체하므로 이전 기기는 로그아웃됩니다. 기존에 이름으로 만든 프로필과 자동으로 합치지는 않습니다. 카카오 로그인 후 **초대하기**에서 친구 초대장을 사용할 수 있습니다. 프로필 영구 삭제 시 서버의 카카오 연결 정보도 삭제되어 다음 로그인은 새 프로필로 시작합니다. 카카오 계정의 서비스 연결 해제는 카카오 계정 설정에서 별도로 할 수 있습니다.

## 메시지 신고 운영

운영 담당자와 대응 주기를 정하고 공개 연락처를 준비한 뒤 새 신고 접수를 켜세요. 직접 실행은 `apps/server/.env`, Compose는 저장소 루트 `.env`에 `CHAT_REPORTS_ENABLED=1`을 넣고 서버를 다시 시작하거나 컨테이너를 다시 생성합니다. 기본값은 꺼짐입니다. `GET /state`의 `chatReporting`이 `true`일 때만 앱에서 새 신고를 접수할 수 있습니다. `false`는 접수 중단, 필드 없음은 이전 서버이며 기존 접수 내역은 중단 중에도 본인만 조회할 수 있습니다.

저장소 루트에서 다음 명령으로 **해당 서버 DB에 접근할 수 있는 운영자만** 검토합니다. `list`는 오래된 미처리 신고부터 최대 100개를 보여 주며 `show`는 원문과 설명을 표시합니다. 접수 번호를 확인한 뒤 `remove`는 메시지를 모든 수신자에게서 삭제하고 같은 메시지의 미처리 신고를 함께 처리합니다. `dismiss`는 해당 신고만 조치 없이 종료합니다. 서버가 실행 중이어도 사용할 수 있으며 다음 상태 조회에 반영됩니다. 동일한 결정을 재실행해도 결과는 같고 이미 다른 결정으로 처리한 신고는 변경하지 않습니다.

```sh
pnpm --filter server reports list
pnpm --filter server reports show REPORT_ID
pnpm --filter server reports resolve REPORT_ID remove
pnpm --filter server reports resolve REPORT_ID dismiss
```

Docker 배포에서는 같은 컨테이너의 빌드된 명령을 사용합니다. 아래 `REPORT_ID`를 실제 접수 번호로 바꾸세요.

```sh
docker compose exec server node dist/review-reports.js list
docker compose exec server node dist/review-reports.js show REPORT_ID
docker compose exec server node dist/review-reports.js resolve REPORT_ID remove
```

신고함을 정기적으로 확인하고 오래된 신고부터 검토하세요. 이 도구는 자동 알림이나 운영 인력을 대신하지 않으며 사용자 제재·이의 신청·게시 전 콘텐츠 필터링 기능은 제공하지 않습니다. 접수 내역과 처리 결과는 본인의 `GET /chat/reports`에만 노출되고 운영자용 공개 HTTP 경로는 없습니다. 터미널 출력에는 사적인 원문과 식별자가 포함되므로 공개 로그나 GitHub 이슈에 복사하지 마세요.

신고 기록은 원래 채팅과 별도로 SQLite에 보관합니다. 신고 후 차단·연결 해제·채팅 만료는 검토 기록을 지우지 않습니다. 접수 30일 뒤 조회에서 제외하고 서버 시작·분당 정리·새 신고 접수·운영 명령 실행 때 만료분을 삭제합니다. 신고자 또는 보낸 사람의 프로필 삭제 시에도 관련 기록을 삭제합니다. 삭제된 원문은 새로 복구하지 않으며, 별도 백업의 보관·폐기는 운영자가 관리해야 합니다. 메시지 신고는 아직 볼 수 있는 실제 수신 기록으로만 접수하고 프로필당 24시간에 20개로 제한합니다. 기존 DB에는 시작 시 신고 테이블을 추가합니다.

## 업데이트와 재시작

현재 데이터를 먼저 백업한 뒤 원하는 버전의 소스를 받아 실행합니다. 공개 서버에서는 계속 두 Compose 파일을 함께 사용하세요.

```sh
docker compose -f compose.yaml -f compose.https.yaml build --pull server
docker compose -f compose.yaml -f compose.https.yaml up -d --wait
```

동일한 프로젝트 이름과 볼륨을 사용하면 프로필·친구·초대·복구 코드·인사·접속 공개 설정을 유지합니다. Caddy 인증서도 별도 볼륨에 유지합니다. 접속 상태는 메모리에서 관리하므로 서버가 다시 시작되면 앱의 다음 상태 조회 때 갱신됩니다. 현재 서버를 여러 복제본으로 늘려 실행하지 마세요.

일시 중단은 `docker compose -f compose.yaml -f compose.https.yaml stop`, 재개는 같은 명령의 `stop` 대신 `up -d --wait`를 사용합니다. Docker가 다시 시작되면 명시적으로 중단하지 않은 서비스는 자동 실행합니다. `restart: unless-stopped`는 비정상 프로세스 종료 후 재시작하며, healthcheck 실패만으로 프로세스를 재시작하지는 않습니다.

## 백업과 새 서버 복원

아래 백업·복원 명령은 Linux/macOS의 POSIX 셸 기준입니다. 백업에는 SQLite 데이터 디렉터리 전체를 넣습니다. 코드나 로그와 함께 공개 저장소에 올리지 말고 별도 안전한 위치에 보관하세요.

```sh
umask 077
mkdir -p backups
docker compose stop server
docker compose run --rm --no-deps -T server tar czf - -C /data . > "backups/wappy-$(date +%Y%m%d-%H%M%S).tar.gz"
docker compose start server
```

백업 중에는 API가 잠시 중단됩니다. `tar` 명령이 성공했는지 확인한 뒤 파일을 보관하세요. 공개 구성의 프록시는 그대로 둘 수 있습니다. 프로젝트 이름을 `-p`로 바꿨다면 백업을 포함한 모든 명령에 같은 이름을 넣어야 합니다.

복원은 **기존 데이터가 없는 새 서버/새 프로젝트**에서 진행합니다. 같은 버전의 소스와 백업 파일을 가져온 뒤, 압축 파일 이름을 실제 파일로 바꿔 실행하세요.

```sh
docker compose build server
docker compose run --rm --no-deps -T server tar xzf - -C /data < /안전한/경로/wappy-backup.tar.gz
docker compose up -d --wait
```

공개 서버로 복원하려면 도메인 설정 후 마지막 명령에 `-f compose.yaml -f compose.https.yaml`을 추가하고 HTTPS 접속을 확인하세요. 백업 이후의 변경은 복원되지 않습니다. 토큰·복구 코드·삭제 상태도 백업 시점으로 돌아오므로, 원래 서버와 복원 서버를 동시에 서비스하지 마세요. 같은 주소를 새 서버로 연결하면 앱에 남은 유효한 로그인 정보를 계속 사용할 수 있습니다.

## 자동 검증

Node 24 이상과 Docker가 있는 환경에서 다음 명령으로 검사합니다.

```sh
node .github/scripts/check-server-container.mjs
```

매 실행마다 임의 이름의 테스트 프로젝트·볼륨과 루프백 포트를 사용한 뒤 정리합니다. 실제 이미지의 일반 사용자 실행, CORS, 정상 종료, 컨테이너 교체 후 데이터 유지, 빈 볼륨으로 백업 복원, 임시 CA를 신뢰한 HTTPS 접속, 프록시 우회 포트 차단과 전달 헤더 위조 방지를 확인합니다. CI에서도 Linux에서 실행합니다. 로컬 HTTPS 검사는 공인 DNS나 공개 인증서 발급을 대신하지 않습니다.
