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
      className="flex flex-col gap-1 rounded-md border border-hairline bg-canvas px-5 py-4 transition-shadow hover:shadow-elevated"
    >
      <span className="text-sm text-muted">{label}</span>
      <span className="text-2xl font-bold text-ink">
        {value}
        {suffix}
      </span>
    </Link>
  );
}
