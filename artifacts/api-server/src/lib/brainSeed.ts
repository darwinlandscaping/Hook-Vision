/**
 * Brain Knowledge Seed
 * ────────────────────────────────────────────────────────────────────────────
 * Pre-seeds community_reports and brain_videos with expert fishing intelligence
 * for all three HookVision regions: WA (Kimberley/Pilbara), NQ (Far North QLD),
 * and NT (Darwin/Top End).
 *
 * Runs once on server startup via a seeded flag in brain_videos.
 * Each entry is tagged with locationName so the community insights AI can
 * generate rich, region-specific intelligence from real hotspot data.
 */

import { db, communityReports, brainVideos } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger.js";

const SEED_MARKER_TITLE = "__brain_seed_v3__";

// ─── Expert knowledge entries ─────────────────────────────────────────────────

const WA_REPORTS = [
  // Ord River / Lake Kununurra
  { species: "Barramundi", fishCount: 4, depth: "3.5m", locationName: "Ord River, Kununurra", lureSuggestion: "Cast surface poppers tight to fallen timber at first light — barra ambush from structure. Switch to bibless minnow during the retrieve to trigger followers." },
  { species: "Barramundi", fishCount: 2, depth: "5m", locationName: "Ord River, Kununurra", lureSuggestion: "Work rock bars and submerged ledges with slow-sinking hard bodies. Barra hold in the seam between current and slack water on the incoming tide." },
  { species: "Barramundi", fishCount: 6, depth: "4m", locationName: "Lake Kununurra, Ord River", lureSuggestion: "Pre-dawn surface walk-the-dog lures over shallow lily pads. Barra actively feed on the falling tide as water temperature drops below 28°C." },
  { species: "Barramundi", fishCount: 3, depth: "6m", locationName: "Ord River Diversion Dam", lureSuggestion: "Below the dam wall in deep eddies — heavy soft plastics and slow jigs. Trophy fish hold in the thermocline at 6-8m during the heat of the day." },
  { species: "Golden Snapper", fishCount: 5, depth: "12m", locationName: "Cambridge Gulf, WA", lureSuggestion: "Deep jigging with metal slugs over rocky reef. Fingermark (golden snapper) stack at 10-15m on the run-out tide — use a 60g jig with red/orange assist hooks." },
  { species: "Queenfish", fishCount: 8, depth: "1m", locationName: "Cambridge Gulf flats, WA", lureSuggestion: "Fast-retrieve metal slug or surface popper across sand flats. Schools of queenfish chase baitfish balls — match the size of the bait and keep the lure moving." },

  // Fitzroy River / Derby
  { species: "Barramundi", fishCount: 5, depth: "4m", locationName: "Fitzroy River, Derby", lureSuggestion: "Massive tidal influence in the Fitzroy — fish the last hour of the run-in and first hour of run-out around mangrove points. Surface lures at dawn, hardbodies as sun rises." },
  { species: "Barramundi", fishCount: 3, depth: "7m", locationName: "Fitzroy River Crossing, WA", lureSuggestion: "Rock bar below the crossing holds big barra in the run-out. Use a weedless rigged 5-inch soft plastic worked slowly along the bottom at 6-8m depth." },
  { species: "Threadfin Salmon", fishCount: 10, depth: "3m", locationName: "Fitzroy River mouth, WA", lureSuggestion: "Large threadfin gather at the river mouth on the tide change. Cast large spinnerbaits or swim shads — threadfin respond aggressively to fast-moving presentations." },
  { species: "Mangrove Jack", fishCount: 4, depth: "5m", locationName: "King Sound, Derby WA", lureSuggestion: "Mangrove jack tight to the root systems — cast a suspending hardbody right into the timber and pause 3 seconds. The bite comes when the lure suspends motionless." },

  // Broome / Roebuck Bay
  { species: "Coral Trout", fishCount: 3, depth: "18m", locationName: "Roebuck Bay reef, Broome WA", lureSuggestion: "Slow pitch jigging with 80-120g knife jigs over shallow reef. Coral trout stack at 15-22m — drop the jig to bottom then work with short, sharp lifts, allowing the jig to flutter on the fall." },
  { species: "Golden Snapper", fishCount: 7, depth: "22m", locationName: "Broome reef, WA", lureSuggestion: "Berley with pilchards and drop whole pilchard on 4/0 circle hook. Fingermark are aggressive biters on reef structure — golden hour 45 mins after sunrise." },
  { species: "Queenfish", fishCount: 12, depth: "1m", locationName: "Broome boat ramp, WA", lureSuggestion: "Surface popper parallel to the beach at first light. Massive queenfish schools run along Broome beaches — cast past the school and wind back through it fast." },
  { species: "Barramundi", fishCount: 2, depth: "8m", locationName: "Dampier Creek, Broome WA", lureSuggestion: "Barra in Dampier Creek on the rising tide — small to medium fish to 60cm. Soft plastics on light jig heads worked along snag-lined banks produce consistently." },
  { species: "Giant Trevally", fishCount: 4, depth: "2m", locationName: "Broome reef flats, WA", lureSuggestion: "GT patrol reef edges on rising tide — cast a large popper or stickbait 5m ahead and work it fast. GT attacks from below so keep the lure on the surface at all times." },

  // Dampier / Exmouth
  { species: "Coral Trout", fishCount: 6, depth: "25m", locationName: "Dampier Archipelago, WA", lureSuggestion: "Deep vibing (50-80g) over bommy reef. Coral trout and red emperor congregate at Dampier Archipelago ledges — key depth band 20-30m on the dropping tide." },
  { species: "Spanish Mackerel", fishCount: 5, depth: "15m", locationName: "Exmouth Gulf, WA", lureSuggestion: "Troll a mackerel lure at 7-9 knots over bait schools. Spanish mackerel run Exmouth Gulf July-September — use a wire trace and high-speed trolling lure in silver or blue." },
  { species: "Giant Trevally", fishCount: 3, depth: "5m", locationName: "Exmouth Gulf, WA", lureSuggestion: "Poppers and stickbaits around the Exmouth Navy Pier on the run-out. GTs use the pier pylons as ambush points — cast along the structure and retrieve parallel." },
  { species: "Barramundi", fishCount: 2, depth: "3m", locationName: "Harding River, Roebourne WA", lureSuggestion: "Harding River barra are seasonal — best in the wet season run-off (Jan-Mar). Surface lures at dawn over shallow rock bars produce solid fish to 85cm." },
  { species: "Threadfin Salmon", fishCount: 8, depth: "4m", locationName: "De Grey River, WA", lureSuggestion: "De Grey River threadfin on the incoming tide — schools work the tidal flats hard. Use large spinnerbaits or vibration blades in gold/chartreuse and work them fast across the flat." },

  // Kimberley Coast
  { species: "Coral Trout", fishCount: 5, depth: "20m", locationName: "Horizontal Falls, Kimberley WA", lureSuggestion: "Current rips at Horizontal Falls concentrate predators. Jig-fishing on the edge of the rip with 60-80g metals produces coral trout, queenfish and GT simultaneously." },
  { species: "Giant Trevally", fishCount: 6, depth: "3m", locationName: "Montgomery Reef, Kimberley WA", lureSuggestion: "Montgomery Reef on the spring low — GTs trap baitfish in the fast-draining shallows. Cast surface lures parallel to the reef edge and retrieve fast with erratic pauses." },
  { species: "Barramundi", fishCount: 4, depth: "5m", locationName: "Prince Regent River, Kimberley WA", lureSuggestion: "Remote wilderness barra in pristine habitat. Surface poppers and stickbaits at first light around freshwater meets tidal — these fish are aggressive and rarely see lures." },
  { species: "Queenfish", fishCount: 15, depth: "2m", locationName: "Talbot Bay, Kimberley WA", lureSuggestion: "Massive queenfish schools in Talbot Bay during tidal exchanges. Metal slugs cast into feeding frenzies — these fish are acrobatic fighters and fantastic sport on light gear." },
];

const NQ_REPORTS = [
  // Gulf of Carpentaria / Weipa / Cape York
  { species: "Barramundi", fishCount: 6, depth: "4m", locationName: "Norman River, Gulf of Carpentaria", lureSuggestion: "Norman River barra are world-class — fish rock bars and snag lines on the run-out tide. Large bibless minnows in gold produce fish to 1.1m on the right moon phase." },
  { species: "Barramundi", fishCount: 4, depth: "3m", locationName: "Mitchell River, Cape York QLD", lureSuggestion: "Remote Mitchell River — surface lures at dawn over lily pads. Barra are ultra-aggressive in pristine systems. Pop a 75mm popper across the flat and hold on." },
  { species: "Barramundi", fishCount: 8, depth: "5m", locationName: "Archer River, Cape York QLD", lureSuggestion: "Archer River — fish the tidal influence zone with suspending hardbodies. Mid-run tide is peak time. Look for the seam between clear run-off water and tidal murk." },
  { species: "Barramundi", fishCount: 5, depth: "3.5m", locationName: "Holroyd River, Cape York QLD", lureSuggestion: "Holroyd River barra tight to snag lines on the incoming tide. Use a weedless 5-inch soft plastic rigged on a 3/8oz jig head — slow roll along the timber structure." },
  { species: "Barramundi", fishCount: 3, depth: "6m", locationName: "Weipa boat ramp, Cape York QLD", lureSuggestion: "Weipa boat ramp area produces barra year-round. Rock bars at the ramp hold fish on the run-out — soft plastics and slow-sinking minnows in olive/gold." },
  { species: "Barramundi", fishCount: 7, depth: "4m", locationName: "Wenlock River, Cape York QLD", lureSuggestion: "Wenlock River — the wet season (Jan-Apr) run-off brings giant barra into the upper reaches. Surface lures and large stickbaits for trophy fish above the salt limit." },

  // Cairns / Tropical North QLD Coast
  { species: "Barramundi", fishCount: 4, depth: "5m", locationName: "Barron River, Cairns QLD", lureSuggestion: "Barron River below the dam holds resident barra year-round. Fish the morning tide change with medium hardbodies — barra hold in the tailwaters and ambush food washing through." },
  { species: "Barramundi", fishCount: 3, depth: "7m", locationName: "Mulgrave River, Cairns QLD", lureSuggestion: "Mulgrave River barra on the run-out tide below the tidal limit. Bibless minnows in the 80-120mm range cast across current and retrieved with short pauses at 5-8m depth." },
  { species: "Mangrove Jack", fishCount: 6, depth: "4m", locationName: "Trinity Inlet, Cairns QLD", lureSuggestion: "Trinity Inlet — massive resident population of mangrove jack. Cast suspending minnows right into the mangrove roots and twitch aggressively. Jack hit hard and fast — strike immediately on the bite." },
  { species: "Queenfish", fishCount: 10, depth: "2m", locationName: "Cairns Esplanade, QLD", lureSuggestion: "Queenfish school in Trinity Bay visible from the Esplanade. Metal slugs and small poppers early morning — they surface-feed on whitebait schools in the shallows." },
  { species: "Giant Trevally", fishCount: 4, depth: "8m", locationName: "Cairns reef, QLD", lureSuggestion: "Giant trevally on the outer reef edges — slow pitch jigging with 60-80g knife jigs at 10-15m depth. GTs ambush smaller fish on the reef slope on the incoming tide." },

  // Townsville / North QLD Coast
  { species: "Barramundi", fishCount: 5, depth: "4m", locationName: "Ross River, Townsville QLD", lureSuggestion: "Ross River impoundment barra — hardbody minnows in natural baitfish colours worked along submerged timber. Fish concentrate on submerged creek channels at 4-6m depth." },
  { species: "Coral Trout", fishCount: 4, depth: "20m", locationName: "Magnetic Island, Townsville QLD", lureSuggestion: "Coral trout at Magnetic Island on slow pitch jig. Reef ledges at 18-25m produce solid fish — use 60g knife jig with a red/orange skirt and let it flutter on the fall." },
  { species: "Queenfish", fishCount: 8, depth: "1m", locationName: "Pallarenda Beach, Townsville QLD", lureSuggestion: "Queenfish run the beach at Pallarenda — surface poppers and metal slugs in the surf zone. Early morning fish, best on small to medium neap tides when bait concentrates." },
  { species: "Mangrove Jack", fishCount: 5, depth: "6m", locationName: "Bohle River, Townsville QLD", lureSuggestion: "Bohle River jack on the tide change — cast 110mm suspending minnows into undercut snag banks. Jack hit fastest in the last of the light — be ready for the lure to be smashed on first contact." },

  // Saratoga / Jungle Perch / Freshwater NQ
  { species: "Saratoga", fishCount: 3, depth: "2m", locationName: "Lake Tinaroo, Atherton Tablelands QLD", lureSuggestion: "Saratoga patrol lily pad edges at Tinaroo — surface lures and weedless frog presentations. Fish tight to the vegetation edge in the early morning and late afternoon." },
  { species: "Saratoga", fishCount: 4, depth: "1.5m", locationName: "Tully River, QLD", lureSuggestion: "Tully River saratoga in the rainforest section — cast small surface lures under overhanging trees. Saratoga take surface presentations aggressively and jump spectacularly." },
  { species: "Jungle Perch", fishCount: 6, depth: "1m", locationName: "Mossman River, Cairns QLD", lureSuggestion: "Jungle perch in the crystal-clear Mossman River — small poppers and surface lures in pockets between boulders. These fish are fast strikers; use a loop knot for maximum lure action." },
  { species: "Jungle Perch", fishCount: 4, depth: "1.5m", locationName: "Daintree River, QLD", lureSuggestion: "Daintree River jungle perch — ultra-clear water requires stealth. Light 4-6lb line with small hard bodies cast into fast runs and pools. Exceptional sport on ultralight gear." },

  // Gulf Barramundi Season Knowledge
  { species: "Barramundi", fishCount: 10, depth: "3m", locationName: "Karumba, Gulf of Carpentaria QLD", lureSuggestion: "Karumba is the barramundi capital of Queensland — fish the creek mouths at tide change with large bibless minnows. Wet season aggregations can produce 20+ fish in a session." },
  { species: "Threadfin Salmon", fishCount: 12, depth: "4m", locationName: "Gilbert River, Gulf QLD", lureSuggestion: "Gilbert River threadfin — massive schools in the estuary on run-in tide. Large gold spinnerbaits at 3-4m depth as bait schools push in with the tide." },
];

const NT_REPORTS = [
  // Mary River / Shady Camp (iconic NT barra)
  { species: "Barramundi", fishCount: 8, depth: "4m", locationName: "Shady Camp Rock Bar, Mary River NT", lureSuggestion: "Shady Camp Rock Bar is the most famous barra spot in Australia. Fish the rock bar on the run-out tide — surface lures at first light, bibless minnows once the sun is up. Trophy fish regularly exceed 1m here." },
  { species: "Barramundi", fishCount: 5, depth: "3m", locationName: "Mary River, Shady Camp NT", lureSuggestion: "Mary River billabong system — barra pack into the narrows on the tide change. Target the first hour of the incoming tide with surface walk-the-dog lures. Key tip: CROC COUNTRY — never wade, always fish from the boat." },
  { species: "Barramundi", fishCount: 6, depth: "5m", locationName: "Mary River Crossing, NT", lureSuggestion: "Below the Mary River Crossing — deep barra hold in the tailwater. Slow rolling a 5-inch soft plastic at 4-6m depth along the rock wall produces fish to 95cm." },
  { species: "Saratoga", fishCount: 4, depth: "2m", locationName: "Corroboree Billabong, Mary River NT", lureSuggestion: "Corroboree Billabong — iconic location with massive saratoga and barra. Surface lures over lily pads at dawn — extraordinary fishery in a spectacular setting. Croc awareness essential." },
  { species: "Barramundi", fishCount: 7, depth: "3.5m", locationName: "Blyth Homestead, Mary River NT", lureSuggestion: "Blyth Homestead reach — excellent barra year-round. Fish the incoming tide from midway to full with bibless minnows in natural colours along the far bank snag lines." },

  // Daly River
  { species: "Barramundi", fishCount: 5, depth: "4m", locationName: "Daly River, NT", lureSuggestion: "Daly River produces some of Australia's biggest barra. Fish rock bars and submerged ledges on the run-out tide. Large bibless minnows and slow jigs at 4-8m — fish the bottom third of the water column for giants." },
  { species: "Barramundi", fishCount: 3, depth: "6m", locationName: "Daly River Mouth, NT", lureSuggestion: "Daly River mouth — snapper and barra on the tide change. Deep rock structure at 5-8m holds big fish. Slow pitch jig or heavy soft plastic worked along the bottom." },
  { species: "Barramundi", fishCount: 9, depth: "3m", locationName: "Douglas Hot Springs, NT", lureSuggestion: "Daly/Douglas system in the wet season — barra push into the upper freshwater on the floods. Surface lures and large stickbaits in the fast water below rapids produce explosive strikes." },
  { species: "Mangrove Jack", fishCount: 5, depth: "5m", locationName: "Daly River lower estuary, NT", lureSuggestion: "Mangrove jack in the Daly estuary mangroves — cast suspending hard bodies tight to the aerial root systems. Jack ambush from the roots so the lure needs to land within 30cm of the bank." },

  // Adelaide River / Darwin Harbour
  { species: "Barramundi", fishCount: 4, depth: "5m", locationName: "Adelaide River, Darwin NT", lureSuggestion: "Adelaide River barra on the run-out tide — huge CROC population so fish from boat only. Soft plastics and bibless minnows over rock bars. Pre-dawn surface lures produce the biggest fish." },
  { species: "Queenfish", fishCount: 10, depth: "2m", locationName: "Darwin Harbour, NT", lureSuggestion: "Darwin Harbour queenfish on the tide change — cast metal slugs parallel to the breakwall. Schools work the breakwall from the Stokes Hill Wharf to Fishermen's Wharf at first light." },
  { species: "Barramundi", fishCount: 6, depth: "4m", locationName: "Darwin Harbour barge channel, NT", lureSuggestion: "Darwin Harbour barge channel holds resident barra on all tidal phases. Fish with 120mm suspending minnows worked slowly through the current. Best fish typically 60-80cm." },
  { species: "Giant Trevally", fishCount: 5, depth: "3m", locationName: "Darwin Harbour entrance, NT", lureSuggestion: "GT patrol Darwin Harbour entrance on the incoming tide. Poppers and stickbaits along the rocky points — GTs school at channel edges and ambush bait pushed in by the tide." },
  { species: "Spanish Mackerel", fishCount: 4, depth: "15m", locationName: "Darwin Shoal, NT", lureSuggestion: "Spanish mackerel on the Darwin Shoal April-October — troll Halco Laser Pro 160 at 7 knots over bait school marks. Wire trace essential; run 2-3 lures at different depths." },

  // Finniss River / Daly Basin
  { species: "Barramundi", fishCount: 7, depth: "3m", locationName: "Finniss River, NT", lureSuggestion: "Finniss River — remote, pristine barra country. Surface lures at dawn produce aggressive fish. Spectacular fishery; guide recommended for first-timers. Strong croc presence — never leave the boat." },
  { species: "Barramundi", fishCount: 5, depth: "5m", locationName: "Reynolds River, NT", lureSuggestion: "Reynolds River on the spring tides — barra stack in the river mouth narrows. Large bibless minnows on the run-out tide, surface lures on the top of the tide around snag timber." },
  { species: "Saratoga", fishCount: 6, depth: "1.5m", locationName: "Edith River, NT", lureSuggestion: "Edith River saratoga — crystal-clear freshwater above the tidal influence. Small surface lures and soft plastics in pockets below rapids. Saratoga are sight-feeders; stealth is essential." },
  { species: "Barramundi", fishCount: 4, depth: "4m", locationName: "Wildman River, NT", lureSuggestion: "Wildman River barra on the tide change — excellent access via the Wildman Wilderness Lodge. Rock bars at the tidal limit hold resident fish; work surface lures first, then switch to subsurface." },

  // Roper River / Gulf NT
  { species: "Barramundi", fishCount: 6, depth: "5m", locationName: "Roper River, NT", lureSuggestion: "Roper River — iconic barra destination in the Gulf Country. Fish the run-out tide over rock bars with large bibless minnows. The freshwater/saltwater interface is the key zone — barra stack here through the dry season." },
  { species: "Barramundi", fishCount: 8, depth: "3m", locationName: "McArthur River, NT", lureSuggestion: "McArthur River barra in the Gulf — run-out tide produces best results. Stickbaits and surface poppers at dawn; switch to subsurface bibless minnows as the sun rises. Fish concentrate below rocky ledges." },
  { species: "Threadfin Salmon", fishCount: 10, depth: "4m", locationName: "Limmen Bight, NT Gulf", lureSuggestion: "Limmen Bight threadfin salmon — massive schools on the tidal flats. Large spinnerbaits and swim shads at 3-5m depth on the incoming tide. Excellent indicator species — where threadfin are, barra are close." },
];

// ─── Brain Video (expert intelligence entries) ─────────────────────────────

const EXPERT_BRAIN_VIDEOS = [
  // WA Regional Intelligence
  {
    title: "WA Kimberley Barra Intel — Dry Season Rock Bar Pattern",
    description: "Expert analysis: During the WA dry season (Apr-Sep), barramundi stack on rock bars and submerged ledges in tidal rivers. The key trigger is the run-out tide — fish feed aggressively as prey concentrate in thinning water. Bibless minnows in gold/olive at 3-6m produce the most consistent results. Trophy fish above 90cm are most active in the hour before sunrise.",
    brainInsight: "Dry season WA barra follow a predictable rock bar ambush pattern. Run-out tide + first light + natural colours = highest catch rate. Big fish (>90cm) prefer the deeper side of rock bars at 5-8m.",
    detectedSpecies: ["Barramundi", "Golden Snapper", "Threadfin Salmon"],
    depthRanges: ["3-6m rock bars", "5-8m deep side", "1-2m shallow flat"],
    aiTips: [
      "Fish run-out tide over rock bars in the Kimberley — most productive 2hrs before low tide",
      "Pre-dawn surface lures produce the biggest dry-season barra in tidal rivers",
      "Bibless minnows in gold/olive outperform bright colours in clear Kimberley water",
      "Deep side of rock bars (5-8m) holds trophy barra in the heat of the day",
    ],
  },
  {
    title: "WA Kimberley Tidal Intelligence — King Sound Spring Tides",
    description: "King Sound near Derby has the second-largest tidal range in the world at 11-12m. These extreme tides completely transform the fishing. On spring tides, fish the edges of rapidly draining tidal flats where predators trap baitfish in shrinking water. Neap tides are best for creek fishing. Mangrove jack, barramundi and threadfin all peak in the last 2 hours of the run-out.",
    brainInsight: "King Sound extreme tides (up to 12m) create exceptional fishing in brief windows. Spring tide run-outs concentrate bait on flats. Target creek mouths on the last 2hrs of run-out for barra, jack and threadfin.",
    detectedSpecies: ["Barramundi", "Mangrove Jack", "Threadfin Salmon", "Queenfish"],
    depthRanges: ["0.5-2m tidal flat", "3-5m creek mouth", "1-3m mangrove fringe"],
    aiTips: [
      "Plan around King Sound tides — fish last 2hrs run-out for best barra action",
      "Spring tides drain flats fast, concentrating bait and predators",
      "Creek mouths are prime spots as fish pour out with the run-out flow",
      "Neap tides suit creek interior fishing — more stable water levels",
    ],
  },
  {
    title: "WA Broome Mackerel Run — July to September",
    description: "Spanish mackerel run the Broome coast July-September, following the baitfish migration. Trolling with high-speed lures at 7-9 knots over bait schools is the primary technique. Key areas: The Bommie, Eclipse Ridge, 12-Mile Reef. Correct wire trace (49-strand, 60lb+) is essential. Surface trolling at dawn produces the biggest fish. Fish the tide change for best results.",
    brainInsight: "Broome mackerel run July-Sep: troll Halco Laser Pro 160 or Rapala X-Rap over bait school marks at 7-9 knots. 60lb wire trace essential. Eclipse Ridge and 12-Mile Reef are key marks.",
    detectedSpecies: ["Spanish Mackerel", "Coral Trout", "Giant Trevally"],
    depthRanges: ["10-25m reef structure", "surface trolling layer", "2-5m bait school"],
    aiTips: [
      "Troll at 7-9 knots for mackerel — slower speeds attract reef fish but miss mac strikes",
      "60lb 49-strand wire trace is mandatory — mackerel teeth slice monofilament instantly",
      "Eclipse Ridge and 12-Mile Reef are the premium Broome mackerel marks July-Sep",
      "Match lure to bait size — 160mm profiles produce the biggest fish",
    ],
  },

  // NQ Regional Intelligence
  {
    title: "NQ Gulf Barra Intelligence — Wet Season Flood Pattern",
    description: "The Gulf of Carpentaria wet season (Nov-Apr) triggers massive barramundi aggregations in river systems. As flood waters recede, barra concentrate in the lower estuary sections. The key pattern is targeting the fresh/salt water interface as it migrates downstream. Norman River, Archer River and Wenlock River all follow this pattern. Fish transition from lily pad flats to rock bars as water drops.",
    brainInsight: "Gulf NQ wet season barra follow the receding fresh/salt interface downstream. As floods drop, fish concentrate at estuary constrictions and rock bars. March-April is the peak 'post-flood' window for trophy fish.",
    detectedSpecies: ["Barramundi", "Saratoga", "Mangrove Jack", "Threadfin Salmon"],
    depthRanges: ["2-4m estuary", "3-6m river channel", "1-2m flood flat"],
    aiTips: [
      "Post-flood March-April = prime Gulf barra time as fish stack in retreating estuary",
      "Target the fresh/salt interface with bibless minnows — fish this zone hard at tide change",
      "Surface lures dawn and dusk; switch to subsurface mid-morning as fish drop deeper",
      "Saratoga stay in freshwater above the tidal limit — work lily pad edges with surface lures",
    ],
  },
  {
    title: "NQ Cairns Region Intelligence — Tidal Creek Mangrove Jack",
    description: "Trinity Inlet and surrounding tidal creeks hold a resident population of mangrove jack year-round. The key is fishing right in the mangrove roots, not beside them. Use suspending 100-110mm hard bodies cast so they land within 30cm of the root system. Jack hit fastest in low-light periods and on the change of tide. Berley with crushed prawns activates dormant fish in the system.",
    brainInsight: "Cairns mangrove jack need lures in the roots, not beside them. 100-110mm suspending minnows, cast to within 30cm of roots, twitch aggressively. Berley with crushed prawns activates fish. Tide change and low light = peak bite time.",
    detectedSpecies: ["Mangrove Jack", "Barramundi", "Queenfish"],
    depthRanges: ["2-5m tidal creek", "1-3m mangrove fringe", "4-7m channel edge"],
    aiTips: [
      "Cast within 30cm of mangrove roots — jack will not move far to take a lure",
      "Suspending minnows that pause in the strike zone are 3x more effective than sinking lures",
      "Berley with crushed prawns/pilchards activates dormant jack in tidal creeks",
      "Fish the last 2hrs of run-in tide around mangrove points for consistently best jack action",
    ],
  },
  {
    title: "NQ Saratoga Intelligence — Lily Pad Ambush Hunters",
    description: "Saratoga are ambush hunters that lurk beneath lily pads in NQ freshwater systems. Lake Tinaroo, Tully River and Barron River all hold excellent populations. The critical technique is a silent approach by electric motor, casting small surface lures or frogs to the edge of the lily mat and letting them sit for 3-5 seconds before twitching. Saratoga often miss on the first strike — wait for the second hit before setting the hook.",
    brainInsight: "Saratoga hunting pattern: ambush from lily pad shadow. Silent approach, cast to lily edge, pause 3-5 seconds before twitching. Wait for second strike before hook-set. Surface lures and weedless frogs are most effective.",
    detectedSpecies: ["Saratoga", "Barramundi", "Jungle Perch"],
    depthRanges: ["0.5-2m under lily pads", "1-3m open water", "shallow reef flat"],
    aiTips: [
      "Approach saratoga water silently — use electric motor, minimise noise and splash",
      "Let lure sit 3-5 seconds at lily pad edge before twitching — imitate a wounded baitfish",
      "Wait for second strike to set the hook — saratoga often miss the first hit",
      "Weedless frog presentations work best in thick pad mats where other lures snag",
    ],
  },

  // NT Regional Intelligence
  {
    title: "NT Mary River Intelligence — Shady Camp Rock Bar Trophy Barra",
    description: "Shady Camp Rock Bar on the Mary River is Australia's most famous barramundi location. Trophy fish (90cm+) are caught regularly. The rock bar produces best on the run-out tide from 2hrs before low water. Surface lures at first light are the specialist technique — 130-180mm walk-the-dog lures worked slowly over the rock bar. Fish the current seam on the downstream edge of the bar. EXTREME croc risk — never lean over the gunwale.",
    brainInsight: "Shady Camp: run-out tide + first light + 150mm walk-the-dog lure = trophy barra. Fish downstream edge of rock bar in current seam. CRITICAL: saltwater croc density is extreme here — strict boat-only fishing, no wading, no leaning over gunwale.",
    detectedSpecies: ["Barramundi", "Saratoga", "Mangrove Jack"],
    depthRanges: ["2-4m rock bar", "4-7m deep pool", "1-2m tail of bar"],
    aiTips: [
      "Fish downstream edge of Shady Camp rock bar in the current seam for trophy barra",
      "Walk-the-dog surface lures 130-180mm at first light on the run-out produce giants",
      "CROC ALERT: Never wade, lean over gunwale or trail hands in the Mary River",
      "Arrive before dawn for the best surface bite window — it's narrow but exceptional",
    ],
  },
  {
    title: "NT Darwin Harbour Intelligence — Tide-Driven Predator Patterns",
    description: "Darwin Harbour holds year-round populations of barramundi, queenfish, GTs and mangrove jack. The 7-8m tidal range creates very specific fishing windows. Queenfish school around the breakwall and Cullen Bay marina on tide changes. GTs patrol the harbour entrance on the incoming tide. Barra concentrate below the barge channel markers from mid to top of tide. Mangrove jack occupy the East Arm mangroves on the incoming tide only.",
    brainInsight: "Darwin Harbour productivity is entirely tide-driven. Queenfish = breakwall tide change. GTs = harbour entrance incoming tide. Barra = barge channel mid-high tide. Jack = East Arm mangroves incoming. Match species to correct tide phase.",
    detectedSpecies: ["Queenfish", "Giant Trevally", "Barramundi", "Mangrove Jack"],
    depthRanges: ["0-3m surface zone", "3-6m mid water", "5-9m barge channel"],
    aiTips: [
      "Darwin Harbour: match species to tide phase — each species has its own peak window",
      "Queenfish: breakwall and Cullen Bay marina at tide changes with metal slugs",
      "GT: harbour entrance on incoming tide with surface poppers and stickbaits",
      "Barra: barge channel markers mid to high tide with suspending 120mm minnows",
    ],
  },
  {
    title: "NT Crocodile Safety Intelligence — Fishing in Croc Country",
    description: "The NT is home to the world's highest density of saltwater crocodiles. Shady Camp, Mary River, Adelaide River, Daly River and Finniss River all have very high croc populations. Key safety rules: 1) Never wade or bank fish — always fish from boat. 2) Stay 5m from water's edge. 3) Don't trail hands or feet over the gunwale. 4) Be aware at dawn, dusk and at night when crocs are most active. 5) Crocs can lunge from the water without warning. 6) Dead fish and berley attract crocs — dispose cleanly.",
    brainInsight: "NT croc safety is life-critical. HIGH-RISK: Mary River, Adelaide River, Daly River, Finniss River, Shady Camp. ALWAYS fish from boat. NEVER wade, bank fish or trail limbs over gunwale. Dawn/dusk = highest croc activity. Clean disposal of berley and fish scraps.",
    detectedSpecies: ["Saltwater Crocodile"],
    depthRanges: ["all depth zones — crocs patrol from 0-5m"],
    aiTips: [
      "CROC RULE #1: Never wade in any NT tidal river — saltwater crocs are ambush predators",
      "CROC RULE #2: Stay 5m from the water's edge when on banks — crocs can lunge fast",
      "CROC RULE #3: Don't trail hands, feet or fish over the gunwale",
      "Dawn, dusk and night fishing = elevated croc activity — maintain highest vigilance",
    ],
  },
  {
    title: "NT Roper River Intelligence — Remote Gulf Barra Country",
    description: "The Roper River in the NT Gulf Country offers exceptional remote barra fishing. The fresh/salt interface moves dramatically with seasonal floods. Dry season (May-Oct): fish the lower Roper at rock bars and holes on the run-out tide. Wet season (Nov-Apr): access restricted but barra push into the upper freshwater reaches. Key spots: Roper Bar crossing, Nathan River junction, Limmen Bight River confluence.",
    brainInsight: "Roper River: dry season fish lower Roper rock bars on run-out tide. Key marks: Roper Bar crossing, Nathan River junction. Large bibless minnows at 4-7m. Wet season upper freshwater access only — surface lures for post-spawn giants.",
    detectedSpecies: ["Barramundi", "Threadfin Salmon", "Queenfish"],
    depthRanges: ["4-7m rock bars", "2-4m run-out flat", "8-12m deep hole"],
    aiTips: [
      "Roper Bar crossing is the premier Roper River access point — fish the downstream rock bar",
      "Run-out tide produces best barra action — fish the last 2hrs as the current peaks",
      "Large bibless minnows (100-150mm) in gold produce consistent Roper fish",
      "Threadfin salmon aggregate at the Roper mouth on spring tides — excellent sport on light gear",
    ],
  },
];

// ─── Seeding function ─────────────────────────────────────────────────────────

export async function seedBrainKnowledge(): Promise<void> {
  // Check if already seeded by looking for the marker entry
  try {
    const existing = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(brainVideos)
      .where(eq(brainVideos.title, SEED_MARKER_TITLE));

    if ((existing[0]?.count ?? 0) > 0) {
      logger.info("Brain knowledge seed: already seeded, skipping.");
      return;
    }
  } catch (err) {
    logger.warn({ err }, "Brain seed check failed — skipping seed");
    return;
  }

  logger.info("Brain knowledge seed: starting expert knowledge population...");

  const allReports = [
    ...WA_REPORTS.map(r => ({ ...r, region: "WA" })),
    ...NQ_REPORTS.map(r => ({ ...r, region: "NQ" })),
    ...NT_REPORTS.map(r => ({ ...r, region: "NT" })),
  ];

  let reportsAdded = 0;
  let videosAdded = 0;

  // Seed community reports in batches of 20
  for (let i = 0; i < allReports.length; i += 20) {
    const batch = allReports.slice(i, i + 20);
    try {
      await db.insert(communityReports).values(
        batch.map(r => ({
          species:       r.species,
          fishCount:     r.fishCount,
          depth:         r.depth,
          locationName:  r.locationName,
          lureSuggestion: r.lureSuggestion,
          rawAnalysis: {
            sourceType: "expert_seed",
            region:     r.region,
            confidence: 95,
          } as unknown as Record<string, unknown>,
        }))
      );
      reportsAdded += batch.length;
    } catch (err) {
      logger.warn({ err, batch: i }, "Brain seed: report batch failed");
    }
  }

  // Seed expert brain videos (intelligence entries)
  for (const v of EXPERT_BRAIN_VIDEOS) {
    try {
      await db.insert(brainVideos).values({
        title:           v.title,
        description:     v.description,
        durationSecs:    null,
        frameCount:      0,
        videoUri:        null,
        status:          "done" as const,
        brainInsight:    v.brainInsight,
        detectedSpecies: v.detectedSpecies,
        depthRanges:     v.depthRanges,
        aiTips:          v.aiTips,
        processedAt:     new Date(),
      });
      videosAdded++;
    } catch (err) {
      logger.warn({ err, title: v.title }, "Brain seed: video entry failed");
    }
  }

  // Write the seed marker so we don't re-seed on next restart
  try {
    await db.insert(brainVideos).values({
      title:        SEED_MARKER_TITLE,
      description:  `Seed v3 completed: ${reportsAdded} expert reports + ${videosAdded} brain intel entries`,
      status:       "done" as const,
      frameCount:   0,
      processedAt:  new Date(),
    });
  } catch { /* ignore — marker is non-critical */ }

  logger.info(
    { reportsAdded, videosAdded },
    `Brain knowledge seed complete: ${reportsAdded} expert reports + ${videosAdded} regional intelligence entries added`
  );
}
