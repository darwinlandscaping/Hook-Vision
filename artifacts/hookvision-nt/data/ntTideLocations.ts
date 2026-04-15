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
    id: "darwin",
    name: "Darwin Area",
    emoji: "🌅",
    color: "#00d4aa",
    refNote: "Darwin BOM reference",
    locations: [
      {
        id: "darwin-city", name: "Darwin City Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Stokes Hill ramp — launches at all tides. Best barra on the run-out.",
        hotspots: ["East channel run-out", "Stokes Hill wharf pylons at night", "Mangrove edge south of wharf"],
        species: ["Barramundi", "Giant Trevally", "Queenfish", "Mangrove Jack"],
        lure: "Hard-body minnows 70–100mm, soft plastics at night",
        bestTide: "Run-out", access: "Sealed road. Free public ramp. Can be crowded on weekends.",
      },
      {
        id: "fannie-bay", name: "Fannie Bay Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Good launching up to 3hrs either side of high. Trevally off the point.",
        hotspots: ["Fannie Bay point drop-off", "Reef edge 300m north", "Beach gutters at low tide"],
        species: ["Giant Trevally", "Queenfish", "Spanish Mackerel", "Dart"],
        lure: "Metal slices 40–60g, surface poppers",
        bestTide: "Run-in", access: "Sealed road. Ramp usable 2–3hrs either side of high tide.",
      },
      {
        id: "cullen-bay", name: "Cullen Bay Marina", type: "harbour", emoji: "⚓",
        tip: "Lock operates ±90 min around high tide. Book lock-through in advance.",
        hotspots: ["Marina entrance channel", "Rocky headland outside lock", "Breakwall edge at night"],
        species: ["Giant Trevally", "Queenfish", "Barramundi", "Longtail Tuna"],
        lure: "Surface poppers, metal slices, live bait on jigheads",
        bestTide: "Run-out (outside lock)", access: "Lock-through required (book at marina office). Cost applies. Limited parking.",
      },
      {
        id: "nightcliff", name: "Nightcliff Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Usable 2hrs either side of high. Spanish mackerel just off the reef edge.",
        hotspots: ["Reef edge 400m offshore", "North point rock shelf", "Nightcliff channel at night"],
        species: ["Spanish Mackerel", "Giant Trevally", "Coral Trout", "Queenfish"],
        lure: "Skirted trolling lures, metal slices 60g, poppers",
        bestTide: "Run-in", access: "Sealed road. Ramp only usable 2hrs either side of high. Shallow on low.",
      },
      {
        id: "lee-point", name: "Lee Point Beach", type: "beach", emoji: "🏖️",
        tip: "Wade-fish the drop at low tide for dart and whiting. Baitfish school here.",
        hotspots: ["Sandy flat gutters at low tide", "Rock shelf drop-off", "Baitfish school on run-in"],
        species: ["Whiting", "Dart", "Bream", "Grunter", "Longtail Tuna (offshore)"],
        lure: "Yabbies, nippers, soft vibes 1/6oz, sand worms",
        bestTide: "Low water — wade fish the flats",
        access: "Sealed road. Beach launch for small tinnies only. Wade fishing accessible.",
      },
      {
        id: "mandorah", name: "Mandorah Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Runs ~10min ahead of Darwin. Great trevally and queenfish on the run-in.",
        hotspots: ["Channel run-out east of ramp", "Cox Peninsula rock bar", "Trevally gutter on run-in"],
        species: ["Giant Trevally", "Queenfish", "Barramundi", "Spanish Mackerel"],
        lure: "Metal slices 30–50g, surface walkers 80mm",
        bestTide: "Run-in", access: "Ferry from Darwin CBD or 4WD track via Mandorah Road. Good sealed ramp.",
      },
      {
        id: "cox-peninsula", name: "Cox Peninsula Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Sheltered ramp. Target the rock bars inside Cox Peninsula on the run-out.",
        hotspots: ["Rock bar on run-out east side", "Channel mouth", "Tidal flat edges on run-in"],
        species: ["Barramundi", "Mangrove Jack", "Giant Trevally", "Mud Crab"],
        lure: "Surface walkers 80–100mm, hard-body deep divers",
        bestTide: "Run-out", access: "4WD track from Mandorah — conditions vary. Seasonal creek crossings.",
      },
      {
        id: "bynoe-harbour", name: "Bynoe Harbour", type: "harbour", emoji: "⚓",
        tip: "Slightly later than Darwin. Superb barra and mangrove jack in the creeks.",
        hotspots: ["Creek mouths on run-out", "Bynoe mangrove edge", "Rock bars at harbour entrance"],
        species: ["Barramundi", "Mangrove Jack", "Mud Crab", "Giant Trevally"],
        lure: "Hard-body deep divers, weighted soft plastics 4\" paddle tail",
        bestTide: "Run-out", access: "Sealed road to ramp. Creek fishing by small boat. Campsite nearby.",
      },
      {
        id: "gunn-point", name: "Gunn Point Beach", type: "beach", emoji: "🏖️",
        tip: "Solid threadfin and barra school here on the run-out during the build-up.",
        hotspots: ["Gunn Point rock ledge", "Sandbar edge on run-out", "Baitfish school zone"],
        species: ["Barramundi", "Threadfin Salmon", "Queenfish", "Trevally"],
        lure: "Surface walkers, small poppers, metal slices 30g",
        bestTide: "Run-out", access: "4WD track from Lee Point Road — dry season only. Beach launch for small boats.",
      },
      {
        id: "east-arm", name: "East Arm Wharf Area", type: "boat_ramp", emoji: "🚢",
        tip: "Industrial area but great barra fishing off the mangrove edges at night.",
        hotspots: ["Mangrove edge south of wharf", "Night channel under lights", "Buoy line run-out"],
        species: ["Barramundi", "Mangrove Jack", "Trevally"],
        lure: "Soft plastics, hard-body swimbaits at night, surface walkers dusk",
        bestTide: "Night run-out", access: "Public ramp available. Restricted near active berths — fish the mangrove edge south.",
      },
    ],
  },
  {
    id: "adelaide",
    name: "Adelaide River",
    emoji: "🐊",
    color: "#4fc3f7",
    refNote: "Corrected from Darwin",
    locations: [
      {
        id: "adelaide-mouth", name: "Adelaide River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "5 min after Darwin. Barra stack at the mouth on the run-out. Salties active.",
        hotspots: ["River mouth sandbar", "Channel edge rock bar", "Inside mangrove edge on run-in"],
        species: ["Barramundi", "Threadfin Salmon", "Mangrove Jack", "Giant Trevally"],
        lure: "Surface walkers 80–120mm, rattling hard-bodies",
        bestTide: "Run-out", access: "Boat access from Point Stuart ramp. CROC country — stay in boat at all times.",
      },
      {
        id: "point-stuart", name: "Point Stuart Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "~20 min after Darwin. Mud crabs, barra, queenfish on incoming tides.",
        hotspots: ["Rock bar south of ramp", "River mouth point", "Mangrove creek mouths on run-out"],
        species: ["Barramundi", "Mud Crab", "Queenfish", "Mangrove Jack"],
        lure: "Hard-body minnows, surface poppers, crab pots",
        bestTide: "Run-out", access: "Unsealed road from Arnhem Highway — 4WD recommended in wet season. Free ramp.",
      },
      {
        id: "window-wetlands", name: "Window on the Wetlands", type: "bay", emoji: "🌿",
        tip: "Tidal influence 30 min after Darwin. Mainly bream and catfish in the lagoon.",
        hotspots: ["Inlet channel on run-in", "Lily pad edge at dawn", "Back billabong in wet season"],
        species: ["Barramundi", "Saratoga", "Catfish", "Bream", "Sleepy Cod"],
        lure: "Surface poppers, soft frogs, suspending jerkbaits",
        bestTide: "Run-in (tidal influence limited)", access: "Sealed road. Public park with boat ramp. Day-use only. Croc risk.",
      },
      {
        id: "annaburroo", name: "Annaburroo Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "40 min after Darwin. Good early-morning barra in the paperbark channels.",
        hotspots: ["Upper Adelaide River channel", "Snag lines mid-river", "Paperbark edge at dusk"],
        species: ["Barramundi", "Sleepy Cod", "Catfish", "Saratoga"],
        lure: "Hard-body deep divers, soft plastics 3\" shad",
        bestTide: "Run-out", access: "Sealed road via Arnhem Highway. Campsite at Annaburroo Station.",
      },
    ],
  },
  {
    id: "mary",
    name: "Mary River",
    emoji: "🪨",
    color: "#ffd700",
    refNote: "Corrected from Darwin",
    locations: [
      {
        id: "mary-mouth", name: "Mary River Mouth (Pt Ragged)", type: "river_mouth", emoji: "🌊",
        tip: "10 min after Darwin. Great threadfin and barra right at the mouth on run-out.",
        hotspots: ["Point Ragged sandbar", "River mouth main channel", "Bait school under birds"],
        species: ["Barramundi", "Threadfin Salmon", "Queenfish", "Giant Trevally"],
        lure: "Surface walkers 100mm, metal slices 40g",
        bestTide: "Run-out", access: "Boat access only — rocky bar approach. Watch the bar depth at low tide.",
      },
      {
        id: "shady-camp", name: "Shady Camp Rock Bar", type: "rock_bar", emoji: "🪨", star: true,
        tip: "NT's most famous barramundi rock bar. Fish the run-out over the rocks at dawn.",
        hotspots: ["Rock bar main run-out", "Left bank snag line", "Channel bend below bar", "Sandy run upstream of bar"],
        species: ["Barramundi", "Mangrove Jack", "Threadfin Salmon", "Saratoga"],
        lure: "Surface walkers 100–120mm, heavy rattling hard-bodies 15–20g",
        bestTide: "Run-out — 1hr before to 2hrs after the turn",
        access: "4WD required. Seasonal — dry season only. Park on levee. DO NOT drive on bar surface.",
      },
      {
        id: "shady-camp-ramp", name: "Shady Camp Boat Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "Launch 2hrs either side of high. Park on the levee — DO NOT drive on the bar.",
        hotspots: ["Channel below the levee bank", "Mary River upstream from ramp", "Rock bar area approach"],
        species: ["Barramundi", "Mangrove Jack", "Threadfin Salmon"],
        lure: "Hard-body minnows 80–100mm, surface walkers",
        bestTide: "Run-out", access: "4WD required. Sealed levee road. Don't attempt creek crossings in wet season.",
      },
      {
        id: "corroboree", name: "Corroboree (Mary R.)", type: "bay", emoji: "🌿",
        tip: "40 min after Darwin. Mainly freshwater barra, saratoga and catfish upstream.",
        hotspots: ["Corroboree Lagoon inlet", "Paperbark snag lines", "Upstream tidal-limit pool"],
        species: ["Barramundi", "Saratoga", "Catfish", "Bream", "Sleepy Cod"],
        lure: "Surface poppers, spinnerbaits, soft frogs in lily pads",
        bestTide: "Run-in", access: "Sealed road via Arnhem Highway. Campsite available. Croc risk — no wading.",
      },
      {
        id: "marrakai", name: "Marrakai Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "45 min after Darwin. Good early-morning barra in the paperbark channels.",
        hotspots: ["Marrakai Creek mouth", "Upper Mary flats on run-in", "Paperbark edge channels"],
        species: ["Barramundi", "Sleepy Cod", "Archer Fish", "Saratoga"],
        lure: "Hard-body shallow runners 70mm, soft plastics",
        bestTide: "Run-out", access: "4WD track. Mostly dry season access. Station property — respect boundaries.",
      },
    ],
  },
  {
    id: "daly",
    name: "Daly River",
    emoji: "🎣",
    color: "#66bb6a",
    refNote: "Corrected from Darwin",
    locations: [
      {
        id: "daly-mouth", name: "Daly River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "45 min after Darwin. Mangrove jack and barra stack at the mouth on the run-out.",
        hotspots: ["River mouth sandbar channel", "Channel edge west bank", "Snag lines inside mouth"],
        species: ["Barramundi", "Threadfin Salmon", "Mangrove Jack", "Giant Trevally"],
        lure: "Surface walkers 80–120mm, large hard-body minnows",
        bestTide: "Run-out", access: "Boat access only from downstream. Very remote. CROC country.",
      },
      {
        id: "snake-creek", name: "Snake Creek Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "65 min after Darwin. Remote ramp — 4WD only. Big barra in the snake holes.",
        hotspots: ["Snake Creek deep holes", "Daly River junction pool", "Mangrove edge on run-in"],
        species: ["Barramundi", "Mangrove Jack", "Catfish", "Sleepy Cod"],
        lure: "Heavy jigs, deep-diving hard-bodies 80mm",
        bestTide: "Run-out", access: "4WD only via rough access track. Seasonal — ask locally about conditions.",
      },
      {
        id: "woolianna", name: "Woolianna Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "1.5hrs after Darwin. The classic Daly River barra ramp — flood plains epic in the wet.",
        hotspots: ["The Junction pool upstream", "Flood plain drains in wet season", "Paperbark snag lines"],
        species: ["Barramundi", "Sleepy Cod", "Saratoga", "Mangrove Jack"],
        lure: "Hard-body minnows 80mm, surface lures in wet, spinnerbaits",
        bestTide: "Run-out", access: "Unsealed road from Daly River Road. Lodge with hire boats available.",
      },
      {
        id: "daly-river-town", name: "Daly River Town Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "2hrs after Darwin. Small tidal range here — fish structure and deep pools.",
        hotspots: ["Town waterhole under bridge", "Upstream riverbend snags", "Mission pool area"],
        species: ["Barramundi", "Saratoga", "Sleepy Cod", "Catfish"],
        lure: "Surface lures, hard-body minnows 70mm, spinnerbaits",
        bestTide: "Run-out (minimal tidal range here)", access: "Sealed road from Daly River Road. Community ramp — follow local signs.",
      },
      {
        id: "port-keats", name: "Wadeye (Port Keats)", type: "boat_ramp", emoji: "🚢",
        tip: "Nearly 3hrs after Darwin. Remote. Pristine barra, queenfish and trevally.",
        hotspots: ["Tidal flats south of town", "Estuary mouth channels", "Rock ledges on run-out"],
        species: ["Barramundi", "Queenfish", "Mangrove Jack", "Giant Trevally"],
        lure: "Surface poppers, metal slices 40g, hard-body minnows",
        bestTide: "Run-out", access: "Fly-in or very long 4WD from Daly River. Community — permit required from council.",
      },
    ],
  },
  {
    id: "kakadu",
    name: "Kakadu & Alligator Rivers",
    emoji: "🦆",
    color: "#ff7043",
    refNote: "Corrected from Darwin",
    locations: [
      {
        id: "south-alligator", name: "South Alligator Mouth", type: "river_mouth", emoji: "🌊",
        tip: "10 min after Darwin. Huge barra school at the mouth — cast along the snag lines.",
        hotspots: ["River mouth sandbar", "West bank rock bar", "Bird Point tidal flat on run-in"],
        species: ["Barramundi", "Threadfin Salmon", "Giant Trevally", "Queenfish"],
        lure: "Surface walkers 100–120mm, rattling hard-bodies, poppers",
        bestTide: "Run-out", access: "Sealed road via Arnhem Highway. Boat ramp at Jim Jim Crossing area. CROC — do not wade.",
      },
      {
        id: "field-island", name: "Field Island", type: "beach", emoji: "🏖️",
        tip: "5 min after Darwin. Remote sand bar. Excellent queenfish and mackerel at high.",
        hotspots: ["North tip sandbar", "West channel edge on run-out", "Baitfish school on run-in"],
        species: ["Giant Trevally", "Queenfish", "Spanish Mackerel", "Barramundi"],
        lure: "Poppers 80mm, metal slices 40–60g",
        bestTide: "Run-in", access: "Boat access only from South Alligator ramp — remote. Check Kakadu NP permit requirements.",
      },
      {
        id: "cahills-crossing", name: "Cahills Crossing Rock Bar", type: "rock_bar", emoji: "🪨", star: true,
        tip: "NT's most famous croc-and-barra crossing. Fish the run-out from the bank — DO NOT wade.",
        hotspots: ["Rock bar main run-out zone", "Pool below the crossing", "East bank channel bend", "North bank snag line"],
        species: ["Barramundi", "Mangrove Jack", "Saratoga", "Archer Fish"],
        lure: "Surface walkers 100mm+, heavy hard-bodies, suspending jerkbaits",
        bestTide: "Run-out — hour before to 2hrs after the turn",
        access: "Sealed road via Oenpelli Road. Fish ONLY from the bank. DO NOT wade — active croc habitat. Arnhem Land permit beyond this point.",
      },
      {
        id: "east-alligator", name: "East Alligator River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "25 min after Darwin. Remote but excellent. Massive barra and jack in the channels.",
        hotspots: ["Mouth sandbar east bank", "Channel junction pool", "Mangrove creek on run-in"],
        species: ["Barramundi", "Mangrove Jack", "Threadfin Salmon", "Giant Trevally"],
        lure: "Large hard-body minnows 100mm, surface walkers",
        bestTide: "Run-out", access: "Arnhem Land permit required beyond Cahills Crossing. Ranger station access point.",
      },
      {
        id: "west-alligator", name: "West Alligator River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "5 min after Darwin. Threadfin and barra on run-in. Boat access only.",
        hotspots: ["West point rock bar", "Mouth tidal flat", "Mid-river snag lines"],
        species: ["Barramundi", "Queenfish", "Threadfin Salmon"],
        lure: "Surface walkers 80mm, rattling hard-bodies",
        bestTide: "Run-out", access: "Boat access only from Jim Jim ramp. Very remote. Kakadu NP permit required.",
      },
    ],
  },
  {
    id: "essington",
    name: "Port Essington / Cobourg",
    emoji: "⛵",
    color: "#ab47bc",
    refNote: "Corrected from Darwin",
    locations: [
      {
        id: "port-essington", name: "Port Essington", type: "harbour", emoji: "⚓",
        tip: "30 min after Darwin. Remote and pristine. Barra, jack, fingermark in the harbour.",
        hotspots: ["Victoria Settlement channel", "Inner harbour mangroves on run-out", "Rock shoals at harbour entrance"],
        species: ["Barramundi", "Fingermark", "Mangrove Jack", "Coral Trout", "Giant Trevally"],
        lure: "Large hard-body swimbaits 100mm, jigs 20–30g",
        bestTide: "Run-out", access: "Charter boat or yacht access only. No road access. Cobourg Marine Park permit required.",
      },
      {
        id: "cobourg", name: "Cobourg Peninsula", type: "beach", emoji: "🏖️",
        tip: "25 min after Darwin. Permit required. Spectacular GT, mackerel and reef fish.",
        hotspots: ["Cobourg reef edge 1km out", "Sandy beaches on run-in", "Rock headlands wash zone"],
        species: ["Giant Trevally", "Spanish Mackerel", "Coral Trout", "Longtail Tuna"],
        lure: "Poppers, metal slices, trolling lures skirted",
        bestTide: "Run-in", access: "Cobourg Marine Park permit required from NT Parks. Fly-in or boat only.",
      },
      {
        id: "smith-point", name: "Smith Point (Cobourg)", type: "boat_ramp", emoji: "🚢",
        tip: "20 min after Darwin. Basic ramp. The best Spanish mackerel in the NT.",
        hotspots: ["Point reef edge", "Bay flats on run-in", "Headland wash zone"],
        species: ["Spanish Mackerel", "Giant Trevally", "Queenfish", "Longtail Tuna"],
        lure: "Skirted trolling lures, poppers 70mm, metal slices",
        bestTide: "Run-in", access: "Via Gurig National Park — permit required. Very remote. Basic facilities at Black Point.",
      },
    ],
  },
  {
    id: "victoria",
    name: "Victoria River & West",
    emoji: "🌄",
    color: "#ff8f00",
    refNote: "Corrected from Darwin",
    locations: [
      {
        id: "victoria-mouth", name: "Victoria River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "2hr 40min after Darwin. Massive tidal run — queenfish and barra on the run-out.",
        hotspots: ["McAdam Point tidal run", "River mouth west bank", "Rock ledges on the point"],
        species: ["Barramundi", "Queenfish", "Giant Trevally", "Threadfin Salmon"],
        lure: "Surface walkers 100–120mm, metal slices 50g",
        bestTide: "Run-out", access: "4WD track from Victoria Highway — remote. Very large tides here. CROC country.",
      },
      {
        id: "big-horse-creek", name: "Big Horse Creek Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "~3hrs after Darwin. Legendary barra fishing in the Victoria River system.",
        hotspots: ["Creek junction pool", "Victoria River main channel run-out", "Paperbark edge drains"],
        species: ["Barramundi", "Saratoga", "Mangrove Jack", "Sleepy Cod"],
        lure: "Hard-body minnows 80mm, spinnerbaits, soft plastics",
        bestTide: "Run-out", access: "4WD only via long remote track. Self-sufficient required. No mobile coverage.",
      },
      {
        id: "baines-river", name: "Baines River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "~2hr 35min after Darwin. Pristine remote river. 4WD access only.",
        hotspots: ["River mouth estuary edge", "Baines rock shelf run-out", "Tidal flat on run-in"],
        species: ["Barramundi", "Threadfin Salmon", "Queenfish", "Giant Trevally"],
        lure: "Surface poppers, hard-body minnows 80–100mm",
        bestTide: "Run-out", access: "Very remote — 4WD via Gregory area or WA border track. Boat essential.",
      },
    ],
  },
  {
    id: "arnhem",
    name: "Arnhem Land",
    emoji: "🏹",
    color: "#e53935",
    refNote: "Corrected from Gove BOM",
    locations: [
      {
        id: "nhulunbuy-ramp", name: "Nhulunbuy (Gove) Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "BOM reference port for east Arnhem. Excellent GT, mackerel and coral species.",
        hotspots: ["Gove Harbour channel run-out", "Reef drop-off east of ramp", "Melville Bay flats"],
        species: ["Giant Trevally", "Spanish Mackerel", "Coral Trout", "Barramundi", "Queenfish"],
        lure: "Poppers 80mm, metal slices 40g, soft-pitch jigs",
        bestTide: "Run-out", access: "Gove Peninsula. Public ramp at the wharf. GEMCO mining area — permit may apply.",
      },
      {
        id: "melville-bay", name: "Melville Bay (Gove)", type: "bay", emoji: "🌊",
        tip: "Same as Gove. Sheltered bay — jewfish and barra on the flats at dawn.",
        hotspots: ["Bay coral edge", "Melville Bay flats at dawn", "North rock headland wash"],
        species: ["Giant Trevally", "Queenfish", "Barramundi", "Jewfish", "Coral Trout"],
        lure: "Metal slices, soft plastic jigs 4\", surface walkers",
        bestTide: "Run-in", access: "Boat access from Nhulunbuy ramp. Open bay — weather-dependent crossing.",
      },
      {
        id: "caledon-bay", name: "Caledon Bay", type: "bay", emoji: "🌊",
        tip: "+30 min from Gove. Remote permit required. Outstanding GT and reef fishing.",
        hotspots: ["Bay reef edge", "Creek mouths at run-out", "Offshore bommie"],
        species: ["Giant Trevally", "Spanish Mackerel", "Coral Trout", "Longtail Tuna"],
        lure: "Poppers 80–100mm, skirted trolling lures, slow jigs",
        bestTide: "Run-out", access: "Remote. Yolŋu community — Arnhem Land permit required. Charter recommended.",
      },
      {
        id: "trial-bay", name: "Trial Bay (Arnhem Land)", type: "bay", emoji: "🌊",
        tip: "+20 min from Gove. Barra and mangrove jack in the mangrove creek systems.",
        hotspots: ["Bay entrance channel", "Mangrove creek mouths run-out", "Rock shelf edges"],
        species: ["Barramundi", "Mangrove Jack", "Trevally", "Fingermark"],
        lure: "Hard-body minnows 80mm, soft plastics, surface lures",
        bestTide: "Run-out", access: "Arnhem Land permit required. Remote. Boat essential — no road access.",
      },
      {
        id: "buckingham-bay", name: "Buckingham Bay", type: "bay", emoji: "🌊",
        tip: "+45 min from Gove. Remote. Great for mackerel and pelagics off the point.",
        hotspots: ["Bay reef structure", "Headland wash run-in", "Channel baitball zone"],
        species: ["Spanish Mackerel", "Giant Trevally", "Coral Trout", "Longtail Tuna"],
        lure: "High-speed metal slices, trolling lures, poppers 100mm",
        bestTide: "Run-in", access: "Very remote. Arnhem Land permit required. Charter boat recommended.",
      },
      {
        id: "elcho-island", name: "Elcho Island (Galiwinku)", type: "boat_ramp", emoji: "🚢",
        tip: "-30 min from Gove. Community area — check access. Mixed reef and barra.",
        hotspots: ["Ferry channel on run-out", "Reef edge north of island", "Creek mouth on run-in"],
        species: ["Barramundi", "Giant Trevally", "Coral Trout", "Threadfin Salmon"],
        lure: "Metal slices, poppers 80mm, soft plastics",
        bestTide: "Run-out", access: "Community permit required from Galiwinku community council.",
      },
      {
        id: "milingimbi", name: "Milingimbi", type: "boat_ramp", emoji: "🚢",
        tip: "-45 min from Gove. NT tidal flats. Excellent mud crabs and estuary species.",
        hotspots: ["Mangrove creek mouths on run-out", "Arafura Sea flat edge", "Channel run-out"],
        species: ["Barramundi", "Mud Crab", "Threadfin Salmon", "Queenfish"],
        lure: "Hard-body minnows, soft plastics, crab pots",
        bestTide: "Run-out", access: "Community permit required. Seasonal access. Fly-in or boat from Darwin.",
      },
      {
        id: "maningrida", name: "Maningrida (Liverpool River)", type: "boat_ramp", emoji: "🚢",
        tip: "20 min BEFORE Darwin. Gulf-facing. Big tidal barra and threadfin in the river.",
        hotspots: ["Liverpool River mouth", "Rock bars inside the estuary", "Tidal flat edge on run-out"],
        species: ["Barramundi", "Queenfish", "Threadfin Salmon", "Mud Crab"],
        lure: "Surface walkers 100mm, metal slices 30–50g",
        bestTide: "Run-out", access: "Community permit required from Maningrida council. Fly-in or boat access.",
      },
    ],
  },
  {
    id: "groote",
    name: "Groote Eylandt",
    emoji: "🏝️",
    color: "#7986cb",
    refNote: "Groote Eylandt BOM reference",
    locations: [
      {
        id: "alyangula", name: "Alyangula Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "BOM reference for Groote. Gulf-style diurnal tides. Barra and coral species.",
        hotspots: ["Harbour rock bar on run-out", "Sandy beach north of ramp", "Reef edge east of island"],
        species: ["Giant Trevally", "Spanish Mackerel", "Coral Trout", "Barramundi"],
        lure: "Poppers 80mm, metal slices 40g, jigs 20–40g",
        bestTide: "Run-out", access: "Mining town — GEMCO access permit required. Good facilities and ramp.",
      },
      {
        id: "emerald-river", name: "Emerald River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "+20 min from Groote. Excellent barra in the river system during run-out.",
        hotspots: ["River mouth bar at run-out", "Creek junction pool", "Sandbar baitball"],
        species: ["Barramundi", "Mangrove Jack", "Threadfin Salmon", "Saratoga"],
        lure: "Surface walkers 80–120mm, rattling minnows",
        bestTide: "Run-out", access: "4WD track from Alyangula. Remote. Groote Eylandt permit required.",
      },
      {
        id: "umbakumba", name: "Umbakumba Ramp", type: "boat_ramp", emoji: "🚢",
        tip: "+45 min from Groote. South-coast ramp. GT, mackerel and sweetlip on the reef.",
        hotspots: ["Rock reef south of ramp", "Tidal channel run-out", "Bay reef edge east"],
        species: ["Coral Trout", "Giant Trevally", "Spanish Mackerel", "Sweetlip"],
        lure: "Jigs 20–40g, poppers 80mm, slow-pitch jig",
        bestTide: "Run-out", access: "Community area — access permit required. Remote from Alyangula.",
      },
      {
        id: "bartalumba-bay", name: "Bartalumba Bay", type: "bay", emoji: "🌊",
        tip: "+15 min from Groote. Sheltered fishing — good for families. Reef and barra.",
        hotspots: ["Bay reef flat", "Sandy run north edge", "Creek mouth on run-in"],
        species: ["Barramundi", "Queenfish", "Trevally", "Bream"],
        lure: "Metal slices 30g, surface walkers 80mm, poppers",
        bestTide: "All tides", access: "Boat access from Alyangula. Groote Eylandt permit required.",
      },
      {
        id: "winchelsea", name: "Winchelsea Island", type: "bay", emoji: "🌊",
        tip: "+30 min from Groote. Excellent GT, coral trout and coral species.",
        hotspots: ["Island reef edge south side", "Rock ledge north side", "Coral bommies east"],
        species: ["Coral Trout", "Giant Trevally", "Spanish Mackerel", "Longtail Tuna"],
        lure: "Slow-pitch jigs 40g, poppers 80mm, trolling lures",
        bestTide: "Run-in", access: "Boat access only. Remote. Weather-dependent crossing from Alyangula.",
      },
    ],
  },
  {
    id: "gulf",
    name: "Gulf Coast",
    emoji: "🌊",
    color: "#26c6da",
    refNote: "Corrected from Groote BOM",
    locations: [
      {
        id: "king-ash-bay", name: "King Ash Bay Ramp", type: "boat_ramp", emoji: "🚢", star: true,
        tip: "Borroloola's iconic ramp. Threadfin, barra and queenfish in the Gulf.",
        hotspots: ["King Ash Bay rock bar at run-out", "McArthur River upstream channel", "Inlet edge on run-out", "Gravel bar on run-in"],
        species: ["Barramundi", "Threadfin Salmon", "Giant Trevally", "Queenfish", "Mangrove Jack"],
        lure: "Surface walkers 100–120mm, metal slices, hard-body minnows 80mm",
        bestTide: "Run-out", access: "Unsealed road from Borroloola. Well-equipped fishing camp with good facilities.",
      },
      {
        id: "mcarthur-mouth", name: "McArthur River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "+1hr from Groote. Big barra school at the mouth on the Gulf run-out tide.",
        hotspots: ["River mouth sandbar", "Channel left bank run-out", "Gulf tidal flat baitfish edge"],
        species: ["Barramundi", "Threadfin Salmon", "Queenfish", "Giant Trevally"],
        lure: "Surface walkers 100mm, metal slices 40–60g",
        bestTide: "Run-out", access: "Boat access from King Ash Bay ramp. Very remote. CROC country.",
      },
      {
        id: "roper-mouth", name: "Roper River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "+2hrs from Groote. Big estuary — threadfin, barra and queenfish at the mouth.",
        hotspots: ["Roper mouth sandbar", "Left bank estuary channel", "Gulf flat baitfish school"],
        species: ["Barramundi", "Threadfin Salmon", "Queenfish", "Mangrove Jack"],
        lure: "Surface poppers 80mm, metal slices, hard-body minnows",
        bestTide: "Run-out", access: "Remote. Boat from Roper Bar or coastal track. 4WD essential.",
      },
      {
        id: "roper-bar", name: "Roper Bar Rock Bar", type: "rock_bar", emoji: "🪨", star: true,
        tip: "ICONIC NT rock bar — barra stack below the crossing at run-out.",
        hotspots: ["Rock bar main run-out zone", "Left bank channel bend", "Pool below the crossing", "Upstream gravel bar"],
        species: ["Barramundi", "Saratoga", "Mangrove Jack", "Sleepy Cod", "Archer Fish"],
        lure: "Surface walkers 80–100mm, suspending jerkbaits, spinnerbaits",
        bestTide: "Run-out — 1hr before to 3hrs after the turn",
        access: "4WD via Roper Highway. Roper Bar Store and campsite on site. Fish from bank — CROC country.",
      },
      {
        id: "nathan-river", name: "Nathan River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "+1.5hrs from Groote. Remote Gulf creek. Pristine barra and estuary species.",
        hotspots: ["River mouth estuary edge", "Gulf flat sandbar run-out", "Inland pool access track"],
        species: ["Barramundi", "Threadfin Salmon", "Queenfish", "Trevally"],
        lure: "Hard-body minnows 80mm, surface walkers",
        bestTide: "Run-out", access: "Very remote. 4WD from Nathan River Homestead. Self-sufficient — no facilities.",
      },
      {
        id: "robinson-river", name: "Robinson River Mouth", type: "river_mouth", emoji: "🌊",
        tip: "+1hr 40min from Groote. Very remote. Excellent run-out barra and queenfish.",
        hotspots: ["River mouth estuary rock ledge", "Gulf flat run-out edge", "Creek junction pool"],
        species: ["Barramundi", "Queenfish", "Giant Trevally", "Threadfin Salmon"],
        lure: "Surface walkers 100mm, metal slices 40g",
        bestTide: "Run-out", access: "Extremely remote. Helicopter or long 4WD from Borroloola. Fully self-sufficient.",
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

// ─── NT Water Temperature by season and region ────────────────────────────────
export function getNTWaterTemp(regionId: string): string {
  const m = new Date().getMonth() + 1; // 1-12
  const isGulf = regionId === "gulf" || regionId === "groote";
  const isWet = m >= 1 && m <= 4;
  const isBuildUp = m === 10 || m === 11;
  if (isWet)     return isGulf ? "30–33°C" : "29–32°C";
  if (isBuildUp) return isGulf ? "29–31°C" : "28–31°C";
  return isGulf ? "26–28°C" : "24–27°C";
}

// ─── NT Season label ──────────────────────────────────────────────────────────
export function getNTSeason(): { name: string; emoji: string; fishing: string } {
  const m = new Date().getMonth() + 1;
  if (m >= 5 && m <= 9)  return { name: "Dry Season", emoji: "☀️", fishing: "Prime season — barra and pelagics at peak" };
  if (m === 10 || m === 11) return { name: "Build-Up", emoji: "⛈️", fishing: "Pre-wet — baitfish schools, great topwater" };
  return { name: "Wet Season", emoji: "🌧️", fishing: "Flood plains open — remote access limited" };
}
