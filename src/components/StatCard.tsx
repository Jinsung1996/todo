import Link from "next/link";

export function StatCard({
  href,
  label,
  value,
  suffix,
}: {
  href: string;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-canvas px-3 py-2 transition-shadow hover:shadow-elevated"
    >
      <span className="truncate text-xs text-muted">{label}</span>
      <span className="shrink-0 text-base font-bold text-ink">
        {value}
        {suffix}
      </span>
    </Link>
  );
}
