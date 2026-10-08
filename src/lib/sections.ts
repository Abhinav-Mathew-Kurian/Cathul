// The invitation's sections, top to bottom, by their element ids — what the
// analytics page measures "how far guests got" against.
export const SECTIONS = ["story", "celebrations", "rsvp", "note", "wishes", "gallery", "music"] as const;
export type Section = (typeof SECTIONS)[number];

// What a guest can do beyond reading, each counted at most once per visit:
// a venue's map or calendar file (by side), opening or liking a photo,
// calling a contact, and switching the music off.
export const ACTIONS = [
  "map:groom",
  "map:bride",
  "calendar:groom",
  "calendar:bride",
  "photo",
  "like",
  "call",
  "music-off",
] as const;
export type Action = (typeof ACTIONS)[number];
