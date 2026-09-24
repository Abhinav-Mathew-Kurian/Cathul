// ─────────────────────────────────────────────────────────────────────────
// EVERYTHING ON THE SITE LIVES HERE. Edit this one file to update the site.
// Most photos/illustrations are the couple's real assets now; the two
// venue-scenery photos in `celebrations` are still verified Unsplash
// stand-ins until real venue photos exist (see the `unsplash` object below).
// ─────────────────────────────────────────────────────────────────────────

export type StoryMoment = {
  year: string;
  title: string;
  /** Each entry renders as its own line — a scrapbook-style short caption. */
  description: string[];
  /** Real per-stage illustration, dropped in later. Renders a soft placeholder vignette until then. */
  image: string | null;
};

export type GalleryPhoto = {
  id: string;
  caption: string;
  image: string;
};

export type Track = {
  id: string;
  title: string;
  artist: string;
  /** Audio file pending — the player shows a graceful "couldn't load" state until this exists. */
  src: string;
  /** Album art pending — null renders a themed fallback disc instead of a broken image. */
  cover: string | null;
};

export type ReceptionEvent = {
  id: string;
  type: "groom" | "bride";
  label: string;
  /** ISO datetime with the venue's own offset — the single source of truth
   * for day/date/time, so the two never drift out of sync (as the old
   * hand-typed `day: "Sunday"` field once did). */
  startsAt: string;
  venueName: string;
  /** Short city label, shown prominently beside the pin icon. */
  address: string;
  /** Full street address, shown as a smaller line under `address`. */
  fullAddress: string;
  mapsUrl: string;
  /** Real venue-city scenery, not an illustration — swap once venue photos exist. */
  image: string;
  /** Chibi character illustration for this side of the family. */
  character: string;
  note: string[];
  /** Only the bride's note ends with a decorative heart in the reference. */
  noteHeart?: boolean;
};

const unsplash = {
  // Verified real photos (checked location metadata on Unsplash) — Kannur
  // sunset for the groom's side, Munnar (Idukki district) tea hills for the
  // bride's side, standing in for the venue scenery until real venue photos exist.
  kannurSunset: "https://images.unsplash.com/photo-1649832981978-81cb8376e94a",
  idukkiHills: "https://images.unsplash.com/photo-1742106855258-2d7dd403f84a",
};

export const wedding = {
  couple: {
    groom: "Athul",
    bride: "Cathy",
  },

  tagline: "Two families. Two celebrations. One crazy love story.",
  weddingDate: "2026-11-16T18:00:00+05:30", // groom's side — drives the countdown

  hero: {
    heading: "It's Happening!",
  },

  story: {
    heading: "Our Story",
    subheading: ["Different paths. Same chaos.", "A better together."],
    closing: ["Same people", "More madness", "Forever"],
    endingImage: "/images/story/ending-sunset.png",
    moments: [
      {
        year: "2018",
        title: "First Met",
        description: ["College mutuals", "(and a lot of chaya )"],
        image: "/images/story/first-met.png",
      },
      {
        year: "2019",
        title: "Actually Talked",
        description: ["Turned out we like", "the same dumb jokes(NOPE!)"],
        image: "/images/story/became-friends.png",
      },
      {
        year: "2020",
        title: "Became Friends",
        description: ["Long conversations.", "Zero plans to stop"],
        image: "/images/story/something-more.png",
      },
      {
        year: "2022",
        title: "Something More",
        description: ["We lost count", "of time...(And apparently, sleep too)"],
        image: "/images/story/looking-at-each-other.png",
      },
      {
        year: "2026",
        title: "Here We Are",
        description: ["Still the same idiots.", "Just luckier."],
        image: "/images/story/here-we-are.png",
      },
    ] satisfies StoryMoment[],
  },

  celebrations: {
    heading: "The Celebrations",
    subheading: ["Same love. Two receptions.", "Twice the fun!"],
    events: [
      {
        id: "groom-reception",
        type: "groom",
        label: "Groom's Side Reception",
        startsAt: "2026-11-17T11:30:00+05:30",
        venueName: "Suvarnabhumi Auditorium",
        address: "Kannur",
        fullAddress: "Manathana, Kalladi, Kannur, Kerala",
        mapsUrl: "https://maps.google.com/?q=Suvarnabhumi+Auditorium+Manathana+Kalladi+Kannur+Kerala",
        image: unsplash.kannurSunset,
        character: "/images/celebrations/groom.png",
        note: ["Groom's side + friends", "Come early. Stay late. Eat well!"],
      },
      {
        id: "bride-reception",
        type: "bride",
        label: "Bride's Side Reception",
        startsAt: "2026-11-22T18:00:00+05:30",
        venueName: "Grand Bella Auditorium",
        address: "Idukki",
        fullAddress: "Kanjikuzhy, Kerala 685606",
        mapsUrl: "https://maps.google.com/?q=Grand+Bella+Auditorium+Kanjikuzhy+Kerala+685606",
        image: unsplash.idukkiHills,
        character: "/images/celebrations/bride.png",
        note: ["Bride's side + everyone else", "Same people. Different city.", "Same madness!"],
        noteHeart: true,
      },
    ] satisfies ReceptionEvent[],
  },

  rsvp: {
    heading: "RSVP",
    subheading: ["Let us know if you're joining", "the madness!"],
    countryCodes: ["+91", "+1", "+44", "+971"],
    bothEventsLabel: "Both (Of course!)",
    bottomImage: "/images/rsvp/just-married.png",
  },

  gallery: {
    heading: "Gallery",
    subheading: "Some moments. More to come...",
    photos: [
      { id: "g1", caption: "Where it all began (2016)", image: "/images/gallery/g1-old-times.jpg" },
      { id: "g2", caption: "That look", image: "/images/gallery/g2-forest-glance.jpg" },
      { id: "g3", caption: "Lost in the ruins", image: "/images/gallery/g3-temple-pillars.jpg" },
      { id: "g4", caption: "Golden hour", image: "/images/gallery/g4-temple-sunset.jpg" },
      { id: "g5", caption: "Peace & Happy", image: "/images/gallery/g5-temple-selfie.jpg" },
      { id: "g6", caption: "Quiet mornings", image: "/images/gallery/g6-cafe-hands.jpg" },
      { id: "g7", caption: "Up in the clouds", image: "/images/gallery/g7-hills-tees.jpg" },
      { id: "g8", caption: "Mirror selfie o'clock", image: "/images/gallery/g8-cafe-mirror.jpg" },
      { id: "g9", caption: "Family & flowers", image: "/images/gallery/g9-roses-family.jpg" },
      { id: "g10", caption: "On the road again", image: "/images/gallery/g10-street-backpacks.jpg" },
    ] satisfies GalleryPhoto[],
    closing: "Collecting moments for a lifetime!",
    endingImage: "/images/gallery/ending-portrait.png",
  },

  music: {
    heading: "Music",
    subheading: ["Because every good story", "has a soundtrack!"],
    speechBubble: "Better with music, right?",
    bottomImage: "/images/music/temple-archway.png",
    // Cover art is a photo from the same gallery shoot, not used elsewhere
    // in the gallery grid, composited with the title/artist baked in.
    // Fully data-driven — adding another track later is just another entry.
    playlist: [
      {
        id: "jhol-acoustic",
        title: "Jhol (Acoustic)",
        artist: "Maanu",
        src: "/audio/song-1-jhol.mp3",
        cover: "/images/music/covers/song-1-jhol.jpg",
      },
      {
        id: "koode-neeyum",
        title: "Koode Neeyum",
        artist: "Rohan D M, Jisma & Vimal",
        src: "/audio/song-2-koode-neeyum.mp3",
        cover: "/images/music/covers/song-2-koode-neeyum.jpg",
      },
      {
        id: "dekha-hi-nahi",
        title: "Dekha Hi Nahi",
        artist: "Osho Jain",
        src: "/audio/song-3-dekha-hi-nahi.mp3",
        cover: "/images/music/covers/song-3-dekha-hi-nahi.jpg",
      },
      {
        id: "rehbara",
        title: "Rehbara",
        artist: "Abhijeet Srivastava, Shayra Apoorva",
        src: "/audio/song-4-rehbara.mp3",
        cover: "/images/music/covers/song-4-rehbara.jpg",
      },
      {
        id: "nenjodu-cherthu",
        title: "Nenjodu Cherthu",
        artist: "Yuvvh",
        src: "/audio/song-5-nenjodu-cherthu.mp3",
        cover: null,
      },
    ] satisfies Track[],
  },

  note: {
    heading: "A Note From Us",
    body: [
      "We can't wait to celebrate this special chapter with our favourite people.",
      "Thank you for being a part of our journey — for your love, support, and all the madness along the way.",
      "See you soon!",
    ],
    closing: ["Same people", "Same chaos", "A brighter tomorrow"],
  },

  help: {
    heading: "Need Help?",
    subheading: "For any queries, reach out to:",
    sides: [
      {
        label: "Groom's Side",
        contacts: [
          { name: "Athul", phone: "+91 97473 91259" },
          { name: "Groom's Father", phone: "+91 85473 45774" },
          { name: "Groom's Brother", phone: "+91 85905 35279" },
        ],
      },
      {
        label: "Bride's Side",
        contacts: [
          { name: "Cathy", phone: "+91 70348 58948" },
          { name: "Bride's Father", phone: "+91 94957 64123" },
          { name: "Bride's Brother", phone: "+91 86066 68939" },
        ],
      },
    ],
    note: "Or just ping us, we probably won't miss it!",
  },

  footerImage: "/images/footer/thank-you.png",
};

export type Wedding = typeof wedding;
