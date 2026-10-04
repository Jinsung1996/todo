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
import { useRouter } from "next/navigation";
import type { Todo, TodoStatus } from "@/types";

const COLUMNS: { id: TodoStatus; label: string }[] = [
  { id: "TODO", label: "할 일" },
  { id: "DOING", label: "진행 중" },
  { id: "DONE", label: "완료" },
];

function TodoCard({
  todo,
  onOpen,
  onDelete,
}: {
  todo: Todo;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
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
      className={`flex items-center justify-between rounded border border-black/[.1] bg-white px-3 py-2 text-sm shadow-sm dark:border-white/[.145] dark:bg-zinc-900 ${
        isDragging ? "z-10 opacity-70" : ""
      }`}
    >
      <span
        role="link"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(todo._id);
        }}
        className="cursor-pointer hover:underline"
      >
        {todo.title}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(todo._id);
        }}
        className="text-xs text-red-600"
      >
        삭제
      </button>
    </div>
  );
}

function Column({
  id,
  label,
  todos,
  onOpen,
  onDelete,
}: {
  id: TodoStatus;
  label: string;
  todos: Todo[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] flex-1 flex-col gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.145] ${
        isOver ? "bg-black/[.03] dark:bg-white/[.06]" : ""
      }`}
    >
      <h3 className="text-sm font-semibold text-zinc-500">{label}</h3>
      {todos.map((todo) => (
        <TodoCard key={todo._id} todo={todo} onOpen={onOpen} onDelete={onDelete} />
      ))}
    </div>
  );
}

export function Board({
  todos,
  onMove,
  onDelete,
}: {
  todos: Todo[];
  onMove: (todoId: string, newStatus: TodoStatus) => void;
  onDelete: (todoId: string) => void;
}) {
  const router = useRouter();
  // Without an activation distance, dnd-kit treats a plain click as a zero-movement
  // drag and swallows the click event on children, breaking the title's onOpen click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const todoId = String(active.id);
    const newStatus = over.id as TodoStatus;
    const todo = todos.find((t) => t._id === todoId);
    if (todo && todo.status !== newStatus) {
      onMove(todoId, newStatus);
    }
  }

  function handleOpen(todoId: string) {
    router.push(`/todos/${todoId}`);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            label={col.label}
            todos={todos.filter((t) => t.status === col.id)}
            onOpen={handleOpen}
            onDelete={onDelete}
          />
        ))}
      </div>
    </DndContext>
  );
}
