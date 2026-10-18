import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "목표 관리",
  description: "연간 목표 -> 주간 목표 -> 일간 목표를 한 화면에서",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionFromToken(token);
  const user = session
    ? { username: session.user.username, avatarUrl: session.user.avatarUrl }
    : null;

  return (
    <html lang="ko" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
