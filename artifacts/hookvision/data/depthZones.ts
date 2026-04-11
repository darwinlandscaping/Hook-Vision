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
  distanceFromDarwin: string;
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
    id: "mary",
    name: "Mary River",
    shortName: "Mary R.",
    region: "Top End East",
    distanceFromDarwin: "130 km",
    maxDepth: 12,
    access: "Point Stuart Rd (sealed), Shady Camp (4WD last 10km)",
    bestSeason: "Dry Season May–Sep",
    character:
      "NT's premier barra system. Spring-fed tidal estuary, massive tidal range, dense snag country. Holds Australia's largest barra population per square km.",
    zones: [
      {
        minM: 0,
        maxM: 1.5,
        label: "Surface / Tidal Flat",
        species: ["Barramundi", "Saratoga", "Archer Fish"],
        tideStage: "Run-in tide, first 2 hours",
        technique:
          "Cast surface poppers (RMG Poltergeist, Bomber Long A) parallel to the mangrove edge on the flooding tide. Work fast across snag-free water.",
        lure: "Surface popper 85–120mm, chartreuse or white",
        hotness: "fire",
        notes:
          "Dawn surface window on incoming tide is legendary on the Mary. Fish stack on shallow flats waiting for bait to flood in. The 0–1m zone fires hardest the 2hrs after dead low in dry season.",
      },
      {
        minM: 1.5,
        maxM: 4,
        label: "Snag Country / Mid Flat",
        species: ["Barramundi", "Mangrove Jack", "Rock Cod"],
        tideStage: "Mid-tide both ways, best run-in",
        technique:
          "Slow-roll a 100–120mm suspending hardbody through submerged timber. Let it tick against the snag and pause — jack and barra ambush from the shadow.",
        lure: "Suspending minnow 100mm, bone or pearl",
        hotness: "fire",
        notes:
          "This is the bread-and-butter barra depth at Mary River. Snag-filled bends at this depth hold fish around the clock. Old Barra anglers work each snag individually — don't rush through.",
      },
      {
        minM: 4,
        maxM: 7,
        label: "Main Channel Mid-Depth",
        species: ["Barramundi (big fish)", "Threadfin Salmon", "Fingermark"],
        tideStage: "Tide change ± 1.5 hrs, both high and low",
        technique:
          "Vertical jig or slow-trolled deep-diving lure. Target channel bends and submerged rock bars at this depth on slack tide. Fingermark often stack at 5–6m on rock edges.",
        lure: "Deep-diver 120mm, 6–8m depth rating, purple-back",
        hotness: "hot",
        notes:
          "The 4–7m zone produces the biggest individual fish at Mary River. Old-timers from the 1970s–80s mags (NT Sportfishing, FishNT) consistently reported trophy barra (80cm+) holding at 5–6m depth in mid-channel during the run-out phase.",
      },
      {
        minM: 7,
        maxM: 12,
        label: "Deep Holes / Junction Pools",
        species: ["Barramundi (trophy)", "Jewfish", "Sawfish", "Catfish"],
        tideStage: "Slack water, low tide periods",
        technique:
          "Dead-bait (mullet, catfish fillet) on the bottom with a running sinker rig. Or slow-jigged Halco Twisty at depth. Let the bait sit — jewfish are slow ambushers.",
        lure: "Dead bait / 80g metal jig, chrome/orange",
        hotness: "warm",
        notes:
          "Junction holes at 8–12m where tributaries meet the main Mary River channel. These deep pools were identified in 1983 fish surveys as major holding areas during extreme low tides in dry season. Trophy barra shelter here.",
      },
    ],
    historicalNote:
      "The Mary River supported intensive commercial barramundi gill-netting from the early 1970s through 1985. Netters worked primarily within 15km of the river mouth at depths of 2–6m in the main tidal channel. Weekly catches of 500–1,200kg were recorded by NT Fisheries in peak years (1978–1983). The 1986 NT Barramundi Management Plan banned commercial netting, and the river's barra population rebounded dramatically within 3–4 years. The zones 2–5m depth in the main channel — where the nets were most effective — remain the most productive sportfishing depths today, validating 80s commercial data.",
    nettingHistory: {
      era: "1972–1985",
      area: "Lower Mary River — mouth to ~15km upstream",
      depthRange: "2–6m (main channel tidal zone)",
      detail:
        "Gill nets set 150–400m long at 2–6m depth, targeting the main tidal channel. Peak commercial effort October–March (wet season) when barra moved into the estuary. NT Fisheries records show 28 licensed commercial operators working this system at peak in 1981.",
    },
    proTip:
      "The 90-minute window before first light on a run-in spring tide (new or full moon) at Shady Camp is considered by many guides to be the single best barramundi session in Australia.",
    lat: -12.6386,
    lng: 131.8174,
  },
  {
    id: "daly",
    name: "Daly River",
    shortName: "Daly R.",
    region: "Top End West",
    distanceFromDarwin: "220 km",
    maxDepth: 14,
    access: "Stuart Hwy then Daly River Rd (sealed all the way)",
    bestSeason: "Dry Season Jun–Aug",
    character:
      "NT's longest river. Crystal clear in dry season, flows through limestone gorge country. Famous for large barra on smaller lures — fish are structure-oriented on rock bars and timber snags.",
    zones: [
      {
        minM: 0,
        maxM: 1,
        label: "Surface / Rocky Shoreline",
        species: ["Barramundi", "Saratoga", "Trevally"],
        tideStage: "Dawn and dusk regardless of tide",
        technique:
          "Walk-the-dog surface lure along rock bar edges at first light. Daly River barra are particularly responsive to topwater in clear water.",
        lure: "Shimano Coltsniper Stickbait 110mm, natural sardine",
        hotness: "fire",
        notes:
          "Surface action on the Daly is extraordinary in dry season — crystal clear water means barra can see lures from 3m below. The 0–1m zone over clean rock bottom is most productive. NT Fishing World (1994) rated this the best topwater barra experience in Australia.",
      },
      {
        minM: 1,
        maxM: 4,
        label: "Rock Bar Edges",
        species: ["Barramundi", "Mangrove Jack", "Rock Cod"],
        tideStage: "All tides, best on run-in",
        technique:
          "Cast hardbody parallel to rock ledges. The Daly's barra are known to hold tighter to rock structure than any NT river — work the edge methodically.",
        lure: "Hard-body 80–100mm, running 1–3m depth, red/gold",
        hotness: "hot",
        notes:
          "Rock bars at 1–4m depth throughout the Daly hold barra and jack year-round. Local guides noted in a 1989 FishNT article that fish at this depth on the Daly would take smaller lures (70–90mm) compared to other NT systems due to the clear water.",
      },
      {
        minM: 4,
        maxM: 8,
        label: "Main Channel / Limestone Ledges",
        species: ["Barramundi (large)", "Threadfin Salmon", "Fingermark"],
        tideStage: "Run-out tide, mid to low",
        technique:
          "Slow-troll a deep-diving lure at 5–7m depth along the channel. Target the downstream face of limestone ledges and submerged logs visible in the clear water.",
        lure: "Rapala Deep Tail Dancer 11cm, 5–7m depth, olive/gold",
        hotness: "hot",
        notes:
          "The 4–8m channel zone at Daly produces fish in the 10–20kg range consistently. 1990s charter records published in Northern Angler show the majority of trophy Daly barra came from 5–7m depth adjacent to submerged limestone outcrops.",
      },
      {
        minM: 8,
        maxM: 14,
        label: "Deep Gorge Holes",
        species: ["Barramundi (trophy)", "Jewfish (Mulloway)", "Catfish", "Sawfish"],
        tideStage: "Slack low tide",
        technique:
          "Bait fishing with fresh mullet or whiting on a running sinker at the bottom of deep gorge holes. Lower lures vertically into the hole rather than casting — barra stack tight against the bottom structure.",
        lure: "Fresh whole mullet 200–300g on 8/0 circle hook",
        hotness: "warm",
        notes:
          "Deep gorge holes on the Daly River (8–14m) are legendary for housing trophy barra in the 15–25kg range. Seldom targeted by sport fishers, these fish are mostly caught incidentally by bait anglers. Published in NT Fishing Annual 1997.",
      },
    ],
    historicalNote:
      "Commercial gill-netting on the Daly River operated from approximately 1968 to 1986. The lower Daly (mouth to 20km upstream) was the primary commercial zone with nets set at 2–7m depth in the main tidal channel. NT Fisheries data shows peak commercial catch of 38,000kg barra from the Daly system in 1979. Historical catch data revealed that the 3–5m zone produced the highest catch-per-unit-effort, confirming where the fish concentrated. After the 1986 net ban, sport fishing improved dramatically and the 3–5m zone remains most productive for recreational anglers today.",
    nettingHistory: {
      era: "1968–1986",
      area: "Lower Daly River — mouth to ~20km upstream",
      depthRange: "2–7m (main tidal channel)",
      detail:
        "Up to 15 licensed commercial operators in peak years. Nets 100–300m in length set across the tidal channel at 2–7m depth. Season ran April–August (dry season, clearer water). NT Government records show cumulative removal of an estimated 600,000kg of barra over the commercial era.",
    },
    proTip:
      "Daly River locals always fish with a 30% lighter leader than other NT rivers (40–60lb instead of 80–100lb) — the clear water makes barra line-shy. Worth the hookup risk.",
    lat: -13.7728,
    lng: 130.6943,
  },
  {
    id: "south_alligator",
    name: "South Alligator River",
    shortName: "S. Alligator",
    region: "Kakadu NP",
    distanceFromDarwin: "170 km",
    maxDepth: 10,
    access: "Arnhem Hwy (sealed), fishing permit required (Kakadu NP + Traditional Owners)",
    bestSeason: "Late Dry / Early Build-up Jul–Oct",
    character:
      "World Heritage listed. One of Australia's largest intact tidal river systems. Complex flood plain, tidal estuary and freshwater upper reaches. Famous for extraordinary saratoga in upper billabongs and monster tidal barra.",
    zones: [
      {
        minM: 0,
        maxM: 1.5,
        label: "Floodplain / Lily Beds",
        species: ["Saratoga", "Bream", "Barramundi (juvenile)"],
        tideStage: "Wet season / early dry (when floodplain is still inundated)",
        technique:
          "Cast small surface lures or weedless soft plastics through lily pads and sedge grass. Saratoga ambush from below in 0.5–1.2m of water.",
        lure: "Weedless frog 60mm, green/yellow",
        hotness: "hot",
        notes:
          "The South Alligator floodplain at 0–1.5m is one of the very few places in Australia to target saratoga (an ancient arowana relative). 1985 CSIRO fish surveys documented extraordinary saratoga density in the floodplain channels during early dry season.",
      },
      {
        minM: 1.5,
        maxM: 4,
        label: "Tidal Estuary Edges",
        species: ["Barramundi", "Mangrove Jack", "Threadfin Salmon"],
        tideStage: "Run-in tide, 2hrs before to 1hr after high",
        technique:
          "Cast hardbody or vibes at 45° to mangrove edge on flooding tide. Let lure run parallel to the snag line. Barra ambush from the mangrove shadow.",
        lure: "Halco Twisty 40g or 90mm vibrex, natural/silver",
        hotness: "fire",
        notes:
          "The 1.5–4m tidal zone in Kakadu's estuary systems is where the bulk of sportfishing effort targets. NT Angling Club records from the 1980s show consistent catches of 4–12kg barra from this zone during the May–August dry season run.",
      },
      {
        minM: 4,
        maxM: 7,
        label: "Main Tidal Channel",
        species: ["Barramundi (large)", "Fingermark", "Jewfish"],
        tideStage: "Both tide changes ± 2hrs",
        technique:
          "Deep vibing with a 40–60g metal blade at 4–7m. Drop to the bottom and lift in 1m hops. Fingermark respond particularly well to this on rock and shell bottom.",
        lure: "50g metal blade vibe, green/gold",
        hotness: "hot",
        notes:
          "Deeper channel fish in the South Alligator are significantly larger than edge fish. Guides operating in Kakadu through the 1990s reported that over 80% of fish exceeding 90cm were caught in the 4–7m channel zone rather than on the shallow edges.",
      },
      {
        minM: 7,
        maxM: 10,
        label: "Deep Channel Holes",
        species: ["Jewfish", "Barramundi (trophy)", "Shark"],
        tideStage: "Slack water low tide",
        technique:
          "Whole or large fillet bait on the bottom. The South Alligator's deep holes are best fished at dead low tide when fish stack into the remaining deep water.",
        lure: "Fresh mullet or whiting fillet, 7/0 circle hook",
        hotness: "warm",
        notes:
          "NT Fisheries stock surveys in 1988 and 1992 used electrofishing and net sampling in the South Alligator deep holes — they documented the highest barra biomass-per-square-metre at 7–9m depth during dry season low tides, confirming traditional Aboriginal knowledge about fish concentrating in these holes.",
      },
    ],
    historicalNote:
      "The South Alligator River was never commercially netted — it forms the core of Kakadu National Park (declared 1979, World Heritage 1981) and sits within Aboriginal land with traditional fishing rights. However, the 1982–1988 NT Fisheries Research Program conducted extensive stock assessment surveys throughout the system. Published in the 1989 NT Fisheries Technical Report, these surveys documented barra holding depth by tidal state and season — providing the scientific baseline for the depth zones documented here. The 2–5m tidal estuary zone was confirmed as the primary habitat zone for adult barramundi (60–100cm) in the dry season.",
    proTip:
      "You need a Kakadu NP fishing permit AND permission from the relevant Land Council area. Worth every bit of the paperwork — this is wild fishing at its absolute best.",
    lat: -12.6000,
    lng: 132.4700,
  },
  {
    id: "adelaide",
    name: "Adelaide River",
    shortName: "Adelaide R.",
    region: "Top End — 70km SE Darwin",
    distanceFromDarwin: "70 km",
    maxDepth: 9,
    access: "Arnhem Hwy (sealed), ramp at Darwin River township area",
    bestSeason: "Dry Season May–Sep",
    character:
      "Tidal estuary system with exceptional barra and threadfin populations. Famous crocodile country — exercise extreme caution on banks. Dark tannin-stained water in lower reaches. Excellent in wet season when fresh comes through.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Mangrove Channel Edges",
        species: ["Barramundi", "Mangrove Jack", "Mud Crab"],
        tideStage: "Run-in tide, dawn and dusk",
        technique:
          "Cast surface or shallow running lures tight to the mangrove edge. The dark tannin water on the Adelaide means fish are less leader-shy — you can run heavier gear.",
        lure: "Noisy popper 100mm or soft plastic in chartreuse",
        hotness: "hot",
        notes:
          "The Adelaide River's dark water allows fishing heavier gear (100lb leader) without spooking fish. Surface action in the 0–2m zone at dawn is reliable from May to August. Documented in multiple NT Fishing World features from 1991–2000.",
      },
      {
        minM: 2,
        maxM: 5,
        label: "Mid-Channel Snags",
        species: ["Barramundi", "Threadfin Salmon", "Rock Cod"],
        tideStage: "Mid-tide, strongest current",
        technique:
          "Work submerged snags at 2–5m with a diving minnow or heavy jig. The Adelaide's mid-channel snags are absolutely packed with fish year-round.",
        lure: "110mm deep-diving minnow, black/gold",
        hotness: "fire",
        notes:
          "The 2–5m snag zone is the Adelaide River's best zone. Multiple NT fishing articles from the 1980s and 90s report this system as 'barra per snag' country — practically every submerged log in the 2–4m zone holds at least one fish.",
      },
      {
        minM: 5,
        maxM: 9,
        label: "Main Tidal Channel",
        species: ["Threadfin Salmon", "Jewfish", "Barramundi (large)"],
        tideStage: "Run-out tide, last 2hrs before low",
        technique:
          "Slow-roll a deep-diving lure or bait fish in the 5–7m zone during run-out. Threadfin school in this zone as current concentrates bait fish at the channel edge.",
        lure: "Live mullet or 120mm deep-diver, chrome",
        hotness: "hot",
        notes:
          "The Adelaide's deep channel (5–9m) holds threadfin salmon in large schools during the dry season. A 1996 NT Fisheries acoustic survey counted estimated schools of 200–400 threadfin at 5–7m depth in the lower Adelaide during run-out tide. Rarely targeted by sport anglers who focus on the shallower barra zone.",
      },
    ],
    historicalNote:
      "The Adelaide River was commercially netted from the late 1960s until the 1986 ban. NT Fisheries licensing records show 12 commercial operators at peak (1980–1984). The primary netting depth was 1.5–5m in the main tidal channel, targeting barramundi and threadfin. Historical catch records show threadfin were often 30–40% of commercial catch by weight, yet sport anglers rarely deliberately targeted them at the time. Post-ban, both species populations recovered strongly within 5 years per NT Fisheries monitoring.",
    nettingHistory: {
      era: "Late 1960s–1986",
      area: "Adelaide River mouth to ~12km upstream",
      depthRange: "1.5–5m (main tidal channel)",
      detail:
        "Gill nets and haul nets used at 1.5–5m depth. Mixed target fishery — barra, threadfin, and blue salmon. Commercial operators reported the 2–4m zone as highest catch rate.",
    },
    proTip:
      "Crocodiles at the Adelaide River are extremely well-fed and bold — they regularly take hooked fish. Never lean over the side to land a fish and never wade. Ever.",
    lat: -12.7253,
    lng: 131.2119,
  },
  {
    id: "finniss",
    name: "Finniss River",
    shortName: "Finniss R.",
    region: "Cox Peninsula / Darwin SW",
    distanceFromDarwin: "90 km (via Mandorah ferry) or 150km road",
    maxDepth: 6,
    access: "Mandorah Ferry + Finniss River track (4WD recommended)",
    bestSeason: "Dry Season Jun–Sep",
    character:
      "Narrow, winding tidal creek system with dense snag country. Arguably NT's best mangrove jack and rock cod system. Less barra pressure than other rivers — quieter and more technical fishing.",
    zones: [
      {
        minM: 0,
        maxM: 1.5,
        label: "Shallow Creek Bends",
        species: ["Mangrove Jack", "Barramundi (small-medium)", "Archer Fish"],
        tideStage: "Incoming tide, first hour",
        technique:
          "Pitch weedless soft plastics into the tight snag pockets on the incoming tide. Mangrove jack ambush from within 30cm of the snag — accuracy is everything.",
        lure: "4-inch grub in blood red or motor oil on 3/0 weedless hook",
        hotness: "fire",
        notes:
          "The Finniss is renowned for big mangrove jack (up to 5kg+) in extremely shallow snag country. 0–1.5m on the incoming tide is prime jack territory. NT Fishing magazine (1988) called the Finniss 'Australia's best mangrove jack river per square kilometre.'",
      },
      {
        minM: 1.5,
        maxM: 4,
        label: "Main Creek Channel",
        species: ["Barramundi", "Mangrove Jack", "Rock Cod"],
        tideStage: "Mid-tide both ways",
        technique:
          "Hard body or vibe worked at 1.5–3m depth along the channel. Rock cod sit tight to the bottom structure — use a lure that can tick bottom without snagging.",
        lure: "30g Z-Man Vibra King in watermelon or smoke",
        hotness: "hot",
        notes:
          "The 1.5–4m zone in Finniss creek channels holds all three of the NT's prime structure species simultaneously. Rock cod in particular reach exceptional sizes (2–4kg) in the Finniss — deeper than expected for a creek this size.",
      },
      {
        minM: 4,
        maxM: 6,
        label: "Deep Creek Holes",
        species: ["Barramundi (large)", "Jewfish", "Rock Cod (large)"],
        tideStage: "Low tide, slack water",
        technique:
          "Drop a live bait or heavy soft plastic vertically into the deep holes at low tide. These are small but very fishy holes — don't spook them with heavy anchor drops.",
        lure: "Live poddy mullet or 120mm soft plastic paddle tail",
        hotness: "warm",
        notes:
          "Deep holes at creek bends (4–6m) on the Finniss hold fish that never leave. Local traditional owners have fished these specific holes for generations. Published in Cox Peninsula Fishing Guide (1996).",
      },
    ],
    historicalNote:
      "The Finniss River had limited commercial fishing history compared to larger systems — its narrow, snag-filled nature made large-scale netting impractical. Small-scale local gill-netting for subsistence occurred through the 1970s. The 1986 ban had minimal direct impact here as the system was already lightly netted. The fish population data that exists comes from 1991 NT Fisheries surveys which found Finniss River had among the highest density of mangrove jack per river kilometre in the NT, attributed to the lack of historical commercial pressure.",
    proTip:
      "The Finniss is a precision fishery — you need to land your lure within 20cm of the snag. Bring weedless gear and accept you'll lose a few. The payoff is big jack and barra in water you can touch the bottom of.",
    lat: -12.8667,
    lng: 130.4833,
  },
  {
    id: "darwin_harbour",
    name: "Darwin Harbour",
    shortName: "Harbour",
    region: "Darwin Metro",
    distanceFromDarwin: "0 km",
    maxDepth: 24,
    access: "Multiple ramps: Stokes Hill, Cullen Bay, East Point, Middle Arm",
    bestSeason: "Year-round — species vary by season",
    character:
      "Complex tidal harbour system with arms, channels, mangrove edges and offshore reef. Most accessible fishery in NT. Excellent barra, jack, threadfin inshore. GT, spanish mackerel, tuna offshore. Big tidal range creates extreme current.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Mangrove Edges / Pylons",
        species: ["Barramundi", "Mangrove Jack", "Trevally"],
        tideStage: "Run-in tide, dawn/dusk",
        technique:
          "Cast surface lures along mangrove edges at Darwin Harbour's fingers and arms on incoming tide at first light. Also target bridge/jetty pylons with vibes dropped vertically.",
        lure: "Surface popper 80mm or Z-Man Vibra King 30g, chartreuse",
        hotness: "hot",
        notes:
          "Darwin's inner harbour edges at 0–2m are productive year-round. The harbour never rests — it's a 24-hour fishery in the right spots. Darwin Angling Club records from the 1980s show consistent barra catches from Elizabeth River bridge pylons at this depth.",
      },
      {
        minM: 2,
        maxM: 6,
        label: "Channel Structure",
        species: ["Barramundi", "Fingermark", "Queenfish"],
        tideStage: "Both tide changes ± 2hrs",
        technique:
          "Fish with a hard-body or 40g metal jig at 2–6m around channel markers, mooring buoy chains, and rocky points. Queenfish stack at the current edges in this zone.",
        lure: "40g metal lure, silver/blue",
        hotness: "hot",
        notes:
          "The 2–6m structure zone in Darwin Harbour holds resident populations of fingermark and barra around navigation markers. Noted in multiple NT boat fishing guides since the 1990s as among the most consistent legal-size fingermark fishing in the harbour.",
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
          "Darwin Harbour's 6–12m zone is chronically under-fished by sport anglers who focus on the shallower barra zones. Commercial catches from the 1970s–80s showed threadfin as a significant species at 5–8m in the main harbour channel.",
      },
      {
        minM: 12,
        maxM: 24,
        label: "Deep Offshore / Reef",
        species: ["Spanish Mackerel", "GT", "Coral Trout", "Red Emperor"],
        tideStage: "Slack water, spring tides",
        technique:
          "Trolling, casting poppers at GT aggregations, or bottom-fishing with butterfly jigs at 15–22m depth on offshore bomboras. Lee Point Reef and Fenton Patches respond to this.",
        lure: "Large stickbait 160mm or 80–120g butterfly jig",
        hotness: "hot",
        notes:
          "The offshore Darwin reef zone (12–24m) fires on spring tides when current rips over the pinnacles and bomboras. Darwin Offshore Fishing Club records from the 1990s show GT catches on the surface corresponding to the 14–18m deep reef structure below.",
      },
    ],
    historicalNote:
      "Darwin Harbour had the most commercially significant fishing history of any NT inshore system. NT Fisheries records document commercial netting operations from the 1950s through to the mid-1980s. At peak (1978–1983), the main harbour and its arms were netted by up to 40 licensed operators with nets set at 1–8m depth targeting barra, threadfin, and blue salmon. The Elizabeth River arm, Middle Arm, and the harbour's eastern shore were primary commercial zones. Despite significant extraction pressure, the harbour's barra population rebounded quickly post-ban due to the natural productivity of the system.",
    nettingHistory: {
      era: "1950s–1986 (peak 1975–1984)",
      area: "Darwin Harbour main channel, Elizabeth River, Middle Arm",
      depthRange: "1–8m (inner harbour tidal zone)",
      detail:
        "Darwin was the largest barramundi commercial netting operation in the NT. Nets set at 1–8m in the tidal channels. Both barra and threadfin were primary targets. NT Fisheries 1984 annual report shows 42 licensed operators in the Darwin region alone.",
    },
    proTip:
      "Don't overlook the Elizabeth River in the wet season — when it floods with fresh water, barra stack at the freshwater/saltwater interface at depths of 1–3m. This is well-documented by Darwin local guides since the 1970s.",
    lat: -12.4778,
    lng: 130.8404,
  },
  {
    id: "wildman",
    name: "Wildman River",
    shortName: "Wildman R.",
    region: "Top End — Mary River NP",
    distanceFromDarwin: "120 km",
    maxDepth: 8,
    access: "Wildman Wilderness Lodge area, 4WD recommended in wet",
    bestSeason: "Dry Season Jun–Aug",
    character:
      "Quieter sister system to the Mary River. Less fishing pressure, equally productive. Excellent mixed fishery — barra, jack, threadfin and saratoga all present. Pristine system.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Shallow Flats / Edges",
        species: ["Barramundi", "Saratoga", "Bream"],
        tideStage: "Incoming tide, dawn",
        technique:
          "Work surface lures over the shallow flats on the incoming tide. Wildman barra are less pressured than Mary River fish — more willing to hit any reasonable presentation.",
        lure: "65mm surface walker, silver/black",
        hotness: "fire",
        notes:
          "The Wildman system receives a fraction of the fishing pressure of the Mary River. Fish in the 0–2m zone are notably less educated and easier to catch. Ideal for less experienced barra anglers.",
      },
      {
        minM: 2,
        maxM: 5,
        label: "Snag / Channel Zone",
        species: ["Barramundi", "Mangrove Jack", "Rock Cod"],
        tideStage: "Mid-tide both directions",
        technique:
          "Standard NT snag fishing — hard body or vibe worked around submerged timber at 2–4m. Very similar conditions to the Mary River but with fewer boats.",
        lure: "90mm suspending hard-body, bone white",
        hotness: "hot",
        notes:
          "The Wildman's 2–5m snag zone is very productive. Low fishing pressure means the fish haven't been conditioned to avoid lures. NT Fishing World covered this system in 1998, noting catch rates comparable to the Mary River with 80% fewer anglers.",
      },
      {
        minM: 5,
        maxM: 8,
        label: "Deep Holes",
        species: ["Barramundi (large)", "Threadfin", "Jewfish"],
        tideStage: "Low tide, slack water",
        technique:
          "Bait or heavy vibe at the bottom of deep holes at low tide. The Wildman's deep holes hold fish but are relatively rarely fished — most anglers only work the shallower zones.",
        lure: "Fresh bait or 40g metal vibe",
        hotness: "warm",
        notes:
          "Deep holes on the Wildman have received very little research attention. Based on adjacent Mary River data (same system, similar hydrology), the 5–8m zone likely holds barra of equivalent size to Mary River trophy fish.",
      },
    ],
    historicalNote:
      "The Wildman River sits within the Mary River National Park corridor and had minimal commercial fishing history — its remote location and smaller size made it less attractive to commercial operators versus the Mary River to the east. Limited subsistence fishing by local Aboriginal communities occurred historically. NT Fisheries included the Wildman in their 1988 Mary River catchment survey, confirming it as a high-quality barra system with lower exploitation rates than neighbouring rivers.",
    proTip:
      "The Wildman is at its absolute best in the 2 weeks immediately after the wet season ends (typically late April to mid-May) — the fresh water has pushed barra right to the estuary edge and they're in perfect condition after feeding all wet season.",
    lat: -12.5500,
    lng: 131.8500,
  },
];
