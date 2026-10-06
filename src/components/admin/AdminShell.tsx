"use client";

import { useEffect, useState, type ReactNode } from "react";
import { wedding } from "@/content/wedding";

// The frame both admin pages share, built for a phone first: a sticky header
// with the Wishes / Visitors switch (and whatever the page pins under it,
// like filters), big touch targets, and a toast and confirm sheet in place of
// the browser's alert() and confirm() boxes.

export type AdminTab = "wishes" | "visitors";

const { groom, bride } = wedding.couple;

export function AdminShell({
  tab,
  adminKey,
  onRefresh,
  refreshing = false,
  toolbar,
  children,
}: {
  tab: AdminTab;
  adminKey: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const key = encodeURIComponent(adminKey);
  return (
    <div className="min-h-screen w-full bg-cream text-ink">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">Admin</p>
          <p className="truncate font-hand text-2xl leading-tight text-ink">
            {groom} &amp; {bride}
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh"
            className="grid size-11 flex-shrink-0 place-items-center rounded-full bg-white text-ink/70 shadow-sm active:scale-95"
          >
            <RefreshIcon className={refreshing ? "animate-spin" : ""} />
          </button>
        )}
      </div>
      {/* Only the switch and the page's own controls stay pinned while scrolling. */}
      <header className="sticky top-0 z-30 border-b border-ink/8 bg-cream/90 pt-3 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4">
          <nav className="grid grid-cols-2 rounded-2xl bg-ink/6 p-1" aria-label="Admin pages">
            {(
              [
                ["wishes", "Wishes", `/wishes-admin?key=${key}`],
                ["visitors", "Visitors", `/analytics-admin?key=${key}`],
              ] as const
            ).map(([id, label, href]) => (
              <a
                key={id}
                href={href}
                aria-current={tab === id ? "page" : undefined}
                className={`rounded-xl py-2.5 text-center font-body text-sm font-semibold transition-colors ${
                  tab === id ? "bg-white text-ink shadow-sm" : "text-ink/55"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
          {toolbar ? <div className="py-3">{toolbar}</div> : <div className="h-3" />}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-[max(6rem,calc(env(safe-area-inset-bottom)+4rem))]">
        {/* The extra div keeps the cards from matching globals.css's
            `main > section` rule, which skips painting off-screen sections
            of the invitation and would leave blank cards here. */}
        <div>{children}</div>
      </main>
    </div>
  );
}

/** A short message that floats above the bottom edge, then leaves on its own. */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error"; id: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);
  const show = (text: string, tone: "ok" | "error" = "ok") => setToast({ text, tone, id: Date.now() });
  const element = toast && (
    <div
      key={toast.id}
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
    >
      <p
        className={`rounded-full px-5 py-3 font-body text-sm font-semibold text-white shadow-lg ${
          toast.tone === "error" ? "bg-rose-deep" : "bg-ink"
        }`}
      >
        {toast.text}
      </p>
    </div>
  );
  return { show, element };
}

/** A bottom sheet asking to confirm something that can't be undone. */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Cancel" onClick={onCancel} className="absolute inset-0 bg-ink/40" />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pt-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15 sm:hidden" />
        <h2 className="font-body text-lg font-bold text-ink">{title}</h2>
        <p className="mt-1 font-body text-sm text-ink/65">{body}</p>
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="h-12 rounded-2xl bg-rose-deep font-body text-base font-semibold text-white active:scale-[0.98]"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-2xl bg-ink/6 font-body text-base font-semibold text-ink/75 active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Icons (24px grid, stroke) ──────────────────────────────────────────────

function Icon({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`size-[18px] flex-shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export const RefreshIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </Icon>
);
export const SearchIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);
export const PinIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M12 17v5" />
    <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z" />
  </Icon>
);
export const EyeIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const EyeOffIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2" />
    <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="m2 2 20 20" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icon>
);
export const TrashIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
  </Icon>
);
export const LockIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
);
