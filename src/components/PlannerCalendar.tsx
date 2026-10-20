"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type DayDropData, MONTH_ITEM_ID_PREFIX, MonthGrid } from "@/components/MonthGrid";
import { RepeatDialog } from "@/components/RepeatDialog";
import { resolveCategoryStyle } from "@/lib/category";
import { describeRepeat } from "@/lib/repeat";
import {
  DAY_START_MINUTES,
  GRID_END_MINUTES,
  GRID_START_MINUTES,
  minutesToTime,
  snapMinutes,
  timeToMinutes,
} from "@/lib/schedule";
import type { Category } from "@/lib/useCategories";
import { dropPlacesCopy, trayTodos } from "@/lib/tray";
import { dateKey, startOfWeek } from "@/lib/week";
import type { Todo, TodoStatus } from "@/types";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
// Tall enough that a 30-minute block (half a row) still fits its title,
// status select and time range legibly, and is easy to grab and drag.
const ROW_HEIGHT_PX = 96; // px per hour
const HALF_ROW_HEIGHT_PX = ROW_HEIGHT_PX / 2; // 30-minute guide line
const GRID_HEIGHT_PX = ((GRID_END_MINUTES - GRID_START_MINUTES) / 60) * ROW_HEIGHT_PX;
const PX_PER_MINUTE = ROW_HEIGHT_PX / 60;
const MIN_BLOCK_HEIGHT_PX = 28;
const MONTHS_AHEAD = 12; // month tabs: this month + the next 11
const MIN_DURATION_MINUTES = 30;

// Three different drags can originate from one todo — moving the block
// (plain todo._id), dragging it in from the tray, or resizing it from its
// bottom edge — each needs its own dnd-kit id namespace so they never
// collide with each other.
const CHIP_ID_PREFIX = "chip:";
const RESIZE_ID_PREFIX = "resize:";

type ScheduledTodo = Todo & { scheduledDate: string; startTime: string };

function isScheduled(todo: Todo): todo is ScheduledTodo {
  return Boolean(todo.scheduledDate && todo.startTime);
}

const STATUS_OPTIONS: { value: TodoStatus; label: string }[] = [
  { value: "TODO", label: "진행 전" },
  { value: "DOING", label: "진행 중" },
  { value: "DONE", label: "완료" },
];

function EventBlock({
  todo,
  categories,
  onSetStatus,
  onUnassign,
}: {
  todo: ScheduledTodo;
  categories: Category[];
  onSetStatus: (id: string, status: TodoStatus) => void;
  onUnassign: (id: string) => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: todo._id,
  });
  const {
    attributes: resizeAttributes,
    listeners: resizeListeners,
    setNodeRef: setResizeRef,
    transform: resizeTransform,
    isDragging: isResizing,
  } = useDraggable({ id: `${RESIZE_ID_PREFIX}${todo._id}` });

  const startMinutes = timeToMinutes(todo.startTime);
  const duration = todo.durationMinutes ?? 60;
  const maxDuration = GRID_END_MINUTES - startMinutes;

  // While the bottom handle is being dragged, preview the exact duration it
  // would commit to on drop (same snap/clamp as handleDragEnd below) so the
  // block visibly grows/shrinks live, instead of only after releasing.
  const previewDuration =
    isResizing && resizeTransform
      ? Math.min(
          Math.max(
            snapMinutes(duration + resizeTransform.y / PX_PER_MINUTE),
            MIN_DURATION_MINUTES
          ),
          maxDuration
        )
      : duration;
  const endMinutes = startMinutes + previewDuration;
  const top = (startMinutes - GRID_START_MINUTES) * PX_PER_MINUTE;
  const height = Math.max(MIN_BLOCK_HEIGHT_PX, previewDuration * PX_PER_MINUTE);

  const cat = resolveCategoryStyle(todo.category, categories);
  const done = todo.status === "DONE";
  const doing = todo.status === "DOING";

  return (
    <div
      data-event-block={todo._id}
      style={{
        top,
        height,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={`absolute inset-x-0.5 flex overflow-hidden rounded-sm border border-hairline-soft text-left text-sm text-ink shadow-elevated ${
        cat.bg
      } ${done ? "opacity-60" : ""} ${doing ? "ring-1 ring-primary/50" : ""} ${
        isDragging || isResizing ? "z-20" : "z-10"
      } ${isDragging ? "opacity-70" : ""}`}
    >
      {/* A dedicated grab strip, not the whole card: the body below packs in
          a status select, and that needs the pointer for itself.
          Always-present regardless of block height/content, so dragging to
          reschedule never has to compete with it for space. */}
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        data-drag-handle={todo._id}
        title="끌어서 시간/날짜 이동"
        className={`w-2 shrink-0 cursor-grab ${cat.dot}`}
      />
      <div className="flex min-w-0 flex-1 flex-col px-1 py-0.5">
        <div className="flex items-start justify-between gap-1">
          <button
            type="button"
            onClick={() => router.push(`/todos/${todo._id}`)}
            className={`min-w-0 flex-1 truncate text-left font-medium hover:underline ${
              done ? "line-through" : ""
            }`}
            title={`${todo.title} (${todo.startTime}–${minutesToTime(endMinutes)})`}
          >
            {todo.title}
          </button>
          <button
            type="button"
            onClick={() => onUnassign(todo._id)}
            className="shrink-0 text-muted hover:text-primary"
            title="이 날짜에서 빼기"
          >
            ✕
          </button>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pb-1">
          {/* 진행 전/진행 중/완료 is an explicit choice here — picking a
              value is the only thing that changes status; dragging either
              handle only ever moves date/time/duration (handleDragEnd
              below never touches status), so a 진행 중 (multi-day) item
              never silently becomes 완료 on its own. */}
          <select
            value={todo.status}
            onChange={(e) => onSetStatus(todo._id, e.target.value as TodoStatus)}
            className="w-fit rounded-sm border border-hairline-soft bg-canvas px-0.5 py-0 text-[11px] text-ink"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* A 30-minute block only has room for the title and status;
              its position on the grid already shows the time. */}
          {previewDuration > MIN_DURATION_MINUTES && (
            <span className="text-[11px] opacity-80">
              {todo.startTime}–{minutesToTime(endMinutes)}
            </span>
          )}
        </div>
      </div>
      {/* Bottom resize handle: drag down to extend, up to shorten — like
          dragging the edge of an event in Google Calendar. Snaps to the
          same 30-minute grid as repositioning. */}
      <div
        ref={setResizeRef}
        {...resizeListeners}
        {...resizeAttributes}
        data-resize-handle={todo._id}
        title="끌어서 종료 시간 조절"
        className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize items-center justify-center"
      >
        <span className="h-1 w-6 rounded-full bg-ink/20" aria-hidden />
      </div>
    </div>
  );
}

function DayColumn({
  date,
  todos,
  categories,
  onSetStatus,
  onUnassign,
}: {
  date: string;
  todos: ScheduledTodo[];
  categories: Category[];
  onSetStatus: (id: string, status: TodoStatus) => void;
  onUnassign: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: date,
    data: { kind: "week-day", date } satisfies DayDropData,
  });

  return (
    <div
      ref={setNodeRef}
      data-day-column={date}
      style={{
        height: GRID_HEIGHT_PX,
        // Two layers: a visible line every hour, a faint one every 30
        // minutes — a guide for dragging event blocks to a half-hour slot.
        backgroundImage: [
          `repeating-linear-gradient(to bottom, var(--hairline) 0, var(--hairline) 1px, transparent 1px, transparent ${ROW_HEIGHT_PX}px)`,
          `repeating-linear-gradient(to bottom, var(--hairline-soft) 0, var(--hairline-soft) 1px, transparent 1px, transparent ${HALF_ROW_HEIGHT_PX}px)`,
        ].join(", "),
      }}
      className={`relative flex-1 border-l border-hairline-soft first:border-l-0 ${
        isOver ? "bg-primary/5" : ""
      }`}
    >
      {todos.map((todo) => (
        <EventBlock
          key={todo._id}
          todo={todo}
          categories={categories}
          onSetStatus={onSetStatus}
          onUnassign={onUnassign}
        />
      ))}
    </div>
  );
}

function TrayChip({ todo, categories }: { todo: Todo; categories: Category[] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${CHIP_ID_PREFIX}${todo._id}`,
  });

  // Already on the calendar (or a 🔁 template): dropping it adds another
  // occurrence rather than moving it — see dropPlacesCopy.
  const copyHint = dropPlacesCopy(todo) ? " +" : "";
  const cat = resolveCategoryStyle(todo.category, categories);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-unscheduled-chip={todo._id}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={`flex shrink-0 cursor-grab items-center gap-1.5 rounded-full border bg-canvas px-3 py-1 text-xs text-ink shadow-elevated ${
        todo.status === "DOING" ? "border-primary/40" : "border-hairline"
      } ${isDragging ? "z-20 opacity-70" : ""}`}
      title={todo.repeat ? `${todo.title} (${describeRepeat(todo.repeat)} 반복 중)` : todo.title}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cat.dot}`} aria-hidden />
      <span className="max-w-[160px] truncate">
        {todo.isRecurring && "🔁 "}
        {todo.title}
        {copyHint}
      </span>
      {todo.repeat && (
        <span className="shrink-0 text-[10px] text-muted">{describeRepeat(todo.repeat)}</span>
      )}
    </div>
  );
}

function Tray({ todos, categories }: { todos: Todo[]; categories: Category[] }) {
  if (todos.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline-soft pb-2">
      <span
        className="shrink-0 text-[11px] text-muted-soft"
        title="이미 캘린더에 있는 일정(+)이나 🔁 반복 일정은 끌어다 놓을 때마다 하나씩 더 추가돼요"
      >
        끌어서 일정에 추가 →
      </span>
      {todos.map((todo) => (
        <TrayChip key={todo._id} todo={todo} categories={categories} />
      ))}
    </div>
  );
}


type View = "week" | "month";

// The day under the *pointer* wins, not the one the dragged chip's box
// overlaps most — a wide chip grabbed by one end would otherwise land on
// the neighbouring day while its time came from the pointer.
const pointerFirst: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function firstOfMonth(d: Date, offset = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const start = `${monday.getFullYear()}년 ${monday.getMonth() + 1}월 ${monday.getDate()}일`;
  const end =
    sunday.getMonth() === monday.getMonth()
      ? `${sunday.getDate()}일`
      : `${sunday.getMonth() + 1}월 ${sunday.getDate()}일`;
  return `${start} – ${end}`;
}

/** Toggle-able 주간 (time grid) / 월간 (바둑판) calendar sharing one tray. */
export function PlannerCalendar({
  todos,
  categories,
  onMoveTodo,
  onSetStatus,
  onResizeTodo,
  onUnassign,
  onScheduleTodo,
  onCopyTodo,
  onRepeatTodo,
  onStopRepeat,
  onCreateOnDate,
}: {
  /** All of the user's todos — placed ones render on the calendar; see
   *  src/lib/tray.ts for which ones also render as tray chips. */
  todos: Todo[];
  /** The user's registered categories, for resolving each todo's saved
   *  color (see resolveCategoryStyle in src/lib/category.ts). */
  categories: Category[];
  onMoveTodo: (todoId: string, newDate: string, newStartTime: string) => void;
  onSetStatus: (todoId: string, status: TodoStatus) => void;
  onResizeTodo: (todoId: string, durationMinutes: number) => void;
  onUnassign: (todoId: string) => void;
  /** Place a not-yet-placed todo on `date`, server picks the time. */
  onScheduleTodo: (todoId: string, date: string) => void;
  /** Place another occurrence of `todoId` on `date`. */
  onCopyTodo: (todoId: string, date: string, startTime?: string) => void;
  /** Place a 🔁 template on `date` and on `weekdays` from then on. */
  onRepeatTodo: (todoId: string, date: string, weekdays: number[], startTime?: string) => void;
  onStopRepeat: (todoId: string) => void;
  onCreateOnDate: (title: string, date: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const [view, setView] = useState<View>("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  // A 🔁 template just dropped, waiting on "이 날만 / 앞으로도 반복".
  const [pendingRepeat, setPendingRepeat] = useState<{
    todo: Todo;
    date: string;
    startTime?: string;
  } | null>(null);
  // Where the pointer is during a drag, so a chip dropped on the week grid
  // lands at the time slot under the cursor (e.g. 오전 공부 vs 오후 공부)
  // instead of just the next free slot.
  const pointerY = useRef<number | null>(null);
  // Stable across re-renders so stopTracking always removes the very
  // listener handleDragStart added, even if todos update mid-drag.
  const trackPointer = useRef((e: PointerEvent) => {
    pointerY.current = e.clientY;
  }).current;
  const stickyHeader = useRef<HTMLDivElement>(null);
  const gridScroller = useRef<HTMLDivElement>(null);
  const dayHeader = useRef<HTMLDivElement>(null);

  // The grid spans 00–24시 but opens at 07시, the usual start of the day;
  // 새벽 is a scroll up away.
  useLayoutEffect(() => {
    if (view !== "week" || !gridScroller.current) return;
    gridScroller.current.scrollTop = (DAY_START_MINUTES - GRID_START_MINUTES) * PX_PER_MINUTE;
  }, [view]);

  const today = dateKey();
  const thisMonth = firstOfMonth(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekKeys = weekDays.map((d) => dateKey(d));
  // Recurring todos are templates that live in the tray only; each placed
  // occurrence is its own copy (see src/lib/recurring.ts's isActiveToday).
  const placed = todos.filter((t) => !t.isRecurring);
  const scheduled = placed
    .filter(isScheduled)
    .filter((t) => weekKeys.includes(t.scheduledDate));
  const chips = trayTodos(todos);

  function handleDragStart(event: DragStartEvent) {
    const start = event.activatorEvent as PointerEvent | null;
    pointerY.current = start?.clientY ?? null;
    window.addEventListener("pointermove", trackPointer);
  }

  function stopTracking() {
    window.removeEventListener("pointermove", trackPointer);
  }

  // The 30-minute slot under the pointer in `date`'s column, clamped so a
  // block of `duration` still fits inside the grid.
  function slotUnderPointer(date: string, duration: number): string | undefined {
    const column = document.querySelector(`[data-day-column="${date}"]`);
    if (!column || pointerY.current === null) return undefined;
    const offset = pointerY.current - column.getBoundingClientRect().top;
    const minutes =
      GRID_START_MINUTES + Math.floor(offset / HALF_ROW_HEIGHT_PX) * MIN_DURATION_MINUTES;
    const clamped = Math.min(
      Math.max(minutes, GRID_START_MINUTES),
      GRID_END_MINUTES - Math.min(duration, GRID_END_MINUTES - GRID_START_MINUTES)
    );
    return minutesToTime(clamped);
  }

  function handleDragEnd(event: DragEndEvent) {
    stopTracking();
    const { active, delta, over } = event;
    const rawId = String(active.id);
    // The week columns are clipped by their scroll box, and in both views
    // the tray/headers sit over where hidden parts of the grid may be; a
    // drop released outside the visible grid (e.g. a short drag inside the
    // tray) is not a drop onto whatever column is hidden underneath.
    const visibleTop = (dayHeader.current ?? stickyHeader.current)?.getBoundingClientRect().bottom;
    const visibleBottom = gridScroller.current?.getBoundingClientRect().bottom;
    const y = pointerY.current;
    const outsideGrid =
      y !== null &&
      ((visibleTop !== undefined && y < visibleTop) ||
        (visibleBottom !== undefined && y > visibleBottom));
    const drop = outsideGrid ? undefined : (over?.data.current as DayDropData | undefined);

    if (rawId.startsWith(CHIP_ID_PREFIX)) {
      if (!drop) return;
      const todo = todos.find((t) => t._id === rawId.slice(CHIP_ID_PREFIX.length));
      if (!todo) return;
      const startTime =
        drop.kind === "week-day"
          ? slotUnderPointer(drop.date, todo.durationMinutes ?? 60)
          : undefined;
      if (todo.isRecurring) {
        setPendingRepeat({ todo, date: drop.date, startTime });
      } else if (dropPlacesCopy(todo)) {
        onCopyTodo(todo._id, drop.date, startTime);
      } else if (startTime) {
        onMoveTodo(todo._id, drop.date, startTime);
      } else {
        onScheduleTodo(todo._id, drop.date);
      }
      return;
    }

    // Month view: dragging an item to another day keeps its time of day.
    if (rawId.startsWith(MONTH_ITEM_ID_PREFIX)) {
      if (!drop) return;
      const todo = placed.find((t) => t._id === rawId.slice(MONTH_ITEM_ID_PREFIX.length));
      if (!todo || todo.scheduledDate === drop.date) return;
      if (todo.startTime) onMoveTodo(todo._id, drop.date, todo.startTime);
      else onScheduleTodo(todo._id, drop.date);
      return;
    }

    if (rawId.startsWith(RESIZE_ID_PREFIX)) {
      const todoId = rawId.slice(RESIZE_ID_PREFIX.length);
      const target = scheduled.find((t) => t._id === todoId);
      if (!target) return;
      const startMinutes = timeToMinutes(target.startTime);
      const duration = target.durationMinutes ?? 60;
      const maxDuration = GRID_END_MINUTES - startMinutes;
      const snapped = snapMinutes(duration + delta.y / PX_PER_MINUTE);
      const clamped = Math.min(Math.max(snapped, MIN_DURATION_MINUTES), maxDuration);
      if (clamped !== duration) onResizeTodo(todoId, clamped);
      return;
    }

    const scheduledTodo = scheduled.find((t) => t._id === rawId);
    if (!scheduledTodo) return;

    const newDate = drop ? drop.date : scheduledTodo.scheduledDate;
    const duration = scheduledTodo.durationMinutes ?? 60;
    const rawMinutes = timeToMinutes(scheduledTodo.startTime) + delta.y / PX_PER_MINUTE;
    const snapped = snapMinutes(rawMinutes); // 30-minute grid, see lib/schedule.ts
    const clamped = Math.min(
      Math.max(snapped, GRID_START_MINUTES),
      GRID_END_MINUTES - duration
    );
    const newStartTime = minutesToTime(clamped);

    if (newDate !== scheduledTodo.scheduledDate || newStartTime !== scheduledTodo.startTime) {
      onMoveTodo(scheduledTodo._id, newDate, newStartTime);
    }
  }

  function goToday() {
    setWeekStart(startOfWeek(new Date()));
    setMonth(firstOfMonth(new Date()));
  }

  function shift(direction: -1 | 1) {
    if (view === "week") setWeekStart((d) => addDays(d, 7 * direction));
    else setMonth((d) => firstOfMonth(d, direction));
  }

  function openWeekOf(date: Date) {
    setWeekStart(startOfWeek(date));
    setView("week");
  }

  const navButton =
    "flex h-7 min-w-7 items-center justify-center rounded-sm border border-hairline px-2 text-xs text-ink hover:bg-surface-soft";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerFirst}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={stopTracking}
    >
      {/* Sticky so the tray stays in reach while scrolling down the month
          grid; the week grid scrolls inside its own box instead. */}
      <div ref={stickyHeader} className="sticky top-0 z-30 flex flex-col gap-2 bg-canvas pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-sm border border-hairline p-0.5" role="tablist">
            {(
              [
                ["week", "주간"],
                ["month", "월간"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={`rounded-sm px-3 py-1 text-xs ${
                  view === key ? "bg-primary font-medium text-on-primary" : "text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => shift(-1)} className={navButton} title="이전">
            ‹
          </button>
          <button type="button" onClick={goToday} className={navButton}>
            오늘
          </button>
          <button type="button" onClick={() => shift(1)} className={navButton} title="다음">
            ›
          </button>
          <span data-calendar-label className="text-sm font-semibold text-ink">
            {view === "week"
              ? weekLabel(weekStart)
              : `${month.getFullYear()}년 ${month.getMonth() + 1}월`}
          </span>
        </div>
        {view === "month" && (
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {Array.from({ length: MONTHS_AHEAD }, (_, i) => {
              const m = firstOfMonth(thisMonth, i);
              const active =
                m.getFullYear() === month.getFullYear() && m.getMonth() === month.getMonth();
              return (
                <button
                  key={i}
                  type="button"
                  data-month-tab={dateKey(m).slice(0, 7)}
                  onClick={() => setMonth(m)}
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${
                    active
                      ? "bg-ink font-medium text-canvas"
                      : "border border-hairline text-muted hover:text-ink"
                  }`}
                >
                  {m.getMonth() === 0 || i === 0 ? `${m.getFullYear() % 100}년 ` : ""}
                  {m.getMonth() + 1}월
                </button>
              );
            })}
          </div>
        )}
        <Tray todos={chips} categories={categories} />
      </div>

      {view === "week" ? (
        // Its own scroll box: 24 hours is far taller than the screen, and
        // keeping the page itself short leaves the stat cards in view.
        <div
          ref={gridScroller}
          data-week-scroller
          className="h-[calc(100vh-15rem)] min-h-[420px] overflow-y-auto"
        >
          <div ref={dayHeader} className="sticky top-0 z-30 flex bg-canvas">
            <div className="w-10 shrink-0" />
            {weekDays.map((date, i) => {
              const key = dateKey(date);
              const isToday = key === today;
              return (
                <div
                  key={key}
                  className={`flex flex-1 flex-col items-center gap-0.5 border-l border-hairline-soft py-1.5 text-xs first:border-l-0 ${
                    isToday ? "font-semibold text-primary" : "text-muted"
                  }`}
                >
                  <span>{DAY_LABELS[i]}</span>
                  <span
                    className={
                      isToday
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-on-primary"
                        : ""
                    }
                  >
                    {date.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
          {/* pt-2 leaves room for the "00시" label, which sits half a line
              above its row and would otherwise hide under the day header. */}
          <div className="flex pt-2">
            <div className="flex w-10 shrink-0 flex-col" style={{ height: GRID_HEIGHT_PX }}>
              {Array.from({ length: (GRID_END_MINUTES - GRID_START_MINUTES) / 60 }, (_, i) => (
                <div
                  key={i}
                  style={{ height: ROW_HEIGHT_PX }}
                  className="-translate-y-2 text-right text-[11px] text-muted-soft"
                >
                  {String(GRID_START_MINUTES / 60 + i).padStart(2, "0")}시
                </div>
              ))}
            </div>
            {weekKeys.map((key) => (
              <DayColumn
                key={key}
                date={key}
                todos={scheduled.filter((t) => t.scheduledDate === key)}
                categories={categories}
                onSetStatus={onSetStatus}
                onUnassign={onUnassign}
              />
            ))}
          </div>
        </div>
      ) : (
        <MonthGrid
          month={month}
          todos={placed}
          categories={categories}
          onOpenDay={openWeekOf}
          onCreateOnDate={onCreateOnDate}
        />
      )}
      {pendingRepeat && (
        <RepeatDialog
          todo={pendingRepeat.todo}
          date={pendingRepeat.date}
          startTime={pendingRepeat.startTime}
          onOnce={() => {
            onCopyTodo(pendingRepeat.todo._id, pendingRepeat.date, pendingRepeat.startTime);
            setPendingRepeat(null);
          }}
          onRepeat={(weekdays) => {
            onRepeatTodo(
              pendingRepeat.todo._id,
              pendingRepeat.date,
              weekdays,
              pendingRepeat.startTime
            );
            setPendingRepeat(null);
          }}
          onStopRepeat={() => {
            onStopRepeat(pendingRepeat.todo._id);
            setPendingRepeat(null);
          }}
          onClose={() => setPendingRepeat(null)}
        />
      )}
    </DndContext>
  );
}
