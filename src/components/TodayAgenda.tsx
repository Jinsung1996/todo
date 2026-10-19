"use client";

import Link from "next/link";
import { weeklyProgress } from "@/lib/progress";
import { isActiveToday } from "@/lib/recurring";
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
  // isActiveToday always means *today* specifically — this panel is always
  // meant to show today, so `date` is really just for the heading.
  const items = todos
    .filter((t): t is Todo & { startTime: string } => isActiveToday(t) && Boolean(t.startTime))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const doneCount = items.filter((t) => t.status === "DONE").length;
  const percent = weeklyProgress(items);

  return (
    <aside
      data-today-agenda
      className="sticky top-4 flex max-h-[calc(100vh-2rem)] w-60 shrink-0 flex-col gap-3 self-start rounded-md border border-hairline p-3"
    >
      <div>
        <p className="text-xs text-muted">오늘</p>
        <h2 className="text-base font-bold text-ink">{formatDateHeading(date)}</h2>
      </div>
      <div data-today-progress className="flex flex-col gap-1 rounded-sm bg-surface-soft p-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted">일간 완료</span>
          <span className="text-[11px] text-muted">
            {doneCount} / {items.length}
          </span>
        </div>
        <span className="text-2xl font-bold text-ink">{percent}%</span>
        <div className="h-2 rounded-full bg-surface-strong">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
        {items.map((todo) => {
          const status = todo.status;
          return (
            <li key={todo._id}>
              <Link
                href={`/todos/${todo._id}`}
                data-agenda-item={todo._id}
                className={`flex flex-col gap-0.5 rounded-sm border px-2 py-1.5 text-xs transition-shadow hover:shadow-elevated ${STATUS_STYLE[status]}`}
              >
                <span className="truncate font-medium">{todo.title}</span>
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
