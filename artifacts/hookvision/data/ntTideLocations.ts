export type LocationType = "boat_ramp" | "river_mouth" | "rock_bar" | "harbour" | "beach" | "bay";

export interface TideLocation {
  id: string;
  name: string;
  type: LocationType;
  emoji: string;
  tip: string;
  star?: boolean;
}

export interface TideRegion {
  id: string;
  name: string;
  emoji: string;
  color: string;
  refNote: string;
  locations: TideLocation[];
}

export const NT_TIDE_REGIONS: TideRegion[] = [
  {
    id: "darwin",
    name: "Darwin Area",
    emoji: "🌅",
    color: "#00d4aa",
    refNote: "Darwin BOM reference",
    locations: [
      { id: "darwin-city",   name: "Darwin City Ramp",      type: "boat_ramp",   emoji: "🚢", tip: "Stokes Hill ramp — launches at all tides. Best barra on the run-out." },
      { id: "fannie-bay",    name: "Fannie Bay Ramp",        type: "boat_ramp",   emoji: "🚢", tip: "Good launching up to 3hrs either side of high. Trevally off the point." },
      { id: "cullen-bay",    name: "Cullen Bay Marina",      type: "harbour",     emoji: "⚓", tip: "Lock operates ±90 min around high tide. Book lock-through in advance." },
      { id: "nightcliff",    name: "Nightcliff Ramp",        type: "boat_ramp",   emoji: "🚢", tip: "Usable 2hrs either side of high. Spanish mackerel just off the reef edge." },
      { id: "lee-point",     name: "Lee Point Beach",        type: "beach",       emoji: "🏖️", tip: "Wade-fish the drop at low tide for dart and whiting. Baitfish school here." },
      { id: "mandorah",      name: "Mandorah Ramp",          type: "boat_ramp",   emoji: "🚢", tip: "Runs ~10min ahead of Darwin. Great trevally and queenfish on the run-in." },
      { id: "cox-peninsula", name: "Cox Peninsula Ramp",     type: "boat_ramp",   emoji: "🚢", tip: "Sheltered ramp. Target the rock bars inside Cox Peninsula on the run-out." },
      { id: "bynoe-harbour", name: "Bynoe Harbour",          type: "harbour",     emoji: "⚓", tip: "Slightly later than Darwin. Superb barra and mangrove jack in the creeks." },
      { id: "gunn-point",    name: "Gunn Point Beach",       type: "beach",       emoji: "🏖️", tip: "Solid threadfin and barra school here on the run-out during the build-up." },
      { id: "east-arm",      name: "East Arm Wharf Area",    type: "boat_ramp",   emoji: "🚢", tip: "Industrial area but great barra fishing off the mangrove edges at night." },
    ],
  },
  {
    id: "adelaide",
    name: "Adelaide River",
    emoji: "🐊",
    color: "#4fc3f7",
    refNote: "Corrected from Darwin",
    locations: [
      { id: "adelaide-mouth",  name: "Adelaide River Mouth",     type: "river_mouth", emoji: "🌊", tip: "5 min after Darwin. Barra stack at the mouth on the run-out. Salties active." },
      { id: "point-stuart",    name: "Point Stuart Ramp",        type: "boat_ramp",   emoji: "🚢", tip: "~20 min after Darwin. Mud crabs, barra, queenfish on incoming tides." },
      { id: "window-wetlands", name: "Window on the Wetlands",   type: "bay",         emoji: "🌿", tip: "Tidal influence 30 min after Darwin. Mainly bream and catfish in the lagoon." },
      { id: "annaburroo",      name: "Annaburroo Ramp",          type: "boat_ramp",   emoji: "🚢", tip: "40 min after Darwin. Good access point for upper Adelaide River barra." },
    ],
  },
  {
    id: "mary",
    name: "Mary River",
    emoji: "🪨",
    color: "#ffd700",
    refNote: "Corrected from Darwin",
    locations: [
      { id: "mary-mouth",      name: "Mary River Mouth",         type: "river_mouth", emoji: "🌊", tip: "10 min after Darwin. Great threadfin and barra right at the mouth on run-out." },
      { id: "shady-camp",      name: "Shady Camp Rock Bar",      type: "rock_bar",    emoji: "🪨", tip: "NT's most famous barramundi rock bar. Fish the run-out over the rocks at dawn.", star: true },
      { id: "shady-camp-ramp", name: "Shady Camp Boat Ramp",     type: "boat_ramp",   emoji: "🚢", tip: "Launch 2hrs either side of high. Park on the levee — DO NOT drive on the bar." },
      { id: "corroboree",      name: "Corroboree (Mary R.)",     type: "bay",         emoji: "🌿", tip: "40 min after Darwin. Mainly freshwater barra, saratoga and catfish upstream." },
      { id: "marrakai",        name: "Marrakai Ramp",            type: "boat_ramp",   emoji: "🚢", tip: "45 min after Darwin. Good early-morning barra in the paperbark channels." },
    ],
  },
  {
    id: "daly",
    name: "Daly River",
    emoji: "🎣",
    color: "#66bb6a",
    refNote: "Corrected from Darwin",
    locations: [
      { id: "daly-mouth",      name: "Daly River Mouth",         type: "river_mouth", emoji: "🌊", tip: "45 min after Darwin. Mangrove jack and barra stack at the mouth on the run-out." },
      { id: "snake-creek",     name: "Snake Creek Ramp",         type: "boat_ramp",   emoji: "🚢", tip: "65 min after Darwin. Remote ramp — 4WD only. Big barra in the snake holes." },
      { id: "woolianna",       name: "Woolianna Ramp",           type: "boat_ramp",   emoji: "🚢", tip: "1.5hrs after Darwin. The classic Daly River barra ramp — flood plains epic in the wet." },
      { id: "daly-river-town", name: "Daly River Town Ramp",     type: "boat_ramp",   emoji: "🚢", tip: "2hrs after Darwin. Small tidal range here — fish structure and deep pools." },
      { id: "port-keats",      name: "Wadeye (Port Keats)",      type: "boat_ramp",   emoji: "🚢", tip: "Nearly 3hrs after Darwin. Remote. Pristine barra, queenfish and trevally." },
    ],
  },
  {
    id: "kakadu",
    name: "Kakadu & Alligator Rivers",
    emoji: "🦆",
    color: "#ff7043",
    refNote: "Corrected from Darwin",
    locations: [
      { id: "south-alligator", name: "South Alligator Mouth",   type: "river_mouth", emoji: "🌊", tip: "10 min after Darwin. Huge barra school at the mouth — cast along the snag lines." },
      { id: "field-island",    name: "Field Island",             type: "beach",       emoji: "🏖️", tip: "5 min after Darwin. Remote sand bar. Excellent queenfish and mackerel at high." },
      { id: "cahills-crossing", name: "Cahills Crossing Rock Bar", type: "rock_bar", emoji: "🪨", tip: "NT's most famous croc-and-barra crossing. Fish the run-out from the bank — DO NOT wade.", star: true },
      { id: "east-alligator",  name: "East Alligator Mouth",    type: "river_mouth", emoji: "🌊", tip: "25 min after Darwin. Remote but excellent. Massive barra and jack in the channels." },
      { id: "west-alligator",  name: "West Alligator Mouth",    type: "river_mouth", emoji: "🌊", tip: "5 min after Darwin. Threadfin and barra on run-in. Boat access only." },
    ],
  },
  {
    id: "essington",
    name: "Port Essington / Cobourg",
    emoji: "⛵",
    color: "#ab47bc",
    refNote: "Corrected from Darwin",
    locations: [
      { id: "port-essington", name: "Port Essington",           type: "harbour",     emoji: "⚓", tip: "30 min after Darwin. Remote and pristine. Barra, jack, fingermark in the harbour." },
      { id: "cobourg",        name: "Cobourg Peninsula",        type: "beach",       emoji: "🏖️", tip: "25 min after Darwin. Permit required. Spectacular GT, mackerel and reef fish." },
      { id: "smith-point",    name: "Smith Point (Cobourg)",    type: "boat_ramp",   emoji: "🚢", tip: "20 min after Darwin. Basic ramp. The best Spanish mackerel in the NT." },
    ],
  },
  {
    id: "victoria",
    name: "Victoria River & West",
    emoji: "🌄",
    color: "#ff8f00",
    refNote: "Corrected from Darwin",
    locations: [
      { id: "victoria-mouth",  name: "Victoria River Mouth",    type: "river_mouth", emoji: "🌊", tip: "2hr 40min after Darwin. Massive tidal run — queenfish and barra on the run-out." },
      { id: "big-horse-creek", name: "Big Horse Creek Ramp",    type: "boat_ramp",   emoji: "🚢", tip: "~3hrs after Darwin. Legendary barra fishing in the Victoria system." },
      { id: "baines-river",    name: "Baines River Mouth",      type: "river_mouth", emoji: "🌊", tip: "~2hr 35min after Darwin. Pristine remote river. 4WD access only." },
    ],
  },
  {
    id: "arnhem",
    name: "Arnhem Land",
    emoji: "🏹",
    color: "#e53935",
    refNote: "Corrected from Gove BOM",
    locations: [
      { id: "nhulunbuy-ramp",  name: "Nhulunbuy (Gove) Ramp",  type: "boat_ramp",   emoji: "🚢", tip: "BOM reference port for east Arnhem. Excellent GT, mackerel and coral species." },
      { id: "melville-bay",    name: "Melville Bay (Gove)",     type: "bay",         emoji: "🌊", tip: "Same as Gove. Sheltered bay — jewfish and barra on the flats at dawn." },
      { id: "caledon-bay",     name: "Caledon Bay",             type: "bay",         emoji: "🌊", tip: "+30 min from Gove. Remote permit required. Outstanding GT and reef fishing." },
      { id: "trial-bay",       name: "Trial Bay",               type: "bay",         emoji: "🌊", tip: "+20 min from Gove. Barra and mangrove jack in the mangrove creek systems." },
      { id: "buckingham-bay",  name: "Buckingham Bay",          type: "bay",         emoji: "🌊", tip: "+45 min from Gove. Remote. Great for mackerel and pelagics off the point." },
      { id: "elcho-island",    name: "Elcho Island (Galiwinku)", type: "boat_ramp",  emoji: "🚢", tip: "-30 min from Gove. Community area — check access. Mixed reef and barra." },
      { id: "milingimbi",      name: "Milingimbi",              type: "boat_ramp",   emoji: "🚢", tip: "-45 min from Gove. NT tidal flats. Excellent mud crabs and estuary species." },
      { id: "maningrida",      name: "Maningrida (Liverpool R.)", type: "boat_ramp", emoji: "🚢", tip: "20 min BEFORE Darwin. Gulf-facing. Big tidal barra and threadfin in the river." },
    ],
  },
  {
    id: "groote",
    name: "Groote Eylandt",
    emoji: "🏝️",
    color: "#7986cb",
    refNote: "Groote Eylandt BOM reference",
    locations: [
      { id: "alyangula",      name: "Alyangula Ramp",           type: "boat_ramp",   emoji: "🚢", tip: "BOM reference for Groote. Gulf-style diurnal tides. Barra and coral species." },
      { id: "emerald-river",  name: "Emerald River Mouth",      type: "river_mouth", emoji: "🌊", tip: "+20 min from Groote. Excellent barra in the river system during run-out." },
      { id: "umbakumba",      name: "Umbakumba Ramp",           type: "boat_ramp",   emoji: "🚢", tip: "+45 min from Groote. South-coast ramp. GT, mackerel and sweetlip on the reef." },
      { id: "bartalumba-bay", name: "Bartalumba Bay",           type: "bay",         emoji: "🌊", tip: "+15 min from Groote. Sheltered fishing — good for families. Reef and barra." },
      { id: "winchelsea",     name: "Winchelsea Island",        type: "bay",         emoji: "🌊", tip: "+30 min from Groote. Excellent GT, coral trout and coral species." },
    ],
  },
  {
    id: "gulf",
    name: "Gulf Coast",
    emoji: "🌊",
    color: "#26c6da",
    refNote: "Corrected from Groote BOM",
    locations: [
      { id: "king-ash-bay",   name: "King Ash Bay Ramp",        type: "boat_ramp",   emoji: "🚢", tip: "+2hrs from Groote. Borroloola's iconic ramp. Threadfin, barra and barramundi in the Gulf.", star: true },
      { id: "mcarthur-mouth", name: "McArthur River Mouth",     type: "river_mouth", emoji: "🌊", tip: "+1hr from Groote. Big barra school at the mouth on the Gulf run-out tide." },
      { id: "roper-mouth",    name: "Roper River Mouth",        type: "river_mouth", emoji: "🌊", tip: "+2hrs from Groote. Big estuary — threadfin, barra and queenfish at the mouth." },
      { id: "roper-bar",      name: "Roper Bar Rock Bar",       type: "rock_bar",    emoji: "🪨", tip: "+4hrs from Groote. ICONIC NT rock bar — barra stack below the crossing at run-out.", star: true },
      { id: "nathan-river",   name: "Nathan River Mouth",       type: "river_mouth", emoji: "🌊", tip: "+1.5hrs from Groote. Remote Gulf creek. Pristine barra and estuary species." },
      { id: "robinson-river", name: "Robinson River Mouth",     type: "river_mouth", emoji: "🌊", tip: "+1hr 40min from Groote. Very remote. Excellent run-out barra and queenfish." },
    ],
  },
];

export const TYPE_LABELS: Record<LocationType, string> = {
  boat_ramp:   "Boat Ramp",
  river_mouth: "River Mouth",
  rock_bar:    "Rock Bar",
  harbour:     "Harbour",
  beach:       "Beach",
  bay:         "Bay",
};

export const TYPE_COLORS: Record<LocationType, string> = {
  boat_ramp:   "#00a8ff",
  river_mouth: "#00d4aa",
  rock_bar:    "#ffd700",
  harbour:     "#ab47bc",
  beach:       "#ff8f00",
  bay:         "#4fc3f7",
};
