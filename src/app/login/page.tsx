const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "로그인 시도가 만료되었거나 유효하지 않습니다. 다시 시도해주세요.",
  github_denied: "GitHub 인증이 취소되었습니다. 다시 시도해주세요.",
  github_login_failed: "GitHub 로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.github_login_failed) : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-canvas p-16">
      <h1 className="text-2xl font-bold text-ink">할 일 관리</h1>
      <p className="text-sm text-muted">GitHub 계정으로 로그인하세요.</p>
      {message && (
        <p className="max-w-sm rounded-md border border-error/30 bg-error/5 px-4 py-2 text-center text-sm text-error">
          {message}
        </p>
      )}
      <a
        href="/auth/github"
        className="flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-medium text-on-primary transition-colors hover:bg-primary-active"
      >
        GitHub로 로그인
      </a>
    </main>
  );
}
