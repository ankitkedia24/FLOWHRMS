"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleCheck, CircleX, CloudOff, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Toast (component-specifications.md §20).
 * - success 4s · info 5s · error PERSISTENT until dismissed.
 * - Timer pauses on hover/focus. Never focus-stealing.
 * - Placement: bottom (above the bottom nav) on mobile; bottom-right on
 *   desktop, max 3 visible.
 * - A toast never carries the only copy of important information.
 */
export type ToastVariant = "neutral" | "success" | "info" | "error" | "offline";

export interface ToastInput {
  variant: ToastVariant;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ show: (t: ToastInput) => void } | null>(
  null,
);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const DURATIONS: Record<ToastVariant, number | null> = {
  success: 4000,
  neutral: 4000,
  info: 5000,
  offline: 5000,
  error: null, // persistent until dismissed
};

const icons: Record<ToastVariant, ReactNode> = {
  success: <CircleCheck aria-hidden="true" className="size-5 shrink-0" />,
  info: <Info aria-hidden="true" className="size-5 shrink-0" />,
  error: <CircleX aria-hidden="true" className="size-5 shrink-0" />,
  neutral: <Info aria-hidden="true" className="size-5 shrink-0" />,
  offline: <CloudOff aria-hidden="true" className="size-5 shrink-0" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const startTimer = useCallback(
    (id: number, variant: ToastVariant) => {
      const duration = DURATIONS[variant];
      if (duration === null) return;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  const pauseTimer = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-2), { ...input, id }]); // max 3
      startTimer(id, input.variant);
    },
    [startTimer],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-5",
          "bottom-[calc(var(--fh-layout-bottom-nav-height)+var(--fh-space-3)+env(safe-area-inset-bottom))]",
          "md:inset-x-auto md:right-6 md:bottom-6 md:items-end",
        )}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            onMouseEnter={() => pauseTimer(toast.id)}
            onMouseLeave={() => startTimer(toast.id, toast.variant)}
            onFocus={() => pauseTimer(toast.id)}
            onBlur={() => startTimer(toast.id, toast.variant)}
            className={cn(
              "pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-md p-3.5 shadow-elevation-3",
              toast.variant === "error"
                ? "border border-status-error-border bg-status-error-bg text-status-error-text"
                : toast.variant === "offline"
                  ? "border border-status-info-border bg-status-info-bg text-status-info-text"
                  : "bg-surface-inverse text-text-inverse",
            )}
          >
            {icons[toast.variant]}
            <p className="min-w-0 flex-1 text-secondary">{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
                className="shrink-0 text-label underline underline-offset-2"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-xs p-1 opacity-80 hover:opacity-100"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
