// The invitation's sections, top to bottom, by their element ids — what the
// analytics page measures "how far guests got" against.
export const SECTIONS = ["story", "celebrations", "rsvp", "note", "wishes", "gallery", "music"] as const;
export type Section = (typeof SECTIONS)[number];
