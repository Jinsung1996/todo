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
import {
  GRID_END_MINUTES,
  GRID_START_MINUTES,
  minutesToTime,
  snapMinutes,
  timeToMinutes,
} from "@/lib/schedule";
import { dateKey } from "@/lib/week";
import type { Todo } from "@/types";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const ROW_HEIGHT_PX = 48; // px per hour
const GRID_HEIGHT_PX = ((GRID_END_MINUTES - GRID_START_MINUTES) / 60) * ROW_HEIGHT_PX;
const PX_PER_MINUTE = ROW_HEIGHT_PX / 60;
const MIN_BLOCK_HEIGHT_PX = 22;

type ScheduledTodo = Todo & { scheduledDate: string; startTime: string };

function isScheduled(todo: Todo): todo is ScheduledTodo {
  return Boolean(todo.scheduledDate && todo.startTime);
}

const STATUS_STYLE: Record<string, string> = {
  TODO: "border-hairline bg-canvas text-ink",
  DOING: "border-primary/40 bg-primary/10 text-ink",
  DONE: "border-emerald-300 bg-emerald-50 text-emerald-700 line-through dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
};

function EventBlock({
  todo,
  onToggleDone,
  onUnassign,
}: {
  todo: ScheduledTodo;
  onToggleDone: (id: string, done: boolean) => void;
  onUnassign: (id: string) => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: todo._id,
  });

  const startMinutes = timeToMinutes(todo.startTime);
  const duration = todo.durationMinutes ?? 60;
  const top = (startMinutes - GRID_START_MINUTES) * PX_PER_MINUTE;
  const height = Math.max(MIN_BLOCK_HEIGHT_PX, duration * PX_PER_MINUTE);
  const done = todo.status === "DONE";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-event-block={todo._id}
      style={{
        top,
        height,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={`absolute inset-x-0.5 flex cursor-grab flex-col overflow-hidden rounded-sm border px-1.5 py-0.5 text-left text-xs shadow-elevated ${
        STATUS_STYLE[todo.status]
      } ${isDragging ? "z-20 opacity-70" : "z-10"}`}
    >
      <div className="flex items-start justify-between gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/todos/${todo._id}`);
          }}
          className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
          title={todo.title}
        >
          {todo.title}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUnassign(todo._id);
          }}
          className="shrink-0 text-muted hover:text-primary"
          title="이 날짜에서 빼기"
        >
          ✕
        </button>
      </div>
      <label className="mt-auto flex items-center gap-1 text-[11px] opacity-80">
        <input
          type="checkbox"
          checked={done}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            onToggleDone(todo._id, e.target.checked);
          }}
          className="h-3 w-3 accent-emerald-600"
        />
        {todo.startTime}
      </label>
    </div>
  );
}

function DayColumn({
  date,
  todos,
  onToggleDone,
  onUnassign,
}: {
  date: string;
  todos: ScheduledTodo[];
  onToggleDone: (id: string, done: boolean) => void;
  onUnassign: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });

  return (
    <div
      ref={setNodeRef}
      style={{
        height: GRID_HEIGHT_PX,
        backgroundImage:
          "repeating-linear-gradient(to bottom, var(--hairline-soft) 0, var(--hairline-soft) 1px, transparent 1px, transparent " +
          ROW_HEIGHT_PX +
          "px)",
      }}
      className={`relative flex-1 border-l border-hairline-soft first:border-l-0 ${
        isOver ? "bg-primary/5" : ""
      }`}
    >
      {todos.map((todo) => (
        <EventBlock key={todo._id} todo={todo} onToggleDone={onToggleDone} onUnassign={onUnassign} />
      ))}
    </div>
  );
}

export function WeekCalendar({
  weekDays,
  todos,
  onMoveTodo,
  onToggleDone,
  onUnassign,
}: {
  weekDays: Date[];
  todos: Todo[];
  onMoveTodo: (todoId: string, newDate: string, newStartTime: string) => void;
  onToggleDone: (todoId: string, done: boolean) => void;
  onUnassign: (todoId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const today = dateKey();
  const scheduled = todos.filter(isScheduled);

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta, over } = event;
    const todo = scheduled.find((t) => t._id === String(active.id));
    if (!todo) return;

    const newDate = over ? String(over.id) : todo.scheduledDate;
    const duration = todo.durationMinutes ?? 60;
    const rawMinutes = timeToMinutes(todo.startTime) + delta.y / PX_PER_MINUTE;
    const snapped = snapMinutes(rawMinutes);
    const clamped = Math.min(
      Math.max(snapped, GRID_START_MINUTES),
      GRID_END_MINUTES - duration
    );
    const newStartTime = minutesToTime(clamped);

    if (newDate !== todo.scheduledDate || newStartTime !== todo.startTime) {
      onMoveTodo(todo._id, newDate, newStartTime);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
                todos={scheduled.filter((t) => t.scheduledDate === key)}
                onToggleDone={onToggleDone}
                onUnassign={onUnassign}
              />
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}
