"use client";

import { useRouter } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { resolveCategoryStyle } from "@/lib/category";
import { isDoneToday } from "@/lib/recurring";
import {
  GRID_END_MINUTES,
  GRID_START_MINUTES,
  minutesToTime,
  snapMinutes,
  timeToMinutes,
} from "@/lib/schedule";
import type { Category } from "@/lib/useCategories";
import { dateKey } from "@/lib/week";
import type { Todo, TodoStatus } from "@/types";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const ROW_HEIGHT_PX = 48; // px per hour
const HALF_ROW_HEIGHT_PX = ROW_HEIGHT_PX / 2; // 30-minute guide line
const GRID_HEIGHT_PX = ((GRID_END_MINUTES - GRID_START_MINUTES) / 60) * ROW_HEIGHT_PX;
const PX_PER_MINUTE = ROW_HEIGHT_PX / 60;
const MIN_BLOCK_HEIGHT_PX = 22;
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
  onToggleRecurringToday,
  onUnassign,
}: {
  todo: ScheduledTodo;
  categories: Category[];
  onSetStatus: (id: string, status: TodoStatus) => void;
  onToggleRecurringToday: (id: string, checked: boolean) => void;
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
  // A recurring todo's stored status stays TODO forever (see
  // src/lib/recurring.ts) — "done" is whether it's been checked off today.
  const done = isDoneToday(todo);
  const doing = !todo.isRecurring && todo.status === "DOING";

  return (
    <div
      data-event-block={todo._id}
      style={{
        top,
        height,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={`absolute inset-x-0.5 flex overflow-hidden rounded-sm border border-hairline-soft text-left text-xs text-ink shadow-elevated ${
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
        className={`w-1.5 shrink-0 cursor-grab ${cat.dot}`}
      />
      <div className="flex min-w-0 flex-1 flex-col px-1 py-0.5">
        <div className="flex items-start justify-between gap-1">
          <button
            type="button"
            onClick={() => router.push(`/todos/${todo._id}`)}
            className={`min-w-0 flex-1 truncate text-left font-medium hover:underline ${
              done ? "line-through" : ""
            }`}
            title={todo.title}
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
        <div className="mt-auto flex flex-col gap-0.5">
          {todo.isRecurring ? (
            // 아침/점심/저녁 같은 매일 반복 습관: a plain checkbox, not the
            // 3-way status below — "진행 중" doesn't mean anything for a
            // daily habit, it's either done today or not. Checking it off
            // never removes it; tomorrow it's unchecked again on its own.
            <label className="flex w-fit items-center gap-1 text-[10px]">
              <input
                type="checkbox"
                checked={done}
                onChange={(e) => onToggleRecurringToday(todo._id, e.target.checked)}
                className="h-3 w-3 accent-emerald-600"
              />
              오늘 완료
            </label>
          ) : (
            // 진행 전/진행 중/완료 is an explicit choice here — picking a
            // value is the only thing that changes status; dragging either
            // handle only ever moves date/time/duration (handleDragEnd
            // below never touches status), so a 진행 중 (multi-day) item
            // never silently becomes 완료 on its own.
            <select
              value={todo.status}
              onChange={(e) => onSetStatus(todo._id, e.target.value as TodoStatus)}
              className="w-fit rounded-sm border border-hairline-soft bg-canvas px-0.5 py-0 text-[10px] text-ink"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          <span className="text-[10px] opacity-80">
            {todo.startTime}–{minutesToTime(endMinutes)}
          </span>
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
        className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-center justify-center"
      >
        <span className="h-0.5 w-5 rounded-full bg-ink/20" aria-hidden />
      </div>
    </div>
  );
}

function DayColumn({
  date,
  todos,
  categories,
  onSetStatus,
  onToggleRecurringToday,
  onUnassign,
}: {
  date: string;
  todos: ScheduledTodo[];
  categories: Category[];
  onSetStatus: (id: string, status: TodoStatus) => void;
  onToggleRecurringToday: (id: string, checked: boolean) => void;
  onUnassign: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });

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
          onToggleRecurringToday={onToggleRecurringToday}
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

  // A multi-day 진행 중 item can already be scheduled on another day and
  // still show up here (see trayTodos) — flag that instead of pretending
  // it's unscheduled.
  const scheduledHint = todo.scheduledDate ? ` · ${todo.scheduledDate.slice(5).replace("-", "/")}` : "";
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
      title={todo.title}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cat.dot}`} aria-hidden />
      <span className="max-w-[160px] truncate">
        {todo.isRecurring && "🔁 "}
        {todo.title}
        {scheduledHint}
      </span>
    </div>
  );
}

function Tray({ todos, categories }: { todos: Todo[]; categories: Category[] }) {
  if (todos.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-hairline-soft pb-2">
      <span className="shrink-0 text-[11px] text-muted-soft">끌어서 일정에 추가 →</span>
      {todos.map((todo) => (
        <TrayChip key={todo._id} todo={todo} categories={categories} />
      ))}
    </div>
  );
}

export function WeekCalendar({
  weekDays,
  todos,
  categories,
  onMoveTodo,
  onSetStatus,
  onResizeTodo,
  onToggleRecurringToday,
  onUnassign,
  onScheduleTodo,
}: {
  weekDays: Date[];
  /** All of the user's todos — ones scheduled inside this week render as
   *  grid blocks; see `trayTodos` for which ones also render as chips. */
  todos: Todo[];
  /** The user's registered categories, for resolving each todo's saved
   *  color (see resolveCategoryStyle in src/lib/category.ts). */
  categories: Category[];
  onMoveTodo: (todoId: string, newDate: string, newStartTime: string) => void;
  onSetStatus: (todoId: string, status: TodoStatus) => void;
  onResizeTodo: (todoId: string, durationMinutes: number) => void;
  onToggleRecurringToday: (todoId: string, checked: boolean) => void;
  onUnassign: (todoId: string) => void;
  onScheduleTodo: (todoId: string, date: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const today = dateKey();
  const weekKeys = weekDays.map((d) => dateKey(d));
  // A recurring todo stays pinned to *today*'s column forever once placed
  // (see src/lib/recurring.ts), so its stale scheduledDate from whenever it
  // was first dragged on doesn't need to fall inside the displayed week.
  const scheduled = todos
    .filter(isScheduled)
    .filter((t) => t.isRecurring || weekKeys.includes(t.scheduledDate));
  // Every 일간 목표 that isn't finished yet stays in the tray — including
  // ones already scheduled on some day — because a 진행 중 goal can span
  // several days and needs to be draggable onto each new one, not just the
  // first time it's scheduled.
  const trayTodos = todos.filter((t) => t.status !== "DONE");

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta, over } = event;
    const rawId = String(active.id);

    if (rawId.startsWith(CHIP_ID_PREFIX)) {
      if (!over) return;
      onScheduleTodo(rawId.slice(CHIP_ID_PREFIX.length), String(over.id));
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

    const newDate = over ? String(over.id) : scheduledTodo.scheduledDate;
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

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <Tray todos={trayTodos} categories={categories} />
      <div className="flex flex-col">
        <div className="flex">
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
                <span className={isToday ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-on-primary" : ""}>
                  {date.getDate()}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex">
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
          {weekDays.map((date) => {
            const key = dateKey(date);
            return (
              <DayColumn
                key={key}
                date={key}
                todos={scheduled.filter((t) => (t.isRecurring ? key === today : t.scheduledDate === key))}
                categories={categories}
                onSetStatus={onSetStatus}
                onToggleRecurringToday={onToggleRecurringToday}
                onUnassign={onUnassign}
              />
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}
