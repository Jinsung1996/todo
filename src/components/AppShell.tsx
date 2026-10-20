"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "대시보드", emoji: "🏠" },
  { href: "/goals", label: "연간 목표", emoji: "🎯" },
  { href: "/weeks", label: "주간 목표", emoji: "📅" },
  { href: "/daily", label: "일간 목표", emoji: "✅" },
];

export interface ShellUser {
  username: string;
  avatarUrl: string;
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: ShellUser | null;
}) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-full flex-1 bg-canvas">
      <aside className="hidden w-48 flex-col gap-6 border-r border-hairline bg-canvas p-6 md:flex">
        <span className="text-sm font-semibold text-muted">계획 관리</span>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-ink hover:bg-surface-soft"
                }`}
              >
                <span className="text-base">{item.emoji}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        {user && (
          <div className="mt-auto flex flex-col gap-2 border-t border-hairline pt-4">
            <div className="flex items-center gap-2">
              <Image
                src={user.avatarUrl}
                alt={user.username}
                width={28}
                height={28}
                className="rounded-full"
                unoptimized
              />
              <span className="truncate text-sm text-ink">{user.username}</span>
            </div>
            <a href="/auth/logout" className="text-xs text-muted hover:text-primary">
              로그아웃
            </a>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex items-center justify-between border-b border-hairline px-4 py-2.5 md:px-8 md:py-5">
          <h1 className="text-base font-bold text-ink md:text-xl">목표 관리</h1>
          {user && (
            <a href="/auth/logout" className="text-xs text-muted md:hidden">
              로그아웃
            </a>
          )}
        </header>
        {/* pb leaves room for the phone's bottom tab bar. */}
        <div className="flex flex-1 flex-col pb-16 md:pb-0">{children}</div>
      </div>
      {/* Phones: the sidebar's links as a bottom tab bar instead. */}
      <nav
        data-mobile-nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                active ? "font-semibold text-primary" : "text-muted"
              }`}
            >
              <span className="text-lg leading-none">{item.emoji}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
