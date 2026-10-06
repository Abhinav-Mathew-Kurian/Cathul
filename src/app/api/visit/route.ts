import { NextRequest, NextResponse } from "next/server";
import { SECTIONS } from "@/lib/sections";
import { recordVisitEvent, startVisit, type VisitEvent } from "@/lib/visits-store";
import { withinRateLimit } from "@/lib/wishes-store";

// Receives the site's visit beacons (see src/lib/track.ts). Always answers
// 204 — a guest's page never waits on, or learns anything from, analytics.

const ID = /^[0-9a-f-]{36}$/;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|headless|lighthouse|pingdom|curl|wget/i;
const EVENTS = new Set<string>(["open", "rsvp", "wish", "ping", ...SECTIONS.map((s) => `section:${s}`)]);
const START_MAX = 60;
const START_WINDOW_MS = 10 * 60 * 1000;

const done = () => new NextResponse(null, { status: 204 });

function deviceOf(ua: string) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet" as const;
  if (/mobi|iphone|android/i.test(ua)) return "phone" as const;
  return "computer" as const;
}

function browserOf(ua: string) {
  if (/instagram/i.test(ua)) return "Instagram app";
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return "Facebook app";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/CriOS|Chrome\//.test(ua)) return "Chrome";
  if (/FxiOS|Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

/**
 * Where the guest came from: an explicit ?src= / ?utm_source= on the link
 * first, then in-app browsers, then the referrer. WhatsApp and SMS open links
 * with no referrer at all, so they land in "Direct / WhatsApp".
 */
function sourceOf(src: string, referrer: string, ua: string, host: string) {
  if (src) return src.toLowerCase().slice(0, 40);
  if (/instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return "facebook";
  let ref = "";
  try {
    ref = new URL(referrer).hostname.replace(/^www\.|^m\.|^l\./, "");
  } catch {}
  if (!ref || ref === host) return "Direct / WhatsApp";
  if (/google\./.test(ref)) return "google";
  if (/facebook\.com|fb\.com/.test(ref)) return "facebook";
  if (/instagram\.com/.test(ref)) return "instagram";
  if (/whatsapp/.test(ref)) return "whatsapp";
  if (/t\.co$|twitter\.com|x\.com/.test(ref)) return "x / twitter";
  return ref.slice(0, 60);
}

const header = (request: NextRequest, name: string) => {
  const value = request.headers.get(name) ?? "";
  try {
    return decodeURIComponent(value).slice(0, 80);
  } catch {
    return value.slice(0, 80);
  }
};

export async function POST(request: NextRequest) {
  // sendBeacon posts text/plain, so read the body as text whatever it says.
  const body = await request
    .text()
    .then((text) => JSON.parse(text.slice(0, 2000)))
    .catch(() => null);
  const id = String(body?.id ?? "");
  const event = String(body?.event ?? "");
  const ua = request.headers.get("user-agent") ?? "";
  if (!ID.test(id) || BOT.test(ua)) return done();

  try {
    if (event === "start") {
      const visitorId = String(body?.visitor ?? "");
      if (!ID.test(visitorId)) return done();
      const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
      if (!(await withinRateLimit(`visit:${client}`, START_MAX, START_WINDOW_MS))) return done();
      await startVisit({
        _id: id,
        visitorId,
        returning: body?.returning === true,
        source: sourceOf(String(body?.src ?? ""), String(body?.referrer ?? ""), ua, request.nextUrl.hostname),
        device: deviceOf(ua),
        browser: browserOf(ua),
        country: header(request, "x-vercel-ip-country"),
        region: header(request, "x-vercel-ip-country-region"),
        city: header(request, "x-vercel-ip-city"),
      });
    } else if (EVENTS.has(event)) {
      await recordVisitEvent(id, event as VisitEvent);
    }
  } catch (error) {
    console.error("Failed to record visit:", error);
  }
  return done();
}
