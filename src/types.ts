import type { RepeatRule } from "@/lib/repeat";

export type TodoStatus = "TODO" | "DOING" | "DONE";

export interface YearlyGoal {
  _id: string;
  title: string;
  description?: string;
  year: number;
}

export interface WeeklyPlan {
  _id: string;
  title: string;
  weekStart: string;
  weekEnd: string;
  yearlyGoalId: string | YearlyGoal;
  progress?: number;
}

export interface Todo {
  _id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  category?: string | null;
  // Absent for a standalone "일간 목표" item not tied to any 주간 목표.
  weeklyPlanId?: string | WeeklyPlan | null;
  scheduledDate?: string | null;
  startTime?: string | null; // "HH:mm"
  durationMinutes?: number;
  // 매일 반복되는 습관(아침/점심/저녁 등) — see src/lib/recurring.ts for how
  // completion is derived from lastCompletedDate instead of status.
  isRecurring?: boolean;
  lastCompletedDate?: string | null;
  // 🔁 template only: placed automatically on these weekdays at startTime.
  repeat?: RepeatRule | null;
  repeatSourceId?: string | null;
}
