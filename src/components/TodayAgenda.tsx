"use client";

import Link from "next/link";
import { effectiveStatus, isActiveToday } from "@/lib/recurring";
import type { Todo, TodoStatus } from "@/types";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"]; // Date#getDay(): 0=Sun

// Status, not category, drives color here — this panel's job is "where is
// each of today's items in progress", a different question than the
// category-colored week grid answers ("what kind of thing is this").
const STATUS_STYLE: Record<TodoStatus, string> = {
  TODO: "border-hairline bg-canvas text-ink",
  DOING: "border-primary/40 bg-primary/10 text-ink",
  DONE: "border-emerald-200 bg-emerald-50 text-emerald-700 line-through dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
};

const STATUS_LABEL: Record<TodoStatus, string> = {
  TODO: "진행 전",
  DOING: "진행 중",
  DONE: "완료",
};

function formatDateHeading(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAY_LABELS[date.getDay()];
  return `${month}월 ${day}일 ${weekday}요일`;
}

export function TodayAgenda({ date, todos }: { date: Date; todos: Todo[] }) {
  // isActiveToday always means *today* specifically (recurring todos stay
  // pinned there regardless of their stored scheduledDate) — this panel is
  // always meant to show today, so `date` is really just for the heading.
  const items = todos
    .filter((t): t is Todo & { startTime: string } => isActiveToday(t) && Boolean(t.startTime))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <aside
      data-today-agenda
      className="flex w-56 shrink-0 flex-col gap-3 rounded-md border border-hairline p-3"
    >
      <div>
        <p className="text-xs text-muted">오늘</p>
        <h2 className="text-base font-bold text-ink">{formatDateHeading(date)}</h2>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
        {items.map((todo) => {
          // A recurring todo's real status stays TODO forever — show
          // whether it's done *today* instead (see src/lib/recurring.ts).
          const status = effectiveStatus(todo);
          return (
            <li key={todo._id}>
              <Link
                href={`/todos/${todo._id}`}
                data-agenda-item={todo._id}
                className={`flex flex-col gap-0.5 rounded-sm border px-2 py-1.5 text-xs transition-shadow hover:shadow-elevated ${STATUS_STYLE[status]}`}
              >
                <span className="truncate font-medium">
                  {todo.isRecurring && "🔁 "}
                  {todo.title}
                </span>
                <span className="flex items-center justify-between text-[10px] opacity-80">
                  <span>{todo.startTime}</span>
                  <span>{STATUS_LABEL[status]}</span>
                </span>
              </Link>
            </li>
          );
        })}
        {items.length === 0 && <p className="text-xs text-muted">오늘 일정이 없습니다.</p>}
      </ul>
    </aside>
  );
}
