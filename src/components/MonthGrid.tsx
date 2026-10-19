"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { resolveCategoryStyle } from "@/lib/category";
import type { Category } from "@/lib/useCategories";
import { dateKey, startOfWeek } from "@/lib/week";
import type { Todo } from "@/types";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const MAX_VISIBLE_ITEMS = 4;
export const MONTH_ITEM_ID_PREFIX = "month-item:";

export type DayDropData = { kind: "week-day" | "month-day"; date: string };

function MonthItem({ todo, categories }: { todo: Todo; categories: Category[] }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${MONTH_ITEM_ID_PREFIX}${todo._id}`,
  });
  const cat = resolveCategoryStyle(todo.category, categories);
  const done = todo.status === "DONE";

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-month-item={todo._id}
      onClick={() => router.push(`/todos/${todo._id}`)}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={`flex w-full min-w-0 cursor-grab items-center gap-1 rounded-sm px-1 py-0.5 text-left text-[11px] text-ink ${
        cat.bg
      } ${done ? "line-through opacity-60" : ""} ${isDragging ? "relative z-20 opacity-70 shadow-elevated" : ""}`}
      title={`${todo.startTime ?? ""} ${todo.title}`.trim()}
    >
      <span className="shrink-0 opacity-70">{todo.startTime}</span>
      <span className="truncate">{todo.title}</span>
    </button>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  todos,
  categories,
  adding,
  onStartAdding,
  onStopAdding,
  onCreate,
  onOpenDay,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  todos: Todo[];
  categories: Category[];
  adding: boolean;
  onStartAdding: () => void;
  onStopAdding: () => void;
  onCreate: (title: string) => void;
  onOpenDay: () => void;
}) {
  const key = dateKey(date);
  const { setNodeRef, isOver } = useDroppable({
    id: `month-day:${key}`,
    data: { kind: "month-day", date: key } satisfies DayDropData,
  });
  const [title, setTitle] = useState("");
  const visible = todos.slice(0, MAX_VISIBLE_ITEMS);
  const hidden = todos.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      data-month-day={key}
      className={`group flex min-h-28 min-w-0 flex-col gap-0.5 border-l border-t border-hairline-soft p-1 [&:nth-child(7n+1)]:border-l-0 ${
        inMonth ? "" : "bg-surface-soft/60"
      } ${isOver ? "bg-primary/5" : ""}`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onOpenDay}
          title="이 날짜의 주간 캘린더 보기"
          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs hover:bg-surface-strong ${
            isToday
              ? "bg-primary font-semibold text-on-primary hover:bg-primary-active"
              : inMonth
                ? "text-ink"
                : "text-muted-soft"
          }`}
        >
          {date.getDate()}
        </button>
        <button
          type="button"
          onClick={onStartAdding}
          title="이 날짜에 일정 추가"
          className="h-5 w-5 rounded-full text-sm leading-none text-muted opacity-0 hover:bg-surface-strong hover:text-primary focus:opacity-100 group-hover:opacity-100"
        >
          +
        </button>
      </div>
      {visible.map((todo) => (
        <MonthItem key={todo._id} todo={todo} categories={categories} />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={onOpenDay}
          className="text-left text-[10px] text-muted hover:text-primary"
        >
          +{hidden}개 더
        </button>
      )}
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) onCreate(title.trim());
            setTitle("");
            onStopAdding();
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setTitle("");
              onStopAdding();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setTitle("");
                onStopAdding();
              }
            }}
            placeholder="일정 제목 + Enter"
            className="w-full rounded-sm border border-hairline bg-canvas px-1 py-0.5 text-[11px] text-ink focus:border-ink focus:outline-none"
          />
        </form>
      )}
    </div>
  );
}

/** Month-at-a-glance grid (Mon–Sun rows) for placing things days or months ahead. */
export function MonthGrid({
  month,
  todos,
  categories,
  onOpenDay,
  onCreateOnDate,
}: {
  /** Any date inside the month to show. */
  month: Date;
  /** Already-filtered placed todos (no recurring templates). */
  todos: Todo[];
  categories: Category[];
  onOpenDay: (date: Date) => void;
  onCreateOnDate: (title: string, date: string) => void;
}) {
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const today = dateKey();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = Math.round((first.getTime() - gridStart.getTime()) / 86_400_000);
  const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const byDate = new Map<string, Todo[]>();
  for (const todo of todos) {
    if (!todo.scheduledDate) continue;
    const list = byDate.get(todo.scheduledDate) ?? [];
    list.push(todo);
    byDate.set(todo.scheduledDate, list);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  }

  return (
    <div className="flex flex-col rounded-sm border border-hairline-soft">
      <div className="grid grid-cols-7">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`py-1.5 text-center text-xs ${i >= 5 ? "text-primary/80" : "text-muted"}`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = dateKey(d);
          return (
            <DayCell
              key={key}
              date={d}
              inMonth={d.getMonth() === month.getMonth()}
              isToday={key === today}
              todos={byDate.get(key) ?? []}
              categories={categories}
              adding={addingDate === key}
              onStartAdding={() => setAddingDate(key)}
              onStopAdding={() => setAddingDate((cur) => (cur === key ? null : cur))}
              onCreate={(title) => onCreateOnDate(title, key)}
              onOpenDay={() => onOpenDay(d)}
            />
          );
        })}
      </div>
    </div>
  );
}
