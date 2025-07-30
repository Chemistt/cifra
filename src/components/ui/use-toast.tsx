"use client";

import { create } from "zustand";
import { useCallback } from "react";

type Toast = {
  id: string;
  title: string;
  description?: string;
  duration?: number;
};

type ToastStore = {
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
};

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({ toasts: [...state.toasts, toast] })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

function useToast() {
  const addToast = useToastStore((state) => state.addToast);

  const toast = useCallback(
    ({
      title,
      description,
      duration = 3000,
    }: Omit<Toast, "id">) => {
      const id = crypto.randomUUID();
      addToast({ id, title, description, duration });
      setTimeout(() => {
        useToastStore.getState().removeToast(id);
      }, duration);
    },
    [addToast]
  );

  return { toast };
}

export { useToast };