export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 rounded-full bg-black/[.08] dark:bg-white/[.145]">
        <div
          className="h-2 rounded-full bg-emerald-500 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm text-zinc-500">
        {clamped}%
      </span>
    </div>
  );
}
