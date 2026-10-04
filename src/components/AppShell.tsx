"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "대시보드", emoji: "🏠" },
  { href: "/goals", label: "1년 목표", emoji: "🎯" },
  { href: "/weeks", label: "주간 계획", emoji: "📅" },
  { href: "/daily", label: "할 일", emoji: "✅" },
  { href: "/calendar", label: "캘린더", emoji: "🗓️" },
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
    <div className="flex min-h-full flex-1">
      <aside className="flex w-48 flex-col gap-6 border-r border-black/[.08] p-6 dark:border-white/[.145]">
        <span className="text-sm font-semibold text-zinc-500">계획 관리</span>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-foreground text-background font-medium"
                    : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.08]"
                }`}
              >
                <span className="text-base">{item.emoji}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        {user && (
          <div className="mt-auto flex flex-col gap-2 border-t border-black/[.08] pt-4 dark:border-white/[.145]">
            <div className="flex items-center gap-2">
              <Image
                src={user.avatarUrl}
                alt={user.username}
                width={28}
                height={28}
                className="rounded-full"
                unoptimized
              />
              <span className="truncate text-sm text-zinc-600 dark:text-zinc-300">
                {user.username}
              </span>
            </div>
            <a
              href="/auth/logout"
              className="text-xs text-zinc-500 hover:text-red-600"
            >
              로그아웃
            </a>
          </div>
        )}
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="border-b border-black/[.08] px-8 py-5 dark:border-white/[.145]">
          <h1 className="text-xl font-semibold">할 일 + 계획 관리</h1>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
