"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Todo, TodoStatus } from "@/types";

type BoxId = "PENDING" | "DONE";

const BOXES: { id: BoxId; label: string }[] = [
  { id: "PENDING", label: "이 날의 할 일" },
  { id: "DONE", label: "완료" },
];

function TodoCard({
  todo,
  onUnassign,
}: {
  todo: Todo;
  onUnassign: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: todo._id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
      className={`flex cursor-grab items-center justify-between rounded-lg border border-white/40 bg-white/40 px-3 py-2 text-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 ${
        isDragging ? "z-10 opacity-70" : ""
      }`}
    >
      <span>{todo.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onUnassign(todo._id);
        }}
        className="text-xs text-zinc-500 hover:text-red-600"
        title="이 날짜에서 빼기"
      >
        ✕
      </button>
    </div>
  );
}

const BOX_STYLES: Record<BoxId, { base: string; over: string; label: string }> = {
  PENDING: {
    base: "border-red-200 bg-red-500/5 dark:border-red-900/60 dark:bg-red-500/10",
    over: "bg-red-500/15",
    label: "text-red-500 dark:text-red-400",
  },
  DONE: {
    base: "border-emerald-200 bg-emerald-500/5 dark:border-emerald-900/60 dark:bg-emerald-500/10",
    over: "bg-emerald-500/15",
    label: "text-emerald-600 dark:text-emerald-400",
  },
};

function Box({
  id,
  label,
  todos,
  onUnassign,
}: {
  id: BoxId;
  label: string;
  todos: Todo[];
  onUnassign: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const style = BOX_STYLES[id];

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[72px] flex-1 flex-col gap-2 rounded-xl border border-dashed p-3 ${style.base} ${
        isOver ? style.over : ""
      }`}
    >
      <h3 className={`text-sm font-semibold ${style.label}`}>{label}</h3>
      {todos.map((todo) => (
        <TodoCard key={todo._id} todo={todo} onUnassign={onUnassign} />
      ))}
      {todos.length === 0 && (
        <p className="text-xs text-zinc-400">여기로 할일을 끌어다 놓으세요.</p>
      )}
    </div>
  );
}

export function DayBoard({
  todos,
  onMove,
  onUnassign,
}: {
  todos: Todo[];
  onMove: (todoId: string, newStatus: TodoStatus) => void;
  onUnassign: (todoId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const todoId = String(active.id);
    const box = over.id as BoxId;
    const todo = todos.find((t) => t._id === todoId);
    if (!todo) return;
    const newStatus: TodoStatus = box === "DONE" ? "DONE" : "TODO";
    if (todo.status !== newStatus) {
      onMove(todoId, newStatus);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4">
        {BOXES.map((box) => (
          <Box
            key={box.id}
            id={box.id}
            label={box.label}
            todos={todos.filter((t) =>
              box.id === "DONE" ? t.status === "DONE" : t.status !== "DONE"
            )}
            onUnassign={onUnassign}
          />
        ))}
      </div>
    </DndContext>
  );
}
