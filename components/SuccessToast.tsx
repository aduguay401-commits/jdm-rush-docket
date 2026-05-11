"use client";

import { useEffect } from "react";

type SuccessToastProps = {
  message: string | null;
  onDismiss: () => void;
};

export default function SuccessToast({ message, onDismiss }: SuccessToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(onDismiss, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <button
      aria-live="polite"
      className="success-toast fixed bottom-4 left-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-lg border border-white/10 border-l-4 border-l-emerald-500 bg-[#141414] px-4 py-3 text-left text-sm text-white shadow-2xl shadow-black/40 transition hover:border-white/20 sm:left-auto sm:right-4 sm:top-4 sm:bottom-auto sm:w-auto sm:min-w-72"
      onClick={onDismiss}
      type="button"
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-400">
        ✓
      </span>
      <span className="font-medium">{message}</span>
    </button>
  );
}
