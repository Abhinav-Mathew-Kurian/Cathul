"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DONT_COUNT_KEY, thisDevicesVisitor } from "@/lib/track";

// "Don't count this device", shared by every admin page. Opening any of them
// switches it on for that device unless it was switched off by hand, since
// only the couple open the admin. Each switch also tells the server, so the
// device's past visits leave the numbers too (or come back).

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
/** true / false, or null on the server and wherever storage is blocked. */
const read = () => {
  try {
    return localStorage.getItem(DONT_COUNT_KEY) === "1";
  } catch {
    return null;
  }
};

/** Saves the choice on this device and on the server. Resolves false if either failed. */
export async function setDontCount(adminKey: string, dontCount: boolean): Promise<boolean> {
  const visitor = thisDevicesVisitor();
  try {
    localStorage.setItem(DONT_COUNT_KEY, dontCount ? "1" : "0");
  } catch {
    return false;
  }
  listeners.forEach((listener) => listener());
  if (!visitor) return false;
  const res = await fetch(`/api/visits/admin?key=${encodeURIComponent(adminKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitor, counted: !dontCount }),
  }).catch(() => null);
  return !!res?.ok;
}

export function useDontCount() {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** On an admin page: leaves this device out of the numbers, unless it was switched back on by hand. */
export function useLeaveThisDeviceOut(adminKey: string) {
  useEffect(() => {
    if (!adminKey) return;
    let choice: string | null;
    try {
      choice = localStorage.getItem(DONT_COUNT_KEY);
    } catch {
      return;
    }
    // Repeated for a device already left out, so the server hears of one
    // that switched before it kept a list.
    if (choice !== "0") void setDontCount(adminKey, true);
  }, [adminKey]);
}
