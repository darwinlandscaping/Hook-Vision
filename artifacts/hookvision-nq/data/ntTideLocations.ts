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

export const NT_TIDE_REGIONS: TideRegion[] = [
  {
    id: "gulf",
    name: "Gulf of Carpentaria",
    emoji: "🌊",
    color: "#00d4aa",
    refNote: "Karumba BOM reference (QLD_TP001)",
    locations: [
      {
        id: "karumba-point",
        name: "Karumba Point Ramp",
        type: "boat_ramp",
        emoji: "🚢",
        star: true,
        tip: "Karumba Point is the Gulf's best-known ramp — launches at all tides. Best barra and queenfish on the run-out.",
        hotspots: [
          "Norman River mouth run-out channel",
          "Karumba Point beach for queenfish May–Sep",
          "Mangrove edge north of ramp on run-in",
        ],
        species: ["Barramundi", "Queenfish", "Giant Trevally", "Mud Crab"],
        lure: "Surface walkers 100mm, rattling hard-bodies 90mm",
        bestTide: "Run-out",
        access: "Sealed road from Normanton. Free public ramp. Very popular — arrive early on weekends.",
      },
      {
        id: "normanton",
        name: "Normanton Wharf Deep Hole",
        type: "harbour",
        emoji: "⚓",
        tip: "The deepest hole on the Norman River. Black jewfish stack here at night on full moon run-outs.",
        hotspots: [
          "Normanton wharf pile shadow at night",
          "Deep-hole channel bend 200m upstream",
          "Mangrove run-out gutter on south bank",
        ],
        species: ["Black Jewfish", "Barramundi", "Mangrove Jack", "Mud Crab"],
        lure: "Heavy vibe 80g, live mullet on jighead",
        bestTide: "Run-out (especially night)",
        access: "Sealed road Normanton. Town ramp. Fuel available in Normanton.",
      },
      {
        id: "flinders-mouth",
        name: "Flinders River Mouth",
        type: "river_mouth",
        emoji: "🌊",
        tip: "Runs ~30 min behind Karumba. Queenfish and threadfin school on the beach on the run-in.",
        hotspots: [
          "Flinders River mouth bar on run-out",
          "Beach flat east of river mouth for queenfish",
          "Snag country 2 km upstream for barra",
        ],
        species: ["Barramundi", "Queenfish", "Threadfin Salmon", "Mud Crab"],
        lure: "Metal slices 40g, surface walkers 90mm",
        bestTide: "Run-in for beach, run-out for river",
        access: "Boat-only access from Karumba. 4WD camping possible at Karumba Pt. No road access to river mouth.",
      },
      {
        id: "gilbert-mouth",
        name: "Gilbert River Mouth",
        type: "river_mouth",
        emoji: "🌿",
        tip: "Remote Gulf river mouth — minimal fishing pressure, big barra. Access by boat or helicopter.",
        hotspots: [
          "Gilbert River mouth outer bar",
          "First bend upstream snag country",
          "Tidal flat east of mouth on run-in",
        ],
        species: ["Barramundi", "Queenfish", "Mangrove Jack", "Mud Crab"],
        lure: "Surface popper 100mm, suspending minnow 90mm",
        bestTide: "Run-out",
        access: "Boat from Karumba (75 km). Remote — self-sufficiency essential. No facilities.",
      },
      {
        id: "albert-river",
        name: "Burketown / Albert River",
        type: "boat_ramp",
        emoji: "🪨",
        star: true,
        tip: "The Albert River produces monster barra year-round — trophy fish to 1.1 m are caught every dry season.",
        hotspots: [
          "Albert River snag banks 5–15 km upstream",
          "Gregory River junction deep hole",
          "Burketown ramp channel on run-out",
        ],
        species: ["Barramundi", "Black Jewfish", "Golden Snapper", "Mud Crab"],
        lure: "Walk-the-dog surface lures 100–120mm, hard-body minnow 90mm",
        bestTide: "Run-out — 2 hrs after high",
        access: "Sealed road from Mt Isa (340 km) or Normanton. Burketown has fuel, accommodation, and a public ramp.",
      },
    ],
  },
  {
    id: "cape-york",
    name: "Cape York / Western",
    emoji: "🏝️",
    color: "#00a8ff",
    refNote: "Weipa BOM reference (QLD_TP002)",
    locations: [
      {
        id: "weipa-causeway",
        name: "Weipa Causeway",
        type: "rock_bar",
        emoji: "🎯",
        star: true,
        tip: "World-class GT fishing. Work GT poppers off the causeway rocks on dawn run-in tides May–August.",
        hotspots: [
          "Causeway rock bar run-in tidal surge",
          "Embley River channel edge 300m south",
          "Evans Landing bommies offshore",
        ],
        species: ["Giant Trevally", "Barramundi", "Golden Snapper", "Spanish Mackerel"],
        lure: "GT poppers 160mm, stickbaits 180mm, hard-body 90mm",
        bestTide: "Run-in — morning tide sessions",
        access: "Sealed road in Weipa township. No ramp needed for causeway casting. Ramp at Evans Landing for boat access.",
      },
      {
        id: "evans-landing",
        name: "Evans Landing Ramp (Weipa)",
        type: "boat_ramp",
        emoji: "🚢",
        tip: "Main Weipa ramp — launches at all tides. Access to Ducie River, Embley River, and offshore GT bomies.",
        hotspots: [
          "Ducie River mouth for barra and fingermark",
          "Embley River snag country 10–20 km upstream",
          "Offshore reef bombies for GT and Spanish mackerel",
        ],
        species: ["Giant Trevally", "Golden Snapper", "Barramundi", "Coral Trout"],
        lure: "Heavy poppers, jig heads 20–40g, hard-body minnow 100mm",
        bestTide: "Run-out for river barra; run-in for GT at bombies",
        access: "Sealed road. Evans Landing Ramp — concrete ramp. Weipa has full facilities including fuel, accommodation.",
      },
      {
        id: "pormpuraaw",
        name: "Pormpuraaw / Edward River",
        type: "river_mouth",
        emoji: "🌄",
        tip: "Extremely remote Gulf river — almost no fishing pressure. Barra and barramundi over 90 cm are common.",
        hotspots: [
          "Edward River mouth tidal bar",
          "First deep bend 3 km upstream",
          "Beach flat adjacent to river mouth for queenfish",
        ],
        species: ["Barramundi", "Queenfish", "Mud Crab", "Golden Snapper"],
        lure: "Surface walker 100mm, suspending minnow 90mm",
        bestTide: "Run-out",
        access: "Charter flight from Cairns or drive via Peninsula Developmental Road (4WD required May–Oct only). Pormpuraaw community — check access requirements.",
      },
    ],
  },
  {
    id: "fnq",
    name: "Far North Queensland",
    emoji: "🪸",
    color: "#ffd700",
    refNote: "Cairns BOM reference (QLD_TP003)",
    locations: [
      {
        id: "marlin-marina",
        name: "Cairns Marlin Marina",
        type: "harbour",
        emoji: "⚓",
        tip: "Gateway to the GBR. Marina runs ±2hrs around high tide. Black marlin season September–December.",
        hotspots: [
          "Trinity Bay reef edge for Spanish mackerel",
          "Barron River delta for barra on autumn run-outs",
          "Hastings Reef and Saxon Reef for coral trout",
        ],
        species: ["Spanish Mackerel", "Barramundi", "Coral Trout", "Giant Trevally"],
        lure: "Trolling lures 160mm, metal slices 60g, hard-body 90mm",
        bestTide: "Run-out for estuarine barra; all tides offshore",
        access: "Cairns CBD. Marina fuel and facilities. Multiple public ramps in Trinity Bay area.",
      },
      {
        id: "port-douglas",
        name: "Port Douglas Marina",
        type: "harbour",
        emoji: "⚓",
        tip: "Excellent reef access. Low Isles and Opal Reef for coral trout within 15 km. Barra in the Daintree River.",
        hotspots: [
          "Opal Reef coral trout and GT",
          "Daintree River barra on run-out tides",
          "Four Mile Beach tailor and longtail tuna",
        ],
        species: ["Coral Trout", "Giant Trevally", "Barramundi", "Spanish Mackerel"],
        lure: "Slow-pitch jigs 80–120g, poppers 120mm, surface walker 90mm",
        bestTide: "Run-out for Daintree River barra; anytime on reef",
        access: "Port Douglas marina. Ramp usable all tides — concrete. 65 km north of Cairns on Captain Cook Hwy.",
      },
      {
        id: "cooktown-marina",
        name: "Cooktown / Endeavour River",
        type: "boat_ramp",
        emoji: "🚢",
        star: true,
        tip: "Barra in the Endeavour River, world-class coral trout offshore at Lizard Island. Spanish mackerel September–November.",
        hotspots: [
          "Endeavour River mouth for barra March–July",
          "Lizard Island reef system for coral trout and GT",
          "Cooktown reef for Spanish mackerel on troll",
        ],
        species: ["Barramundi", "Coral Trout", "Spanish Mackerel", "Golden Snapper"],
        lure: "Skirted trolling lures, hard-body 90mm, slow-pitch jig 100g",
        bestTide: "Run-out for river barra; all tides offshore",
        access: "Cooktown. Concrete ramp at Webber Esplanade. Cooktown has fuel, accommodation. 300 km north of Cairns.",
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

export function getNTWaterTemp(regionId: string): string {
  const m = new Date().getMonth() + 1;
  const isGulf = regionId === "gulf" || regionId === "cape-york";
  const isWet = m >= 1 && m <= 4;
  const isBuildUp = m === 10 || m === 11;
  if (isWet)     return isGulf ? "29–33°C" : "28–31°C";
  if (isBuildUp) return isGulf ? "28–31°C" : "27–30°C";
  return isGulf ? "22–26°C" : "24–27°C";
}

export function getNQWaterTemp(regionId: string): string {
  return getNTWaterTemp(regionId);
}

export function getNTSeason(): { name: string; emoji: string; fishing: string } {
  const m = new Date().getMonth() + 1;
  if (m >= 5 && m <= 9)
    return { name: "Gulf Dry Season",  emoji: "☀️", fishing: "Prime season — barra, GT and queenfish at peak" };
  if (m === 10 || m === 11)
    return { name: "Build-Up (QLD)",   emoji: "⛅", fishing: "Barra firing hard in Gulf rivers on October rains" };
  return   { name: "Gulf Wet Season",  emoji: "🌧️", fishing: "Big barra in flooded plains — access challenging" };
}

export function getNQSeason(): { name: string; emoji: string; fishing: string } {
  return getNTSeason();
}
