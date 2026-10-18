"use client";

import { useState } from "react";
import { CATEGORY_COLOR_OPTIONS, resolveCategoryStyle } from "@/lib/category";
import type { Category } from "@/lib/useCategories";

const NEW_CATEGORY_VALUE = "__new__";

/**
 * Lets the user pick one of their saved categories (color applied
 * automatically — see resolveCategoryStyle) or register a new one by typing
 * a name and picking its color once. That saved name+color pair is then
 * reused everywhere that category is used, instead of re-picking a color
 * every time.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  onCreate,
  onDelete,
}: {
  categories: Category[];
  value: string;
  onChange: (category: string) => void;
  onCreate: (name: string, colorKey: string) => Promise<Category | null>;
  onDelete?: (categoryId: string) => Promise<boolean>;
}) {
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColorKey, setNewColorKey] = useState(CATEGORY_COLOR_OPTIONS[0].key);
  const [saving, setSaving] = useState(false);

  const dot = resolveCategoryStyle(value, categories).dot;

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === NEW_CATEGORY_VALUE) {
      setCreating(true);
      setNewName("");
      setNewColorKey(CATEGORY_COLOR_OPTIONS[0].key);
      return;
    }
    onChange(e.target.value);
  }

  // A plain div, not a <form> — this picker is used inside other forms
  // (the todo-creation forms on /daily and the week board), and a <form>
  // nested inside another <form> is invalid HTML: browsers split it into
  // sibling forms during parsing, so a nested submit stops reaching this
  // handler. The "분류 추가" button and Enter-in-the-name-input both call
  // this directly instead of relying on form submission.
  async function submitNewCategory() {
    const trimmed = newName.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const created = await onCreate(trimmed, newColorKey);
    setSaving(false);
    if (created) {
      onChange(created.name);
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        <select
          value={creating ? NEW_CATEGORY_VALUE : value}
          onChange={handleSelectChange}
          className="w-32 rounded-sm border border-hairline bg-canvas px-2 py-2 text-ink focus:border-2 focus:border-ink focus:outline-none"
        >
          <option value="">분류 없음</option>
          {categories.map((c) => (
            <option key={c._id} value={c.name}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CATEGORY_VALUE}>+ 새 분류 추가</option>
        </select>
        {categories.length > 0 && onDelete && (
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            className="text-xs text-muted hover:text-primary"
          >
            관리
          </button>
        )}
      </div>

      {creating && (
        <div className="flex flex-col gap-1.5 rounded-sm border border-hairline-soft p-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNewCategory();
              }
            }}
            placeholder="새 분류 이름"
            maxLength={20}
            className="rounded-sm border border-hairline bg-canvas px-2 py-1 text-sm text-ink focus:border-2 focus:border-ink focus:outline-none"
          />
          <div className="flex flex-wrap gap-1">
            {CATEGORY_COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setNewColorKey(opt.key)}
                title={opt.label}
                aria-label={opt.label}
                className={`h-5 w-5 rounded-full ${opt.dot} ${
                  newColorKey === opt.key ? "ring-2 ring-ink ring-offset-1" : ""
                }`}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={submitNewCategory}
              disabled={!newName.trim() || saving}
              className="rounded-sm bg-primary px-3 py-1 text-xs font-medium text-on-primary hover:bg-primary-active disabled:opacity-50"
            >
              분류 추가
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-sm border border-hairline px-3 py-1 text-xs text-ink"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {managing && onDelete && (
        <ul className="flex flex-col gap-1 rounded-sm border border-hairline-soft p-2">
          {categories.map((c) => (
            <li key={c._id} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-ink">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${resolveCategoryStyle(c.name, categories).dot}`}
                  aria-hidden
                />
                {c.name}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`"${c.name}" 분류를 삭제할까요? 이미 사용 중인 일정의 분류명은 그대로 남아요.`))
                    return;
                  const deleted = await onDelete(c._id);
                  if (deleted && value === c.name) onChange("");
                }}
                className="text-muted hover:text-error"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
