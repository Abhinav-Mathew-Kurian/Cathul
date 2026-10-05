// Rules for a wish, shared by the form (instant feedback) and the API (the
// real check — the client is never trusted), so the two can't drift apart.

export type WishVisibility = "public" | "private";

/** What the public wall and the API ever expose about a wish. */
export type PublicWish = {
  id: string;
  name: string;
  message: string;
  /** ISO timestamp. */
  createdAt: string;
};

export const NAME_MAX = 60;
export const MESSAGE_MIN = 2;
export const MESSAGE_MAX = 400;
export const PAGE_SIZE = 8;
/**
 * How many wishes the couple can pin to the sky. The sky has 12 spots; the
 * rest always go to the newest wishes, so a guest's own lantern still has
 * somewhere to rise to.
 */
export const MAX_PINNED = 6;

/** Trims, NFC-normalizes, strips control characters and collapses runs of blank lines. */
export function cleanText(raw: unknown, max: number, multiline: boolean): string {
  let text = String(raw ?? "").normalize("NFC");
  // Keep \n in messages; drop every other control/format character that
  // could hide text or flip its direction.
  text = text.replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩]/g, "");
  text = multiline ? text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n") : text.replace(/\s+/g, " ");
  return text.trim().slice(0, max);
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|net|org|io|co|me|app|link|xyz|ly)\b)/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// 8+ digits, allowing spaces, dashes, dots and brackets between them.
const PHONE = /(\+?\d[\s\-.()]*){8,}/;

export type WishInput = { name: string; message: string; visibility: WishVisibility };

/** Field → error message; empty when the wish is fine to send. */
export function validateWish({ name, message, visibility }: WishInput): Partial<Record<"name" | "message", string>> {
  const errors: Partial<Record<"name" | "message", string>> = {};
  if (!name) errors.name = "Please add your name.";
  if (message.length < MESSAGE_MIN) errors.message = "Write a few words for the couple.";
  else if (visibility === "public" && (LINK.test(message) || EMAIL.test(message) || PHONE.test(message))) {
    errors.message = "Links, emails and phone numbers can't go on the public wall — send it privately instead.";
  }
  if (visibility === "public" && !errors.name && (LINK.test(name) || PHONE.test(name))) {
    errors.name = "Just your name, please.";
  }
  return errors;
}
