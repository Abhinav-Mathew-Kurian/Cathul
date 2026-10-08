// Turns Vercel's IP-geo headers into names the couple would recognise.
//
// The town is only ever approximate: it's where the guest's network meets the
// internet, not where they are. Indian mobile networks hand most of a region
// to one city — much of central Kerala on Jio or Airtel reads as Kochi — so
// it's best taken as "near here". Only the display changes; visits keep the
// raw names, so the town filter matches every visit, old or new.

/** What the geo database calls a place, and what people call it. Keys are without accents. */
const TOWNS: Record<string, string> = {
  Kanayannur: "Kochi",
  Cochin: "Kochi",
  Tellicherry: "Thalassery",
  Cannanore: "Kannur",
  Calicut: "Kozhikode",
  Trivandrum: "Thiruvananthapuram",
  Trichur: "Thrissur",
  Alleppey: "Alappuzha",
  Quilon: "Kollam",
  Palghat: "Palakkad",
  Muvattupula: "Muvattupuzha",
  Angamali: "Angamaly",
  Perumpavur: "Perumbavoor",
  Kalpatta: "Kalpetta",
  Perya: "Periya",
  "Ar Rayyan": "Al Rayyan",
};

/** Indian states and territories by their ISO 3166-2 code, as Vercel sends them. */
const INDIAN_STATES: Record<string, string> = {
  AN: "Andaman and Nicobar",
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CH: "Chandigarh",
  CG: "Chhattisgarh",
  CT: "Chhattisgarh",
  DH: "Dadra and Nagar Haveli and Daman and Diu",
  DN: "Dadra and Nagar Haveli and Daman and Diu",
  DD: "Dadra and Nagar Haveli and Daman and Diu",
  DL: "Delhi",
  GA: "Goa",
  GJ: "Gujarat",
  HR: "Haryana",
  HP: "Himachal Pradesh",
  JK: "Jammu and Kashmir",
  JH: "Jharkhand",
  KA: "Karnataka",
  KL: "Kerala",
  LA: "Ladakh",
  LD: "Lakshadweep",
  MP: "Madhya Pradesh",
  MH: "Maharashtra",
  MN: "Manipur",
  ML: "Meghalaya",
  MZ: "Mizoram",
  NL: "Nagaland",
  OR: "Odisha",
  OD: "Odisha",
  PY: "Puducherry",
  PB: "Punjab",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TG: "Telangana",
  TS: "Telangana",
  TR: "Tripura",
  UP: "Uttar Pradesh",
  UK: "Uttarakhand",
  UT: "Uttarakhand",
  WB: "West Bengal",
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "IN" → "India"; anything that isn't a country code comes back as it is. */
export function countryName(code: string) {
  try {
    return code.length === 2 ? (regionNames.of(code) ?? code) : code;
  } catch {
    return code;
  }
}

/** "Nilambūr" → "Nilambur", "Kanayannur" → "Kochi". */
export function townName(city: string) {
  const plain = city.normalize("NFD").replace(/\p{M}/gu, "");
  return TOWNS[plain] ?? plain;
}

/** "Kochi, Kerala" in India, "Dublin, Ireland" abroad. */
export function placeName({ city, region, country }: { city: string; region: string; country: string }) {
  const town = city ? townName(city) : "";
  const area = country === "IN" ? (INDIAN_STATES[region] ?? "India") : country ? countryName(country) : "";
  return [town, area !== town && area].filter(Boolean).join(", ") || "Unknown";
}
