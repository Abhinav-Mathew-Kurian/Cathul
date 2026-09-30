import type { Metadata } from "next";
import { WishesAdmin } from "./WishesAdmin";

// The couple's private view of every wish. The key in the URL is checked by
// the API on every request (RSVP_EXPORT_KEY); this page itself holds nothing.
export const metadata: Metadata = {
  title: "Wishes — admin",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { key } = await searchParams;
  return <WishesAdmin adminKey={typeof key === "string" ? key : ""} />;
}
