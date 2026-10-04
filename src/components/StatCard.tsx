import Link from "next/link";

export function StatCard({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xl border border-black/[.1] px-5 py-4 transition-colors hover:border-black/[.3] dark:border-white/[.145] dark:hover:border-white/[.4]"
    >
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </Link>
  );
}
