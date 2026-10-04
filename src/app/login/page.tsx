export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-canvas p-16">
      <h1 className="text-2xl font-bold text-ink">할 일 관리</h1>
      <p className="text-sm text-muted">GitHub 계정으로 로그인하세요.</p>
      <a
        href="/auth/github"
        className="flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-medium text-on-primary transition-colors hover:bg-primary-active"
      >
        GitHub로 로그인
      </a>
    </main>
  );
}
