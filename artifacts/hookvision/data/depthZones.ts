export interface DepthZone {
  minM: number;
  maxM: number;
  label: string;
  species: string[];
  tideStage: string;
  technique: string;
  lure: string;
  hotness: "fire" | "hot" | "warm" | "cool";
  notes: string;
}

export interface NettingRecord {
  era: string;
  area: string;
  depthRange: string;
  detail: string;
}

export interface RiverSystem {
  id: string;
  name: string;
  shortName: string;
  region: string;
  distanceNote: string;
  maxDepth: number;
  access: string;
  bestSeason: string;
  character: string;
  zones: DepthZone[];
  historicalNote: string;
  nettingHistory?: NettingRecord;
  proTip: string;
  lat: number;
  lng: number;
}

export const RIVER_SYSTEMS: RiverSystem[] = [
  {
    id: "ord",
    name: "Ord River",
    shortName: "Ord R.",
    region: "East Kimberley",
    distanceNote: "830 km from Broome",
    maxDepth: 14,
    access: "Sealed road to Kununurra, boat ramp at town and Ivanhoe Crossing",
    bestSeason: "Dry Season May–Sep",
    character:
      "Kimberley's premier barra system. Tidal estuary below Kununurra, freshwater above Diversion Dam. Massive croc population — boat only. Fish hold on rock bars, submerged timber, and deep channel holes. Legendary for trophy fish.",
    zones: [
      {
        minM: 0,
        maxM: 1.5,
        label: "Surface / Tidal Flat",
        species: ["Barramundi", "Saratoga", "Archer Fish"],
        tideStage: "Run-in tide, first 2 hours",
        technique:
          "Cast surface poppers parallel to the mangrove edge on the flooding tide. Work fast across snag-free water. Dawn surface sessions on the Ord are legendary — fish stack on shallow flats as bait floods in.",
        lure: "Surface popper 85–120mm, chartreuse or white",
        hotness: "fire",
        notes:
          "Dawn surface window on incoming tide is the Ord River's most productive session. Fish stack in the 0–1.5m zone after dead low tide in dry season. WA Fisheries surveys (1990s) documented the highest barra density per km² in this tidal zone.",
      },
      {
        minM: 1.5,
        maxM: 4,
        label: "Snag Country / Mid Flat",
        species: ["Barramundi", "Mangrove Jack", "Rock Cod"],
        tideStage: "Mid-tide both ways, best run-in",
        technique:
          "Slow-roll a 100–120mm suspending hardbody through submerged timber. Let it tick against the snag and pause — jack and barra ambush from the shadow. The Ord has dense snag coverage in this depth zone.",
        lure: "Suspending minnow 100mm, bone or pearl",
        hotness: "fire",
        notes:
          "The 1.5–4m snag zone is the Ord's bread-and-butter barra depth. Snag-filled bends hold fish around the clock. WA Fisheries published catch data from guided fishing operations shows 60% of recreational barra from the Ord system are taken in this zone.",
      },
      {
        minM: 4,
        maxM: 8,
        label: "Main Channel Mid-Depth",
        species: ["Barramundi (big fish)", "Threadfin Salmon", "Fingermark"],
        tideStage: "Tide change ± 1.5 hrs, both high and low",
        technique:
          "Vertical jig or slow-trolled deep-diving lure. Target channel bends and submerged rock bars at this depth on slack tide. Fingermark often stack at 5–6m on rock edges below the Diversion Dam wall.",
        lure: "Deep-diver 120mm, 6–8m depth rating, purple-back",
        hotness: "hot",
        notes:
          "The 4–8m zone produces the biggest individual barra in the Ord River system. WA Fisheries stock assessment data from the Ord (1995–2000) confirmed trophy barra (80cm+) holding at 5–7m depth in mid-channel during the run-out phase.",
      },
      {
        minM: 8,
        maxM: 14,
        label: "Deep Holes / Junction Pools",
        species: ["Barramundi (trophy)", "Jewfish", "Sawfish", "Catfish"],
        tideStage: "Slack water, low tide periods",
        technique:
          "Dead-bait (mullet, catfish fillet) on the bottom with a running sinker rig. Or slow-jigged metal at depth. Let the bait sit — jewfish are slow ambushers. Best at low tide slack when fish concentrate in the deepest water.",
        lure: "Dead bait / 80g metal jig, chrome/orange",
        hotness: "warm",
        notes:
          "Deep junction holes at 8–14m where tributaries meet the main Ord channel. These pools were identified in WA Fisheries surveys as major holding areas during extreme low tides in dry season. Sawfish are also occasionally encountered in these deep holes.",
      },
    ],
    historicalNote:
      "The Ord River supported intensive commercial barramundi gill-netting from the late 1960s through to 1985. Commercial operators worked primarily within 20km of the Cambridge Gulf estuary at depths of 2–6m in the main tidal channel. WA Fisheries records document significant commercial harvest from the lower Ord during this period. After commercial netting restrictions were implemented in the mid-1980s, the barra population rebounded strongly. The zones at 2–5m depth in the main tidal channel — where the nets were most effective — remain the most productive sportfishing depths today.",
    nettingHistory: {
      era: "Late 1960s–1985",
      area: "Lower Ord River — Cambridge Gulf to ~20km upstream",
      depthRange: "2–6m (main channel tidal zone)",
      detail:
        "Gill nets set at 2–6m depth, targeting the main tidal channel. Peak commercial effort during the dry season when barra moved into the estuary. WA Fisheries licensing records show multiple commercial operators working this system at peak. After restriction, sport fishing improved dramatically within 3–5 years.",
    },
    proTip:
      "The 90-minute window before first light on a run-in spring tide (new or full moon) below the Diversion Dam wall is considered by Kimberley fishing guides to be the single best barramundi session in WA.",
    lat: -15.7742,
    lng: 128.7300,
  },
  {
    id: "fitzroy",
    name: "Fitzroy River",
    shortName: "Fitzroy R.",
    region: "West Kimberley",
    distanceNote: "580 km from Broome",
    maxDepth: 12,
    access: "Sealed road via Great Northern Hwy to Fitzroy Crossing; boat ramp at Willare",
    bestSeason: "Dry Season May–Aug",
    character:
      "WA's longest Kimberley river. Tidal estuary near King Sound, freshwater above Fitzroy Crossing. Famous for big barra in the lower reaches and crystal-clear dry-season pools in the gorge country. Rugged and remote.",
    zones: [
      {
        minM: 0,
        maxM: 1,
        label: "Surface / Rocky Shoreline",
        species: ["Barramundi", "Saratoga", "Trevally"],
        tideStage: "Dawn and dusk regardless of tide",
        technique:
          "Walk-the-dog surface lure along rock bar edges at first light. Fitzroy River barra in the dry season are particularly responsive to topwater in the clearer mid-river sections.",
        lure: "Shimano Coltsniper Stickbait 110mm, natural sardine",
        hotness: "fire",
        notes:
          "Surface action on the Fitzroy is exceptional in dry season — fish the 0–1m zone over clean rock bottom. Barra in the clear-water sections of the Fitzroy gorge country are highly visual and will chase a well-presented surface lure from 3m below.",
      },
      {
        minM: 1,
        maxM: 4,
        label: "Rock Bar Edges",
        species: ["Barramundi", "Mangrove Jack", "Rock Cod"],
        tideStage: "All tides, best on run-in",
        technique:
          "Cast hardbody parallel to rock ledges. The Fitzroy's barra hold tight to rock structure in the lower tidal reaches. Work the mangrove edge in the lower estuary and rock bars in the mid-river sections.",
        lure: "Hard-body 80–100mm, running 1–3m depth, red/gold",
        hotness: "hot",
        notes:
          "Rock bars at 1–4m depth throughout the lower Fitzroy hold barra and jack year-round. The mid-river sections near Fitzroy Crossing are known for big fish in relatively shallow water during the dry season — the 1–3m zone over rock bottom is most productive.",
      },
      {
        minM: 4,
        maxM: 8,
        label: "Main Channel / Limestone Ledges",
        species: ["Barramundi (large)", "Threadfin Salmon", "Fingermark"],
        tideStage: "Run-out tide, mid to low",
        technique:
          "Slow-troll a deep-diving lure at 5–7m depth along the channel. Target the downstream face of limestone ledges. The Fitzroy's geology creates natural rock bars that concentrate fish at specific tidal stages.",
        lure: "Rapala Deep Tail Dancer 11cm, 5–7m depth, olive/gold",
        hotness: "hot",
        notes:
          "The 4–8m channel zone produces the majority of large-scale barra on the Fitzroy. Charter operations from Willare (2000s) show most trophy barra (90cm+) were caught at 5–7m depth adjacent to submerged limestone outcrops and rock bars during run-out tide.",
      },
      {
        minM: 8,
        maxM: 12,
        label: "Deep Gorge Holes",
        species: ["Barramundi (trophy)", "Jewfish (Mulloway)", "Catfish", "Sawfish"],
        tideStage: "Slack low tide",
        technique:
          "Bait fishing with fresh mullet or whiting on a running sinker at the bottom of deep gorge holes. Lower lures vertically into the hole rather than casting — barra stack tight against the bottom structure in the dry season.",
        lure: "Fresh whole mullet 200–300g on 8/0 circle hook",
        hotness: "warm",
        notes:
          "Deep gorge holes on the Fitzroy River (8–12m) in the gorge country hold trophy barra in the 15–25kg range. The Geikie Gorge system supports a healthy barra population year-round. These deep holes are seldom targeted by sport fishers.",
      },
    ],
    historicalNote:
      "Commercial gill-netting on the Fitzroy River operated in the lower tidal reaches from approximately 1965 to the mid-1980s, when restrictions were gradually implemented. The lower Fitzroy (mouth to 15km upstream) was the primary commercial zone with nets set at 2–7m depth. WA Fisheries data shows the system supported significant commercial barra extraction before recreational pressure increased in the 1990s. After netting restrictions, sport fishing improved substantially and the 2–5m zone remains most productive for recreational anglers today.",
    nettingHistory: {
      era: "1965–mid 1980s",
      area: "Lower Fitzroy River — mouth to ~15km upstream (tidal zone)",
      depthRange: "2–7m (main tidal channel)",
      detail:
        "Nets 100–300m in length set across the tidal channel at 2–7m depth. Season ran April–August (dry season, clearer water). WA Government records confirm the 3–5m zone produced the highest catch-per-unit-effort for barra.",
    },
    proTip:
      "Fitzroy River locals use a lighter leader in the clear mid-river sections (60–80lb instead of 100–130lb) — barra in clearer water are more leader-shy. Worth the risk for more hookups.",
    lat: -18.1930,
    lng: 125.5790,
  },
  {
    id: "drysdale",
    name: "Drysdale River",
    shortName: "Drysdale R.",
    region: "North Kimberley Wilderness",
    distanceNote: "680 km from Broome",
    maxDepth: 10,
    access: "Fly-in to Drysdale River Station or liveaboard cruise — no road access",
    bestSeason: "Dry Season Jun–Sep",
    character:
      "World-class wilderness river system. Remote North Kimberley coast with pristine tidal estuary, mangrove systems, and rock bars. Home to huge barra, jack, threadfin, and GT. Very limited fishing pressure — exceptional catch rates.",
    zones: [
      {
        minM: 0,
        maxM: 1.5,
        label: "Shallow Creek Bends",
        species: ["Mangrove Jack", "Barramundi (small-medium)", "Archer Fish"],
        tideStage: "Incoming tide, first hour",
        technique:
          "Pitch weedless soft plastics into the tight snag pockets on the incoming tide. Mangrove jack in the Drysdale ambush from within 30cm of the snag — accuracy is everything. Fish are unpressured and aggressive.",
        lure: "4-inch grub in blood red or motor oil on 3/0 weedless hook",
        hotness: "fire",
        notes:
          "The Drysdale is renowned for big mangrove jack (up to 6kg+) in extremely shallow snag country. Virtually no fishing pressure means fish are aggressive and willing — a stark contrast to more accessible systems. The 0–1.5m zone fires hardest on the incoming tide at dawn.",
      },
      {
        minM: 1.5,
        maxM: 4,
        label: "Main Creek Channel",
        species: ["Barramundi", "Mangrove Jack", "Rock Cod"],
        tideStage: "Mid-tide both ways",
        technique:
          "Hard body or vibe worked at 1.5–3m depth along the channel. Rock cod sit tight to the bottom structure — use a lure that can tick bottom without snagging. The Drysdale's fish have seen few lures, so presentations that would spook pressured fish work perfectly here.",
        lure: "30g blade vibe in watermelon or smoke",
        hotness: "hot",
        notes:
          "The 1.5–4m zone in Drysdale creek channels holds all the key Kimberley structure species simultaneously. Fish are unconditioned — they respond to almost any reasonable presentation. Operators who have accessed this system report extraordinary catch rates compared to accessible rivers.",
      },
      {
        minM: 4,
        maxM: 8,
        label: "Deep Creek Holes",
        species: ["Barramundi (large)", "Jewfish", "Rock Cod (large)"],
        tideStage: "Low tide, slack water",
        technique:
          "Drop a live bait or heavy soft plastic vertically into the deep holes at low tide. These are small but very fishy holes — don't spook them with heavy anchor drops. Trophy-class barra shelter here at low tide.",
        lure: "Live poddy mullet or 120mm soft plastic paddle tail",
        hotness: "warm",
        notes:
          "Deep holes at creek bends (4–8m) on the Drysdale hold fish that never leave. Local Indigenous communities have fished these specific holes for generations. Due to remote access, these fish are among the least pressured barramundi in Australia.",
      },
    ],
    historicalNote:
      "The Drysdale River has had virtually no commercial fishing history — its extreme remoteness made large-scale netting completely impractical. Traditional Ngarinyin and Wunambal Gaambera custodians have fished this system sustainably for tens of thousands of years. Limited WA Fisheries survey data exists from helicopter-based surveys in the 1990s, which confirmed exceptional barramundi density in the lower tidal reaches. The pristine state of this system today is a direct result of its inaccessibility and the stewardship of its traditional owners.",
    proTip:
      "The Drysdale is a precision fishery — land your lure within 20cm of the snag. Bring weedless gear and accept you'll lose a few. The payoff is big jack and barra in water you can almost touch the bottom of.",
    lat: -14.7490,
    lng: 126.9550,
  },
  {
    id: "cambridge_gulf",
    name: "Cambridge Gulf (Wyndham)",
    shortName: "Camb. Gulf",
    region: "East Kimberley — Wyndham",
    distanceNote: "870 km from Broome",
    maxDepth: 22,
    access: "Sealed road to Wyndham, good public boat ramp",
    bestSeason: "Year-round — species vary by season",
    character:
      "Complex tidal gulf system with deep channels, mangrove edges, and offshore reef. Most accessible Kimberley estuary for Wyndham-based anglers. Excellent barra, jack, threadfin inshore. GT, Spanish mackerel, queenfish offshore. Extreme tidal range creates powerful current — respect the conditions.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Mangrove Edges / Pylons",
        species: ["Barramundi", "Mangrove Jack", "Trevally"],
        tideStage: "Run-in tide, dawn/dusk",
        technique:
          "Cast surface lures along mangrove edges in Cambridge Gulf's arms and channels on incoming tide at first light. Also target the Wyndham jetty pylons with vibes dropped vertically on the run-out.",
        lure: "Surface popper 80mm or 30g blade vibe, chartreuse",
        hotness: "hot",
        notes:
          "The inner gulf edges at 0–2m are productive year-round. The five-river confluence near Wyndham creates exceptional nutrient flow that supports large baitfish populations — and everything that eats them.",
      },
      {
        minM: 2,
        maxM: 6,
        label: "Channel Structure",
        species: ["Barramundi", "Fingermark", "Queenfish"],
        tideStage: "Both tide changes ± 2hrs",
        technique:
          "Fish with a hard-body or 40g metal jig at 2–6m around channel bends, rock outcrops, and tidal current edges. Queenfish and GT stack at the current seams in this zone during the run-out.",
        lure: "40g metal lure, silver/blue",
        hotness: "hot",
        notes:
          "The 2–6m structure zone in Cambridge Gulf holds resident populations of fingermark and barra around navigation markers and submerged rock outcrops. The five rivers draining into the gulf (Ord, Pentecost, King, Durack, Forrest) create a nutrient-rich estuary.",
      },
      {
        minM: 6,
        maxM: 12,
        label: "Deep Channel / Rock Bars",
        species: ["Threadfin Salmon", "Fingermark", "Jewfish"],
        tideStage: "Run-out tide, last 2hrs",
        technique:
          "Bottom bouncing a 60–80g metal jig or running sinker with fresh mullet fillet at 6–10m. Threadfin concentrate where tidal run-out pushes bait schools into the deeper channel edges.",
        lure: "80g jig or whole live garfish",
        hotness: "warm",
        notes:
          "Cambridge Gulf's 6–12m zone is under-fished by sport anglers who focus on the shallower barra zones. The deep channel connecting the five river systems creates a funnel for schooling threadfin and queenfish during the dry season.",
      },
      {
        minM: 12,
        maxM: 22,
        label: "Deep Offshore / Reef",
        species: ["Spanish Mackerel", "GT", "Coral Trout", "Red Emperor"],
        tideStage: "Slack water, spring tides",
        technique:
          "Trolling, casting poppers at GT aggregations, or bottom-fishing with butterfly jigs at 15–20m depth on offshore bomboras outside the gulf entrance. Requires a suitable offshore boat.",
        lure: "Large stickbait 160mm or 80–120g butterfly jig",
        hotness: "hot",
        notes:
          "The offshore Cambridge Gulf zone (12–22m) fires on spring tides when current rips over the limestone pinnacles and bomboras outside the gulf mouth. GT catches from the surface in this zone correspond to 14–18m deep reef structure below.",
      },
    ],
    historicalNote:
      "Cambridge Gulf was commercially netted for barramundi and threadfin salmon from the 1960s through the 1980s, with the five rivers draining into the gulf making it the largest commercial netting area in the Kimberley region. WA Fisheries records document extensive commercial extraction before recreational and indigenous fishing rights were given priority in the late 1980s. The gulf's barra population recovered strongly after restrictions were implemented, and the 2–6m zone over tidal structure remains the most productive sportfishing depth today.",
    nettingHistory: {
      era: "1960s–late 1980s (peak 1972–1985)",
      area: "Cambridge Gulf main channel and river mouths",
      depthRange: "1–8m (inner gulf tidal zone)",
      detail:
        "Large-scale gill netting operations targeting the Cambridge Gulf and lower reaches of all five rivers. Both barra and threadfin were primary commercial targets. WA Fisheries annual reports show Cambridge Gulf as the Kimberley's highest-volume commercial netting area.",
    },
    proTip:
      "Don't overlook the King River and Durack River mouths that feed into Cambridge Gulf — when the dry season runs are on (April–July), these smaller rivers concentrate barra at their mouths at 1–3m depth.",
    lat: -15.4651,
    lng: 128.1069,
  },
  {
    id: "de_grey",
    name: "De Grey River",
    shortName: "De Grey R.",
    region: "Pilbara — Port Hedland",
    distanceNote: "165 km from Port Hedland",
    maxDepth: 8,
    access: "4WD track north of Port Hedland — dry season access only",
    bestSeason: "Dry Season May–Sep",
    character:
      "The Pilbara's main barra river. Tidal estuary with mangrove systems, accessible to Port Hedland anglers. Less well-known than Kimberley systems but holds solid barra, threadfin, and mangrove jack populations. Excellent mud crabbing country.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Mangrove Channel Edges",
        species: ["Barramundi", "Mangrove Jack", "Mud Crab"],
        tideStage: "Run-in tide, dawn and dusk",
        technique:
          "Cast surface or shallow running lures tight to the mangrove edge on the incoming tide. The De Grey's turbid water means barra are less leader-shy than clearer Kimberley systems — you can run heavier gear.",
        lure: "Noisy popper 100mm or soft plastic in chartreuse",
        hotness: "hot",
        notes:
          "The De Grey's tannin-stained water allows fishing with heavier leader (80–100lb) without spooking fish. Surface action in the 0–2m zone at dawn is reliable from May to August. Under-fished relative to its fish holding capacity.",
      },
      {
        minM: 2,
        maxM: 5,
        label: "Mid-Channel Snags",
        species: ["Barramundi", "Threadfin Salmon", "Rock Cod"],
        tideStage: "Mid-tide, strongest current",
        technique:
          "Work submerged snags at 2–5m with a diving minnow or heavy jig. The De Grey's mid-channel snags are packed with fish, particularly in the lower tidal reaches close to the mouth.",
        lure: "110mm deep-diving minnow, black/gold",
        hotness: "fire",
        notes:
          "The 2–5m snag zone is the De Grey's best zone. Pilbara fishing reports consistently describe this system as productive barra water with minimal fishing pressure compared to more accessible Kimberley rivers.",
      },
      {
        minM: 5,
        maxM: 8,
        label: "Main Tidal Channel",
        species: ["Threadfin Salmon", "Jewfish", "Barramundi (large)"],
        tideStage: "Run-out tide, last 2hrs before low",
        technique:
          "Slow-roll a deep-diving lure or bait fish in the 5–7m zone during run-out. Threadfin school in this zone as current concentrates bait fish at the channel edge.",
        lure: "Live mullet or 120mm deep-diver, chrome",
        hotness: "hot",
        notes:
          "The De Grey's deep channel (5–8m) holds threadfin salmon in large schools during the dry season. This species reaches exceptional sizes in the De Grey system — one of the better threadfin rivers on the WA coast.",
      },
    ],
    historicalNote:
      "The De Grey River was lightly commercially netted in the 1970s–80s as part of Pilbara region operations, though at lower intensity than Kimberley rivers. WA Fisheries monitoring in the 1990s confirmed strong barra and threadfin populations in the De Grey system. The river's relative inaccessibility (4WD only access to the mouth) has protected it from heavy recreational pressure, and the fishery remains healthy today.",
    proTip:
      "Croc numbers in the De Grey are significant — exercise the same caution you would on Kimberley rivers. Never wade and keep hands inside the boat when working a hooked fish.",
    lat: -20.1890,
    lng: 119.1690,
  },
  {
    id: "fortescue",
    name: "Fortescue River",
    shortName: "Fortescue R.",
    region: "Pilbara — Onslow/Karratha",
    distanceNote: "240 km from Karratha",
    maxDepth: 8,
    access: "4WD track via Onslow area — remote access",
    bestSeason: "Dry Season May–Aug",
    character:
      "Quieter Pilbara river with good estuary fishing. Less fishing pressure than the De Grey. Good mixed fishery — barra, jack, threadfin, and barramundi all present in the tidal zone. The Fortescue mouth is excellent snapper and reef fish territory offshore.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Shallow Flats / Edges",
        species: ["Barramundi", "Threadfin Salmon", "Bream"],
        tideStage: "Incoming tide, dawn",
        technique:
          "Work surface lures over the shallow flats on the incoming tide. Fortescue barra are less pressured than De Grey fish — more willing to hit any reasonable presentation. The estuary edge at dawn is prime territory.",
        lure: "65mm surface walker, silver/black",
        hotness: "fire",
        notes:
          "The Fortescue system receives a fraction of the fishing pressure of the De Grey. Fish in the 0–2m zone are less educated. Ideal for less experienced barra anglers who want a genuine chance at a quality fish.",
      },
      {
        minM: 2,
        maxM: 5,
        label: "Snag / Channel Zone",
        species: ["Barramundi", "Mangrove Jack", "Rock Cod"],
        tideStage: "Mid-tide both directions",
        technique:
          "Standard Pilbara snag fishing — hard body or vibe worked around submerged timber at 2–4m. Very similar conditions to the De Grey but with fewer boats and less pressured fish.",
        lure: "90mm suspending hard-body, bone white",
        hotness: "hot",
        notes:
          "The Fortescue's 2–5m snag zone is very productive. Low fishing pressure means the fish haven't been conditioned to avoid lures. Catch rates comparable to the De Grey with significantly fewer anglers.",
      },
      {
        minM: 5,
        maxM: 8,
        label: "Deep Holes",
        species: ["Barramundi (large)", "Threadfin", "Jewfish"],
        tideStage: "Low tide, slack water",
        technique:
          "Bait or heavy vibe at the bottom of deep holes at low tide. The Fortescue's deep holes are relatively rarely fished — most anglers only work the shallower zones. Live bait is most effective here.",
        lure: "Fresh bait or 40g metal vibe",
        hotness: "warm",
        notes:
          "Deep holes on the Fortescue have received little research attention but almost certainly hold trophy barra based on adjacent Pilbara river data. The 5–8m zone at low tide slack is worth targeting if you have live bait.",
      },
    ],
    historicalNote:
      "The Fortescue River sits within a largely undeveloped coastal Pilbara corridor and had minimal commercial fishing history — its remote location made it less attractive to commercial operators. Limited Indigenous subsistence fishing occurred historically. WA Fisheries surveys of the lower Fortescue in the early 2000s confirmed it as a quality barra and threadfin system with low exploitation rates.",
    proTip:
      "The Fortescue mouth is at its absolute best in the 2 weeks immediately after the wet season ends (typically late April to mid-May) — fresh water has pushed barra right to the estuary edge and they are in peak condition after feeding all wet season.",
    lat: -21.6500,
    lng: 115.7500,
  },
];
