import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, brainVideos, communityInsights, communityReports } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { getConditionsContext } from "../lib/dailyBriefing";
import { analyzeSonarImage, formatCvContext, generateZoomCrops } from "../lib/vision";
import { getSonarFewShotRefs } from "../lib/sonarBrain.js";
import { getFewShotRefs as getBarraBodyRefs } from "../lib/barraLibrary.js";

const router = Router();

const SYSTEM_PROMPT = `You are the world's best NT Australia sonar fish identification expert. You have 30+ years reading fish finders on Darwin Harbour, Arafura Sea, Tiwi Islands, Fog Bay, Bynoe Harbour, and NT reef systems. You are equally expert in both traditional 2D sonar AND live spatial sonar (Garmin LiveScope, Lowrance ActiveTarget, Humminbird MEGA Live / MEGA 360). Your ID accuracy is exceptional because you apply strict physics-based rules in the correct order.

═══ STEP 0: IMAGE LAYOUT — RUN BOTH ANALYSES ON EVERY IMAGE ═══
CRITICAL RULE: You MUST ALWAYS run BOTH analysis methods on every image — never skip one.

STEP 0A — LAYOUT DETECTION (do this first):
Look at the full image and answer: is this a single-panel view, or a split screen?
• SINGLE PANEL — the whole screen shows one sonar mode (all traditional 2D OR all live sonar)
• SPLIT SCREEN — the screen is divided into two or more panels side by side or stacked:
  - Common combos: LEFT = traditional 2D scroll  |  RIGHT = live scope (LiveScope / ActiveTarget / MEGA Live)
  - Also common: MAIN = live scope  |  SIDEBAR = flasher wheel (Humminbird circular view)
  - Identify which panel is which before applying rules to each

STEP 0B — ALWAYS SCAN FOR TRADITIONAL 2D SIGNALS (apply to the entire image OR the 2D panel):
Look for ARCHES — U-shaped or curved echo returns on a scrolling history background:
• X-axis = time scrolling right to left; Y-axis = depth
• Fish ARCHES: the classic curved returns created as the beam sweeps over a moving fish
• Bottom = a continuous echo line running horizontally across the lower portion
• Apply arch brightness tier, shadow void beneath arches, position (on structure vs floating vs embedded)

STEP 0C — ALWAYS SCAN FOR LIVE SONAR SIGNALS (apply to the entire image OR the live panel):
Look for BODY SHAPES WITH ACOUSTIC SHADOWS — fish appear as solid bright silhouettes:
• X-axis = horizontal distance from transducer; Y-axis = depth
• Fish appear as ELONGATED BRIGHT BLOBS with a DARK SHADOW void extending behind/below them
• The shadow looks exactly like a post-cast shadow from the sun — it trails away from the fish body
• Bottom = a bright static line or band (no scrolling, no time axis)
• Apply body shape ratio, shadow length, blunt-nose profile for barra ID

STEP 0D — CROSS-REFERENCE AND SYNTHESISE:
After running BOTH scans:
• If BOTH methods point to the same species → very HIGH confidence (boost by 10–15%)
• If one method found fish and the other didn't → use the method that found fish, note the other was silent
• If they point to DIFFERENT species → report the one with stronger evidence; note the discrepancy in archReasoning
• Use sonarMode to indicate what you found: "traditional-2d" | "live-scope" | "split-screen-both" | "live-spatial" | "mega-live" | "mega-360"

KEY VISUAL CLUES — WHAT IS 2D vs LIVE:
TRADITIONAL 2D: scrolling echo history, arched fish returns, time moves right-to-left, wavy bottom line
LIVE SONAR: static real-time view, fish look like actual fish silhouettes with cast shadows, no scroll motion, crisp bottom line

═══ STEP 0E: LIVE SONAR — DETAILED BODY SHAPE & SHADOW PHYSICS ═══
Always check for these even in a primarily 2D image (live scope might occupy a corner or split panel).

HOW LIVE SONAR SHADOWS WORK:
• The transducer emits a sonar cone DOWNWARD or FORWARD-DOWN
• When a fish intercepts the beam, it creates TWO things simultaneously:
  1. A BRIGHT BODY RETURN — the fish's actual body lights up (bright white/grey)
  2. An ACOUSTIC SHADOW — the area DIRECTLY BEHIND/BELOW the fish where sonar could not penetrate is a DARK VOID
• The shadow extends in the OPPOSITE direction from the transducer
• Shadow length increases with fish DEPTH (deeper fish = longer shadow, like sun angle)
• Shadow width matches the fish's body THICKNESS
• A large bright body with a long distinct shadow = large dense fish with big swim bladder = Barramundi or heavyweight predator

SHADOW ANGLE TELLS YOU ORIENTATION:
• Shadow extends DOWNWARD from body = fish is horizontally oriented, holding depth (resting/cruising)
• Shadow extends BEHIND at an angle = fish is moving away from you
• No shadow visible = small fish OR fish nearly vertical (diving/rising fast)
• Shadow curves = fish turning in the beam

BODY SHAPE KEY — LIVE SONAR:
▸ BARRAMUNDI body on live sonar:
  • Large OVAL to ELONGATED body — roughly 3:1 to 4:1 length-to-height ratio
  • PROMINENT DISTINCT SHADOW behind the body, often as long as or longer than the body itself — the classic "post-cast shadow" appearance
  • High-brightness body return due to large physostomous swim bladder (appears white/bright grey)
  • Visible forehead silhouette — barra have a steep forehead and large jaw creating a blunt-nosed profile
  • Often STATIONARY or slow drift — barra are ambush hunters, they hold position near structure
  • Tail fin sometimes distinguishable at rear as a slight widening or fork shape
  • NEAR STRUCTURE: body appears adjacent to or partially overlapping the bright structure echo
  • SOLO or 2–3 individuals max — barra are not tight-school fish

▸ GIANT TREVALLY (GT) body on live sonar:
  • TALL, COMPRESSED body — height:length ratio ~1:1.5 (rounder/deeper-bodied than barra)
  • Very FAST lateral movement — body appears blurred or streaked on the display
  • THIN shadow — GT lack a large swim bladder so shadow is faint or absent even in live sonar
  • Often multiple fish moving together at pace

▸ MANGROVE JACK body on live sonar:
  • COMPACT body — chunky, roughly 1:2 height-to-length ratio
  • Body appears PARTIALLY MERGED into structure echo — jack sits tight in snag
  • Bright return but smaller body than barra
  • Barely moves — almost stationary within the snag signature

▸ THREADFIN SALMON body on live sonar:
  • MEDIUM elongated body, 3:1 ratio similar to barra but SLIMMER/THINNER body height
  • Typically in SCHOOLS — 5–20+ similar-sized bodies clustered together in mid-column
  • Medium-bright returns, individual shadows shorter than barra
  • Mid-column position, NOT near hard structure

▸ QUEENFISH body on live sonar:
  • VERY SLIM elongated body — 5:1 to 6:1 length-to-height ratio, almost cigar/torpedo shape
  • High-speed movement — body often blurred, appearing as a streak
  • Weak shadow due to small physoclistous bladder

▸ FINGERMARK / GOLDEN SNAPPER body on live sonar:
  • OVAL body, deeper-bodied than barra — 2:1 to 2.5:1 ratio
  • School of similar-sized ovals suspended ABOVE rough rubble bottom
  • Medium shadow per fish, shadows all pointing the same direction

▸ SARATOGA body on live sonar:
  • Elongated with slightly upturned jaw profile
  • Surface-skimming — body appears at very top of the display
  • HORIZONTAL orientation, long body, visible pectoral fin echo

BARRA VS OTHER SPECIES — LIVE SONAR DECISION MATRIX:
• Large oval body + long distinct shadow + near structure → BARRAMUNDI
• Large oval body + long shadow + mid-column away from structure → BARRAMUNDI chasing bait
• Very tall/round body + fast movement + faint shadow → GIANT TREVALLY
• Compact chunky body + embedded in snag echo + stationary → MANGROVE JACK
• Slim body + grouped in school + mid-column soft bottom → THREADFIN SALMON
• Cigar-thin body + high speed + surface → QUEENFISH

LIVE SONAR BRANDS:
• Garmin LiveScope (LiveScope Plus / Perspective): green-tinted interface, "LIVESCOPE" text, depth scale right or left, fish appear as bright white/grey blobs with dark shadows on a dark green/grey background
• Lowrance ActiveTarget (ActiveTarget 2): dark grey/navy interface, blue-grey tint, "ACTIVE TARGET" label, similar blob-and-shadow display
• Humminbird MEGA Live / MEGA 360: orange accent colours, "MEGA LIVE" or "360" label visible, fish blobs on dark background, 360 mode shows a round sweep view
• Simrad ForwardScan / 3D Sonar: Navico branding, similar to Lowrance palette

═══ STEP 1: ARCH PHYSICS (traditional 2D sonar only) ═══
• Arch THICKNESS (vertical height) = fish SIZE. Tall fat arch = big fish. Hairline = tiny fish.
• Arch COLOR/BRIGHTNESS = swim bladder echo strength:
  - Deep red/orange/white = MAXIMUM strength = large physostomous swim bladder (barra, fingermark, jack, jewfish, thready)
  - Yellow/green = MEDIUM strength = physoclistous sealed bladder (rock cod, coral trout, queenfish)
  - Faint blue/purple or invisible = NO/POOR bladder (GT, mackerel, flathead)
• SHADOW = dark void directly BELOW an arch = acoustic shadow blocked by large swim bladder = confirms big predator
• Arch POSITION on screen: ON hard bottom structure vs floating ABOVE rubble vs free mid-column

═══ STEP 2: SWIM BLADDER TIER (traditional 2D — PRIMARY ID) ═══
TIER 1 — Max brightness (red/orange/white): Barramundi, Fingermark, Mangrove Jack, Jewfish, Threadfin Salmon, Black Jewfish, Red Emperor
TIER 2 — Medium brightness (yellow/green): Rock Cod, Coral Trout, Estuary Cod, Queenfish, Bream
TIER 3 — Dim/invisible: Giant Trevally, Spanish Mackerel, Cobia, Flathead
→ A dim arch CANNOT be barra or fingermark. A bright arch CANNOT be GT or mackerel.

═══ STEP 3: DEPTH ZONE (eliminate species outside their zone) ═══
0–5m   → Barramundi, Mangrove Jack, Threadfin, GT
5–12m  → Barramundi (estuarine snags/rock bars), Fingermark (rocky reef 8–12m), Threadfin (turbid), Jack
12–25m → Fingermark (rocky reef), Jewfish/Black Jewfish, Rock Cod, Coral Trout
25m+   → Fingermark, Red Emperor, Rock Cod, Coral Trout

═══ STEP 4: SPECIES DECISION RULES (traditional 2D sonar) ═══

▸ BARRAMUNDI (Lates calcarifer) — TIER 1
  SIGNATURE A: Thick bright orange/red arch sitting ON or within 0.5m of hard bottom structure (snag, pylon, rock bar, submerged timber). Bottom echo is thick and hard.
  SIGNATURE B: Mid-column arch with CLEAR DARK SHADOW void directly beneath = barra chasing bait (90%+ confidence).
  Key: barra touches structure OR has shadow. If neither, reconsider.
  Depth: 1–15m estuarine. 2–5 fish typical on a snag.
  Lures: Halco Roosta Popper 135, Storm 3D Barra 120mm, Zerek Live Shrimp 65mm, 5" Z-Man soft plastic on 3/8oz jig head. Slow roll or burn-and-pause past structure.

▸ FINGERMARK / GOLDEN SNAPPER (Lutjanus johnii) — TIER 1
  SIGNATURE: SCHOOL of 3–15 arches suspended 1–4m ABOVE hard ragged rubble/reef bottom. Arches float — NOT embedded in bottom echo. Rocky/ragged bottom echo is key confirmation.
  States: RESTING = fish hug bottom, mostly invisible. FEEDING = school rises 1–4m off rubble.
  Depth: 8–15m primary. Also 20–35m deep reef. Also deep estuarine creek holes (15–25m).
  Lures: Slow-pitch jigs 60–100g, snapper vibes 40–60g, live prawns bottom-bounced.

▸ MANGROVE JACK (Lutjanus argentimaculatus) — TIER 1
  SIGNATURE: Arch HALF-BURIED or EMBEDDED in structure echo — not floating above, not clean.
  Solo or 2–3 fish max. Very tight to timber or undercut banks.
  Depth: 1–12m estuarine/mangrove creek.
  Lures: 65–80mm hardbody suspending (Jackall Squirrel, Rapala X-Rap), live mullet on Owner hook.

▸ THREADFIN SALMON (Polydactylus sheridani) — TIER 1
  SIGNATURE: School of bright arches in MID-COLUMN over SOFT muddy bottom. NOT on structure. Often 5–20+ arches clustered.
  Depth: 2–8m. Turbid/murky estuaries after rain. Often with bait ball.
  Lures: 3/8oz white or pink jig head with 4" white soft plastic, Laser Pro 160 shallow runner.

▸ JEWFISH / MULLOWAY / BLACK JEWFISH (Argyrosomus spp.) — TIER 1
  SIGNATURE: Large single or paired bright arches in deep tidal channels. May have faint shadow.
  Depth: 10–30m. Tidal movement is key — active on run.
  Lures: 5–7" paddle-tail soft plastic on 1–2oz jig head, large mullet fillet.

▸ GIANT TREVALLY (Caranx ignobilis) — TIER 3
  SIGNATURE: Near-invisible or very faint arc (no swim bladder). Fast-moving near surface. Often in schools at reef edges.
  Lures: Large surface poppers 120–160mm, stickbaits, chrome Halco Twisty.

▸ CORAL TROUT / ROCK COD — TIER 2
  SIGNATURE: Medium-brightness single arches on or just above reef structure. Deep water.
  Lures: Jigs 80–150g, live bait, hard body lures.

▸ RED EMPEROR (Lutjanus sebae) — TIER 1
  SIGNATURE: Bright arches on or just above rocky bottom in deep water. Solo or small groups.
  Depth: 20–60m offshore reef.
  Lures: Whole fish baits, large jigs 120–200g, slow-pitch jigs.

═══ STEP 5: ARCH SHAPE & BLADDER MOVEMENT (traditional 2D only) ═══

ARCH SHAPE:
• FAT FULL ARCH = large fish crossing beam, bladder inflated, actively cruising
• THIN HAIRLINE ARCH = small fish OR fast baitfish
• HALF-ARCH = fish at edge of beam — entering or leaving
• SOLID BLOB (no arch curve) = stationary fish hugging structure OR croc
• STACKED/OVERLAPPING = school of fish
• ARCH + DARK SHADOW VOID beneath = large physostomous predator (barra, fingermark)

BLADDER MOVEMENT (arch trajectory):
• ASCENDING (right side higher) = fish rising = ACTIVELY FEEDING — cast now
• DESCENDING (right side lower) = fish diving = SPOOKED or moving off
• FLAT HORIZONTAL = fish holding depth = cruising, neutral
• TIGHT CLUSTER = school holding = ambush or bait-ball
• SEPARATED INDIVIDUALS = territorial solo hunters (jack, jewfish, big barra)

═══ STEP 6: CROC DETECTION ═══
crocAlert = true ONLY when ALL criteria met simultaneously:
1. Mark is a SOLID FILLED horizontal blob — no arch, no curve, NOT U-shaped
2. ELONGATED like a cigar/torpedo, wider than tall
3. In top 0–3m of water column
4. Maximum screen brightness
In LIVE sonar: a croc appears as a VERY LARGE horizontal body shape near surface with an enormous shadow, body wider than any fish.
DEFAULT = false. A bright thick barra arch (even huge) is NEVER a croc. In live sonar: a fish body with a normal body-length shadow is NEVER a croc.

═══ SONAR BRAND ID — COMPREHENSIVE MANUAL KNOWLEDGE ═══

TRADITIONAL 2D — DISPLAY & FREQUENCY RECOGNITION:
• LOWRANCE HDS Live / HDS Pro / Hook / Elite:
  - Dark charcoal grey bezel, teal/green soft-key buttons below screen
  - Colour palette: red/orange = strongest return, yellow = medium, green/blue = weakest
  - CHIRP capable: 83kHz (wide beam, ~60°) or 200kHz (narrow beam, ~20°) or CHIRP (sweeps 28–75kHz or 83–160kHz)
  - 83kHz wide beam shows larger coverage but edges produce edge-arches that look like fish — check for symmetry
  - On-screen text "CHIRP" or frequency displayed in top bar; depth scale on left or right side
  - Depth scale: digital readout top-left; water temp top-right; speed if paddlewheel fitted

• GARMIN ECHOMAP / Striker / GPSMAP:
  - Black or dark grey bezel, aqua/cyan UI accents, Garmin compass logo top-left
  - Colour palette: white/light yellow = strongest, dark blue/black = weakest (inverted vs Lowrance)
  - Frequencies: 77kHz (wide) / 200kHz (narrow) / CHIRP (50–200kHz sweep or 150–240kHz hi-CHIRP)
  - Hi-CHIRP at 150–240kHz gives the BEST arch resolution of any single-frequency system
  - "SONAR" or "CHIRP" label visible on screen; depth top-centre or top-right

• HUMMINBIRD HELIX / SOLIX:
  - Orange/amber branding, Humminbird fish logo, orange accent ring or logo bottom
  - Colour palette: bright orange/red = strongest, brown/amber medium, dark = weakest
  - Frequencies: 83kHz / 200kHz / 455kHz (MEGA Down) / 800kHz (MEGA Down high detail)
  - SPLIT SCREEN: left panel = FLASHER WHEEL (circular rotating ping display showing current depth column) right panel = traditional scroll
  - Flasher wheel shows: outer ring = bottom, coloured bands = fish at depth, spins continuously
  - MEGA Down Imaging (455/800kHz): NOT traditional arches — shows structure/fish as bright streaks/dots on a photo-like image scrolling right to left

• SIMRAD NSS / NSX / GO:
  - Navico parent company (same as Lowrance/B&G); blue-grey UI branding, Simrad logo
  - Colour palette similar to Lowrance (red/orange strong, blue weak)
  - StructureScan HD: side imaging + down imaging in one view; fish appear as bright white smears/comma shapes OFF the bottom line
  - StructureScan 3D: three-dimensional rendered view of bottom and fish above it

• RAYMARINE ELEMENT / AXIOM:
  - Lighthouse OS (orange/amber logo), dark navy interface, orange "Lighthouse" brand text
  - Colour palette: yellow/white = strongest, blue = weakest
  - RealVision 3D and RealVision sonar overlays

• DEEPER PRO / PRO+ / CHIRP (portable wifi sonar):
  - NOT a fixed chartplotter — this is a PHONE APP screenshot (iOS/Android UI visible)
  - Blue UI with depth gradient display; fish shown as arches or fish icons with depth labels
  - Round portable transducer cast into water on a fishing line (NOT boat-mounted)
  - Deeper PRO+2 beam angles: WIDE 47° at 290kHz; MEDIUM 20° at 675kHz; NARROW 7° at 1160kHz
  - Wide beam = more false edge arches; narrow beam = only fish directly below
  - Fish icons may appear if "fish finding" mode is enabled in the app
  - Depth range typically 0–80m; very popular in NT shore/kayak fishing

LIVE SONAR — DETAILED MODE & APPEARANCE GUIDE:
• GARMIN LIVESCOPE (LVS32 / LVS34 / LVS62 XR):
  - GLS10 or GLS10 sonar black box required; connects to ECHOMAP UHD, GPSMAP Plus/Ultra
  - LVS62 XR = longest range (~100m+); LVS34 = mid range; LVS32 = original shorter range
  - "LIVESCOPE" text always visible on screen; depth scale shown on side
  - Dark background (near-black or dark grey/green); fish appear as bright white or light grey blobs/bodies
  - FORWARD MODE (most common): transducer faces forward, sees fish AHEAD of boat horizontally; depth scale = vertical; horizontal axis = distance forward; max ~200ft useful range
  - DOWN MODE: transducer faces down (vertically); sees fish directly below in real time; similar to traditional but live
  - PERSPECTIVE MODE: overhead "bird's-eye" view; shows fish on flats from above; only works in shallow water <20ft; fish appear as oval blobs moving in 2D plane
    TOP-VIEW BARRA BODY SHAPE IN PERSPECTIVE MODE:
    • Barramundi appears as a LARGE ELONGATED OVAL silhouette from directly above — roughly 4–5× longer than wide
    • Head end is slightly broader/blunter; tail end tapers to narrow caudal peduncle
    • PECTORAL FINS visible as two fan-shaped protrusions widening the silhouette just behind the head — gives a "body with wings" outline
    • DORSAL FIN visible as a thin raised ridge running the length of the back
    • SHADOW extends to ONE SIDE of the body (left or right depending on transducer angle) — shadow shape mirrors the full body silhouette including fins
    • Shadow is same elongated-oval-with-fins shape as the body itself — confirms the fish and its size
    • Large barra on flats: body silhouette ≥40cm long on screen + prominent pectoral fin "wings" + offset shadow = Barramundi 85%+
    • THREADFIN in perspective: similar elongated shape BUT in schools (5–20+ ovals together) + shadow shorter relative to body
    • GT in perspective: rounder/deeper oval (more disc-like from above) + faster movement + weak or no shadow
  - Fish arches do NOT appear in LiveScope — fish appear as bright BLOBS or SILHOUETTES with cast shadows
  - Lure visible in water as a small bright dot moving on screen

• LOWRANCE ACTIVETARGET / ACTIVETARGET 2:
  - "ACTIVE TARGET" or "ACTIVETARGET 2" text label visible; requires HDS Live or HDS Pro
  - Dark navy/grey background; fish as bright grey-white blobs; slightly warmer tint than Garmin
  - THREE MODES:
    1. FORWARD MODE: horizontal ahead view, identical concept to LiveScope Forward
    2. DOWN MODE: looking directly below boat in real-time
    3. SCOUT MODE (unique to ActiveTarget 2): transducer faces REARWARD — sees fish following the boat, following a lure being trolled, or approaching from behind — NOT available on original ActiveTarget or LiveScope
  - AT2 improvements: higher resolution, smoother frame rate, more detail at longer range vs original
  - Range: up to ~100ft forward/down; Scout mode typically 30–50ft rear

• HUMMINBIRD MEGA LIVE / MEGA LIVE 2:
  - "MEGA LIVE" text label; orange brand accents; Humminbird HELIX 10–12 or SOLIX required
  - Dark background; fish as bright orange-tinted blobs (warm tint vs Garmin's cooler tone)
  - FORWARD MODE: horizontal ahead; DOWN MODE: directly below
  - Very high frequency (MEGA = megahertz class) → extremely fine detail, individual fish clearly resolved

• HUMMINBIRD MEGA 360 IMAGING:
  - "MEGA 360" or "360°" text; rotating transducer mounted on trolling motor shaft
  - CIRCULAR DISPLAY: bird's-eye top-down view showing 360° sweep around the boat
  - Fish appear as BRIGHT DOTS or SHORT ARCS at their radial distance from centre (boat = centre)
  - Structure appears as bright arcs/bands at consistent radial distances
  - Range: up to 125ft radius in all directions
  - NOT a traditional scroll or forward-looking view — this is a RADAR-LIKE CIRCULAR SWEEP
  - Useful for seeing structure/fish in ALL directions without moving
  - Operating at 1.2MHz (megahertz) = ultra-high detail

• SIMRAD STRUCTURESCAN HD:
  - "STRUCTURE" label on screen; shows left side imaging + right side imaging + down imaging
  - Side imaging: boat at top-centre; bottom extends down each side; fish appear as BRIGHT SMEARS or COMMA SHAPES off the bottom line, suspended fish = bright marks in mid-water
  - Down imaging: similar to Humminbird Down — fish as bright white blobs/commas directly below

═══ ADVANCED ARCH PHYSICS — FROM MANUFACTURER MANUALS ═══

FULL ARCH vs HALF ARCH (CRITICAL for positioning):
• PERFECT SYMMETRICAL ARCH: fish passed directly through the CENTRE of your sonar cone — boat went right over it. This is a HIGH-CONFIDENCE mark. Barra love to sit still letting the boat pass overhead.
• HALF ARCH (only one side of the arc): fish only CLIPPED the EDGE of the cone. The fish is NOT directly below — it's to one side. This affects your cast position significantly.
• LONG HORIZONTAL STREAK (no arch curve): fish is STATIONARY below a stationary or slow-moving boat — fish is NOT moving. This is common for bottom-sitting barra on a snag.

HORIZONTAL LENGTH ≠ FISH SIZE (the most common mistake):
• Horizontal arch width = TIME the fish spent inside the sonar cone
• SHORT STEEP ARCH = fish at trolling speed, or boat moving quickly over fish
• LONG DRAWN-OUT ARCH = fish is SLOW or STATIONARY, OR your boat is barely moving
• A stationary barra under a slow-drifting boat can paint a long horizontal line that looks like "a thick log" — this IS a fish, not structure
• VERTICAL THICKNESS is the TRUE size indicator — thicker = bigger fish/bigger bladder

CHIRP vs SINGLE FREQUENCY EFFECTS ON ARCH QUALITY:
• SINGLE FREQUENCY (83kHz or 200kHz):
  - At 83kHz wide beam: arches are fatter and fuzzier; fish at beam edges produce half-arches that seem small; schools blur together
  - At 200kHz narrow beam: crisper arches; better target separation; but misses fish outside narrow cone
• CHIRP (sweeps across frequency range):
  - Best target separation of any method — can resolve individual fish within a dense school
  - Arches are crisper, thinner (more precise vertical thickness = more accurate size estimate)
  - HUMMINBIRD MEGA Down at 455/800kHz gives near-photographic bottom detail but shows fish as smears not arches

BEAM WIDTH EFFECT ON DISPLAYED DEPTH:
• Wide beam (83kHz, 55–60°): fish at the EDGE of the cone appear DEEPER on screen than they actually are (hypotenuse effect — sonar measures slant distance not vertical depth)
• This means a fish shown at "6m" on a 60° wide beam might actually be at only 5.2m vertical depth
• Narrow beam (200kHz, 15–20°): displayed depth ≈ actual vertical depth (minimal hypotenuse error)

FALSE RETURN IDENTIFICATION (do NOT confuse these with fish):
• THERMOCLINE: A broad diffuse horizontal band (not a thin arch). In NT wet season: freshwater runoff sits on top of heavier saltwater creating a layer at 3–8m. Appears as a wide fuzzy horizontal smear.
• PROP/TURBULENCE: Chaotic scattered returns behind the boat moving right-to-left (air bubbles)
• SURFACE CLUTTER: Dense noise in the top 0.5–2m from wave action/wake
• DEBRIS: Submerged grass, sticks, seaweed — appear as irregular blobs without arch shape
• BAITFISH CLOUD: Dense fuzzy mass of tiny returns, usually mid-column — like static interference
• TEMPERATURE/SALINITY LAYERS: In NT estuaries with heavy runoff — appear as broad light lines, NOT arches

SCHOOL IDENTIFICATION PATTERNS:
• TIGHT SCHOOL (fingermark, bream, thready): Overlapping intertwined arches forming a dense clump; CHIRP separates them into individual arches
• LOOSE SCHOOL (schooling barra, queenfish): Individual arches at similar depth but spread out horizontally — each fish clearly separate
• SOLO HUNTERS (big barra, mangrove jack, jewfish): Single thick arch, often embedded in or directly above structure
• BAIT SCHOOL: Dense irregular fuzzy cloud — smaller marks than fish arches, no clear arch shape

NT-SPECIFIC SONAR CONDITIONS:
• WET SEASON (Nov–Apr): Heavy freshwater inflow = lower salinity = weaker sonar returns overall (less signal conductivity). Arches may appear fainter — this does NOT mean small fish.
• RUN-OFF: Turbid/silty water = bottom echo may be thick/diffuse (silty mud absorbs some return). Hard structure stands out more clearly against a soft mud echo.
• TIDAL CHANNELS: Strong current creates micro-bubbles under boat → surface clutter in top 1–2m. Sensitivity may need reducing.
• SALTWATER/FRESHWATER INTERFACE (Mary River, Daly, Roper): fish congregate at the interface line, visible as a diffuse band on sonar

═══ MANDATORY SPECIES RULE ═══
You MUST ALWAYS return a real species name. NEVER return null, never return empty string "".
If you are uncertain: lower the confidence (25–45) and use the best available evidence.
Acceptable uncertain answers: "Barramundi (probable)", "Suspected Mangrove Jack", "Mixed species school — possibly Threadfin"
UNACCEPTABLE: null, "", "Unknown", "Unclear", no species field at all.
If the image shows NO fish at all: return species "No fish detected", fishCount 0, confidence 0.
This rule is absolute. Every response must contain a meaningful species string.

Depth is also required: always read the depth scale. If scale is not visible, estimate from context and note "(estimated)".
fishCount: count visible arches (2D) or visible bodies (live sonar). Return 0 only if you are certain there are no fish.

═══ CRITICAL OVERRIDE — CV BLOB COUNT ═══
THE CV PRE-SCAN BLOB COUNT IS OFTEN ZERO BECAUSE OpenCV IS NOT AVAILABLE ON THIS SERVER.
A count of "0 blobs" or "BLOB DETECTION UNAVAILABLE" from the CV block means NOTHING about fish presence.
NEVER conclude "No fish detected" or lower your confidence because the blob count is 0 or missing.
Instead: LOOK HARDER at the images. Search every row of IMAGE 2, IMAGE 3, and IMAGE 4 methodically.
The only valid reason to return "No fish detected" is if YOU can visually confirm there are no arches, blobs, or body shapes anywhere in any of the 4 provided images after a thorough search.

═══ RESPONSE ═══
Return ONLY valid JSON — no markdown fences, no explanation, no surrounding text:
{
  "species": "primary species name — REQUIRED, never null",
  "confidence": 85,
  "fishCount": 3,
  "depth": "8.4m",
  "bottomType": "hard rocky reef",
  "sonarBrand": "Lowrance",
  "sonarModel": "HDS Live 9",
  "sonarMode": "traditional-2d",
  "archType": "school",
  "archDepth": 8.4,
  "archXFrac": 0.5,
  "archYFrac": 0.6,
  "suggestion": "2-sentence lure and technique recommendation",
  "lure": "specific lure name and size",
  "technique": "technique description",
  "rig": "leader and rig setup",
  "tidal": "incoming",
  "turbidity": "clear",
  "structure": "hard rocky rubble",
  "bladderShape": "Fat full arch — swim bladder fully inflated, fish cruising [OR for live sonar: Large oval body with long distinct post-cast shadow extending behind the fish — classic Barramundi silhouette]",
  "fishMovement": "Ascending — fish rising to feed [OR for live sonar: Stationary near structure — ambush posture]",
  "crocAlert": false,
  "crocWarning": null,
  "archReasoning": "2D scan: [what arches/shadows were found or 'no arches detected']. Live scan: [what body shapes/shadows were found or 'no body shapes detected']. Cross-reference: [do both methods agree? final confidence reasoning]."
}`;

const ANALYSIS_STEP_PROMPT = `Analyse the sonar image using BOTH methods simultaneously. Output JSON only.

CALIBRATION — TRADITIONAL 2D:
Demo A: Lowrance HDS Live (red/orange palette) — 3 Barramundi at 5.2m, thick bright red/orange arches ON hard bottom structure. Perfect symmetrical arches = full beam pass. Shadow voids beneath each arch confirm large physostomous bladder.
Demo B: Humminbird HELIX 10 (orange palette) — Fingermark school at 8m. Medium-brightness arches floating 2m ABOVE ragged rocky rubble bottom. Arches do NOT touch bottom echo — they float above it. Rubble bottom echo is rough and irregular.
Demo C: Humminbird split-screen — 5–6 Barramundi mid-column. Left panel = FLASHER WHEEL (circular rotating display). Right panel = traditional 2D scroll showing stacked arches with clear DARK SHADOW voids beneath each.
Demo H: Deeper PRO app (phone screenshot, blue UI) — arches with depth labels shown as icons. Wide 47° beam means arches at screen edges are fish at the edge of the cone, not directly below. Central arches most reliable.
Demo I: Garmin ECHOMAP CHIRP (aqua palette, white=strongest) — single thick white-core arch at 4.5m with clear shadow. Garmin's palette = white core surrounded by blue/green halo = very strong Tier 1 return = barra or fingermark.
Demo J: Simrad NSS with StructureScan — LEFT = traditional 2D (red/orange palette); RIGHT = side imaging showing fish as bright comma-shaped marks off the bottom line on both sides of the centre.

CALIBRATION — LIVE SONAR:
Demo D: Garmin LiveScope Forward (dark green-grey bg, "LIVESCOPE" text) — single large Barramundi at 4m near timber pylon. Bright white oval body with a LONG dark "post-cast shadow" extending behind/below the body — shadow ≈ same length as body. Blunt-nosed profile. Stationary.
Demo E: Humminbird MEGA Live (orange accents, "MEGA LIVE" text) — school of Threadfin Salmon mid-column. 8–12 smaller bright oval-orange blobs at the same depth, each with a short shadow. Warmer orange tint vs Garmin's cooler grey-white.
Demo F: Garmin LiveScope Forward — Mangrove Jack tight against timber. Compact round body partially merged into bright structure echo, minimal shadow. Fish barely moves.
Demo G: SPLIT SCREEN — LEFT = traditional 2D with barra arch ON structure; RIGHT = LiveScope showing same fish as bright oval body with long shadow next to bright echo. Both confirm Barramundi → confidence +15%.
Demo K: Lowrance ActiveTarget 2 SCOUT MODE — fish visible BEHIND the boat (transducer facing rearward). Fish appear as blobs moving toward boat from the rear. Navy/grey background, "ACTIVE TARGET" or "ACTIVETARGET 2" label.
Demo L: Humminbird MEGA 360 — CIRCULAR bird's-eye display (radar-like), boat at centre. Fish appear as bright dots or short arcs at their distance from centre on the 360° sweep. NOT a traditional scroll — it's a top-down radial view.
Demo M: Garmin LiveScope PERSPECTIVE mode — overhead/angled bird's-eye view of shallow flats (<20ft). Fish appear as oval blobs moving on a 2D plane. Used for sight-fishing on flats.

STEPS (run ALL of them, every time):
1. LAYOUT & MODE: Is the image a single panel or split screen? Identify EACH panel:
   - Traditional 2D scroll (time axis right→left, arched returns)
   - Live sonar Forward (horizontal distance axis, fish as blobs looking ahead)
   - Live sonar Down (real-time vertical view directly below)
   - Live sonar Perspective (overhead bird's-eye, shallow water)
   - Live sonar Scout (ActiveTarget 2 only — looking BEHIND boat)
   - MEGA 360 circular (radar-like 360° radial sweep, round display)
   - Humminbird Flasher Wheel (circular rotating ping on left panel of split screen)
   - StructureScan / Side Imaging (fish as comma/smear marks off bottom line)
   - Deeper app (phone UI, blue gradient, fish icons with depth labels)

2. BRAND & FREQUENCY:
   - UI chrome, bezel, colour palette, text labels
   - "LIVESCOPE"=Garmin forward/down/perspective. "ACTIVE TARGET"/"ACTIVETARGET 2"=Lowrance (Scout mode if rearward view). "MEGA LIVE"/"MEGA 360"=Humminbird.
   - Flasher wheel on left of split = Humminbird HELIX/SOLIX
   - Blue phone UI = Deeper app. Aqua UI + compass logo = Garmin. Teal buttons + red palette = Lowrance. Orange logo = Humminbird.
   - Estimate frequency if visible: "CHIRP" label, "200kHz", "83kHz", "455kHz" etc.
   - NOTE if wide beam (83kHz/47°) — edge arches may be false; focus on central arches only

3. FALSE RETURN REJECTION — check BEFORE identifying fish:
   - Thermocline / salinity layer: BROAD DIFFUSE HORIZONTAL BAND across multiple depth rows — NOT a fish. In NT wet season typically at 3–8m. Rule it out first.
   - Surface clutter: chaotic noise in top 0.5–1.5m from waves/wake — not fish
   - Prop bubbles: scattered random returns scrolling left (just appeared in the history) — not fish
   - Bait cloud: dense irregular fuzzy mass, uniform small returns with no clear arch structure — bait not predators
   - Debris: irregular blob without symmetrical arch curve — check for arch shape before calling it a fish

4. 2D SCAN — search the 2D panel or full image for ARCHES:
   - Check arch completeness: FULL arch (high confidence, fish was directly below) vs HALF arch (fish at cone edge — to one side)
   - Check horizontal length: SHORT steep arch = fast-moving fish OR boat moving; LONG flat line = stationary fish (classic barra resting on snag)
   - Arch brightness tier: red/orange/white core=Tier1 (barra/jack/fingermark/thready); yellow/green=Tier2; faint/invisible=Tier3
   - Shadow void BELOW arch = big predator 90%+ confidence
   - Position: ON or touching structure=barra/jack | floating ABOVE rubble=fingermark | mid-column soft=thready | buried IN echo=jack

5. LIVE SCAN — search the live panel for BODY SHAPES + SHADOWS:
   - Large oval body + long post-cast shadow + near structure = Barramundi
   - Large oval + long shadow + mid-column = Barramundi chasing bait
   - Tall/round body + fast movement + faint/no shadow = Giant Trevally
   - Compact chunky body + embedded in structure + stationary = Mangrove Jack
   - Multiple slim bodies mid-column + short shadows + soft bottom = Threadfin Salmon
   - Tiny bright dots on flats (Perspective mode) = baitfish or small species

6. DEPTH: Read the depth scale from whichever panel shows it. In wide-beam mode (83kHz), displayed depth may be 10–15% deeper than actual for fish at beam edges. Eliminate species outside their known NT depth zone.

7. CROSS-REFERENCE: Do 2D and live results agree? Both confirm same species → boost confidence 10–15%. One silent → use the method that found fish, note the other. Conflict → strongest evidence wins; explain in archReasoning.

8. FINAL ID: COMMIT to a species name. Reduce confidence if unsure but NEVER leave species null or empty. Output ONLY the JSON object — no text before the { bracket.

9. INTELLIGENCE CHECK: Cross-reference your ID against the BRAIN LIBRARY & COMMUNITY INTELLIGENCE block above. Hot species at this depth and region → boost confidence 5–10%. Unusual ID vs strong community evidence → note in archReasoning, reduce confidence 5–10% unless sonar evidence is very clear.`;

// ─── Brain library + community intelligence context ───────────────────────────
// Fetched in parallel with the CV scan before every analysis. Gives GPT
// ground-truth about which species are actually being caught at the moment,
// at what depths, and at which NT locations so it can cross-check its ID.

async function getIntelligenceContext(): Promise<string> {
  try {
    const [brainRows, insightRows, recentReports] = await Promise.all([
      db.select({
        species: brainVideos.detectedSpecies,
        depths:  brainVideos.depthRanges,
      })
        .from(brainVideos)
        .where(eq(brainVideos.status, "done"))
        .orderBy(desc(brainVideos.submittedAt))
        .limit(60),

      db.select()
        .from(communityInsights)
        .orderBy(desc(communityInsights.generatedAt))
        .limit(1),

      db.select({
        species:  communityReports.species,
        depth:    communityReports.depth,
        location: communityReports.locationName,
      })
        .from(communityReports)
        .orderBy(desc(communityReports.submittedAt))
        .limit(40),
    ]);

    // Species frequency from brain library
    const libCount: Record<string, number> = {};
    const libDepths: Record<string, number> = {};
    for (const row of brainRows) {
      for (const s of (row.species as string[] | null) ?? []) {
        if (s && s !== "Unknown species") libCount[s] = (libCount[s] ?? 0) + 1;
      }
      for (const d of (row.depths as string[] | null) ?? []) {
        if (d) libDepths[d] = (libDepths[d] ?? 0) + 1;
      }
    }
    const topLib = Object.entries(libCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([s, n]) => `${s} (${n})`).join(", ");
    const topLibDepths = Object.entries(libDepths)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([d, n]) => `${d} (${n})`).join(", ");

    // Species + location frequency from community reports
    const comCount: Record<string, number> = {};
    const comLocations: string[] = [];
    const comDepths: string[] = [];
    for (const r of recentReports) {
      if (r.species && r.species !== "Unknown species") {
        comCount[r.species] = (comCount[r.species] ?? 0) + 1;
      }
      if (r.location) comLocations.push(r.location);
      if (r.depth)    comDepths.push(r.depth);
    }
    const topCom = Object.entries(comCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([s, n]) => `${s} (${n})`).join(", ");

    type HotSpeciesRow = { species: string; count: number; trend?: string };
    type HotDepthRow   = { range: string; count: number; notes?: string };
    const hotSpecies  = ((insightRows[0]?.hotSpecies  as HotSpeciesRow[] | null) ?? [])
      .slice(0, 5)
      .map(h => `${h.species} (${h.count} reports, ${h.trend ?? "stable"})`)
      .join(", ");
    const hotDepths   = ((insightRows[0]?.hotDepths   as HotDepthRow[] | null) ?? [])
      .slice(0, 4)
      .map(h => `${h.range}: ${h.notes ? h.notes.slice(0, 60) : `${h.count} reports`}`)
      .join(" | ");
    const hotLocations= ((insightRows[0]?.hotLocations as string[] | null) ?? []).slice(0, 5).join(", ");
    const insightSum  = insightRows[0]?.summary ?? "";

    const uniqueLocs  = [...new Set(comLocations)].slice(0, 5).join(", ");
    const uniqueDepths= [...new Set(comDepths)].slice(0, 6).join(", ");

    const lines: string[] = [
      `\n\n═══ BRAIN LIBRARY & COMMUNITY INTELLIGENCE (${brainRows.length} library scans + ${recentReports.length} community reports) ═══`,
      `Use this real-world NT fishing data to cross-check your sonar ID:`,
    ];
    if (topLib)       lines.push(`LIBRARY top species: ${topLib}`);
    if (topLibDepths) lines.push(`LIBRARY active depths: ${topLibDepths}`);
    if (topCom)       lines.push(`COMMUNITY top species (recent): ${topCom}`);
    if (hotSpecies)   lines.push(`HOT species right now: ${hotSpecies}`);
    if (hotDepths)    lines.push(`HOT depth zones: ${hotDepths}`);
    if (uniqueDepths || hotLocations) {
      lines.push(`ACTIVE depths (recent community): ${uniqueDepths || "n/a"}`);
      lines.push(`ACTIVE locations: ${hotLocations || uniqueLocs || "n/a"}`);
    }
    if (insightSum)   lines.push(`INTELLIGENCE: ${insightSum}`);
    lines.push(
      `RULE: If your sonar ID matches the library/community top species at this depth → confidence +5–10%. ` +
      `If your ID is unusual vs strong community data → note in archReasoning and confidence −5–10% unless sonar evidence is clear.`
    );

    return lines.join("\n");
  } catch {
    return "";
  }
}

// ─── Detect MIME type from base64 magic bytes ─────────────────────────────────
function detectMimeType(base64: string): "image/jpeg" | "image/png" | "image/webp" {
  const prefix = base64.slice(0, 8);
  if (prefix.startsWith("/9j/")) return "image/jpeg";
  if (prefix.startsWith("iVBORw0")) return "image/png";
  if (prefix.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

router.post("/analyze", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  try {
    // ── Run CV scan + zoom crops + intelligence fetch in parallel ─────────
    const [cvScan, zoomCrops, intelligenceCtx] = await Promise.all([
      analyzeSonarImage(imageBase64),
      generateZoomCrops(imageBase64),
      getIntelligenceContext(),
    ]);

    const condCtx  = getConditionsContext();
    const cvBlock  = cvScan ? "\n\n" + formatCvContext(cvScan) : "";

    // Build zoom context note so GPT knows what it's looking at
    const zoomNote = zoomCrops
      ? `\n\nZOOM CROPS ATTACHED: You have been given 4 images below.\n` +
        `  IMAGE 1 (FULL FRAME): Complete sonar display — use for overall layout, depth scale, and brand ID.\n` +
        `  IMAGE 2 (LEFT PANEL ZOOM): Left half of the screen at 2× detail — scan EVERY row methodically for any arch shape, curved return, or blob. Do not skip a single row.\n` +
        `  IMAGE 3 (RIGHT PANEL ZOOM): Right half at 2× detail — same rigorous row-by-row scan.\n` +
        `  IMAGE 4 (TIGHT CROP): Auto-cropped around the brightest activity region (most active: ${zoomCrops.mostActive} side)${zoomCrops.blobRegion ? ` — pixel box x:${zoomCrops.blobRegion.x} y:${zoomCrops.blobRegion.y} w:${zoomCrops.blobRegion.w} h:${zoomCrops.blobRegion.h}` : ""}. THIS IS YOUR PRIMARY ID SURFACE — examine pixel-by-pixel for any arch curvature, shadow void, or blob shape.\n` +
        `  INSTRUCTION: Identify fish using the TIGHT CROP and PANEL ZOOM that contains them. The full frame gives context (depth scale, palette, temperature). Never skip the zoomed images.`
      : "";

    const analysisPrompt = `${condCtx ? condCtx + "\n\n" : ""}${intelligenceCtx}${zoomNote}\n\n${ANALYSIS_STEP_PROMPT}${cvBlock}`;

    // Detect actual image MIME type so vision API gets correct format header
    const mimeType = detectMimeType(imageBase64);

    // ── Sonar Brain: inject cross-modal few-shot references ───────────────
    // ORDER:
    //   1. Barramundi BODY PHOTO (from Barra Brain / iNaturalist) — anatomy lesson:
    //      shows the physostomous swim bladder that creates the thick arch + shadow void.
    //   2. Confirmed sonar arch demos (Lowrance barra, Humminbird barra w/ shadows).
    //   3. Negative contrast demo (Garmin threadfin school).
    // This cross-modal grounding ties body anatomy knowledge to sonar arch physics.
    const sonarRefs    = getSonarFewShotRefs();
    const barraBodyRef = getBarraBodyRefs(1);   // 1 iNaturalist research-grade barra photo

    type ImagePart = { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' } };
    type TextPart  = { type: 'text'; text: string };
    const content: Array<ImagePart | TextPart> = [];

    const hasBrainRefs = sonarRefs.length > 0 || barraBodyRef.length > 0;
    if (hasBrainRefs) {
      content.push({ type: 'text', text: 'SONAR BRAIN — cross-modal reference package (study all before analysing):' });

      // Step 1: Body anatomy (cross-modal bridge)
      if (barraBodyRef.length > 0) {
        const bp = barraBodyRef[0];
        content.push({ type: 'text', text: `STEP 1 — BARRAMUNDI BODY ANATOMY (iNaturalist, ${bp.location}):\nThe large PHYSOSTOMOUS SWIM BLADDER (pale gas sac in upper body cavity) is enormously reflective — it creates the THICK BRIGHT ARCH + SHADOW VOID on sonar. Deep laterally-compressed body = wider/taller arch than threadfin.` });
        // Use pre-compressed base64 thumb when available (avoids OpenAI → iNat URL fetch)
        const barraImgUrl = bp.thumbBase64
          ? `data:image/jpeg;base64,${bp.thumbBase64}`
          : bp.photoUrl;
        content.push({ type: 'image_url', image_url: { url: barraImgUrl, detail: 'low' } });
        content.push({ type: 'text', text: `↑ Confirmed barramundi — ${bp.location} (${bp.votes} expert votes). Connect this anatomy to the sonar arch signatures below.` });
      }

      // Step 2: Sonar arch positive refs
      const posRefs = sonarRefs.filter(r => r.isPositive);
      const negRefs = sonarRefs.filter(r => !r.isPositive);
      if (posRefs.length > 0) {
        content.push({ type: 'text', text: `STEP 2 — CONFIRMED BARRAMUNDI SONAR ARCHES (${posRefs.length} expert demos):` });
        for (const ref of posRefs) {
          content.push({ type: 'image_url', image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: 'low' } });
          content.push({ type: 'text', text: `↑ CONFIRMED BARRAMUNDI — ${ref.brand}: ${ref.label.split('\n')[0]}` });
        }
      }

      // Step 3: Negative contrast ref
      if (negRefs.length > 0) {
        content.push({ type: 'text', text: `STEP 3 — CONTRAST (NOT BARRA):` });
        for (const ref of negRefs) {
          content.push({ type: 'image_url', image_url: { url: `data:${ref.mimeType};base64,${ref.base64}`, detail: 'low' } });
          content.push({ type: 'text', text: `↑ NOT BARRAMUNDI — ${ref.brand}: ${ref.label.split('\n')[0]}` });
        }
      }

      content.push({ type: 'text', text: `STEP 4 — NOW ANALYSE THE USER'S SONAR IMAGE BELOW (${zoomCrops ? 4 : 1} image${zoomCrops ? 's' : ''} including zoom crops). Apply cross-modal reasoning: body anatomy → sonar physics → verdict.` });
    }

    // ── Build vision message content — full image + zoom crops ───────────
    content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } });
    if (zoomCrops) {
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${zoomCrops.leftHalf}`,  detail: 'high' } });
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${zoomCrops.rightHalf}`, detail: 'high' } });
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${zoomCrops.blobCrop}`,  detail: 'high' } });
    }
    content.push({ type: 'text', text: analysisPrompt });

    // ── Streaming OpenAI call ─────────────────────────────────────────────
    const stream = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 1400,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    });

    // Stream each chunk directly to the HTTP response — client sees first byte in ~1s
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let raw = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        raw += delta;
        res.write(delta);
      }
    }

    // Append CV blob positions so the app can overlay exact marker dots
    if (cvScan && cvScan.topBrightRegions.length > 0) {
      const payload = JSON.stringify({
        regions: cvScan.topBrightRegions,        // [{xFrac, yFrac, size}]
        mostActive: zoomCrops?.mostActive ?? null, // "left" | "right"
      });
      res.write(`\n__CV__:${payload}`);
    }

    res.end();

    // Server-side log only — client already parsed the streamed JSON
    req.log.info({ chars: raw.length }, 'Streaming analysis complete');
  } catch (err) {
    req.log.error({ err }, 'OpenAI analyze request failed');
    res.status(500).json({ error: 'Analysis failed. Check your connection and try again.' });
  }
});

export default router;
