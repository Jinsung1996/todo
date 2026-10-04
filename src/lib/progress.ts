export function weeklyProgress(todos: { status: string }[]): number {
  if (todos.length === 0) return 0;
  const done = todos.filter((t) => t.status === "DONE").length;
  return Math.round((done / todos.length) * 100);
}
