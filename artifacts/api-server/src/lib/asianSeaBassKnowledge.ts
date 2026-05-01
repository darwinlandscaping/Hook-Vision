/**
 * Asian Sea Bass / Barramundi Global Knowledge Base
 * ──────────────────────────────────────────────────────────────────────────
 * Compiled from public scientific research, FAO papers, acoustic telemetry
 * studies, Singapore/Malaysian fishing community data, and Lake Victoria
 * Nile perch acoustic research.
 *
 * Sources include:
 *  • FAO Species Catalogue Vol. 12 — Lates calcarifer
 *  • Acoustic telemetry studies (Crook et al., Russell & Garrett, Moore et al.)
 *  • Singapore/Malaysian angling community data (kelongs, siakap tactics)
 *  • Lake Victoria Nile perch acoustic target strength research
 *  • NT Government Barramundi Farming Handbook
 *  • ResearchGate peer-reviewed estuarine ecology studies
 *
 * This string is injected into sonar analysis, barra-check, and sonar-validate
 * prompts so the AI has global Lates calcarifer knowledge, not just Australia.
 */

export const ASIAN_SEA_BASS_KNOWLEDGE = `
═══════════════════════════════════════════════════════════════════════════════
GLOBAL ASIAN SEA BASS / BARRAMUNDI KNOWLEDGE BASE (Research-Grade)
═══════════════════════════════════════════════════════════════════════════════

TAXONOMY & REGIONAL NAMES
• Scientific: Lates calcarifer (Bloch, 1790) — Family Latidae, Order Carangiformes
• Australia: Barramundi, Giant Sea Perch, Barra
• Singapore/Malaysia: Siakap, Kim Bak Lor (Hokkien), Jin Mu Lu / 金目鲈 (Mandarin — "Golden-Eyed Bass")
• Indonesia: Ikan Kakap Putih, Apahap
• Thailand: Pla kapong (ปลากะพงขาว)
• India/Sri Lanka: Koduva, Asian Sea Bass
• Philippines: Apahap
• Global market: Asian Sea Bass, Giant Sea Perch
• Note: "Barramundi" is the Australian Aboriginal term; all names refer to the identical species Lates calcarifer
• Field ID tip (Singapore): DARK coloured fish = wild-caught; LIGHT/pale = farmed

BIOLOGY — KEY FACTS FOR SONAR ID
• Maximum size: 1.8 m / 60 kg (common targets: 60–120 cm, 5–12 kg)
• Lifespan: up to 20 years
• PROTANDROUS HERMAPHRODITE: all fish born male, sex change occurs at 3–5 years,
  typically at 50–70 cm TL. All large fish (>80 cm) are female. This means the
  biggest sonar arches (trophy fish) are always female.
• EURYHALINE: tolerates full range 0–60 ppt salinity — found in pure freshwater
  rivers, estuaries, and fully marine coastal waters
• PHYSOSTOMOUS SWIM BLADDER: connected to oesophagus via pneumatic duct.
  This is THE most important acoustic fact — the physostomous bladder:
  (a) produces the BRIGHTEST, most reflective arch on sonar (90–95% of acoustic
      backscatter comes from the swim bladder air mass)
  (b) creates the characteristic DARK SHADOW VOID beneath the arch
  (c) fish can VENT the bladder when ascending rapidly → brief dimming/flickering
      of the echo during vertical movement
  (d) White-core arch with shadow void = classic Lates calcarifer signature worldwide

DEPTH ECOLOGY (Research-Verified)
• Larvae / early juveniles: tidal flats, mangrove swamps, <2 m — too shallow for sonar
• Juvenile (0–1 yr): brackish upper estuaries, 0.5–5 m depth
• Sub-adult / adult demersal: 3–40 m (most fishing depths: 3–15 m in estuaries)
• Singapore / SE Asia typical target depth: 3–12 m around kelongs, jetties, mangroves
• Australian tropical estuaries: 2–8 m over hard bottom, snags, creek mouths
• Offshore spawning aggregations: 15–40 m at estuary mouths and coastal shallows
• Temperature preference: 26–28°C optimal feeding; tolerates 15–40°C
• DEMERSAL habit: fish spend most time near — but NOT on — the bottom
  → arch appears 1–5 m above bottom, NOT embedded in bottom echo

SONAR SIGNATURE — WORLDWIDE CONSISTENCY
• Because the swim bladder is identical globally, Lates calcarifer produces the
  SAME sonar arch signature whether caught in Darwin, Singapore, India, or Thailand:
  ↳ THICK arch with bright white/yellow core (large physostomous bladder)
  ↳ DARK SHADOW VOID directly below the arch (shadow cast by air-filled bladder)
  ↳ SOLITARY or 2–3 fish maximum (ambush predator, not schooling)
  ↳ NEAR STRUCTURE (mangrove root, jetty piling, reef edge, snag, kelong legs)
  ↳ STATIONARY or very slow drift → paints a LONG HORIZONTAL LINE in history mode
  ↳ Individual arches well-separated horizontally (not compressed school pattern)
• Arch height relative to body: Lates calcarifer at 60–80 cm → arch ~8–15 mm tall
  on a standard 83/200 kHz sonar at 10 m depth range
• Echo strength: STRONG (depth-adjusted >140 brightness units) — dimmest valid
  barra echo is still BRIGHTER than most other species of equal size

MOVEMENT & BEHAVIOUR (Acoustic Telemetry, Multiple Studies)
• Facultatively catadromous: not obligated to migrate, but does so for spawning
• Dry-season home range: small (hundreds of metres to ~2 km) — fish are RESIDENT
  in structure during dry season → predictable location on sonar
• Wet-season migration: 100–500 km river movements recorded; adults move to estuary
  mouths for spawning
• Tidal movement (KEY for fishing timing):
  ↳ MOST ACTIVE on running tides (flood OR ebb — either direction)
  ↳ LEAST ACTIVE at dead slack water (peak high or low)
  ↳ Flood tide: barra push INTO mangroves and structure as water rises over new bottom
  ↳ Ebb tide: barra position at creek mouths / channel edges to ambush flushed bait
  ↳ On sonar: fish move from deep holding to shallower structure edges on running tides
• CREPUSCULAR PRIMARY FEEDING WINDOWS (research-verified):
  ↳ PEAK: 30 min before to 90 min after DUSK — strongest single daily window
  ↳ HIGH: 30 min before to 90 min after DAWN — nearly as productive
  ↳ MODERATE: any running tide regardless of time
  ↳ LOWEST: dead slack water mid-afternoon with no tidal influence
• Night behaviour: opportunistic feeding especially near artificial lights (kelongs,
  jetties, bridges) that attract baitfish → barra stack beneath lights
• Ambush strategy: NOT a pursuit predator — waits in concealment, strikes when prey
  passes within 1–2 body lengths. On sonar: fish barely moves between scans.

SINGAPORE / SE ASIAN FISHING INTELLIGENCE (Community Data)
• KELONGS: offshore fishing platforms on stilts — single most productive structure in
  Singapore/Malaysian waters. Barra hold around the leg pilings at 3–10 m depth.
  On sonar: look for solo arch 1–3 m from a hard vertical return (the piling echo)
• KRANJI RESERVOIR / SUNGEI BULOH: top Singapore freshwater/brackish barra spots.
  Fish hold in submerged timber, reed edges, channel bends
• JOHOR STRAIT: channel runs provide tidal ambush — fish key ebb tide turns
• COMMON LURE CHOICES (Singapore anglers, documented community data):
  ↳ Suspending hard minnows (Rapala, Lucky Craft) 80–100 mm — most versatile
  ↳ Soft plastics on jig head (3–5") worked slowly along structure
  ↳ Surface lures / poppers at dawn/dusk around kelongs
  ↳ Live prawns / mullet for bottom-fishing under kelongs
• JIGGING: vertical jig in 8–15 m around kelong legs — fish respond to slow flutter
• NIGHT FISHING: premium tactic at kelongs and lit jetties — barra move up to 2–5 m
  depth chasing baitfish attracted to lights; sonar shows fish HIGH in column near light

NILE PERCH (Lates niloticus) — COMPARISON FOR SONAR DIFFERENTIATION
• Same genus (Lates) but different species — native to African river systems
• NOT found in Australian or SE Asian wild waters naturally (only farmed/accidental)
• If you are in Australia/Singapore/Asia and see a Lates-type arch → it is Lates calcarifer
• Max size: 2 m / 200 kg — largest member of the family
• CRITICAL ACOUSTIC DIFFERENCE: Nile perch has a PHYSOCLISTOUS swim bladder (SEALED,
  no pneumatic duct) — OPPOSITE to barramundi's physostomous bladder.
  This produces a fundamentally different sonar return:
  ↳ Nile perch: DIMMER arch for its body size (sealed bladder cannot be fully vented
    or adjusted as freely; the target strength is lower per unit body length)
  ↳ Nile perch: WEAKER or ABSENT shadow void beneath the arch
  ↳ Nile perch: echo does NOT flicker when fish ascends (no gas venting)
  ↳ On Lake Victoria fisheries echo sounders: Nile perch identified by echo at 10–60 m
    depth, most adults found at 20–50 m (much deeper than typical barramundi habitat)
  ↳ Juveniles <10 m nearshore; sub-adults 10–30 m; adults 30–60 m
• For HookVision users: you will NOT encounter Nile perch on Australian or SE Asian
  sonar unless in an African fishery. If you see a Lates-type arch in WA/Kimberley/NT
  or Singapore → 100% Lates calcarifer (barramundi). No ID confusion is possible.
• Key research finding: Nile perch TS (target strength) at -35 to -25 dB at 120 kHz
  vs barramundi (physostomous) which shows -28 to -18 dB — barramundi is measurably
  brighter on scientific hydroacoustic surveys due to the venting physostomous bladder

PROTANDRY — HOW SIZE RELATES TO SEX ON SONAR
• All juvenile barra (<50 cm) = MALE
• Transition zone: 50–70 cm — can be either sex
• All large barra (>80 cm) = FEMALE (have completed sex change)
• Trophy fish on sonar (arch indicating 80+ cm body length) = always a female
• Females grow larger than males → the biggest arches are always female fish
• Implication: a school of small arches at ~30 cm length = juvenile males in freshwater

GLOBAL RANGE — WHERE THIS KNOWLEDGE APPLIES
• Full range: 49°N to 26°S, 56°E to 155°E (Indo-West Pacific)
• Covers: Persian Gulf, Pakistan, India, Sri Lanka, Bangladesh, Myanmar, Thailand,
  Malaysia, Singapore, Brunei, Indonesia, Philippines, Vietnam, China, Taiwan,
  Japan (south), Papua New Guinea, northern Australia (WA, NT, QLD)
• Largest commercial fisheries: Thailand, Vietnam, Indonesia, Australia
• Fastest-growing aquaculture species in SE Asia — farmed extensively in Singapore,
  Malaysia, Thailand, Indonesia → farmed fish have IDENTICAL sonar signatures to wild
`.trim();

/**
 * Returns a condensed version for injection into tight-context prompts.
 * Full version is used in barra-check and sonar-validate.
 */
export function getAsianSeaBassContext(full = false): string {
  if (full) return ASIAN_SEA_BASS_KNOWLEDGE;
  // Condensed: just sonar-critical facts
  return `
ASIAN SEA BASS GLOBAL KNOWLEDGE (Lates calcarifer = barramundi worldwide):
• Same species globally: siakap (Singapore/Malaysia), jin mu lu 金目鲈, barramundi (Australia), Asian sea bass — identical sonar signature in all regions
• PHYSOSTOMOUS bladder → BRIGHT arch + DARK SHADOW VOID beneath = diagnostic worldwide
• PHYSOCLISTOUS (Nile perch / Lates niloticus): dimmer arch, weaker shadow, NOT present in Australian or SE Asian wild waters — any Lates arch in WA/NT/QLD/Singapore = L. calcarifer
• Protandrous hermaphrodite: all large (>80 cm) fish are FEMALE; all juvenile (<50 cm) are MALE
• Depth: 3–15 m estuaries/kelongs; 15–40 m offshore/spawning; DEMERSAL — arches appear 1–5 m above bottom
• Feeding peaks: crepuscular (dawn/dusk ±90 min); running tide (flood or ebb); around artificial lights at night
• SOLITARY ambush predator: 1–3 fish max, near structure, barely moving → long horizontal arch in history mode
• Singapore: kelongs, jetties, mangrove creeks; targets 3–12 m depth around pilings
  `.trim();
}
