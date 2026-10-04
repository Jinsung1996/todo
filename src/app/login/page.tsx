export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-16">
      <h1 className="text-2xl font-semibold">할 일 관리</h1>
      <p className="text-sm text-zinc-500">GitHub 계정으로 로그인하세요.</p>
      <a
        href="/auth/github"
        className="flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-background"
      >
        GitHub로 로그인
      </a>
    </main>
  );
}
