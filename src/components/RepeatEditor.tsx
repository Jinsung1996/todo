"use client";

import { useState } from "react";
import { WeekdayPicker } from "@/components/RepeatDialog";
import { DurationSelect, TimeSelect } from "@/components/TimeSelect";
import { describeRepeat, type RepeatRule } from "@/lib/repeat";

/**
 * A running repeat's days, time and length, changed for every untouched
 * copy from today on in one go (instead of moving each day by hand).
 */
export function RepeatEditor({
  rule,
  durationMinutes,
  onSave,
  onStop,
}: {
  rule: RepeatRule;
  durationMinutes: number;
  onSave: (changes: { weekdays: number[]; startTime: string; durationMinutes: number }) => void;
  onStop: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [weekdays, setWeekdays] = useState(rule.weekdays);
  const [startTime, setStartTime] = useState(rule.startTime);
  const [duration, setDuration] = useState(durationMinutes);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink">
        <span data-repeat-rule>{describeRepeat(rule)}에 자동으로 추가 중</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-primary hover:underline"
        >
          반복 수정
        </button>
        <button type="button" onClick={onStop} className="text-xs text-error hover:text-error-hover">
          반복 중지
        </button>
      </div>
    );
  }

  return (
    <div data-repeat-editor className="flex flex-col gap-3 rounded-md border border-hairline p-4">
      <WeekdayPicker value={weekdays} onChange={setWeekdays} />
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          시작
          <TimeSelect value={startTime} onChange={setStartTime} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          길이
          <DurationSelect value={duration} onChange={setDuration} />
        </label>
      </div>
      <p className="text-xs text-muted">
        오늘부터 아직 시작 안 한 반복 일정이 모두 바뀌어요. 진행 중·완료된 일정은 그대로예요.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-sm border border-hairline px-4 py-2 text-sm text-ink"
        >
          취소
        </button>
        <button
          type="button"
          disabled={weekdays.length === 0}
          onClick={() => {
            onSave({ weekdays, startTime, durationMinutes: duration });
            setEditing(false);
          }}
          className="flex-1 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </div>
  );
}
