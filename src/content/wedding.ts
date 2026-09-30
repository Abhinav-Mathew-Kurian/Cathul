// ─────────────────────────────────────────────────────────────────────────
// EVERYTHING ON THE SITE LIVES HERE. Edit this one file to update the site.
// Most photos/illustrations are the couple's real assets now; the two
// venue-scenery photos in `celebrations` are still verified Unsplash
// stand-ins until real venue photos exist (see the `unsplash` object below).
// ─────────────────────────────────────────────────────────────────────────

export type StoryMoment = {
  year: string;
  /** Not shown on the page — used as the illustration's alt text. */
  title: string;
  /** One line beside the illustration — it flies in letter by letter in place of a title. */
  text: string;
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
    /** Her full name — used where the formal invitation wording calls for it (title, share previews). */
    brideFull: "Catherine",
  },

  // The live domain — canonical URL, share previews, sitemap and robots all build on it.
  siteUrl: "https://athulwedscathy.in",

  tagline: "Two families. Two celebrations. One crazy love story.",
  weddingDate: "2026-11-16T18:00:00+05:30", // groom's side — drives the countdown

  hero: {
    heading: "It's Happening!",
  },

  story: {
    heading: "Our Story",
    subheading: ["Different paths. Same chaos.", "A better together."],
    closing: ["Same people", "More Happiness", "Forever"],
    endingImage: "/images/story/ending-sunset.png",
    moments: [
      {
        year: "2018",
        title: "First Met",
        text: "From college corridors to finding home in each other",
        image: "/images/story/first-met.png",
      },
      {
        year: "2019",
        title: "Actually Talked",
        text: "Two pseudo-intellectuals. One very long story",
        image: "/images/story/became-friends.png",
      },
      {
        year: "2020",
        title: "Became Friends",
        text: "From “Do you know this?” to “I know you.”",
        image: "/images/story/something-more.png",
      },
      {
        year: "2022",
        title: "Something More",
        text: "Ten years, countless conversations, one home",
        image: "/images/story/looking-at-each-other.png",
      },
      {
        year: "2026",
        title: "Here We Are",
        text: "Started with a conversation. Ended with forever.",
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
        startsAt: "2026-11-16T18:00:00+05:30",
        venueName: "Suvarnabhumi Auditorium",
        address: "Kannur",
        fullAddress: "Manathana, Kalladi, Kerala",
        mapsUrl: "https://maps.google.com/?q=Suvarnabhumi+Auditorium+Manathana+Kalladi+Kannur+Kerala",
        image: unsplash.kannurSunset,
        character: "/images/celebrations/groom.png",
        note: ["Groom's side + friends", "Come early. Stay late. Eat well!"],
      },
      {
        id: "bride-reception",
        type: "bride",
        label: "Bride's Side Reception",
        startsAt: "2026-11-22T17:00:00+05:30",
        venueName: "Grand Bella Auditorium",
        address: "Idukki",
        fullAddress: "Kanjikuzhy, Kerala 685606",
        mapsUrl: "https://maps.google.com/?q=Grand+Bella+Auditorium+Kanjikuzhy+Kerala+685606",
        image: unsplash.idukkiHills,
        character: "/images/celebrations/bride.png",
        note: ["Bride's side + everyone else", "Same people. Different city.", "Same Happiness!"],
        noteHeart: true,
      },
    ] satisfies ReceptionEvent[],
  },

  rsvp: {
    heading: "RSVP",
    subheading: ["Let us know if you're joining", "the Happiness!"],
    countryCodes: ["+91", "+1", "+44", "+971"],
    bothEventsLabel: "Both (Of course!)",
    bottomImage: "/images/rsvp/just-married.png",
  },

  gallery: {
    heading: "Gallery",
    subheading: "Some moments. More to come...",
    likeHint: "psst… double-tap to like your favourites 💕✨",
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
      { id: "g11", caption: "Holding on tight", image: "/images/gallery/g11-holding-on.jpg" },
      { id: "g12", caption: "Blue skies, big smiles", image: "/images/gallery/g12-blue-skies.jpg" },
    ] satisfies GalleryPhoto[],
    closing: "Collecting moments for a lifetime!",
    endingImage: "/images/gallery/ending-portrait.png",
  },

  music: {
    heading: "Music",
    subheading: ["Because every good story", "has a soundtrack!"],
    speechBubble: "Better with music, right?",
    bottomImage: "/images/music/temple-archway.png",
    // Cover art is a square crop of one of the couple's photos (mostly their
    // older, pre-gallery ones — college days, even baby pictures).
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
        id: "hridayam",
        title: "Hridayam",
        artist: "Keethan ft. Aromal Chekaver, daszi, Achayan",
        src: "/audio/song-6-hridayam.mp3",
        cover: "/images/music/covers/song-6-hridayam.jpg",
      },
      {
        id: "pesamale",
        title: "Pesamale",
        artist: "Siri, Xander Arra, Aria Khayal",
        src: "/audio/song-7-pesamale.mp3",
        cover: "/images/music/covers/song-7-pesamale.jpg",
      },
      {
        id: "a-thousand-years",
        title: "A Thousand Years",
        artist: "Christina Perri",
        src: "/audio/song-8-a-thousand-years.mp3",
        cover: "/images/music/covers/song-8-a-thousand-years.jpg",
      },
      {
        id: "mazhaye-thoomazhaye",
        title: "Mazhaye Thoomazhaye",
        artist: "Haricharan, Mridula Warrier",
        src: "/audio/song-9-mazhaye-thoomazhaye.mp3",
        cover: "/images/music/covers/song-9-mazhaye-thoomazhaye.jpg",
      },
      {
        id: "amsham",
        title: "Amsham",
        artist: "Aksomaniac, M.H.R, Bhumi & Circle Tone",
        src: "/audio/song-10-amsham.mp3",
        cover: "/images/music/covers/song-10-amsham.jpg",
      },
      {
        id: "little-things",
        title: "Little Things",
        artist: "One Direction",
        src: "/audio/song-11-little-things.mp3",
        cover: "/images/music/covers/song-11-little-things.jpg",
      },
    ] satisfies Track[],
  },

  note: {
    heading: "A Note From Us",
    // The couple's own words — each entry renders as its own paragraph,
    // signed off with their names beneath.
    body: [
      "It’s been 10 years since we first met.",
      "The journey hasn’t always been easy, but somehow, every twist and turn has been worth it.",
      "We’re so glad that, after all these years, we found our way back home to each other. 🤍",
      "And we’re even happier that you get to be a part of this beautiful new chapter and celebrate it with us.",
      "We hope to see you there!",
    ],
    signOff: "With love,",
    signatureEmoji: "💍✨",
    closing: ["Same people", "Same chaos", "A brighter tomorrow"],
  },

  // The wall of wishes right after the couple's note — guests write back.
  wishes: {
    heading: "Wishes & Blessings",
    subheading: "Leave a little love for Athul & Cathy. They'll read every single one.",
    placeholder: "Write your wish for the couple...",
    publicWarning:
      "Your name and wish will be visible to everyone who opens this invitation (that's 1,000+ guests!). Please don't include phone numbers or addresses.",
    privateNote: "Only Athul & Cathy will see this. It won't appear on the wall.",
    sentPublic: "Your wish is on the wall! ✨",
    sentPrivate: "Sent privately to Athul & Cathy 💌",
    empty: "No wishes yet. Yours could be the very first ✨",
    end: "That's every wish so far. Thank you for all the love 💕",
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

  // Paper lanterns rising over the footer artwork — each tap sends one up
  // with the next blessing in this list (it cycles, so no early repeats).
  lanterns: {
    hint: "Tap a lantern to send your blessings",
    blessings: [
      "May your home always be full of laughter",
      "A lifetime of adventures, together",
      "May every sunrise find you side by side",
      "Love that grows sweeter every year",
      "Endless chai, endless chats, endless love",
      "May your love light up every room",
      "Happily ever after starts now",
      "Two hearts, one beautiful story",
    ],
  },
};

export type Wedding = typeof wedding;
