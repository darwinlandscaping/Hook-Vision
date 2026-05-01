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

const SEED_MARKER_TITLE = "__brain_seed_v4__";

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

// ─── Species Knowledge Base ───────────────────────────────────────────────────
// Comprehensive biology, sizes, ages, legal limits, and fishing intelligence
// for all target species across Australia, Asia, and the Nile perch system.

const SPECIES_KNOWLEDGE_ENTRIES = [

  // ── BARRAMUNDI / LATES CALCARIFER ──────────────────────────────────────────
  {
    title: "Species Intel — Barramundi (Lates calcarifer) Biology & Size Data",
    description: "Barramundi / Asian Sea Bass. Scientific name: Lates calcarifer (Bloch 1790). Family Latidae. Protandrous hermaphrodite — ALL fish born male, transition to female at 50-70cm TL (typically 3-5 years old). Maximum recorded: 1.8m / 60kg. Common target range: 50-120cm, 3-15kg. Lifespan: up to 20 years. Physostomous swim bladder — produces the brightest sonar arch signature of any tropical fish (90-95% of acoustic backscatter from bladder). Dark shadow void beneath arch is diagnostic. LEGAL SIZE BY STATE: QLD minimum 58cm, max possession 120cm (slot limit). NT minimum 55cm. WA: varies by zone — inland rivers 55cm minimum, coastal 50cm. BAG LIMITS: QLD 5/day (only 1 over 120cm). NT 5/day. WA 5/day. SPAWN: Oct-Mar (wet season). Males aggregate near river mouths, females release eggs on spring tide run-outs. Eggs and larvae transported upstream with flood waters. Post-spawn: fish return to freshwater/estuarine habitat. GROWTH RATE: 40cm in year 1, 55-65cm by year 2, 70-85cm year 3, 90cm+ by year 5. All fish >80cm are FEMALE.",
    brainInsight: "Barramundi are protandrous hermaphrodites — all big fish (>80cm) are female. Physostomous swim bladder creates the brightest, most distinctive sonar arch. QLD slot limit: 58-120cm. NT/WA minimum 55cm. Peak spawn Oct-Mar on spring tide run-outs at river mouths.",
    detectedSpecies: ["Barramundi", "Lates calcarifer", "Asian Sea Bass", "Giant Sea Perch"],
    depthRanges: ["0-2m surface at spawn", "3-8m holding structure", "1-4m feeding flat"],
    aiTips: [
      "All barra >80cm are female — handle carefully and consider catch-and-release for trophy fish",
      "QLD slot limit: keep 58-120cm only — fish over 120cm must be released",
      "Physostomous swim bladder = brightest sonar arch + dark shadow void beneath = diagnostic",
      "Spawn runs Oct-Mar: barra aggregate at river mouths on spring tide run-outs",
      "Year 2 fish are ~60cm, year 5 are ~90cm — consider age when deciding to keep",
    ],
  },

  // ── NILE PERCH / LATES NILOTICUS ───────────────────────────────────────────
  {
    title: "Species Intel — Nile Perch (Lates niloticus) Global Data",
    description: "Nile Perch: Lates niloticus. Same family as barramundi (Latidae) — close cousin. Distribution: Nile River basin (Egypt, Sudan, Ethiopia, Uganda, Kenya, Tanzania), Lake Victoria, Lake Tanganyika, Lake Albert, Lake Turkana, Lake Chad, Congo River. INTRODUCED to Lake Victoria 1954 — now largest population globally. Maximum size: 2m / 200kg (Lake Nasser record). Common target: 60-150cm, 10-50kg. Lake Victoria commercial fishing: primary target 40-80cm for fillet export. ACOUSTIC SIGNATURE: similar to barramundi — physostomous swim bladder produces strong sonar arch, typically larger and denser than barra arch due to larger body mass. FISHING: Lake Victoria — trolling deep-diving minnows at 8-15m along thermocline. Lake Nasser (Egypt) — jigging near dam structures 20-40m. White Nile (Uganda) — surface lures and live bait near rapids. ECOLOGY: apex predator, highly territorial, responsible for extinction of 200+ Lake Victoria cichlid species. Can be detected on sonar as very large single arches at 8-25m depth.",
    brainInsight: "Nile perch (Lates niloticus): close cousin to barramundi. Up to 2m/200kg in Lake Victoria. Physostomous bladder = strong sonar arch like barra but larger. Lake Victoria troll 8-15m for 10-50kg fish. Lake Nasser: jig 20-40m near dam structures. Apex predator — introduced 1954 to Lake Victoria.",
    detectedSpecies: ["Nile Perch", "Lates niloticus"],
    depthRanges: ["8-15m thermocline (Lake Victoria)", "20-40m deep (Lake Nasser)", "2-8m rapids zone (White Nile)"],
    aiTips: [
      "Nile perch on Lake Victoria: troll deep-diving minnows at 8-15m along thermocline for 10-50kg fish",
      "Lake Nasser (Egypt): heavy jigging (80-120g metals) near dam walls at 20-40m produces giants",
      "Nile perch sonar signature: very large physostomous arch at 8-25m, similar to barra but denser",
      "White Nile in Uganda: surface lures and live bait near rapids produce aggressive strikes",
      "Lake Victoria night fishing: Nile perch come shallow (2-5m) to feed after dark",
    ],
  },

  // ── ASIAN SEA BASS — INTERNATIONAL GROUNDS ─────────────────────────────────
  {
    title: "Species Intel — Asian Sea Bass International Distribution & Fishing",
    description: "Lates calcarifer (barramundi/siakap) global range: India (Kerala, Karnataka, Goa, Andhra Pradesh — kelongs and coastal estuaries); Bangladesh (Sundarbans mangroves, tidal rivers); Myanmar (Irrawaddy delta); Thailand (Gulf of Thailand kelongs, Mekong tributaries, river systems); Vietnam (Mekong Delta, Perfume River, Con Dao); Malaysia (Johor Bahru kelongs, Sarawak rivers, Sabah estuaries); Singapore (reservoir barramundi, kelong fishing, Johor Strait); Indonesia (Kalimantan rivers, Papua estuaries, Sumatra coastal); Philippines (Manila Bay, Pampanga River); PNG (Fly River, Sepik River). SINGAPORE TECHNIQUE: kelong barramundi (siakap) use live bait and large pilchards under the kelong lights at night — fish aggregate under artificial light to feed on attracted bait. MALAYSIA: Sarawak kelongs and Sabah mangrove rivers produce large wild siakap on 5-7inch soft plastics. THAILAND: Mekong barramundi on live bait and large minnows — trophy fish to 120cm in deep river pools. INDIA: Kerala backwaters — siakap on spinning lures and live prawn near mangrove systems.",
    brainInsight: "Barramundi/siakap distribution: India to PNG, including all SE Asian nations. Singapore kelong technique: live bait under lights at night. Malaysia (Sarawak/Sabah): 5-7 inch soft plastics in mangrove rivers. Thailand: large minnows/live bait in deep Mekong pools. Same species as Australian barra — identical biology, identical sonar signature.",
    detectedSpecies: ["Asian Sea Bass", "Lates calcarifer", "Siakap", "Barramundi"],
    depthRanges: ["0-3m kelong shallows (Singapore)", "3-8m river channel (Thailand/Vietnam)", "5-15m estuary deep (Malaysia)"],
    aiTips: [
      "Singapore kelong barramundi: live bait (pilchards, small fish) under kelong lights at night — very effective",
      "Malaysia Sarawak: 5-7 inch soft plastics in mangrove channels, morning and evening tides",
      "Thailand Mekong pools: large bibless minnows or live bait drifted through deep (8-15m) pools",
      "India Kerala backwaters: live prawn on float rig near mangrove root systems at dusk",
      "Identical biology to Australian barra — sonar arch signature is the same globally",
    ],
  },

  // ── CORAL TROUT ────────────────────────────────────────────────────────────
  {
    title: "Species Intel — Coral Trout (Plectropomus leopardus & spp.)",
    description: "Coral Trout / Leopard Coral Trout: Plectropomus leopardus. Primary target species on Australian reefs. Maximum size: 120cm / 25kg. Common target: 35-70cm, 1-5kg. Lifespan: 16+ years. LEGAL SIZE: QLD 38cm minimum, bag limit 7/day. WA: 38cm minimum, bag limit 4/day. NT: 38cm minimum, bag limit 5/day. Great Barrier Reef coral trout spawning aggregations: November to January. HABITAT: Coral reef structures, ledges, and bommies at 5-40m depth. Ambush predator — holds at reef edge and ambushes passing fish. SONAR SIGNATURE: holds tight to reef structure — often appears as single arch just above reef bottom signal. TECHNIQUE: Slow pitch jigging with 40-80g knife jigs most effective. Vertical jigging over known reef structures. Bottom fishing with whole pilchards on 4/0 circle hook. COLOUR: blue/red dots on body (leopard pattern). Often confused with common trout but distinguishable by blue-rimmed black spots. Barred-tail variant (Plectropomus maculatus) also common in NQ — same fishing techniques.",
    brainInsight: "Coral trout: 38cm minimum in all states. Slow pitch jig 40-80g over reef structure at 10-40m. Ambush predator holds tight to reef edge — sonar shows single arch just above bottom return. Great Barrier Reef spawning Nov-Jan. Bag limits: QLD 7, WA 4, NT 5 per day.",
    detectedSpecies: ["Coral Trout", "Plectropomus leopardus", "Leopard Coral Trout", "Barred-tail Coral Trout"],
    depthRanges: ["10-20m shallow reef", "20-40m mid reef", "40-60m deep reef (large fish)"],
    aiTips: [
      "Coral trout: slow pitch jig (40-80g knife jig) over reef structure is most productive technique",
      "Minimum 38cm in QLD/WA/NT — measure carefully before keeping, bag limits are strict",
      "Sonar: single arch sitting tight to reef bottom structure = likely coral trout holding position",
      "Spawning aggregations on Great Barrier Reef Nov-Jan — consider catch-and-release in these months",
      "Two species: Plectropomus leopardus (leopard pattern) and P. maculatus (barred tail) — same fishing",
    ],
  },

  // ── QUEENFISH ──────────────────────────────────────────────────────────────
  {
    title: "Species Intel — Queenfish (Scomberoides commersonnianus & spp.)",
    description: "Queenfish (Giant Queenfish): Scomberoides commersonnianus. Maximum size: 120cm / 14kg. Common target: 60-90cm, 2-8kg. Also: Needlescaled Queenfish (S. tol) and Doublespotted Queenfish (S. lysan) — both smaller but more abundant. No minimum size or bag limit in most Australian states — catch and release encouraged for large fish. DISTRIBUTION: Northern Australia coast, Indo-Pacific from Red Sea to PNG. HABITAT: Open coastal waters, estuaries, reef edges, tidal flats. Pelagic schooling fish — often visible as surface commotion chasing bait schools. SONAR SIGNATURE: School appears as dense cloud of arches at surface layer 0-5m, individual fish show as fast-moving arches. High swim bladder reflectivity. TECHNIQUE: Metal slugs (30-60g) cast into surface commotion and retrieved fast. Surface poppers. Any fast-moving lure works — queenfish are aggressive, not selective. FIGHTING QUALITY: spectacular jumpers, multiple aerial leaps — excellent sportfish on light tackle.",
    brainInsight: "Queenfish: three species (Giant/Needlescaled/Doublespotted). No bag limit in most states. Metal slugs 30-60g or surface poppers — retrieve FAST. School on surface shows as dense arch cloud at 0-5m on sonar. Spectacular aerial fighters — excellent light tackle sportfish. Indo-Pacific distribution.",
    detectedSpecies: ["Queenfish", "Giant Queenfish", "Scomberoides commersonnianus"],
    depthRanges: ["0-5m surface school", "5-15m deeper scatter", "0-2m tidal flat"],
    aiTips: [
      "Queenfish: no size or bag limit in most states — but release large breeders",
      "Metal slugs 30-60g are the #1 lure — cast into the school and retrieve as fast as possible",
      "Sonar: dense arch cloud at 0-5m = queenfish school — they are always near the surface",
      "Spectacular aerial fighters — use light 6-10lb gear for maximum sport",
      "Look for birds diving over bait schools — queenfish pushing bait up are almost always underneath",
    ],
  },

  // ── GIANT TREVALLY ─────────────────────────────────────────────────────────
  {
    title: "Species Intel — Giant Trevally (Caranx ignobilis)",
    description: "Giant Trevally (GT): Caranx ignobilis. The apex predator of tropical reef systems. Maximum recorded: 170cm / 80kg. Common target: 60-120cm, 10-35kg. Lifespan: 24+ years. No minimum size limit, bag limit 5/day in most Australian states. DISTRIBUTION: Red Sea, Indo-Pacific, Hawaiian Islands, Northern Australia. HABITAT: Reef edges, channel entrances, pinnacles, lagoon channels. SONAR SIGNATURE: Large single arch or small group of arches near reef structure or surface. Extremely bright sonar return due to large swim bladder mass. TECHNIQUE: Large surface poppers (130-170mm, 40-80g) and stickbaits are the primary technique. Cast to visible GT or to known GT territory (reef edges, pinnacles). Fast, erratic surface presentation. Heavy gear required — GT run to reef immediately on strike: 80lb+ braid, PE 6-8. BEHAVIOUR: Often seen patrolling reef edges in pairs or small groups. Will charge surface at speed — 'GTs don't eat, they attack'. Moon phases: full and new moon = peak surface activity at dawn/dusk.",
    brainInsight: "Giant Trevally: up to 170cm/80kg. Large surface poppers (130-170mm) and stickbaits with 80lb+ braid essential. GT run to reef immediately — use heavy tackle. Full/new moon at dawn/dusk = peak surface activity. Large bright sonar arch near reef edge. No size limit, bag limit 5/day.",
    detectedSpecies: ["Giant Trevally", "GT", "Caranx ignobilis"],
    depthRanges: ["0-5m surface strike zone", "5-20m reef edge patrol", "20-40m deep reef pinnacle"],
    aiTips: [
      "GT requires heavy tackle: PE 6-8 braid (80lb+), short heavy leader — they run to reef immediately",
      "Large surface poppers 130-170mm at 40-80g: cast to GT territory and retrieve erratically at speed",
      "Full and new moon peak activity windows at dawn and dusk — plan GT sessions around moon phases",
      "Sonar: single large bright arch near reef edge at 5-20m = likely GT on patrol",
      "GT are sight hunters — cast 5m ahead of the fish and retrieve before it loses interest",
    ],
  },

  // ── THREADFIN SALMON ───────────────────────────────────────────────────────
  {
    title: "Species Intel — Threadfin Salmon (Polydactylus sheridani & P. macrochir)",
    description: "King Threadfin Salmon: Polydactylus macrochir. Blue Threadfin: Polydactylus sheridani. Maximum size (King Threadfin): 180cm / 45kg. Common target: 80-130cm, 5-20kg. Blue threadfin maximum: 100cm / 8kg. LEGAL SIZE: QLD minimum 60cm (King), 40cm (Blue). NT minimum 60cm. WA minimum 60cm. BAG LIMIT: QLD 5/day, NT 5/day. DISTRIBUTION: Northern Australia coast, Gulf of Carpentaria, WA coast. Tidal estuaries, river mouths, sandy tidal flats. SONAR SIGNATURE: School appears as scattered oval arches at 2-6m depth over tidal flats. Individual fish show distinctive elongated arch. Very bright sonar return. TECHNIQUE: Large gold/silver spinnerbaits (3/4 oz+), vibes, and metal slugs. Cast into schools on tidal flats at 2-5m depth. Threadfin respond to fast, aggressive retrieves. SEASONAL: Wet season aggregations (Nov-Apr) at river mouths — massive schools. FEATURE: Four free-hanging pectoral ray filaments — diagnostic. Often found schooling with barra in tidal rivers.",
    brainInsight: "King Threadfin: up to 180cm/45kg. QLD/NT/WA minimum 60cm, bag limit 5/day. Gold/silver spinnerbaits cast into tidal flat schools at 2-5m. Sonar: scattered oval arches at 2-6m over flat. Wet season (Nov-Apr) river mouth aggregations = best fishing. Four free-hanging pectoral filaments = diagnostic.",
    detectedSpecies: ["Threadfin Salmon", "King Threadfin", "Polydactylus macrochir", "Blue Threadfin"],
    depthRanges: ["2-5m tidal flat school", "3-7m river mouth", "1-3m shallow run-out"],
    aiTips: [
      "King threadfin minimum 60cm in QLD/NT/WA — blue threadfin 40cm in QLD",
      "Gold spinnerbaits (3/4oz) cast into tidal flat schools — threadfin hit aggressively",
      "Wet season (Nov-Apr): massive threadfin schools at river mouths — best of year",
      "Sonar shows scattered oval arches at 2-6m over sandy flat = threadfin school signature",
      "Often mixed with barra in tidal rivers — if you catch threadfin, target barra in the same area",
    ],
  },

  // ── MANGROVE JACK ──────────────────────────────────────────────────────────
  {
    title: "Species Intel — Mangrove Jack (Lutjanus argentimaculatus)",
    description: "Mangrove Jack (Jack, Red Bream): Lutjanus argentimaculatus. Maximum size: 120cm / 20kg. Common target: 30-60cm, 1-5kg. Lifespan: 30+ years. LEGAL SIZE: QLD minimum 35cm. NT minimum 35cm. WA minimum 28cm. BAG LIMIT: QLD 7/day. NT 5/day. WA 10/day. DISTRIBUTION: Red Sea to Samoa — Northern Australia coast, SE Asia, India. HABITAT: Mangrove root systems, submerged timber, reef structures. Juvenile fish in freshwater/estuarine mangroves; adults move to offshore reef. SONAR SIGNATURE: Single arch positioned very close to structure — jack hold in snags and rarely move into open water. Moderate sonar return. TECHNIQUE: Suspending or slow-sinking minnows (80-120mm) cast into the timber — within 30cm of the root system. Jack attack from the structure; lure must be in the strike zone. BEHAVIOUR: Extremely aggressive — will smash any lure that enters territory. But EXTREMELY structure-oriented — rarely move >1m to take a lure. Strong initial run into timber. Monofilament leader 30-40lb recommended.",
    brainInsight: "Mangrove jack: minimum 35cm in QLD/NT, 28cm WA. Suspending minnow MUST land within 30cm of mangrove roots — jack won't move to it. Single arch tight to structure on sonar. 30-40lb leader essential — they run straight into timber on strike. Lifespan 30+ years — large fish are old breeders.",
    detectedSpecies: ["Mangrove Jack", "Lutjanus argentimaculatus", "Red Bream"],
    depthRanges: ["2-6m mangrove fringe", "4-8m submerged timber", "10-25m adult reef (large fish)"],
    aiTips: [
      "Mangrove jack lure MUST land within 30cm of root system — fish won't move more than 1m to strike",
      "Minimum 35cm (QLD/NT) — large jack >60cm are 10+ year old breeders, consider release",
      "30-40lb fluorocarbon leader: jack run straight to timber on hook-up — lighter leaders get cut",
      "Suspending minnows that pause motionless in the strike zone are 3x more effective than sinking",
      "Low-light periods (dawn/dusk) and tide changes trigger the most aggressive jack strikes",
    ],
  },

  // ── SARATOGA ───────────────────────────────────────────────────────────────
  {
    title: "Species Intel — Saratoga (Scleropages jardinii & S. leichardtii)",
    description: "Northern Saratoga: Scleropages jardinii (NQ, NT, WA Kimberley). Southern Saratoga / Spotted Barramundi: Scleropages leichardtii (SE QLD). Closely related to Asian Arowana (S. formosus) — same family, ancient lineage (300 million year old family). Maximum size: Northern 90cm / 7kg. Southern 60cm / 4kg. Lifespan: 15+ years. LEGAL SIZE: QLD minimum 38cm (saratoga). NT: no minimum size. HABITAT: Freshwater lakes, rivers, lily pad systems, billabongs. ABOVE: Saratoga are the ONLY species that breathe air and are regularly seen at the surface — this is a key identification feature. Mouthbrooder — female holds eggs and juveniles in mouth. SONAR SIGNATURE: Surface/near-surface arch (0-2m). Very bright return due to large abdominal air space. TECHNIQUE: Surface lures and weedless frog presentations over lily pads. Silent approach (electric motor). Cast to lily pad edge, pause 3-5 seconds. Wait for second strike. DISTRIBUTION: Northern Saratoga extends into Papua New Guinea, Java, Borneo, Southeast Asia.",
    brainInsight: "Northern Saratoga: NQ/NT/WA Kimberley rivers and billabongs. Minimum 38cm (QLD). Ancient lineage (same family as Asian Arowana). Surface/near-surface on sonar (0-2m), bright arch. Surface lures and weedless frogs over lily pads — pause 3-5 sec. WAIT for second strike before hook-set. Mouthbrooder.",
    detectedSpecies: ["Saratoga", "Scleropages jardinii", "Northern Saratoga", "Spotted Barramundi"],
    depthRanges: ["0-2m surface and lily pads", "1-3m open water", "under vegetation"],
    aiTips: [
      "Saratoga minimum 38cm QLD — ancient species (300 million year lineage), handle with care",
      "Wait for the SECOND strike before setting the hook — saratoga often miss first bite",
      "Surface lures work best: pause 3-5 seconds at lily pad edge, then gentle twitch",
      "Sonar: very bright arch at 0-2m = saratoga (or barramundi at surface — check habitat for ID)",
      "Asian Arowana (S. formosus) is close relative — same tactics work in SE Asian rivers",
    ],
  },

  // ── JUNGLE PERCH ───────────────────────────────────────────────────────────
  {
    title: "Species Intel — Jungle Perch (Kuhlia rupestris) & Freshwater Species",
    description: "Jungle Perch: Kuhlia rupestris (Rock Flagtail). Australia's fastest freshwater fish in terms of strike speed. Maximum size: 40cm / 1.5kg. Common target: 20-35cm. DISTRIBUTION: NQ rainforest streams (Mossman, Daintree, Tully, Atherton Tablelands, Cape York), NT freshwater streams, northern WA, Indonesia, PNG, Pacific Islands. HABITAT: Crystal-clear fast-flowing rainforest streams and rivers, above tidal influence, rocky pools and runs. SONAR: Poor sonar signature in turbulent, rocky streams — visible as small single arch in pools. Best located visually. TECHNIQUE: Ultralight gear (2-4lb), small surface lures (30-50mm poppers), soft plastics and small streamers in pools and runs. STEALTH: Approach upstream, cast downstream. Jungle perch are ultra-wary in clear water — any noise or shadow spooks them. SEASON: Best in dry season when water is clearest. No closed season. LEGAL SIZE: QLD no minimum, NT no minimum. CONSERVATION: Declining species in some systems — catch and release recommended. Also in this family: Five-spot Archerfish (Toxotes chatareus) — shoots insects from branches, edible, found in same habitat as jungle perch.",
    brainInsight: "Jungle perch: NQ/NT rainforest streams, clear water above tidal limit. Ultralight 2-4lb gear, small 30-50mm surface lures. Ultra-wary — approach silently upstream. Rocky pools in dry season = best. Declining in some systems — practice C&R. Also present: Archerfish (Toxotes chatareus) in same habitat.",
    detectedSpecies: ["Jungle Perch", "Kuhlia rupestris", "Rock Flagtail", "Archerfish"],
    depthRanges: ["0.5-2m rocky pool", "fast water run (0-1m)", "pool tail-out"],
    aiTips: [
      "Jungle perch: approach silently from UPSTREAM and cast downstream — any disturbance spooks them",
      "Ultralight 2-4lb gear with small 30-50mm surface poppers in rocky pools",
      "Clear water species — no berley, no noise, minimise silhouette over the water",
      "Dry season is best — water is clearest and fish are most concentrated in pools",
      "Catch and release: jungle perch are declining in some NQ streams — important to release",
    ],
  },

  // ── FINGERMARK / GOLDEN SNAPPER ────────────────────────────────────────────
  {
    title: "Species Intel — Fingermark / Golden Snapper (Lutjanus johnii)",
    description: "Fingermark / Golden Snapper: Lutjanus johnii. Maximum size: 80cm / 8kg. Common target: 35-60cm, 1-4kg. Lifespan: 26+ years. LEGAL SIZE: QLD minimum 35cm. NT minimum 35cm. WA minimum 28cm. BAG LIMIT: QLD 7/day. NT 5/day. WA 10/day (combined snapper). DISTRIBUTION: Northern Australia coast, Indo-Pacific. HABITAT: Reef structures, rocky outcrops, deeper tidal channels. More pelagic than mangrove jack — found on reef at 10-30m. SONAR SIGNATURE: Moderate-bright arch at 8-25m near reef or rocky structure. Schools of smaller fish show as multiple arches. TECHNIQUE: Pilchards or whole prawns on 3/0 circle hook at 10-20m depth. Slow jigging (30-50g metals) over reef. Fingermark respond to berley — crushed pilchards in berley pot. COLOUR: Bronze/golden flanks, diagnostic black spot above lateral line on juveniles. Adult fish lose spot — sometimes confused with other Lutjanus species. COOKING: Considered the finest table fish in northern Australia — firm white flesh.",
    brainInsight: "Fingermark/Golden Snapper: minimum 35cm QLD/NT, 28cm WA. Reef structure at 10-30m. Pilchards on 3/0 circle hook with berley most effective. Sonar: moderate-bright arch at 8-25m near rock/reef. 26+ year lifespan — release large fish. Finest table fish in northern Australia.",
    detectedSpecies: ["Fingermark", "Golden Snapper", "Lutjanus johnii"],
    depthRanges: ["10-20m reef structure", "20-30m deeper reef", "5-10m tidal channel"],
    aiTips: [
      "Fingermark minimum 35cm QLD/NT — 26 year lifespan means big fish are very old",
      "Berley with crushed pilchards activates fingermark — drift pilchard whole on 3/0 circle hook",
      "Sonar: moderate-bright arch at 10-25m near rocky structure = likely fingermark",
      "Schools of sub-legal fish show as multiple arches — move to find legal fish",
      "Outstanding table fish — but please release fish over 60cm (these are 15+ year breeders)",
    ],
  },

  // ── SPANISH MACKEREL ───────────────────────────────────────────────────────
  {
    title: "Species Intel — Spanish Mackerel (Scomberomorus commerson)",
    description: "Spanish Mackerel (Spotted Mackerel, Narrow-barred Spanish Mackerel): Scomberomorus commerson. Maximum size: 240cm / 70kg. Common target: 80-140cm, 5-20kg. Lifespan: 12+ years. LEGAL SIZE: QLD minimum 75cm. NT minimum 75cm. WA minimum 75cm. BAG LIMIT: QLD 5/day. NT 10/day. WA 5/day. DISTRIBUTION: Northern Australia, Red Sea to Philippines. HABITAT: Pelagic — open water, near bait schools, reef edges. SONAR: Fast-moving elongated arches or dense schools of elongated targets at 5-30m near bait marks. Very high sonar return. TECHNIQUE: Trolling at 6-9 knots with high-speed lures (Halco Laser Pro 160, Rapala X-Rap 16). WIRE TRACE MANDATORY — 49-strand 60lb wire. Spanish mackerel teeth sever monofilament instantly. Live bait trolling (garfish, yellowtail scad) very effective. SEASON: Broome (WA) Jul-Sep. NQ coast: all year, peak May-Sep. NT: April-October. SPEED: Key — mackerel are attracted to fast-moving prey. Trolling speed below 6 knots often results in no strikes.",
    brainInsight: "Spanish mackerel: minimum 75cm all states, bag limit 5-10/day. 49-strand 60lb wire trace MANDATORY — teeth sever mono instantly. Troll 6-9 knots with Halco Laser Pro 160 or X-Rap 16. Pelagic — sonar shows fast elongated arches near bait schools at 5-30m. WA peak Jul-Sep, NQ all year, NT Apr-Oct.",
    detectedSpecies: ["Spanish Mackerel", "Scomberomorus commerson", "Mackerel"],
    depthRanges: ["5-15m near bait schools", "15-30m deep run", "surface strike zone"],
    aiTips: [
      "Spanish mackerel: 49-strand 60lb wire trace is NON-NEGOTIABLE — mono is cut on first contact",
      "Minimum 75cm all states — measure before keeping, penalties are significant",
      "Troll at 6-9 knots: below 6 knots the lure action is wrong and mackerel lose interest",
      "Sonar: fast-moving elongated arch or dense school at 5-30m near bait = mackerel",
      "Peak season varies by region: WA (Broome) Jul-Sep, NQ all year, NT Apr-Oct",
    ],
  },

  // ── SONAR BRAND KNOWLEDGE ──────────────────────────────────────────────────
  {
    title: "Sonar Brand Intelligence — Lowrance, Garmin, Humminbird, Simrad, Deeper",
    description: "SONAR BRAND VISUAL SIGNATURES for AI identification: LOWRANCE (HDS Live, Ghost, Elite Ti2): Warm red/orange palette. Arches appear brown-red on orange background. Strong contrast. SideScan CHIRP shows very defined arch separation. GARMIN (Echomap Plus, Ultra, Livescope): Cool blue/purple palette. Crisp arch definition. Livescope (live sonar) shows near-real-time arch movement — fish appear as small moving dots. Blue-green background with bright white arches. HUMMINBIRD (Helix, Solix, Apex): Teal-green background. MEGA Live and MEGA Imaging — ultra-high definition. Arches appear as small dense bright dots on teal. Split-screen mode common. SIMRAD (GO9, NSS, NSX): Similar to Garmin (both Navico group). Blue/grey palette, clean arch definition. DEEPER Smart Sonar (Bluetooth): Mobile-first, semicircular display, colour bands, less arch definition — suited for freshwater fish finding rather than arch analysis. RAYMARINE (Axiom, Dragonfly): Dark blue palette, good arch definition. IMPORTANT: Colour palette is the fastest sonar brand ID feature. Warm red = Lowrance; cool blue = Garmin/Simrad; teal-green = Humminbird.",
    brainInsight: "Sonar brand ID: warm red/orange = Lowrance; cool blue/purple = Garmin/Simrad; teal-green = Humminbird. Deeper (mobile) = semicircular display. Livescope (Garmin) shows near-real-time moving fish dots. MEGA Imaging (Humminbird) = ultra-high definition teal. All brands show physostomous fish (barra, GT, jack) as bright arches with shadow void beneath.",
    detectedSpecies: ["Sonar Reference", "Lowrance", "Garmin", "Humminbird", "Simrad"],
    depthRanges: ["all depth ranges — brand ID based on colour palette not depth"],
    aiTips: [
      "Warm red/orange sonar palette = Lowrance (HDS Live, Elite Ti, Ghost series)",
      "Cool blue/purple palette = Garmin (Echomap, Ultra, Livescope) or Simrad",
      "Teal-green background = Humminbird (Helix, Solix, Apex, MEGA Live)",
      "Semicircular fan-shaped display = Deeper Smart Sonar (Bluetooth, mobile)",
      "Garmin Livescope / Humminbird MEGA Live = live sonar — fish appear as moving dots, not arches",
    ],
  },

  // ── COBIA ──────────────────────────────────────────────────────────────────
  {
    title: "Species Intel — Cobia (Rachycentron canadum)",
    description: "Cobia (Sergeant Fish, Black Kingfish, Prodigal Son): Rachycentron canadum. Maximum size: 200cm / 68kg. Common target: 80-130cm, 10-30kg. Lifespan: 12+ years. NO MINIMUM SIZE in most Australian states. BAG LIMIT: QLD 5/day. WA 5/day. NT 5/day. DISTRIBUTION: Circumtropical — Red Sea, Indo-Pacific, Atlantic, Northern Australia. HABITAT: Associated with large floating objects, sharks, rays, whale sharks, buoys, channel markers. SONAR SIGNATURE: Large single arch or paired arches. Cobia lack a physostomous swim bladder — LOWER sonar return than barra. Often seen swimming beside rays on sonar (distinctive paired arch pattern). TECHNIQUE: Pitch bait (live or dead mullet, squid, pilchard) to visible cobia — they follow sharks and rays to surface. Cast poppers and large soft plastics. BEHAVIOUR: Curious and approachable — often circles boats before striking. Commonly caught near surface following whale sharks in WA (Ningaloo). COOK: Exceptional eating — firm white flesh, sashimi grade.",
    brainInsight: "Cobia: no minimum size most states, bag limit 5/day. Associate with sharks, rays, buoys, channel markers. Lower sonar return than barra (no physostomous bladder). Often follow rays — paired arch pattern on sonar. Pitch live bait or large soft plastic to visible fish. Excellent eating — sashimi quality.",
    detectedSpecies: ["Cobia", "Rachycentron canadum", "Black Kingfish", "Sergeant Fish"],
    depthRanges: ["0-10m (follows rays in shallow water)", "surface (near floating objects)", "20-40m (deep channels)"],
    aiTips: [
      "Cobia associate with rays, sharks and floating objects — target these to find cobia",
      "Lower sonar return than barra (no physostomous bladder) — fainter arch",
      "Cast live bait or large soft plastic to visible cobia — they are curious and will investigate",
      "Ningaloo WA: cobia follow whale sharks to surface, Apr-Jul season",
      "Outstanding eating fish — sashimi quality flesh, no bag restrictions in most states",
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

  // Seed expert brain videos (regional intelligence entries)
  const allVideoEntries = [...EXPERT_BRAIN_VIDEOS, ...SPECIES_KNOWLEDGE_ENTRIES];
  for (const v of allVideoEntries) {
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
      description:  `Seed v4 completed: ${reportsAdded} expert reports + ${videosAdded} brain intel entries (regional + species knowledge)`,
      status:       "done" as const,
      frameCount:   0,
      processedAt:  new Date(),
    });
  } catch { /* ignore — marker is non-critical */ }

  logger.info(
    { reportsAdded, videosAdded },
    `Brain knowledge seed v4 complete: ${reportsAdded} expert reports + ${videosAdded} knowledge entries (regional + species + Nile perch + Asian grounds + sonar brands)`
  );
}
