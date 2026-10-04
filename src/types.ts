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
  weeklyPlanId: string | WeeklyPlan;
  scheduledDate?: string | null;
}
