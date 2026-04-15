export interface DepthZone {
  id: string;
  name: string;
  region: string;
  depth: string;
  targetSpecies: string[];
  description: string;
  access: string;
  gpsMarkers?: { lat: number; lon: number; label: string }[];
  season: string;
}

export const DEPTH_ZONES: DepthZone[] = [
  {
    id: "norman-river",
    name: "Norman River System",
    region: "Gulf of Carpentaria",
    depth: "1–6 m tidal estuary",
    targetSpecies: ["Barramundi", "Black Jewfish", "Mud Crab", "Queenfish"],
    description: "The Norman River is Queensland's most fished Gulf system — 70+ km of tidal estuary from Normanton to Karumba Point. Barramundi hold on mangrove cut banks, submerged logs, and rocky bars on tidal changes.",
    access: "Boat ramp at Karumba Point, Normanton boat ramp. Karumba is fly-in / self-drive from Mt Isa or Cairns via the Gulf Developmental Road.",
    gpsMarkers: [
      { lat: -17.487, lon: 140.836, label: "Karumba Point Ramp" },
      { lat: -17.623, lon: 140.912, label: "Norman River Mouth Bar" },
      { lat: -17.667, lon: 141.078, label: "Normanton Wharf Deep Hole" },
      { lat: -17.543, lon: 140.963, label: "Mid-Norman Mangrove Bank" }
    ],
    season: "Oct–January peak (pre-wet/wet season). Dry season barra concentrate in deep holes. Mud crabs year-round in mangrove drains."
  },
  {
    id: "mitchell-river",
    name: "Mitchell River System",
    region: "Gulf of Carpentaria",
    depth: "2–8 m tidal estuary and lower floodplain",
    targetSpecies: ["Barramundi", "Mud Crab", "Black Jewfish", "Golden Snapper"],
    description: "Queensland's largest Gulf river system. The Mitchell, Alice, and Palmer rivers join to form a massive tidal estuary system that produces trophy barramundi every season. Remote access makes it a bucket-list trip.",
    access: "Access via Kowanyama (Cape York Peninsula); charter flights from Cairns or Karumba. No road access to river mouth — boat required.",
    gpsMarkers: [
      { lat: -15.225, lon: 141.583, label: "Mitchell River Mouth" },
      { lat: -15.475, lon: 141.633, label: "Mitchell Lower Estuary Bar" },
      { lat: -15.389, lon: 141.721, label: "Alice River Junction" }
    ],
    season: "Oct–March peak for barra (wet season build-up and flush). Dry season access challenging via boat only."
  },
  {
    id: "gilbert-river",
    name: "Gilbert River",
    region: "Gulf of Carpentaria",
    depth: "1–5 m tidal estuary",
    targetSpecies: ["Barramundi", "Mud Crab", "Mangrove Jack", "Queenfish"],
    description: "The Gilbert River enters the Gulf between the Norman and Mitchell river mouths. It is remote, productive, and almost always features in trophy barra stories from Gulf anglers.",
    access: "Helicopter or boat access from Karumba or charter from Normanton. Extremely remote — full self-sufficiency required.",
    gpsMarkers: [
      { lat: -16.983, lon: 141.333, label: "Gilbert River Mouth" },
      { lat: -16.721, lon: 141.489, label: "Gilbert Mid-Estuary Bar" }
    ],
    season: "October–January hot. Closed in peak wet season due to flooding. Best fished on a remote camp trip."
  },
  {
    id: "flinders-river",
    name: "Flinders River",
    region: "Gulf of Carpentaria",
    depth: "1–4 m tidal estuary",
    targetSpecies: ["Barramundi", "Mud Crab", "Black Jewfish"],
    description: "The Flinders River mouth is a short 20-minute run from Karumba Point. The lower tidal section holds good barra numbers in the pre-wet season and is less fished than the Norman River.",
    access: "Boat from Karumba Point ramp. Follow the channel south-west of Karumba. Shallows at low tide — plan your return trip.",
    gpsMarkers: [
      { lat: -17.733, lon: 141.167, label: "Flinders River Mouth" },
      { lat: -17.712, lon: 141.212, label: "Flinders Tidal Channel" }
    ],
    season: "October–February barra season. Dry season fish concentrate at the mouth bar on run-out tides."
  },
  {
    id: "embley-river-weipa",
    name: "Embley River (Weipa)",
    region: "Western Cape York",
    depth: "1–7 m tidal estuary",
    targetSpecies: ["Barramundi", "Giant Trevally", "Golden Snapper", "Mud Crab"],
    description: "The Embley River at Weipa is arguably Cape York's finest estuary fishing. GT at the Weipa causeway are world-class, while barra and fingermark fill the upper reaches.",
    access: "Boat ramp at Weipa Fishing Club. Weipa accessible by sealed road from Cairns via Cape York development road (4WD recommended in wet season) or by flight.",
    gpsMarkers: [
      { lat: -12.667, lon: 141.867, label: "Weipa Causeway GT Spot" },
      { lat: -12.589, lon: 141.822, label: "Embley River Upper Bar" },
      { lat: -12.745, lon: 141.933, label: "Evans Landing Bank" }
    ],
    season: "GT peak May–August dry season. Barra September–January build-up season. Year-round for fingermark and mud crab."
  },
  {
    id: "endeavour-river",
    name: "Endeavour River (Cooktown)",
    region: "Far North Queensland",
    depth: "1–5 m tidal estuary",
    targetSpecies: ["Barramundi", "Mangrove Jack", "Mud Crab", "Queenfish"],
    description: "The Endeavour River at Cooktown is historically significant and a productive fishing destination. Barra and jack stack in the mangrove bends, and the coral reef offshore offers excellent reef fishing.",
    access: "Boat ramp in Cooktown. Drive from Cairns via the Mulligan Highway (4WD recommended).",
    gpsMarkers: [
      { lat: -15.467, lon: 145.248, label: "Endeavour River Mouth" },
      { lat: -15.489, lon: 145.266, label: "Cooktown Mangrove Bend" }
    ],
    season: "Barra March–July post-wet season. Jack and mud crab year-round. Offshore reef fishing best May–November."
  },
  {
    id: "albert-river",
    name: "Albert River (Burketown)",
    region: "Gulf of Carpentaria",
    depth: "1–6 m tidal estuary",
    targetSpecies: ["Barramundi", "Black Jewfish", "Mud Crab", "Queenfish"],
    description: "The Albert River around Burketown is deep, remote Gulf Country. This is the southern Gulf barra epicentre — the river produces some of Queensland's largest barra every season, in stunning isolation.",
    access: "Sealed road to Burketown from Mt Isa via Cloncurry. Boat ramp at Burketown. Dry season access only (May–October); wet season roads flood.",
    gpsMarkers: [
      { lat: -17.733, lon: 139.548, label: "Burketown Ramp" },
      { lat: -17.689, lon: 139.421, label: "Albert River Tidal Bar" },
      { lat: -17.645, lon: 139.267, label: "Albert Lower Mangrove Reach" }
    ],
    season: "Dry season peak May–October. Wet season barra are active but access is difficult. Night fishing for jewfish from June–September."
  },
  {
    id: "wenlock-river",
    name: "Wenlock River (Cape York)",
    region: "Cape York Peninsula",
    depth: "1–4 m tidal estuary and freshwater pools",
    targetSpecies: ["Barramundi", "Sooty Grunter", "Mangrove Jack", "Saratoga"],
    description: "The Wenlock River on Cape York's east coast is famous for barra and also holds saratoga (jardini) in its freshwater reaches — one of the few rivers in Queensland with both species.",
    access: "Extremely remote — 4WD only via Telegraph Road (dry season only). Full self-sufficiency required.",
    gpsMarkers: [
      { lat: -12.637, lon: 142.567, label: "Wenlock River Tidal Section" },
      { lat: -12.545, lon: 142.623, label: "Wenlock Freshwater Pool" }
    ],
    season: "Dry season only (May–October). Wet season flooding makes the river inaccessible by road."
  }
];

export default DEPTH_ZONES;
