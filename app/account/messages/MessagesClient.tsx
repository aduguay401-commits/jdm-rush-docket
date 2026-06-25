"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { CustomerMessage } from "@/lib/customer/dashboard";

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, customerName }: { msg: CustomerMessage; customerName: string }) {
  const isUs = msg.from === "JDM Rush";
  return (
    <div className={`flex gap-2.5 ${isUs ? "" : "flex-row-reverse"}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-7 h-7 flex items-center justify-center text-[10px] font-bold rounded-full ${
          isUs
            ? "bg-[#E55125]/20 text-[#E55125] border border-[#E55125]/30"
            : "bg-white/[0.06] text-white/40 border border-white/[0.08]"
        }`}
      >
        {isUs ? "JR" : customerName.charAt(0)}
      </div>

      {/* Bubble */}
      <div
        className={`flex-1 min-w-0 max-w-[85%] ${
          isUs ? "" : "flex flex-col items-end"
        }`}
      >
        <p
          className={`text-[10px] font-medium mb-1 text-white/25 ${
            isUs ? "" : "text-right"
          }`}
        >
          {msg.sender} · {msg.time}
        </p>
        <div
          className={`px-3.5 py-2.5 text-[13px] leading-relaxed ${
            isUs
              ? "bg-white/[0.04] border border-white/[0.06] text-white/60"
              : "bg-[#E55125]/[0.08] border border-[#E55125]/[0.15] text-white/70"
          }`}
        >
          {msg.text}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MessagesClient({
  docketId,
  customerName,
  messages,
  vehicle,
}: {
  docketId: string;
  customerName: string;
  messages: CustomerMessage[];
  vehicle: string;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [thread, setThread] = useState(messages);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  function handleClose() {
    setClosing(true);
    setTimeout(() => router.back(), 260);
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setError("");

    const response = await fetch("/api/customer/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docketId, message: trimmed }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to send message.");
      setIsSending(false);
      return;
    }

    setThread((current) => [
      ...current,
      {
        id: `pending-${Date.now()}`,
        from: "You",
        sender: "You",
        time: "Today",
        timestamp: new Date().toISOString(),
        text: trimmed,
      },
    ]);
    setMessageText("");
    setIsSending(false);
    router.refresh();
  }

  return (
    <>
      {/* CSS keyframes for enter and exit */}
      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes slideOutToRight {
          from { transform: translateX(0); }
          to   { transform: translateX(100%); }
        }
      `}</style>

      <div
        className="flex bg-[#111111]"
        style={{ height: "100vh", overflow: "hidden" }}
      >
        {/* ── Dimmed background — desktop only ── */}
        <div
          className="hidden sm:flex flex-1 flex-col overflow-hidden select-none pointer-events-none"
          style={{ opacity: 0.18 }}
        >
          {/* Ghost header */}
          <div className="bg-black border-b border-white/[0.08] h-16 shrink-0" />
          {/* Ghost content */}
          <div className="px-10 pt-12 flex-1 overflow-hidden">
            <div className="w-8 h-[2px] bg-[#E55125] mb-5" />
            <div className="h-7 w-40 bg-white/20 mb-10" />
            {[0, 1].map((i) => (
              <div key={i} className="border border-white/[0.08] mb-4">
                <div className="h-36 bg-[#0a0a0a]" />
                <div className="p-4 bg-black">
                  <div className="h-2 w-24 bg-white/[0.08] mb-2.5" />
                  <div className="h-3 w-44 bg-white/[0.12]" />
                  <div className="flex gap-1 mt-3.5">
                    <div className="h-[3px] w-5 bg-[#E55125]" />
                    <div className="h-[3px] w-5 bg-white/[0.08]" />
                    <div className="h-[3px] w-5 bg-white/[0.08]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Slide-over panel ── */}
        <div
          className="w-full sm:w-[400px] shrink-0 flex flex-col bg-black border-l border-white/[0.08]"
          style={{
            overflow: "hidden",
            animation: closing
              ? "slideOutToRight 0.26s cubic-bezier(0.4, 0, 1, 1) forwards"
              : "slideInFromRight 0.30s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Panel header */}
          <div className="shrink-0 px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-white text-[15px] font-bold">Messages</h2>
              <p className="text-white/30 text-[11px] mt-0.5 truncate">
                {vehicle} · Marcus @ JDM Rush
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="shrink-0 text-white/30 hover:text-white/80 transition-colors"
              aria-label="Close messages"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Thread (scrollable) */}
          <div
            className="flex-1 px-4 py-5 flex flex-col gap-5"
            style={{ overflowY: "auto" }}
          >
            {thread.length > 0 ? (
              thread.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} customerName={customerName} />
              ))
            ) : (
              <p className="text-white/30 text-[12px] leading-relaxed px-1">
                No messages yet. Send a note to your JDM Rush team below.
              </p>
            )}
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-white/[0.08] p-3">
            {error && <p className="text-amber-400/80 text-[11px] mb-2">{error}</p>}
            <form onSubmit={handleSend} className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5">
              <input
                type="text"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder="Message JDM Rush…"
                className="flex-1 bg-transparent text-white/60 placeholder:text-white/20 text-[13px] outline-none"
              />
              <button
                type="submit"
                disabled={isSending || !messageText.trim()}
                className="shrink-0 text-[#E55125]/50 hover:text-[#E55125] disabled:text-[#E55125]/20 transition-colors"
                aria-label="Send"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
