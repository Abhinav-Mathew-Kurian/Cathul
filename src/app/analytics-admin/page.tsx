import type { Metadata } from "next";
import { Analytics } from "./Analytics";

// The couple's private view of who's been visiting. The key in the URL is
// checked by the API on every request (RSVP_EXPORT_KEY); this page itself holds nothing.
export const metadata: Metadata = {
  title: "Visitors — admin",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { key } = await searchParams;
  return <Analytics adminKey={typeof key === "string" ? key : ""} />;
}
