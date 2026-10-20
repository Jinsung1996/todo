"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { RepeatDialog, RepeatScopeDialog } from "@/components/RepeatDialog";
import { DurationSelect, TimeSelect } from "@/components/TimeSelect";
import { resolveCategoryStyle } from "@/lib/category";
import {
  activeRepeatTemplate,
  addDaysToKey,
  describeRepeat,
  WEEKDAY_LABELS,
  weekdayOfKey,
} from "@/lib/repeat";
import {
  DAY_START_MINUTES,
  DEFAULT_DURATION_MINUTES,
  GRID_END_MINUTES,
  GRID_START_MINUTES,
  minutesToTime,
  nextAvailableSlot,
  SLOT_STEP_MINUTES,
  timeToMinutes,
} from "@/lib/schedule";
import { dropPlacesCopy, trayTodos } from "@/lib/tray";
import type { Category } from "@/lib/useCategories";
import { dateKey } from "@/lib/week";
import type { Todo, TodoStatus } from "@/types";

const ROW_HEIGHT_PX = 72; // px per hour — a bit tighter than the PC grid
const PX_PER_MINUTE = ROW_HEIGHT_PX / 60;
const GRID_HEIGHT_PX = ((GRID_END_MINUTES - GRID_START_MINUTES) / 60) * ROW_HEIGHT_PX;
const MIN_BLOCK_HEIGHT_PX = 26;
// A sideways swipe this long (and clearly more sideways than vertical)
// turns the day; anything else is the column scrolling.
const SWIPE_MIN_PX = 60;
const CHIP_ID_PREFIX = "chip:";

const STATUS_OPTIONS: { value: TodoStatus; label: string }[] = [
  { value: "TODO", label: "진행 전" },
  { value: "DOING", label: "진행 중" },
  { value: "DONE", label: "완료" },
];

type Placed = Todo & { scheduledDate: string; startTime: string };

function dayLabel(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEKDAY_LABELS[weekdayOfKey(key)]})`;
}

/** The 30-minute slot at `offsetPx` from the column's top, kept on the grid. */
function slotAt(offsetPx: number, duration: number): string {
  const minutes =
    GRID_START_MINUTES +
    Math.floor(offsetPx / PX_PER_MINUTE / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
  return minutesToTime(
    Math.min(Math.max(minutes, GRID_START_MINUTES), GRID_END_MINUTES - duration)
  );
}

/** A panel sliding up from the bottom — the phone's dialog. */
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-mobile-sheet
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col gap-4 rounded-t-md bg-canvas p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-elevated"
      >
        <h2 className="truncate font-semibold text-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const field =
  "w-full rounded-sm border border-hairline bg-canvas px-3 py-2 text-base text-ink focus:border-ink focus:outline-none";
const primaryButton =
  "flex-1 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-on-primary disabled:opacity-40";
const secondaryButton =
  "rounded-sm border border-hairline px-4 py-2.5 text-sm text-ink active:bg-surface-soft";

function Chip({
  todo,
  categories,
  onPick,
}: {
  todo: Todo;
  categories: Category[];
  onPick: (todo: Todo) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${CHIP_ID_PREFIX}${todo._id}`,
  });
  const cat = resolveCategoryStyle(todo.category, categories);
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-mobile-chip={todo._id}
      onClick={() => onPick(todo)}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-sm text-ink shadow-elevated ${
        isDragging ? "relative z-40 opacity-80" : ""
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${cat.dot}`} aria-hidden />
      <span className="max-w-[9rem] truncate">
        {todo.isRecurring && "🔁 "}
        {todo.title}
      </span>
      {todo.repeat && (
        <span className="text-[10px] text-muted">{describeRepeat(todo.repeat)}</span>
      )}
    </button>
  );
}

function Block({
  todo,
  categories,
  onOpen,
}: {
  todo: Placed;
  categories: Category[];
  onOpen: (todo: Placed) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: todo._id,
  });
  const start = timeToMinutes(todo.startTime);
  const duration = todo.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const cat = resolveCategoryStyle(todo.category, categories);
  const done = todo.status === "DONE";
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-mobile-block={todo._id}
      onClick={() => onOpen(todo)}
      style={{
        top: (start - GRID_START_MINUTES) * PX_PER_MINUTE,
        height: Math.max(MIN_BLOCK_HEIGHT_PX, duration * PX_PER_MINUTE),
        transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
      }}
      className={`absolute inset-x-1 flex overflow-hidden rounded-sm border border-hairline-soft text-left text-ink shadow-elevated ${
        cat.bg
      } ${done ? "opacity-60" : ""} ${todo.status === "DOING" ? "ring-1 ring-primary/50" : ""} ${
        isDragging ? "z-20 opacity-80" : "z-10"
      }`}
    >
      <span className={`w-1.5 shrink-0 ${cat.dot}`} aria-hidden />
      <span className="flex min-w-0 flex-1 items-baseline gap-2 px-2 py-1">
        <span className={`truncate text-sm font-medium ${done ? "line-through" : ""}`}>
          {todo.title}
        </span>
        <span className="shrink-0 text-xs opacity-70">
          {todo.startTime}–{minutesToTime(start + duration)}
        </span>
        {todo.status !== "TODO" && (
          <span className="ml-auto shrink-0 text-[11px] opacity-80">
            {STATUS_OPTIONS.find((o) => o.value === todo.status)?.label}
          </span>
        )}
      </span>
    </button>
  );
}

function Column({
  columnRef,
  children,
}: {
  columnRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "mobile-day" });
  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        columnRef.current = node;
      }}
      data-mobile-column
      style={{
        height: GRID_HEIGHT_PX,
        backgroundImage: [
          `repeating-linear-gradient(to bottom, var(--hairline) 0, var(--hairline) 1px, transparent 1px, transparent ${ROW_HEIGHT_PX}px)`,
          `repeating-linear-gradient(to bottom, var(--hairline-soft) 0, var(--hairline-soft) 1px, transparent 1px, transparent ${ROW_HEIGHT_PX / 2}px)`,
        ].join(", "),
      }}
      className={`relative flex-1 border-l border-hairline-soft ${isOver ? "bg-primary/5" : ""}`}
    >
      {children}
    </div>
  );
}

/**
 * The phone dashboard: one day of the week grid as a single tall column.
 * Swipe sideways for the day before/after; put a tray item on the day by
 * tapping it (and typing a time) or long-pressing and dragging it to a time.
 */
export function MobileDay({
  todos,
  categories,
  onMoveTodo,
  onSetStatus,
  onResizeTodo,
  onUnassign,
  onCopyTodo,
  onRepeatTodo,
  onUpdateRepeat,
  onStopRepeat,
  onCreateOnDate,
}: {
  todos: Todo[];
  categories: Category[];
  onMoveTodo: (todoId: string, newDate: string, newStartTime: string) => void;
  onSetStatus: (todoId: string, status: TodoStatus) => void;
  onResizeTodo: (todoId: string, durationMinutes: number) => void;
  onUnassign: (todoId: string) => void;
  onCopyTodo: (todoId: string, date: string, startTime?: string, durationMinutes?: number) => void;
  onRepeatTodo: (
    todoId: string,
    date: string,
    weekdays: number[],
    startTime?: string,
    durationMinutes?: number
  ) => void;
  onUpdateRepeat: (
    templateId: string,
    from: string,
    changes: { startTime?: string; durationMinutes?: number }
  ) => void;
  onStopRepeat: (todoId: string) => void;
  onCreateOnDate: (title: string, date: string) => void;
}) {
  // Long-press to drag on touch, so a plain swipe still scrolls or turns
  // the day; a mouse (a narrow desktop window) drags after a short move.
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } })
  );
  const today = dateKey();
  const [date, setDate] = useState(today);
  const [picking, setPicking] = useState<{ todo: Todo; time: string } | null>(null);
  const [editing, setEditing] = useState<{
    todo: Placed;
    time: string;
    duration: number;
    allAfter: boolean;
  } | null>(null);
  // A repeat copy dragged to a new time, waiting on "이 날만 / 이후 모두".
  const [pendingScope, setPendingScope] = useState<{
    todo: Placed;
    template: Todo;
    startTime: string;
  } | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [pendingRepeat, setPendingRepeat] = useState<{
    todo: Todo;
    startTime: string;
  } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  // Opens at 07시 like the PC grid; turning the day keeps the scroll spot.
  useLayoutEffect(() => {
    if (scroller.current) {
      scroller.current.scrollTop = (DAY_START_MINUTES - GRID_START_MINUTES) * PX_PER_MINUTE;
    }
  }, []);

  const dayTodos = todos
    .filter((t): t is Placed =>
      Boolean(!t.isRecurring && t.scheduledDate === date && t.startTime)
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const doneCount = dayTodos.filter((t) => t.status === "DONE").length;
  const percent = dayTodos.length ? Math.round((doneCount / dayTodos.length) * 100) : 0;
  const chips = trayTodos(todos);

  function freeSlot(duration: number): string {
    return nextAvailableSlot(
      dayTodos.map((t) => ({
        startTime: t.startTime,
        durationMinutes: t.durationMinutes ?? DEFAULT_DURATION_MINUTES,
      })),
      duration
    );
  }

  // The same three outcomes as a PC tray drop: 🔁 asks about repeating,
  // something already placed gets another occurrence, the rest moves here.
  function place(todo: Todo, time: string) {
    if (todo.isRecurring) setPendingRepeat({ todo, startTime: time });
    else if (dropPlacesCopy(todo)) onCopyTodo(todo._id, date, time);
    else onMoveTodo(todo._id, date, time);
  }

  function turnDay(direction: -1 | 1) {
    setDate((d) => addDaysToKey(d, direction));
  }

  function handleDragEnd(event: DragEndEvent) {
    dragging.current = false;
    const { active, over } = event;
    const rect = active.rect.current.translated;
    if (!over || !rect || !column.current) return;
    const columnTop = column.current.getBoundingClientRect().top;
    const id = String(active.id);

    if (id.startsWith(CHIP_ID_PREFIX)) {
      const todo = todos.find((t) => t._id === id.slice(CHIP_ID_PREFIX.length));
      if (!todo) return;
      const duration = todo.durationMinutes ?? DEFAULT_DURATION_MINUTES;
      // Where the chip's middle is — the finger sits on it.
      place(todo, slotAt(rect.top + rect.height / 2 - columnTop, duration));
      return;
    }

    const todo = dayTodos.find((t) => t._id === id);
    if (!todo) return;
    const duration = todo.durationMinutes ?? DEFAULT_DURATION_MINUTES;
    // A block's top edge is its start time; round to the nearer slot.
    const time = slotAt(rect.top - columnTop + (SLOT_STEP_MINUTES / 2) * PX_PER_MINUTE, duration);
    if (time === todo.startTime) return;
    const template = activeRepeatTemplate(todo, todos);
    if (template) setPendingScope({ todo, template, startTime: time });
    else onMoveTodo(todo._id, date, time);
  }

  function applyToOne(todo: Placed, time: string, duration: number) {
    if (time !== todo.startTime) onMoveTodo(todo._id, date, time);
    if (duration !== (todo.durationMinutes ?? DEFAULT_DURATION_MINUTES)) {
      onResizeTodo(todo._id, duration);
    }
  }

  function saveEdit() {
    if (!editing) return;
    const { todo, time, duration, allAfter } = editing;
    applyToOne(todo, time, duration);
    const template = activeRepeatTemplate(todo, todos);
    if (allAfter && template) {
      onUpdateRepeat(template._id, date, { startTime: time, durationMinutes: duration });
    }
    setEditing(null);
  }

  function pick(todo: Todo) {
    const time = freeSlot(todo.durationMinutes ?? DEFAULT_DURATION_MINUTES);
    // The repeat question already asks for the time — no sheet first.
    if (todo.isRecurring) setPendingRepeat({ todo, startTime: time });
    else setPicking({ todo, time });
  }

  const navButton =
    "flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-lg text-ink active:bg-surface-soft";

  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => {
        dragging.current = true;
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        dragging.current = false;
      }}
    >
      <div data-mobile-day={date} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => turnDay(-1)} className={navButton} title="전날">
            ‹
          </button>
          <div className="flex flex-1 flex-col items-center">
            <span
              data-mobile-date
              className={`text-base font-semibold ${date === today ? "text-primary" : "text-ink"}`}
            >
              {dayLabel(date)}
            </span>
            {date === today ? (
              <span className="text-[11px] text-muted">오늘</span>
            ) : (
              <button
                type="button"
                onClick={() => setDate(today)}
                className="text-[11px] text-primary underline"
              >
                오늘로
              </button>
            )}
          </div>
          <button type="button" onClick={() => turnDay(1)} className={navButton} title="다음날">
            ›
          </button>
        </div>

        <div data-mobile-progress className="flex items-center gap-2 text-xs text-muted">
          <span className="shrink-0">
            완료 {doneCount}/{dayTodos.length}
          </span>
          <div className="h-1.5 flex-1 rounded-full bg-surface-strong">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right font-semibold text-ink">{percent}%</span>
        </div>

        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
          <button
            type="button"
            onClick={() => setCreating("")}
            className="shrink-0 rounded-full border border-dashed border-border-strong px-3 py-1.5 text-sm text-muted"
          >
            + 새 일정
          </button>
          {chips.map((todo) => (
            <Chip
              key={todo._id}
              todo={todo}
              categories={categories}
              onPick={pick}
            />
          ))}
        </div>
        {chips.length > 0 && (
          <p className="-mt-1 text-[11px] text-muted-soft">
            눌러서 시간 입력, 또는 길게 눌러 원하는 시간으로 끌어 놓기 · 옆으로 밀면 날짜 이동
          </p>
        )}

        <div
          ref={scroller}
          data-mobile-scroller
          onTouchStart={(e) => {
            const t = e.touches[0];
            swipeStart.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = swipeStart.current;
            swipeStart.current = null;
            if (!start || dragging.current) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 2) {
              turnDay(dx < 0 ? 1 : -1);
            }
          }}
          className="h-[calc(100dvh-18rem)] min-h-[320px] overflow-y-auto rounded-sm border border-hairline-soft"
        >
          <div className="flex pt-2">
            <div className="flex w-10 shrink-0 flex-col" style={{ height: GRID_HEIGHT_PX }}>
              {Array.from({ length: (GRID_END_MINUTES - GRID_START_MINUTES) / 60 }, (_, i) => (
                <div
                  key={i}
                  style={{ height: ROW_HEIGHT_PX }}
                  className="-translate-y-2 pr-1 text-right text-[11px] text-muted-soft"
                >
                  {String(GRID_START_MINUTES / 60 + i).padStart(2, "0")}시
                </div>
              ))}
            </div>
            <Column columnRef={column}>
              {dayTodos.map((todo) => (
                <Block
                  key={todo._id}
                  todo={todo}
                  categories={categories}
                  onOpen={(t) =>
                    setEditing({
                      todo: t,
                      time: t.startTime,
                      duration: t.durationMinutes ?? DEFAULT_DURATION_MINUTES,
                      allAfter: false,
                    })
                  }
                />
              ))}
            </Column>
          </div>
        </div>
      </div>

      {picking && (
        <Sheet title={`${picking.todo.isRecurring ? "🔁 " : ""}${picking.todo.title}`} onClose={() => setPicking(null)}>
          <label className="flex flex-col gap-1 text-sm text-muted">
            {dayLabel(date)} 몇 시에 넣을까요?
            <TimeSelect
              value={picking.time}
              onChange={(time) => setPicking({ ...picking, time })}
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPicking(null)} className={secondaryButton}>
              취소
            </button>
            <button
              type="button"
              disabled={!picking.time}
              onClick={() => {
                place(picking.todo, picking.time);
                setPicking(null);
              }}
              className={primaryButton}
            >
              추가
            </button>
          </div>
        </Sheet>
      )}

      {editing && (
        <Sheet title={editing.todo.title} onClose={() => setEditing(null)}>
          <div className="flex gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={editing.todo.status === opt.value}
                onClick={() => {
                  onSetStatus(editing.todo._id, opt.value);
                  setEditing({ ...editing, todo: { ...editing.todo, status: opt.value } });
                }}
                className={`flex-1 rounded-sm px-2 py-2 text-sm ${
                  editing.todo.status === opt.value
                    ? "bg-primary font-medium text-on-primary"
                    : "border border-hairline text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
              시작
              <TimeSelect
                value={editing.time}
                onChange={(time) => setEditing({ ...editing, time })}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
              길이
              <DurationSelect
                value={editing.duration}
                onChange={(duration) => setEditing({ ...editing, duration })}
              />
            </label>
          </div>
          {activeRepeatTemplate(editing.todo, todos) && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={editing.allAfter}
                onChange={(e) => setEditing({ ...editing, allAfter: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              🔁 이 날 이후 반복 일정에도 모두 적용
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(null)} className={secondaryButton}>
              닫기
            </button>
            <button type="button" onClick={saveEdit} className={primaryButton}>
              시간 저장
            </button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                onUnassign(editing.todo._id);
                setEditing(null);
              }}
              className="text-error"
            >
              이 날에서 빼기
            </button>
            <Link href={`/todos/${editing.todo._id}`} className="text-muted underline">
              상세 보기
            </Link>
          </div>
        </Sheet>
      )}

      {creating !== null && (
        <Sheet title={`${dayLabel(date)} 새 일정`} onClose={() => setCreating(null)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const title = creating.trim();
              if (!title) return;
              onCreateOnDate(title, date);
              setCreating(null);
            }}
          >
            <input
              autoFocus
              value={creating}
              onChange={(e) => setCreating(e.target.value)}
              placeholder="제목 (빈 시간에 들어가요, 눌러서 시간 변경)"
              className={field}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setCreating(null)} className={secondaryButton}>
                취소
              </button>
              <button type="submit" disabled={!creating.trim()} className={primaryButton}>
                추가
              </button>
            </div>
          </form>
        </Sheet>
      )}

      {pendingRepeat && (
        <RepeatDialog
          todo={pendingRepeat.todo}
          date={date}
          startTime={pendingRepeat.startTime}
          onOnce={(startTime, durationMinutes) => {
            onCopyTodo(pendingRepeat.todo._id, date, startTime, durationMinutes);
            setPendingRepeat(null);
          }}
          onRepeat={(weekdays, startTime, durationMinutes) => {
            onRepeatTodo(pendingRepeat.todo._id, date, weekdays, startTime, durationMinutes);
            setPendingRepeat(null);
          }}
          onStopRepeat={() => {
            onStopRepeat(pendingRepeat.todo._id);
            setPendingRepeat(null);
          }}
          onClose={() => setPendingRepeat(null)}
        />
      )}

      {pendingScope && (
        <RepeatScopeDialog
          todo={pendingScope.todo}
          template={pendingScope.template}
          startTime={pendingScope.startTime}
          durationMinutes={pendingScope.todo.durationMinutes ?? DEFAULT_DURATION_MINUTES}
          onOnlyThis={() => {
            onMoveTodo(pendingScope.todo._id, date, pendingScope.startTime);
            setPendingScope(null);
          }}
          onAllAfter={() => {
            onMoveTodo(pendingScope.todo._id, date, pendingScope.startTime);
            onUpdateRepeat(pendingScope.template._id, date, {
              startTime: pendingScope.startTime,
            });
            setPendingScope(null);
          }}
          onClose={() => setPendingScope(null)}
        />
      )}
    </DndContext>
  );
}
