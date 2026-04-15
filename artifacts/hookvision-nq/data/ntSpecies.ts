export type FishCategory = "estuary" | "reef" | "pelagic" | "freshwater" | "shellfish";
export type EatingRating = 1 | 2 | 3 | 4 | 5;

export interface NTSpecies {
  id: string;
  name: string;
  otherNames: string[];
  scientificName: string;
  category: FishCategory;
  bagLimit: number | null;
  minSizeCm: number | null;
  maxSizeCm: number | null;
  slotLimit: boolean;
  season: string;
  seasonOpen: boolean;
  bestMonths: number[];
  description: string;
  eatingRating: EatingRating;
  catchAndRelease: boolean;
  icon: string;
}

export const NT_SPECIES: NTSpecies[] = [
  {
    id: "barramundi",
    name: "Barramundi",
    otherNames: ["Barra", "Asian Sea Bass"],
    scientificName: "Lates calcarifer",
    category: "estuary",
    bagLimit: 5,
    minSizeCm: 58,
    maxSizeCm: null,
    slotLimit: false,
    season: "Open year-round (check river system closures for some QLD systems)",
    seasonOpen: true,
    bestMonths: [10, 11, 12, 1, 2],
    description:
      "The iconic Gulf Country sportfish. Queensland Fisheries sets a 58 cm minimum and 5-fish daily bag limit. Barra run hard in the Gulf rivers from October through January — Karumba and Norman River produce fish over 1 m every season.",
    eatingRating: 5,
    catchAndRelease: false,
    icon: "fish",
  },
  {
    id: "coral-trout",
    name: "Coral Trout",
    otherNames: ["Common Coral Trout", "Leopard Coral Grouper"],
    scientificName: "Plectropomus leopardus",
    category: "reef",
    bagLimit: 8,
    minSizeCm: 38,
    maxSizeCm: null,
    slotLimit: false,
    season: "Open year-round (check GBR Marine Park zone closures)",
    seasonOpen: true,
    bestMonths: [4, 5, 6, 7, 8, 9],
    description:
      "Queensland's premier reef fish. GBR coral trout are prized for their stunning colours and superb eating quality. QLD Fisheries enforces an 8-fish combined bag across all coral trout species with a 38 cm minimum.",
    eatingRating: 5,
    catchAndRelease: false,
    icon: "fish",
  },
  {
    id: "spanish-mackerel",
    name: "Spanish Mackerel",
    otherNames: ["Spaniard", "Narrow-barred Mackerel"],
    scientificName: "Scomberomorus commerson",
    category: "pelagic",
    bagLimit: 5,
    minSizeCm: 75,
    maxSizeCm: null,
    slotLimit: false,
    season: "Open year-round — peak runs April–October in NQ/Gulf",
    seasonOpen: true,
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    description:
      "One of Australia's most prized sport fish. NQ waters hold outstanding Spaniard numbers from April through October. Trophy fish over 20 kg are encountered regularly off Cairns and Cooktown. QLD bag limit is 5 fish at 75 cm minimum.",
    eatingRating: 5,
    catchAndRelease: false,
    icon: "fish",
  },
  {
    id: "mangrove-jack",
    name: "Mangrove Jack",
    otherNames: ["Jack", "Red Bream", "Creek Red Bream"],
    scientificName: "Lutjanus argentimaculatus",
    category: "estuary",
    bagLimit: 10,
    minSizeCm: 35,
    maxSizeCm: null,
    slotLimit: false,
    season: "Open year-round — best build-up and early wet",
    seasonOpen: true,
    bestMonths: [11, 12, 1, 2, 3, 4],
    description:
      "Aggressive ambush predator found around mangrove roots, rocks, and structure in Gulf estuaries and Cape York rivers. Highly prized sport fish and excellent eating. QLD bag limit is 10 per person at 35 cm minimum.",
    eatingRating: 4,
    catchAndRelease: false,
    icon: "fish",
  },
  {
    id: "mud-crab",
    name: "Mud Crab",
    otherNames: ["Green Crab", "Mangrove Crab"],
    scientificName: "Scylla serrata",
    category: "shellfish",
    bagLimit: 10,
    minSizeCm: 13,
    maxSizeCm: null,
    slotLimit: false,
    season: "Open year-round (females with eggs — zero bag limit)",
    seasonOpen: true,
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    description:
      "Gulf Country mud crabs are legendary — Karumba and the Norman River mouth produce monster greenbacks year-round. QLD minimum carapace width 13 cm (back shell). Females with eggs must be released immediately.",
    eatingRating: 5,
    catchAndRelease: false,
    icon: "crab",
  },
  {
    id: "golden-snapper",
    name: "Golden Snapper",
    otherNames: ["Fingermark", "Finger-mark Bream", "GP"],
    scientificName: "Lutjanus johnii",
    category: "estuary",
    bagLimit: 10,
    minSizeCm: 35,
    maxSizeCm: null,
    slotLimit: false,
    season: "Open year-round — best build-up and wet season",
    seasonOpen: true,
    bestMonths: [10, 11, 12, 1, 2, 3],
    description:
      "The Gulf Country's golden prize. Fingermark grow large in Cape York rivers and GBR reef systems — fish over 8 kg are not uncommon around Weipa and Cape Flattery. Excellent eating and strong fighters. QLD bag limit 10 fish at 35 cm minimum.",
    eatingRating: 5,
    catchAndRelease: false,
    icon: "fish",
  },
  {
    id: "queenfish",
    name: "Queenfish",
    otherNames: ["Queen", "Needlescale Queenfish"],
    scientificName: "Scomberoides commersonnianus",
    category: "pelagic",
    bagLimit: null,
    minSizeCm: null,
    maxSizeCm: null,
    slotLimit: false,
    season: "Open year-round — peak May–September on Gulf beaches",
    seasonOpen: true,
    bestMonths: [5, 6, 7, 8, 9],
    description:
      "The acrobat of Gulf waters — queenfish are famous for spectacular aerial displays and long runs. Karumba beach in winter holds massive schools that will inhale surface lures. No bag or size limit in QLD.",
    eatingRating: 2,
    catchAndRelease: true,
    icon: "fish",
  },
  {
    id: "giant-trevally",
    name: "Giant Trevally",
    otherNames: ["GT", "Lowly Trevally", "Giant Kingfish"],
    scientificName: "Caranx ignobilis",
    category: "pelagic",
    bagLimit: null,
    minSizeCm: null,
    maxSizeCm: null,
    slotLimit: false,
    season: "Open year-round — best dry season at Weipa and Cape York",
    seasonOpen: true,
    bestMonths: [5, 6, 7, 8, 9],
    description:
      "The GT is one of the world's most powerful sport fish. Weipa is world-famous for its GTs — the Embley River causeway and offshore bombies produce fish up to 50 kg. No bag or size limit in QLD — strongly encouraged to release breeding fish.",
    eatingRating: 2,
    catchAndRelease: true,
    icon: "fish",
  },
  {
    id: "sooty-grunter",
    name: "Sooty Grunter",
    otherNames: ["Sooty", "Black Bream"],
    scientificName: "Hephaestus fuliginosus",
    category: "freshwater",
    bagLimit: 20,
    minSizeCm: null,
    maxSizeCm: null,
    slotLimit: false,
    season: "Open year-round in NQ freshwater streams",
    seasonOpen: true,
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    description:
      "The hard-fighting freshwater native of North Queensland's mountain streams and coastal rivers. Sooties hit surface lures and small spinners with abandon in clear water. Found throughout Wet Tropics, Atherton Tablelands, and Cape York streams.",
    eatingRating: 3,
    catchAndRelease: false,
    icon: "fish",
  },
  {
    id: "black-jewfish",
    name: "Black Jewfish",
    otherNames: ["Mulloway", "Jewfish", "Black Jew"],
    scientificName: "Protonibea diacanthus",
    category: "estuary",
    bagLimit: 5,
    minSizeCm: 60,
    maxSizeCm: null,
    slotLimit: false,
    season: "Open year-round — night sessions best in dry season",
    seasonOpen: true,
    bestMonths: [5, 6, 7, 8, 9],
    description:
      "A prized nocturnal species in Gulf estuaries and deep tidal channels. Normanton and Karumba boat ramps produce solid fish on live bait at night. QLD bag limit 5 fish at 60 cm minimum. Handle carefully — they produce a powerful grunt.",
    eatingRating: 4,
    catchAndRelease: false,
    icon: "fish",
  },
];

export const CATEGORIES: { key: FishCategory | "all"; label: string }[] = [
  { key: "all",         label: "All Species" },
  { key: "estuary",    label: "Estuary" },
  { key: "reef",       label: "Reef" },
  { key: "pelagic",    label: "Pelagic" },
  { key: "freshwater", label: "Freshwater" },
  { key: "shellfish",  label: "Shellfish" },
];
