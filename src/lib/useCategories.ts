"use client";

import { useCallback, useEffect, useState } from "react";

export interface Category {
  _id: string;
  name: string;
  colorKey: string;
}

/** Shared load/create/delete for the user's registered categories — used
 *  everywhere a todo's category is entered or displayed (see CategoryPicker
 *  and resolveCategoryStyle in src/lib/category.ts). */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    return fetch("/api/categories")
      .then((res) => res.json())
      .then((data: Category[]) => {
        setCategories(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createCategory(name: string, colorKey: string): Promise<Category | null> {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, colorKey }),
    });
    if (!res.ok) return null;
    const created: Category = await res.json();
    setCategories((prev) => [...prev.filter((c) => c.name !== created.name), created]);
    return created;
  }

  async function deleteCategory(categoryId: string): Promise<boolean> {
    const res = await fetch(`/api/categories/${categoryId}`, { method: "DELETE" });
    if (!res.ok) return false;
    setCategories((prev) => prev.filter((c) => c._id !== categoryId));
    return true;
  }

  return { categories, loading, createCategory, deleteCategory, reload: load };
}
