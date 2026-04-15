export type LocationType = "boat_ramp" | "river_mouth" | "rock_bar" | "harbour" | "beach" | "bay";

export interface TideLocation {
  id: string;
  name: string;
  type: LocationType;
  emoji: string;
  tip: string;
  star?: boolean;
  hotspots: string[];
  species: string[];
  lure: string;
  bestTide: string;
  access: string;
}

export interface TideRegion {
  id: string;
  name: string;
  emoji: string;
  color: string;
  refNote: string;
  locations: TideLocation[];
}

export const WA_TIDE_REGIONS: TideRegion[] = [
  {
    id: "broome",
    name: "Broome Area",
    emoji: "🌅",
    color: "#00d4aa",
    refNote: "Broome BOM reference",
    locations: [
      {
        id: "broome-town-beach", name: "Broome Town Beach Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Main Broome launch. Massive tidal range (up to 10m) — plan your tide window carefully.",
        hotspots: ["Town Beach channel run-out", "Mangrove edge south of ramp", "Roebuck Bay baitfish edge"],
        species: ["Barramundi", "Giant Trevally", "Queenfish", "Mangrove Jack"],
        lure: "Hard-body minnows 70–100mm, surface walkers at dawn",
        bestTide: "Run-out", access: "Sealed road. Public ramp. Usable 2–3hrs either side of high tide due to massive tidal range.",
      },
      {
        id: "roebuck-bay", name: "Roebuck Bay", type: "bay", emoji: "🌊",
        tip: "Vast tidal bay — GT and queenfish over the flats. Mud crabs on the edges.",
        hotspots: ["Bay tidal flat baitfish edge", "Snag point on run-out", "Shorebird beach gutter at low"],
        species: ["Giant Trevally", "Queenfish", "Mud Crab", "Threadfin Salmon", "Bream"],
        lure: "Metal slices 40–60g, surface poppers",
        bestTide: "Run-in", access: "Accessible by boat or 4WD to beach areas. CROC risk on mangrove edges.",
      },
      {
        id: "cable-beach-ramp", name: "Cable Beach Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Indian Ocean side of Broome. Good mackerel and trevally outside reef.",
        hotspots: ["Reef edge 400m offshore", "Beach gutter at low tide", "Point headland wash"],
        species: ["Spanish Mackerel", "Giant Trevally", "Coral Trout", "Queenfish"],
        lure: "Skirted trolling lures, metal slices 60g, poppers",
        bestTide: "Run-in", access: "Sealed road. Ramp usable up to 3hrs either side of high.",
      },
      {
        id: "dampier-creek", name: "Dampier Creek Mangroves", type: "river_mouth", emoji: "🌊",
        tip: "Tidal creek system within Broome town — barra and jack in the mangroves.",
        hotspots: ["Creek mouth run-out", "Mangrove edge on run-in", "Snag lines mid-creek"],
        species: ["Barramundi", "Mangrove Jack", "Mud Crab"],
        lure: "Surface walkers 80mm, soft plastics 4\"",
        bestTide: "Run-out", access: "Walk-in from Broome. CROC risk — stay out of the water.",
      },
      {
        id: "gantheaume-point", name: "Gantheaume Point", type: "beach", emoji: "🏖️",
        tip: "Good rock fishing for GT and mackerel on the run-in. Stunning red pindan cliffs.",
        hotspots: ["Point headland rock ledge", "Reef edge offshore", "Gutter at base of cliffs"],
        species: ["Giant Trevally", "Spanish Mackerel", "Dart", "Longtail Tuna"],
        lure: "Metal slices 40–60g, poppers 80mm",
        bestTide: "Run-in", access: "Sealed road. Rock platform fishing — use caution with large swells.",
      },
    ],
  },
  {
    id: "derby",
    name: "Derby & King Sound",
    emoji: "🐊",
    color: "#4fc3f7",
    refNote: "Derby BOM reference",
    locations: [
      {
        id: "derby-jetty", name: "Derby Jetty Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "World's highest tidal range (up to 12m). Launch 2hrs either side of high only.",
        hotspots: ["Jetty pylons at night", "King Sound channel run-out", "Mangrove edge south of jetty"],
        species: ["Barramundi", "Giant Trevally", "Queenfish", "Mangrove Jack"],
        lure: "Hard-body minnows 80–100mm, surface walkers at dusk",
        bestTide: "Run-out", access: "Sealed road. Ramp usable only 2hrs either side of high due to extreme tidal range.",
      },
      {
        id: "king-sound-mouth", name: "King Sound Mouth", type: "bay", emoji: "🌊",
        tip: "Massive tidal run. Barra, queenfish and trevally stack on the tidal flats.",
        hotspots: ["Sound mouth tidal flat edge", "King Sound channel run-out", "Rocky headland wash"],
        species: ["Barramundi", "Queenfish", "Giant Trevally", "Threadfin Salmon"],
        lure: "Surface walkers 100mm, metal slices 50g",
        bestTide: "Run-out", access: "Boat access from Derby. CROC country — stay in the boat.",
      },
      {
        id: "fitzroy-mouth", name: "Fitzroy River Mouth", type: "river_mouth", emoji: "🌊", star: true,
        tip: "Major Kimberley river system. Barra and threadfin stack at the mouth on run-out.",
        hotspots: ["River mouth sandbar channel", "Channel edge west bank", "Tidal flat on run-in"],
        species: ["Barramundi", "Threadfin Salmon", "Mangrove Jack", "Giant Trevally"],
        lure: "Surface walkers 80–120mm, rattling hard-bodies",
        bestTide: "Run-out", access: "Boat access from Derby. CROC country — active saltwater croc habitat.",
      },
      {
        id: "fitzroy-crossing-ramp", name: "Fitzroy Crossing Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "~2.5hrs after Derby. Iconic WA barra river inland. Fish the run-out pools.",
        hotspots: ["River pool below crossing", "Snag lines mid-river", "Paperbark edge channels"],
        species: ["Barramundi", "Mangrove Jack", "Catfish", "Sleepy Cod"],
        lure: "Hard-body minnows 80mm, surface walkers, spinnerbaits",
        bestTide: "Run-out", access: "Sealed road via Great Northern Hwy. CROC country — do not wade.",
      },
      {
        id: "willare-ramp", name: "Willare Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Sealed road. Good early-morning barra in the lower Fitzroy system.",
        hotspots: ["Fitzroy lower channel", "Snag lines on run-out", "Creek mouth junction"],
        species: ["Barramundi", "Mangrove Jack", "Threadfin Salmon"],
        lure: "Deep-diving hard-bodies, soft plastics 4\" paddle tail",
        bestTide: "Run-out", access: "Great Northern Hwy turnoff — sealed access to ramp.",
      },
    ],
  },
  {
    id: "ord",
    name: "Ord River & Kununurra",
    emoji: "🪨",
    color: "#ffd700",
    refNote: "Corrected from Wyndham BOM",
    locations: [
      {
        id: "ord-mouth", name: "Ord River Mouth (Cambridge Gulf)", type: "river_mouth", emoji: "🌊", star: true,
        tip: "Wyndham area. Massive run-out barra and threadfin at the estuary mouth.",
        hotspots: ["Ord mouth sandbar channel", "Cambridge Gulf tidal flat edge", "Right bank snag line"],
        species: ["Barramundi", "Threadfin Salmon", "Queenfish", "Giant Trevally"],
        lure: "Surface walkers 100–120mm, metal slices 40g",
        bestTide: "Run-out", access: "Boat access from Wyndham ramp. CROC country — active croc habitat.",
      },
      {
        id: "wyndham-ramp", name: "Wyndham Boat Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Gateway to Cambridge Gulf. Excellent barra and queenfish. CROC hotspot.",
        hotspots: ["Gulf channel run-out", "Mangrove edge on run-in", "Rock ledge south of town"],
        species: ["Barramundi", "Queenfish", "Mangrove Jack", "Giant Trevally"],
        lure: "Metal slices 30–50g, surface walkers 80mm",
        bestTide: "Run-out", access: "Sealed road via Great Northern Hwy. Good public ramp. CROC country.",
      },
      {
        id: "lake-kununurra", name: "Lake Kununurra (Ord Stage 1)", type: "bay", emoji: "🌿",
        tip: "Freshwater impoundment above Diversion Dam. Barramundi and saratoga.",
        hotspots: ["Dam wall edge at dawn", "Submerged timber edges", "Creek arms on run-in"],
        species: ["Barramundi", "Saratoga", "Bream", "Sleepy Cod"],
        lure: "Surface poppers, suspending jerkbaits, soft frogs in lily pads",
        bestTide: "Morning and evening (lake — no tidal influence)", access: "Sealed road Kununurra. CROC risk — do not wade or swim.",
      },
      {
        id: "ord-middle-reaches", name: "Ord River Middle Reaches", type: "rock_bar", emoji: "🪨", star: true,
        tip: "Kimberley's premier barra rock bar system. Fish the run-out over rock bars at dawn.",
        hotspots: ["Rock bar main run-out", "Left bank snag line below dam", "Channel bend pool", "Sandy run upstream of bar"],
        species: ["Barramundi", "Mangrove Jack", "Saratoga", "Sleepy Cod"],
        lure: "Surface walkers 100–120mm, heavy rattling hard-bodies 15–20g",
        bestTide: "Run-out — 1hr before to 2hrs after the turn",
        access: "4WD required for some sections. Dry season access best. CROC country — fish from boat or bank.",
      },
      {
        id: "keep-river", name: "Keep River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "WA remote river. Excellent barra, jack, and threadfin.",
        hotspots: ["River mouth estuary", "Rock ledge run-out", "Tidal flat on run-in"],
        species: ["Barramundi", "Mangrove Jack", "Threadfin Salmon", "Queenfish"],
        lure: "Surface walkers 80mm, rattling hard-bodies",
        bestTide: "Run-out", access: "Remote. 4WD from Kununurra or Keep River NP. Boat recommended.",
      },
    ],
  },
  {
    id: "drysdale",
    name: "Drysdale & North Kimberley",
    emoji: "🎣",
    color: "#66bb6a",
    refNote: "Corrected from Wyndham BOM",
    locations: [
      {
        id: "drysdale-mouth", name: "Drysdale River Mouth", type: "river_mouth", emoji: "🌊", star: true,
        tip: "Remote wilderness river mouth. Pristine barra, jack and GT. Fly-in or boat only.",
        hotspots: ["River mouth sandbar channel", "Right bank mangrove edge", "Snag lines inside mouth"],
        species: ["Barramundi", "Threadfin Salmon", "Mangrove Jack", "Giant Trevally"],
        lure: "Surface walkers 80–120mm, large hard-body minnows",
        bestTide: "Run-out", access: "Fly-in to Drysdale River Station or long coastal boat trip. Very remote.",
      },
      {
        id: "mitchell-river", name: "Mitchell River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "World-class remote barra. Home to Mitchell Falls upstream. CROC country.",
        hotspots: ["River mouth estuary edge", "Channel bends upstream", "Rock bar on run-out"],
        species: ["Barramundi", "Mangrove Jack", "Giant Trevally", "Threadfin Salmon"],
        lure: "Surface walkers 100mm, hard-body minnows 80mm",
        bestTide: "Run-out", access: "Fly-in or long boat trip. Mitchell Falls 4WD track stops far from mouth. Remote.",
      },
      {
        id: "prince-regent", name: "Prince Regent River", type: "harbour", emoji: "⚓",
        tip: "Marine park. Spectacular cliffs, outstanding barra and jack in the estuary.",
        hotspots: ["Estuary channel run-out", "Rock cliff edge pools", "Mangrove creek mouths"],
        species: ["Barramundi", "Fingermark", "Mangrove Jack", "Coral Trout", "Giant Trevally"],
        lure: "Large hard-body swimbaits 100mm, jigs 20–30g",
        bestTide: "Run-out", access: "Charter boat or liveaboard cruise only. Prince Regent NR permit required.",
      },
      {
        id: "berkeley-sound", name: "Berkeley Sound (Vansittart Bay)", type: "beach", emoji: "🏖️",
        tip: "Remote bay. Excellent GT, mackerel and reef fish around the offshore bommies.",
        hotspots: ["Bay reef edge 1km out", "Sandy beaches on run-in", "Rock headland wash zone"],
        species: ["Giant Trevally", "Spanish Mackerel", "Coral Trout", "Longtail Tuna"],
        lure: "Poppers, metal slices, trolling lures skirted",
        bestTide: "Run-in", access: "Liveaboard cruise or well-equipped expedition boat. Very remote. No facilities.",
      },
      {
        id: "king-george-falls", name: "King George Falls Area", type: "river_mouth", emoji: "🌊",
        tip: "Australia's highest twin waterfalls — exceptional barra in the basin pool below.",
        hotspots: ["Basin pool below falls", "River estuary run-out", "Rock ledge edges"],
        species: ["Barramundi", "Mangrove Jack", "Saratoga", "Archer Fish"],
        lure: "Surface poppers, suspending jerkbaits, surface walkers 100mm",
        bestTide: "Run-out — best at tide change", access: "Liveaboard cruise only. One of the most remote spots in Australia.",
      },
    ],
  },
  {
    id: "port-hedland",
    name: "Port Hedland & Pilbara Coast",
    emoji: "⛵",
    color: "#ab47bc",
    refNote: "Port Hedland BOM reference",
    locations: [
      {
        id: "port-hedland-ramp", name: "Port Hedland Boat Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Pilbara's main launch. Good mackerel, queenfish and GT offshore.",
        hotspots: ["Harbour channel run-out", "Rocky point east of ramp", "Offshore reef edge 5km"],
        species: ["Spanish Mackerel", "Giant Trevally", "Queenfish", "Coral Trout"],
        lure: "Skirted trolling lures, poppers 70mm, metal slices",
        bestTide: "Run-in", access: "Sealed road. Good public ramp. Subject to port shipping traffic.",
      },
      {
        id: "de-grey-mouth", name: "De Grey River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "Pilbara's main barra river. Excellent run-out fishing on a spring tide.",
        hotspots: ["River mouth sandbar", "Channel east bank run-out", "Tidal flat baitfish edge"],
        species: ["Barramundi", "Threadfin Salmon", "Mangrove Jack", "Queenfish"],
        lure: "Surface walkers 80–100mm, rattling hard-bodies",
        bestTide: "Run-out", access: "4WD track north of Port Hedland. Remote. CROC country.",
      },
      {
        id: "pardoo-station", name: "Pardoo Roadhouse Area", type: "beach", emoji: "🏖️",
        tip: "Beach and estuary fishing. Threadfin and barra at creek mouths on run-out.",
        hotspots: ["Creek mouth on run-out", "Beach gutter at low tide", "Estuary mangrove edge"],
        species: ["Threadfin Salmon", "Barramundi", "Bream", "Mangrove Jack"],
        lure: "Surface walkers 80mm, small poppers, metal slices 30g",
        bestTide: "Run-out", access: "Great Northern Hwy. 4WD track to beach. Check conditions locally.",
      },
      {
        id: "montebello-islands", name: "Montebello Islands", type: "bay", emoji: "🌊", star: true,
        tip: "WA's premier offshore reef fishery. Coral trout, red emperor, and pelagics.",
        hotspots: ["Reef bommies offshore", "Island channel run-out", "Baitfish school under birds"],
        species: ["Coral Trout", "Red Emperor", "Spanish Mackerel", "Giant Trevally", "Longtail Tuna"],
        lure: "Slow jigs 80–150g, poppers 100mm, skirted trolling lures",
        bestTide: "Run-out", access: "Charter or liveaboard from Onslow. Marine park — permit required for overnight.",
      },
    ],
  },
  {
    id: "exmouth",
    name: "Exmouth & Ningaloo",
    emoji: "🌄",
    color: "#ff8f00",
    refNote: "Exmouth BOM reference",
    locations: [
      {
        id: "exmouth-ramp", name: "Exmouth Boat Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Gateway to Ningaloo Reef. Excellent reef fishing and pelagics year-round.",
        hotspots: ["Reef edge 2km offshore", "Exmouth Gulf tidal flat", "Lighthouse Bay run-in"],
        species: ["Coral Trout", "Spanish Mackerel", "Giant Trevally", "Red Emperor"],
        lure: "Slow jigs, poppers 80mm, skirted trolling lures",
        bestTide: "Run-out", access: "Sealed road. Excellent public ramp. Ningaloo NP permit for some areas.",
      },
      {
        id: "exmouth-gulf", name: "Exmouth Gulf Flats", type: "bay", emoji: "🌊",
        tip: "Protected gulf side — great queenfish and threadfin on the tidal flats.",
        hotspots: ["Gulf tidal flat baitfish edge", "Prawn channel run-out", "Creek mouths at dawn"],
        species: ["Queenfish", "Threadfin Salmon", "Mangrove Jack", "Bream", "Trevally"],
        lure: "Surface walkers 80mm, metal slices 30–40g",
        bestTide: "Run-out", access: "Boat access from Exmouth ramp. Shallow tidal flats — check depth.",
      },
      {
        id: "ningaloo-reef", name: "Ningaloo Reef (Outside)", type: "beach", emoji: "🏖️", star: true,
        tip: "World Heritage Reef. Outstanding coral trout, Spanish mackerel and pelagics.",
        hotspots: ["Reef edge bommies offshore", "Channel passes at tide change", "Baitfish school on current"],
        species: ["Coral Trout", "Spanish Mackerel", "GT", "Red Bass", "Sailfish"],
        lure: "Poppers 80–100mm, skirted trolling lures, slow jigs",
        bestTide: "Run-out (reef passes at tide change)",
        access: "Boat from Exmouth or Coral Bay. Ningaloo NP permits required for some zones.",
      },
      {
        id: "coral-bay", name: "Coral Bay Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Southern gateway to Ningaloo. Excellent reef fish and seasonal pelagics.",
        hotspots: ["Reef edge drop-off", "Channel pass run-out", "Bay baitball zone"],
        species: ["Coral Trout", "Spanish Mackerel", "Sailfish", "Longtail Tuna"],
        lure: "Skirted trolling lures, poppers, slow jigs 80g",
        bestTide: "Run-in", access: "Sealed road from Carnarvon. Basic ramp. Ningaloo NP permit required.",
      },
      {
        id: "turquoise-bay", name: "Turquoise Bay Area", type: "beach", emoji: "🏖️",
        tip: "Inside Ningaloo NP. No motorised boats. Shore fishing for trevally and reef species.",
        hotspots: ["Bay gutter at low tide", "Reef edge snorkelling zone", "Beach channel run-out"],
        species: ["Giant Trevally", "Dart", "Bream", "Trevally"],
        lure: "Metal slices 20g, soft vibes 1/6oz",
        bestTide: "Low water — wade the flats", access: "Sealed road. Walk-in only. No boat launch. Ningaloo NP entry permit applies.",
      },
    ],
  },
  {
    id: "dampier",
    name: "Dampier Archipelago & Karratha",
    emoji: "🏹",
    color: "#e53935",
    refNote: "Dampier BOM reference",
    locations: [
      {
        id: "dampier-ramp", name: "Dampier Boat Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Gateway to the Archipelago. 40+ islands for reef and pelagic fishing.",
        hotspots: ["Archipelago channel run-out", "Reef bommies offshore", "Island beach gut run-in"],
        species: ["Coral Trout", "Giant Trevally", "Spanish Mackerel", "Red Emperor", "Queenfish"],
        lure: "Poppers 80mm, metal slices 40g, soft-pitch jigs",
        bestTide: "Run-out", access: "Sealed road. Public ramp. Karratha / Dampier industrial access — follow signs.",
      },
      {
        id: "burrup-peninsula", name: "Burrup Peninsula", type: "bay", emoji: "🌊",
        tip: "Rocky peninsula with excellent trevally and queenfish on the run-in.",
        hotspots: ["Bay rock edge on run-in", "Peninsula channel run-out", "Shallow flat baitfish edge"],
        species: ["Giant Trevally", "Queenfish", "Bream", "Trevally"],
        lure: "Metal slices, soft plastic jigs 4\"",
        bestTide: "Run-in", access: "Sealed road. 4WD tracks to some points. Industrial area — follow posted rules.",
      },
      {
        id: "legendre-island", name: "Legendre Island", type: "beach", emoji: "🏖️",
        tip: "Remote Archipelago island. Best coral trout and GT in the Dampier group.",
        hotspots: ["North tip reef edge", "Island bay channel run-out", "Baitfish school on run-in"],
        species: ["Coral Trout", "Giant Trevally", "Spanish Mackerel", "Longtail Tuna"],
        lure: "Poppers 80–100mm, skirted trolling lures, slow jigs",
        bestTide: "Run-out", access: "30 min boat from Dampier ramp. Open anchorage — weather dependent.",
      },
      {
        id: "mermaid-sound", name: "Mermaid Sound", type: "bay", emoji: "🌊",
        tip: "+10 min from Dampier. Sheltered bay. Excellent jewfish and barra on flats.",
        hotspots: ["Sound tidal flat edge at dawn", "Creek mouths on run-out", "Bommie offshore"],
        species: ["Black Jewfish", "Barramundi", "Queenfish", "Mangrove Jack"],
        lure: "Metal slices, soft plastic jigs 4\"",
        bestTide: "Run-in", access: "Boat from Dampier. Protected bay — safe in most conditions.",
      },
      {
        id: "roebourne-ramp", name: "Roebourne / Point Samson Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "North Pilbara ramp. Great access to mackerel grounds and offshore reef.",
        hotspots: ["Offshore reef 5km", "Point headland run-out", "Bay baitball zone"],
        species: ["Spanish Mackerel", "Giant Trevally", "Coral Trout", "Longtail Tuna"],
        lure: "High-speed metal slices, trolling lures, poppers 100mm",
        bestTide: "Run-in", access: "Sealed road. Public ramp. 20min drive from Karratha.",
      },
    ],
  },
  {
    id: "gascoyne",
    name: "Gascoyne & Shark Bay",
    emoji: "🦈",
    color: "#00897b",
    refNote: "Carnarvon BOM reference",
    locations: [
      {
        id: "carnarvon-ramp", name: "Carnarvon Boat Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Gateway to Shark Bay and southern Gascoyne. Mixed estuary and offshore fishing.",
        hotspots: ["Gascoyne River mouth on run-out", "Offshore reef 10km", "Bay flats at dawn"],
        species: ["Spanish Mackerel", "Queenfish", "Threadfin Salmon", "Coral Trout"],
        lure: "Skirted trolling lures, metal slices, surface walkers",
        bestTide: "Run-out", access: "Sealed road. Good public ramp. Weather-dependent offshore crossing.",
      },
      {
        id: "gascoyne-mouth", name: "Gascoyne River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "Southernmost barramundi and threadfin habitat. Best on run-out after fresh.",
        hotspots: ["River mouth channel edge", "Estuary sandbar run-out", "Tidal flat baitfish edge"],
        species: ["Threadfin Salmon", "Barramundi (lower range)", "Mangrove Jack", "Bream"],
        lure: "Surface walkers 80mm, small poppers 60mm, soft plastics",
        bestTide: "Run-out", access: "4WD track north of Carnarvon. Check road conditions locally.",
      },
      {
        id: "shark-bay", name: "Monkey Mia / Shark Bay", type: "bay", emoji: "🌊", star: true,
        tip: "World Heritage. Outstanding snapper, trevally and whiting. Strict bag limits apply.",
        hotspots: ["Bay drop-off edge", "Seagrass flat run-in", "Channel bommie"],
        species: ["Pink Snapper", "Bream", "Whiting", "Trevally", "Coral Trout"],
        lure: "Jigs 40–60g, soft vibes, baited paternoster rig",
        bestTide: "Run-out", access: "Sealed road via Denham. World Heritage Area — strict regulations apply.",
      },
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

// ─── WA Water Temperature by season and region ────────────────────────────────
export function getWAWaterTemp(regionId: string): string {
  const m = new Date().getMonth() + 1; // 1-12
  const isGascoyne = regionId === "gascoyne";
  const isExmouth = regionId === "exmouth";
  const isWet = m >= 1 && m <= 4;
  const isBuildUp = m === 10 || m === 11;
  if (isGascoyne) {
    if (isWet) return "22–26°C";
    if (isBuildUp) return "20–24°C";
    return "18–22°C";
  }
  if (isExmouth) {
    if (isWet) return "26–30°C";
    if (isBuildUp) return "24–28°C";
    return "21–25°C";
  }
  if (isWet) return "30–33°C";
  if (isBuildUp) return "28–31°C";
  return "25–28°C";
}

// ─── WA/Kimberley Season label ──────────────────────────────────────────────────
export function getWASeason(): { name: string; emoji: string; fishing: string } {
  const m = new Date().getMonth() + 1;
  if (m >= 5 && m <= 9)  return { name: "Dry Season", emoji: "☀️", fishing: "Prime season — barra and pelagics at peak in Kimberley" };
  if (m === 10 || m === 11) return { name: "Build-Up", emoji: "⛈️", fishing: "Pre-wet — baitfish schools, great topwater across the Kimberley" };
  return { name: "Wet Season", emoji: "🌧️", fishing: "Kimberley monsoon — rivers flush, freshwater barra on the flats" };
}
