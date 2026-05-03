/**
 * Live Sonar Expert Knowledge
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared prompt fragments for all live sonar analysis routes.
 *
 * Sources:
 *   • Humminbird MEGA Live 2 operator manual (2025)
 *   • Garmin LiveScope Plus LVS34 owner's manual
 *   • Lowrance ActiveTarget 2 installation + operation guide
 *   • Simrad/Navico live sonar documentation
 *   • Expert angler guides: Insalt Lures (WA Kimberley), Western Angler (NT),
 *     Gary Howard Fishing (QLD), Brad Underwood Bass/Live Scope tutorials,
 *     FishingNoah YouTube channel, Fishing With Norman (bass live scope)
 *   • Australian saltwater croc sonar reports (NT Fisheries, WA DEC)
 *
 * Compiled from manufacturer documentation, guide commentary, and expert
 * angler interviews explaining what they see and how they read each display mode.
 */

// ─── Display mode identification ──────────────────────────────────────────────

export const MODE_IDENTIFICATION = `
════════════════════════════════════════
STEP 1 — IDENTIFY DISPLAY MODE (CRITICAL — interpretation changes completely):
════════════════════════════════════════

▸ FORWARD MODE (most common for croc + fish detection):
  Visual tells: boat/transducer icon sits at TOP-CENTRE of screen. Water column fans downward and outward from this point.
  Layout: TOP = near surface in front of boat. BOTTOM = deep water ahead. LEFT/RIGHT = lateral left/right ahead of boat.
  Fish position: fish at 3m depth appear in upper-third of water column; fish at 8m appear lower.
  Croc on FORWARD: HIGHEST PRIORITY — a croc swimming in front of the boat appears at ROWS 1–2 (near-surface).
                    Massive blob spanning several columns at rows 1–2. May drift left or right across frames.
  Movement read: blob moving LEFT = object swimming to port. Moving RIGHT = starboard. Moving UP = coming toward boat (shallower). Moving DOWN = swimming away (deeper).

▸ DOWN MODE (looking directly beneath the boat):
  Visual tells: display is often more square/symmetrical; no boat icon at top. Depth scale on right edge. Bottom echo is visible but the cone is directly below.
  Layout: TOP = just below the hull (shallowest). BOTTOM = seabed. LEFT/RIGHT = lateral distance below (port/starboard).
  Fish position: fish appear at their actual depth below the boat. Center columns = directly below; outer columns = off to the side.
  Croc on DOWN: A croc directly below the boat = massive blob at rows 3–5 (they rarely swim directly under; more likely rows 1–2 in forward mode). If a very large irregular blob appears at rows 1–3 in down mode = very close to hull — trigger crocAlert.
  Movement read: blob moving LEFT/RIGHT = fish swimming laterally beneath boat. A blob appearing then disappearing = fish swam out of the cone.

▸ SCOUT MODE (Lowrance/Simrad ActiveTarget 2 — 180° wide sweep):
  Visual tells: VERY WIDE horizontal image. Boat silhouette at centre-top. Shows both port and starboard sides simultaneously.
  Layout: CENTRE = directly ahead. LEFT = far port. RIGHT = far starboard. TOP = near boat, BOTTOM = farther ahead at depth.
  Fish position: fish at distance appear toward outer columns (A/B or G/H). Fish close to boat appear in centre columns (D/E).
  Movement read: blob moving from outer to inner columns = fish approaching boat.
  Croc on SCOUT: large blob anywhere in the top rows (near surface) spanning several columns = croc.

▸ LANDSCAPE MODE (Humminbird MEGA Live exclusive — wide horizontal):
  Visual tells: Very wide aspect ratio. Humminbird orange UI chrome. Shows a wide horizontal sweep.
  Fish appear as horizontal bright bars/streaks. Structure = dim irregular shapes.
  Movement read: blob moving laterally = fish swimming to side. Blob growing = fish approaching.

▸ PERSPECTIVE MODE (Garmin LiveScope exclusive — overhead bird's-eye view):
  Visual tells: Garmin dark-green background. Overhead/aerial look. Fish appear as top-view ovals.
  Shadow extends to ONE SIDE (left or right), not below. Very different from forward mode.
  Fish depth indicated by shadow length and position in frame. Croc = enormous top-view blob near bank.
  Movement read: blob moving toward boat = fish approaching.

▸ TRADITIONAL 2D / CHIRP (NOT live sonar — scrolling display):
  Visual tells: image SCROLLS horizontally — newest data enters from the RIGHT. Shows a time history.
  Fish appear as U-shaped ARCHES (∩). Bottom = continuous horizontal line.
  THIS IS NOT A LIVE SONAR FRAME — movement between frames ≠ fish swimming; the whole image shifts.
`;

// ─── Live sonar visual appearance guide ───────────────────────────────────────

export const VISUAL_APPEARANCE = `
════════════════════════════════════════
LIVE SONAR VISUAL APPEARANCE (by brand):
════════════════════════════════════════

▸ HUMMINBIRD MEGA Live 2:
  Background: near-black (darkest of all brands). Orange/amber UI chrome, depth numbers.
  Fish: BRIGHT WHITE or ORANGE crisp ovals. When TargetBoost™ active: very sharp white-orange edges.
  Shadow: long distinct black void extending behind/below each fish. Easiest shadow to see of any brand.
  Structure: appears grey-green; dimmed by TargetBoost contrast making fish stand out strongly.

▸ GARMIN LiveScope Plus (LVS34):
  Background: DARK GREEN / TEAL — signature "night vision green". This is the brand's unique tell.
  Fish: CRISP white-green silhouettes with sharp black outlines against the green background.
  Shadow: dark green/black void, clearly visible against teal background.
  Special: Perspective mode (overhead view) — fish appear as top-view ovals, shadow extends to one SIDE.

▸ LOWRANCE ActiveTarget 2 / SIMRAD:
  Background: DARK NAVY / DARK GREY — cooler, blue-grey tint.
  Fish: medium-brightness oval blobs with distinct trailing shadows.
  Special: Scout mode — 180° wide sweep, very wide image.

ALL LIVE SONAR (any brand):
  • NO ARCHES. Fish are BLOBS, OVALS, SILHOUETTES — never U-shaped arches.
  • Bottom echo = bright curved/angled band at the base of the image.
  • Structure (snags, rocks, logs) = bright irregular blobs that DO NOT move between frames.
  • Each frame is a LIVE SNAPSHOT — not a scrolling history.
`;

// ─── Movement interpretation guide (mode-aware) ───────────────────────────────

export const MOVEMENT_GUIDE = `
════════════════════════════════════════
MOVEMENT TRACKING (most important signal):
════════════════════════════════════════

WHAT MOVES vs WHAT STAYS:
  Static (stays in same zone across ALL frames): bottom echo, rocks, submerged logs, snags, pylons, banks.
  Moving (shifts zone or appears briefly): fish, crocodiles, anything alive.

HOW TO TRACK:
  • Compare each frame to the previous frame zone by zone.
  • Any blob/zone that shifts even 1 grid position = MOVING TARGET — add to movingZones.
  • A return visible in only 1–2 frames = fish passed through — add to movingZones.
  • A return present in ALL 5 frames in the SAME zone = staticZones only.

MOVEMENT SPEED GUIDE:
  Very fast (3+ zones per frame): Giant Trevally, Queenfish, Mackerel — feeding/chasing mode.
  Medium (1–2 zones per frame): Threadfin school, Bream, most active fish.
  Slow (0–1 zone per frame): Barramundi, Mangrove Jack — ambush mode, barely drifts.
  Very slow continuous drift: CROCODILE — moves at near-walking pace.
  Zero: Structure, rocks, bottom.

MOVEMENT DIRECTION (FORWARD MODE):
  Left-right movement = fish swimming laterally across the field in front of boat.
  Upward movement (deeper to shallower rows) = fish approaching the boat (getting shallower as it closes distance).
  Downward movement = fish moving away, or diving deeper.

MOVEMENT DIRECTION (DOWN MODE):
  Left-right movement = fish swimming laterally beneath the boat.
  Appearing in outer columns then moving to centre = fish swimming under the boat.
  Disappearing = fish exited the cone.

BAIT SCHOOL + PREDATOR PATTERN:
  A cloud of small bright dots/blobs (bait school) near a large single blob (predator) = active feeding scenario.
  The large blob may move rapidly (GT/queenfish) or slowly dart at the school (barra).

RULE: Report movement AGGRESSIVELY. If in doubt — report it. False positive = fine. Missed movement = failure.
`;

// ─── Crocodile detection guide (mode-specific) ────────────────────────────────

export const CROC_GUIDE = `
════════════════════════════════════════
🚨 CROCODILE DETECTION — SAFETY CRITICAL:
════════════════════════════════════════

Saltwater crocodile (Crocodylus porosus) on live sonar:

BODY:
  • ENORMOUS solid-filled blob — 3–6× LARGER than any fish blob on screen.
  • Width:length ratio close to 1:2 or 1:3 (squat, wide body). Compare: barra is 1:4+ (very elongated).
  • In forward mode appears as a MASSIVE rectangular/irregular blob spanning 3–5+ columns at rows 1–2.
  • Maximum brightness return (solid body, no air pockets to create void in the return).
  • HUGE shadow extending behind the body — but the body itself is WIDER than any fish.

POSITION BY MODE:
  FORWARD MODE: Croc near surface = rows 1–2, any columns. This is the most dangerous and most common detection scenario. Croc swimming toward the boat rises toward rows 1 as it approaches.
  DOWN MODE: Croc directly below = rows 1–4 depending on depth. A blob at rows 1–3 that is dramatically larger than anything else = croc.
  SCOUT MODE: Large blob at rows 1–2 at any column position = croc near surface.

MOVEMENT:
  • Slow, CONTINUOUS, steady lateral drift — unlike fish which pause, dart, and stop.
  • Typically crosses 1–2 zones per frame (croc swimming pace ≈ 1–2 km/h).
  • Does NOT dart or burst-move like GT or barra.

HOW TO DISTINGUISH CROC FROM LARGE FISH:
  • Width: croc body is MUCH wider relative to length than any fish. A 4m croc at 2m depth appears nearly as wide as it is long on screen.
  • No long elongated torpedo shape — croc is bulky/rectangular, not streamlined like barra.
  • Near surface: large fish (barra, GT, fingermark) prefer structure or deeper water; a massive blob at the very surface = croc.
  • Barra: elongated torpedo, long shadow, near structure, mostly stationary.
  • Croc: wide solid rectangular blob, near surface, slow continuous drift, no structure attachment.

DECISION RULE — DO NOT HESITATE:
  If ANY return at or near the surface (rows 1–2) is SUBSTANTIALLY LARGER than other returns on screen:
    → Set crocAlert: true
    → Fill crocWarning with: size estimate, position (which grid zones), movement direction, confidence.
  A false positive croc alert = annoying. A missed real croc = dangerous or fatal.
`;

// ─── Species quick reference (condensed for multi-frame use) ──────────────────

export const SPECIES_QUICK_REF = `
════════════════════════════════════════
SPECIES QUICK REFERENCE (live sonar blobs):
════════════════════════════════════════

BARRAMUNDI: Large bright elongated oval (4:1 to 5:1 L:H). Very long shadow (≥ body length). Near structure (snag, pylon, rock). STATIONARY or very slow drift. Solo or pair max 2–3. High brightness.
GIANT TREVALLY (GT): Tall round deep body (~1.5:1 L:H). No shadow or faint shadow. FAST movement — blob blurs or smears. Open water. Often 2–6 together.
MANGROVE JACK: Compact stocky body (2:1 L:H). HIGH brightness. Body partially FUSED INTO structure echo (you cannot see clean edge between fish and snag). Near-zero movement. Solo or pair at ONE piece of structure.
THREADFIN SALMON: Slender thin body (4.5:1+ L:H, thinner than barra). SHORT shadow. MID-COLUMN away from hard structure. GROUP of 5–20+ all moving the SAME direction at same speed.
FINGERMARK: Deep-bodied round oval (2.5:1 L:H). Medium shadow. FLOATING ABOVE rough rubble/reef. Loose group 2–8.
QUEENFISH: Very slim (5:1+). Near surface. HIGH SPEED — streaks or blurs.
BAITFISH / SMALL SPECIES: Tiny dots or micro-blobs. Often in tight swirling clouds.
CROCODILE: See CROC_GUIDE — always highest priority to detect. Never miss a croc.
`;
