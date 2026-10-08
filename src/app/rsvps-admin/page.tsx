import type { Metadata } from "next";
import { RsvpsAdmin } from "./RsvpsAdmin";

// The couple's private view of every RSVP. The key in the URL is checked by
// the API on every request (RSVP_EXPORT_KEY); this page itself holds nothing.
export const metadata: Metadata = {
  title: "RSVPs — admin",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { key } = await searchParams;
  return <RsvpsAdmin adminKey={typeof key === "string" ? key : ""} />;
}
