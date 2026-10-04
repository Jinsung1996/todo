# GitHub OAuth 로그인 설정 가이드

## 1. GitHub OAuth App 생성

1. GitHub에 로그인한 상태로 https://github.com/settings/developers 로 이동
2. **OAuth Apps** 탭 → **New OAuth App** 클릭
3. 아래 값으로 입력:
   - **Application name**: 원하는 이름 (예: `할 일 관리 앱 (local)`)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
4. **Register application** 클릭
5. 생성된 앱 페이지에서:
   - **Client ID** 값을 복사
   - **Generate a new client secret** 클릭 후 생성된 **Client Secret** 값을 복사
     (이 값은 생성 직후 한 번만 보이므로 바로 복사해둘 것)

배포 환경(예: Vercel)에 올릴 경우, Homepage URL과 Authorization callback URL을
배포된 실제 도메인으로 바꾼 별도의 OAuth App을 만들거나, 기존 앱의 콜백 URL을
변경해야 합니다. GitHub OAuth App은 콜백 URL을 하나만 등록할 수 있습니다.

## 2. 환경변수 설정

프로젝트 루트에 `.env.local` 파일을 만들고 (이미 있다면 아래 두 줄을 추가):

```bash
GITHUB_CLIENT_ID=<위에서 복사한 Client ID>
GITHUB_CLIENT_SECRET=<위에서 복사한 Client Secret>
```

`.env.local`은 `.gitignore`에 포함되어 있어 깃에 커밋되지 않습니다.
템플릿은 `.env.local.example`을 참고하세요.

## 3. 동작 확인

1. `npm run dev`로 개발 서버 실행
2. `http://localhost:3000` 접속 → 로그인 안 된 상태라 `/login`으로 리다이렉트됨
3. **GitHub로 로그인** 버튼 클릭 → GitHub 인증 화면으로 이동
4. 권한 승인 → `/auth/github/callback`으로 돌아와 세션이 생성되고 `/`로 리다이렉트
5. 사이드바에 GitHub 프로필(아바타/아이디)과 로그아웃 링크가 표시되면 정상

## 참고: 기존 데이터 마이그레이션

GitHub 로그인을 처음 도입하기 전 만들어둔 할일(소유자가 없는 할일)은, 가장 처음
로그인하는 계정에게 자동으로 귀속됩니다. 이후 로그인부터는 그 계정의 할일로만
보이고, 다른 GitHub 계정으로 로그인하면 별도의 빈 할일 목록에서 시작합니다.
