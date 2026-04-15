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
  distanceFromKarumba: string;
  distanceFromDarwin?: string;
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
    id: "norman",
    name: "Norman River",
    shortName: "Norman R.",
    region: "Gulf of Carpentaria",
    distanceFromKarumba: "0 km (at mouth)",
    maxDepth: 8,
    access: "Sealed road to Karumba. Norman River ramp at Karumba Point. Normanton ramp 70 km upstream.",
    bestSeason: "Build-Up & Wet Oct–Feb",
    character:
      "Queensland's most accessible Gulf river — 70 km of tidal estuary from Normanton to Karumba Point. Spring-fed and tidally influenced, the Norman holds barramundi year-round with peak action during the build-up and early wet season. Dense mangrove banks hide barra to 1 m on every run-out tide.",
    zones: [
      {
        minM: 0,
        maxM: 1.5,
        label: "Surface / Tidal Flat",
        species: ["Queenfish", "Barramundi", "Threadfin Salmon"],
        tideStage: "Run-in tide — dawn",
        technique:
          "Walk surface lures parallel to the beach at Karumba Point or across the tidal flat. Queenfish will blow up on anything that moves from May–September. Barra nail surface lures on the flooding tide at first light.",
        lure: "Surface walker 90–120mm, chartreuse or white",
        hotness: "fire",
        notes:
          "The Karumba Point beach is one of the Gulf's most reliable queenfish and surface barra venues. Dry season dawn sessions produce fish every morning. The 0–1.5 m tidal flat is the strike zone.",
      },
      {
        minM: 1.5,
        maxM: 4,
        label: "Mangrove Bank / Mid Estuary",
        species: ["Barramundi", "Mangrove Jack", "Black Jewfish"],
        tideStage: "Run-out — 1–3 hrs after high",
        technique:
          "Work a 90mm rattling hard-body along undercut mangrove banks parallel to the current. Let it swing with the run-out and pause at timber ambush points. Cast past the snag, retrieve through the zone.",
        lure: "Rattling hard-body 90mm, bone or chartreuse",
        hotness: "fire",
        notes:
          "This is the bread-and-butter barra depth on the Norman. The run-out at mid-estuary pours baitfish past ambush points where barra hold tight under mangrove roots. Fish each snag individually.",
      },
      {
        minM: 4,
        maxM: 8,
        label: "Main Channel / Deep Hole",
        species: ["Black Jewfish", "Barramundi", "Mud Crab"],
        tideStage: "All tides — best run-out at night",
        technique:
          "Drop heavy vibes (60–80g) vertically into the deep-hole channel near Normanton Wharf. Live mullet or strips of fresh mullet fished on a running sinker rig accounts for big jewfish at night.",
        lure: "Heavy vibe 60–80g, live mullet or fresh cut bait",
        hotness: "hot",
        notes:
          "The Normanton Wharf deep hole produces trophy black jewfish at night — fish over 15 kg are caught here every year. Barra also stack in the deep channel on the run-out. Set a crab pot on arrival.",
      },
    ],
    historicalNote:
      "The Norman River supported a substantial commercial barramundi netting industry through the 1960s–80s. Trawling for prawns and netting for barra occurred throughout the lower estuary before recreational pressure and environmental legislation changed the fishery management approach.",
    nettingHistory: {
      era: "1960s–1980s",
      area: "Norman River lower estuary (Karumba to Normanton)",
      depthRange: "1–5 m tidal estuary",
      detail:
        "Commercial gillnet operations targeted barramundi across the tidal reach. Data from Queensland Fisheries records indicate peak harvests of 100–250 tonnes annually from the Norman system. The transition to recreational-focused management significantly rebuilt barra stocks.",
    },
    proTip:
      "Fish the first run-out after a neap tide becomes a spring tide — when the tidal differential is greatest, barra feed hardest. Karumba Point to Normanton is 70 km of river; fish the section that matches the current tide stage for maximum results.",
    lat: -17.623,
    lng: 140.912,
  },
  {
    id: "mitchell",
    name: "Mitchell River",
    shortName: "Mitchell R.",
    region: "Gulf of Carpentaria",
    distanceFromKarumba: "190 km north",
    maxDepth: 10,
    access: "Charter flights from Cairns or Karumba to Kowanyama. Boat access only to river mouth. No sealed road.",
    bestSeason: "Build-Up & Wet Oct–Mar",
    character:
      "Queensland's largest Gulf river system — the Mitchell, Alice, and Palmer rivers join to form an enormous tidal estuary. Remote and pristine, the Mitchell produces trophy barramundi every season. The river mouth bar is legendary among serious Gulf anglers.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Bar / Tidal Flat",
        species: ["Barramundi", "Threadfin Salmon", "Queenfish"],
        tideStage: "Run-out — outer bar at low tide",
        technique:
          "Work surface lures and metal slices across the outer bar formation on the run-out. Barra and threadfin stack at the bar waiting for baitfish to funnel through. Cast across the current and allow the lure to work with the flow.",
        lure: "Surface popper 100mm, metal slice 40g",
        hotness: "fire",
        notes:
          "The Mitchell River mouth bar is one of Queensland's most productive but least-accessed barra venues. Fishing pressure is extremely low — a boat and camping gear are the only way in. Fish from a dinghy working the bar zone.",
      },
      {
        minM: 2,
        maxM: 6,
        label: "Lower Estuary Snag Country",
        species: ["Barramundi", "Golden Snapper", "Mangrove Jack"],
        tideStage: "Run-in and run-out",
        technique:
          "Work suspending minnows through submerged timber and bank structure. The Mitchell's lower estuary has dense snag fields — work each one systematically. Golden snapper and fingermark are common in this zone alongside barra.",
        lure: "Suspending minnow 90–100mm, pearl or bone",
        hotness: "hot",
        notes:
          "The Mitchell produces golden snapper (fingermark) along with barra in the middle estuary — a species combination unique to remote Cape York river systems. Trophy fish over 70 cm barra are common due to low pressure.",
      },
      {
        minM: 6,
        maxM: 10,
        label: "Deep Channel / Junction Hole",
        species: ["Barramundi", "Black Jewfish", "Mud Crab"],
        tideStage: "Run-out — junction with Alice River",
        technique:
          "Drop heavy metals or live bait into the deepest section of the Alice/Mitchell junction on the run-out. Barra stack in the deepest channel bend waiting for baitfish to pour through the junction.",
        lure: "Heavy metal jig 60g, live bream or mullet",
        hotness: "hot",
        notes:
          "The confluence of the Alice River into the Mitchell creates a deep scoured hole — 10 m or more of barra-holding water. This junction point fires on the run-out as baitfish flush from the shallower Alice system.",
      },
    ],
    historicalNote:
      "The Mitchell River system was identified by Queensland Fisheries as one of the state's premier barramundi nursery systems in the 1980s. Its remoteness effectively limited commercial exploitation, and the fishery remains largely intact today.",
    proTip:
      "Time your Mitchell River trip to the first neap tides after the October rains hit — barra come alive in the run-off turbidity and will smash anything that moves. Pack a week's supplies and plan for no communication in the lower river system.",
    lat: -15.225,
    lng: 141.583,
  },
  {
    id: "gilbert",
    name: "Gilbert River",
    shortName: "Gilbert R.",
    region: "Gulf of Carpentaria",
    distanceFromKarumba: "100 km north",
    maxDepth: 7,
    access: "Helicopter or high-speed boat from Karumba. Remote — full self-sufficiency required. No facilities.",
    bestSeason: "Build-Up Oct–Jan",
    character:
      "The Gilbert enters the Gulf between the Norman and Mitchell systems. Remote, productive, and almost always featuring in Gulf barra stories. Very few anglers fish this system — the ones who do rarely leave empty-handed.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Outer Bar / Beach",
        species: ["Barramundi", "Queenfish", "Threadfin Salmon"],
        tideStage: "Run-out — outer bar",
        technique:
          "Work the outer sand bar with surface lures and metal slices as bait schools push out on the run-out. Queenfish and threadfin run the bar hard in the dry season mornings.",
        lure: "Metal slice 30–40g, surface walker 90mm",
        hotness: "hot",
        notes:
          "The Gilbert outer bar can be productively fished from the beach or a shallow-draft dinghy. Long casting ability is an advantage — fish hold at the end of the bar formation where the current edge meets deeper water.",
      },
      {
        minM: 2,
        maxM: 7,
        label: "Mid Estuary / Snag Banks",
        species: ["Barramundi", "Mangrove Jack", "Mud Crab"],
        tideStage: "Run-out both stages",
        technique:
          "Systematically work snag banks along the Gilbert's mangrove-lined banks. The river is not wide — accurate casting to structure within 2 m of the bank is essential. Surface lures at dawn, hard-bodies mid-tide.",
        lure: "Surface popper 80mm, suspending minnow 85mm",
        hotness: "hot",
        notes:
          "The Gilbert's best barra fishing is in the mid-estuary zone. Due to very low fishing pressure, fish are naive and will often follow a lure for a long distance before committing. Use natural colours in clear water conditions.",
      },
    ],
    historicalNote:
      "Historical Queensland Fisheries data shows the Gilbert River supported significant commercial prawn trawling through the late 20th century. The mangrove estuary provided critical nursery habitat that has since been protected under Queensland coastal management frameworks.",
    proTip:
      "Fish the Gilbert on an overnight boat camp — run out on the afternoon high tide, fish the evening and dawn run-outs, and head back to Karumba before midday. Two tidal cycles gives you the best of both dawn sessions without needing to camp remotely.",
    lat: -16.983,
    lng: 141.333,
  },
  {
    id: "albert",
    name: "Albert River",
    shortName: "Albert R.",
    region: "Southern Gulf",
    distanceFromKarumba: "230 km southwest (Burketown)",
    maxDepth: 9,
    access: "Sealed road from Mt Isa (340 km) or Normanton (190 km). Burketown public ramp. Fuel available.",
    bestSeason: "Dry Season May–Sep",
    character:
      "The Albert River at Burketown is a cult destination for Gulf anglers. Trophy barra over 1 m are caught here every dry season. The river runs slower than the northern Gulf systems — deeper holes hold large resident fish year-round.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Tidal Flat / Beach Section",
        species: ["Queenfish", "Barramundi", "Threadfin Salmon"],
        tideStage: "Run-in at dawn",
        technique:
          "Walk-the-dog surface lures across the tidal flat adjacent to the Albert River mouth on the flooding tide. Queenfish school here in the dry season and will attack surface presentations all morning.",
        lure: "Walk-the-dog 100mm, chromed surface walker",
        hotness: "hot",
        notes:
          "The Albert River tidal flat section near Burketown is accessible from shore — no boat required for the surface fishing. Queenfish schools can be spotted by birds diving on baitfish from the bank.",
      },
      {
        minM: 2,
        maxM: 6,
        label: "Mid River Snag Country",
        species: ["Barramundi", "Mangrove Jack", "Golden Snapper"],
        tideStage: "Run-out — 1–2 hrs after high",
        technique:
          "Slow-roll a suspending minnow or hard-body along undercut clay banks with submerged root systems. Albert River barra are resident year-round — they know every snag in the system. Slow and methodical wins here.",
        lure: "Hard-body minnow 90–100mm, suspending",
        hotness: "fire",
        notes:
          "The Albert River mid section between Burketown and the mouth is the most productive zone for trophy barra. Fish over 1 m are encountered regularly. Work at a walking pace upstream on the run-out, targeting every point and snag.",
      },
      {
        minM: 6,
        maxM: 9,
        label: "Deep Bend / Gregory Junction",
        species: ["Black Jewfish", "Barramundi", "Mud Crab"],
        tideStage: "Run-out at night",
        technique:
          "Deploy live mullet or fresh-cut catfish strip on the deep-hole bottom near the Gregory River junction. Black jewfish are the prize here — drift baits through the junction scour on the run-out for best results.",
        lure: "Live mullet, heavy vibe 60–80g, cut bait",
        hotness: "hot",
        notes:
          "The Gregory River junction with the Albert creates a productive deep-water convergence. Black jewfish and large barra hold in the deepest section. Night fishing the junction on a run-out tide is one of the Gulf's great experiences.",
      },
    ],
    historicalNote:
      "The Albert River at Burketown was a supply hub for Gulf Country cattle stations in the 19th century. Commercial fishing operations for barramundi and mud crabs operated out of Burketown through much of the 20th century before recreational fishers became the dominant users.",
    proTip:
      "Burketown runs the Burketown Remote Barra Classic each July — fish the week leading up to the competition to pre-fish the holes without pressure. The Albert responds well to a rising barometer after a cold front passes through in the dry season.",
    lat: -17.689,
    lng: 139.421,
  },
  {
    id: "embley",
    name: "Embley River (Weipa)",
    shortName: "Embley R.",
    region: "Western Cape York",
    distanceFromKarumba: "500 km north (Weipa)",
    maxDepth: 12,
    access: "Sealed road to Weipa. Evans Landing boat ramp. Weipa has full facilities — fuel, accommodation, charter operators.",
    bestSeason: "Dry Season May–Sep for GT; Build-Up Oct–Jan for barra",
    character:
      "The Embley River at Weipa is world-famous for giant trevally — GT up to 50 kg are taken annually from the causeway and river estuary. A diverse fishery with GT, barra, fingermark, and coral trout all within reach of the Weipa ramp.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Causeway / Rock Bar",
        species: ["Giant Trevally", "Queenfish", "Spanish Mackerel"],
        tideStage: "Run-in — dawn to 2 hrs after",
        technique:
          "Cast heavy GT poppers (160mm+) across the causeway rock bar on the run-in. GTs use the current surge to ambush bait — position yourself at the point where the run-in current accelerates through the causeway gap.",
        lure: "GT popper 160–180mm, stickbait 180mm",
        hotness: "fire",
        notes:
          "The Weipa causeway is world-famous. GTs up to 50 kg are taken here every dry season. The rock bar creates a current rip that funnels bait and concentrates GTs. Dawn run-in tide sessions are the most productive — arrive before first light.",
      },
      {
        minM: 2,
        maxM: 6,
        label: "Embley Channel / Snag Country",
        species: ["Barramundi", "Golden Snapper", "Mangrove Jack"],
        tideStage: "Run-out — mid-tide",
        technique:
          "Work the Embley's deep mangrove banks with suspending minnows on the run-out tide. Golden snapper and barra hold in the timber at all states of tide — fish the current edges and snag faces systematically.",
        lure: "Suspending minnow 90mm, soft plastic 5 inch",
        hotness: "hot",
        notes:
          "Weipa's Embley River is not just about GT — the barra and fingermark fishing is exceptional. Fish 10–20 km upstream from the causeway for river barra away from the offshore fishing pressure.",
      },
      {
        minM: 6,
        maxM: 12,
        label: "Deep Channel / Offshore Bommies",
        species: ["Coral Trout", "Giant Trevally", "Spanish Mackerel"],
        tideStage: "All tides — best run-in at reef",
        technique:
          "Run offshore to the Embley offshore reef system and slow-pitch jig over hard coral bommies for coral trout. GTs also ambush baitfish schools on the bommie edges. Surface poppers at first light produce violent strikes.",
        lure: "Slow-pitch jig 80–150g, coral trout coloured",
        hotness: "hot",
        notes:
          "Weipa's offshore reef system is one of the most underrated in Queensland. Coral trout to 8 kg, spanish mackerel, and GTs are all accessible within a 20–30 km run from the Weipa ramp.",
      },
    ],
    historicalNote:
      "Weipa's Embley River was identified as a critical marine habitat in the 1980s environmental assessments related to the Comalco (now Rio Tinto) bauxite mining operations. The estuary management frameworks that resulted now protect the fishery that makes Weipa famous.",
    nettingHistory: {
      era: "1970s–1990s",
      area: "Embley River lower estuary and nearshore",
      depthRange: "1–8 m",
      detail:
        "Commercial prawn trawling and barramundi netting occurred across the Weipa nearshore and lower Embley estuary. Following environmental reviews of the bauxite operations, protective management zones were established that benefited the recreational fishery significantly.",
    },
    proTip:
      "Book accommodation in Weipa 6–12 months ahead for the June–August GT season — it's one of Australia's most sought-after GT fishing destinations and the town fills up. Fish the causeway on the first three days of a new moon for maximum spring-tide GT action.",
    lat: -12.589,
    lng: 141.822,
  },
  {
    id: "endeavour",
    name: "Endeavour River",
    shortName: "Endeavour R.",
    region: "Far North Queensland",
    distanceFromKarumba: "850 km east (Cooktown)",
    maxDepth: 8,
    access: "Sealed road to Cooktown (300 km from Cairns via Mulligan Hwy). Cooktown ramp at Webber Esplanade.",
    bestSeason: "Dry Season Mar–Oct for barra; Sep–Nov for offshore mackerel",
    character:
      "The Endeavour River at Cooktown offers both exceptional river fishing and world-class offshore access. The river holds barramundi and mangrove jack; offshore reef systems including Lizard Island provide coral trout, GT, and Spanish mackerel.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Tidal Flat / Beach",
        species: ["Queenfish", "Barramundi", "Threadfin Salmon"],
        tideStage: "Run-in at dawn",
        technique:
          "Cast surface lures or metal slices across the Trinity Bay flats and Endeavour River mouth on the run-in. Queenfish and threadfin are present throughout the dry season.",
        lure: "Metal slice 30g, surface popper 80mm",
        hotness: "warm",
        notes:
          "The Endeavour River mouth at Cooktown produces barra and threadfin on the run-in tide. The town beach is accessible for shore-based fishing for smaller species including whiting and bream.",
      },
      {
        minM: 2,
        maxM: 5,
        label: "Mid River / Mangrove Banks",
        species: ["Barramundi", "Mangrove Jack", "Mud Crab"],
        tideStage: "Run-out — 1–3 hrs after high",
        technique:
          "Work the mid-Endeavour mangrove banks with hard-body lures on the run-out. Barra are resident year-round — the March–July dry season period produces the best numbers as fish concentrate in tidal sections.",
        lure: "Hard-body minnow 85mm, suspending",
        hotness: "hot",
        notes:
          "Barra fishing in the Endeavour River is best March through July before the spring build-up. The river is shorter than the Gulf systems but holds fish throughout the mangrove-lined section.",
      },
      {
        minM: 5,
        maxM: 8,
        label: "Offshore Reef / Lizard Island",
        species: ["Coral Trout", "Giant Trevally", "Spanish Mackerel"],
        tideStage: "All tides — best run-in current",
        technique:
          "Slow-pitch jig at Lizard Island reef for coral trout on the reef drop-offs. Surface poppers on the bommies at Lizard Island produce GTs. Spanish mackerel troll September–November.",
        lure: "Slow-pitch jig 100–150g, popper 140mm",
        hotness: "fire",
        notes:
          "Lizard Island, 27 km from Cooktown, is one of Australia's premier offshore fishing destinations. Coral trout, GT, Spanish mackerel, and black marlin are all accessible. Run out first light and work the reefs before afternoon winds develop.",
      },
    ],
    historicalNote:
      "Captain James Cook careened his ship HMS Endeavour in the river at Cooktown following the Endeavour Reef grounding in 1770. The river and reef system bear his ship's name. Historical records from the late 19th century document significant barramundi and mud crab harvesting by Chinese and European settlers in the Cooktown district.",
    proTip:
      "Book Lizard Island Research Station days in advance — weather windows for the run out to Lizard Island are best in the morning before the south-easterly sea breeze sets in. Flat-calm mornings produce the best surface GT fishing on the coral bommies.",
    lat: -15.489,
    lng: 145.266,
  },
  {
    id: "flinders",
    name: "Flinders River",
    shortName: "Flinders R.",
    region: "Gulf of Carpentaria",
    distanceFromKarumba: "290 km south-east (Cloncurry catchment)",
    maxDepth: 7,
    access: "Sealed road to Normanton (junction point). Upstream sections via Peninsula Developmental Road. 4WD recommended for river access tracks May–Oct.",
    bestSeason: "Build-Up & Early Wet Oct–Feb",
    character:
      "The Flinders River is one of Queensland's longest inland rivers, flowing over 1000 km from the Greenvale plateau to the Gulf. Its lower tidal reaches west of Normanton hold resident barramundi and support major prawn nursery habitat. Fishing the tidal section during the build-up is exceptional.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Tidal Flat / Coastal Fringe",
        species: ["Barramundi", "Threadfin Salmon", "Queenfish"],
        tideStage: "Run-in — dawn session",
        technique:
          "Cast surface walkers and metal slices across the shallow tidal flats at the Flinders mouth on the run-in tide. Threadfin and queenfish patrol the sand edges while barra move onto the flat with the flooding water.",
        lure: "Surface walker 90mm, metal slice 30g, chartreuse",
        hotness: "hot",
        notes:
          "The Flinders tidal flat is rarely fished compared to the Norman — boat access requires a run from Karumba or a low-water crossing from the Normanton area. The reward is fresh country with minimal pressure.",
      },
      {
        minM: 2,
        maxM: 5,
        label: "Mangrove Bank / Mid Estuary",
        species: ["Barramundi", "Mangrove Jack", "Mud Crab"],
        tideStage: "Run-out — 1–2 hrs after high",
        technique:
          "Work hard-body lures along the mangrove-lined banks on the run-out. The Flinders mid-estuary has dense mangrove cover and undercut banks that hold resident barra throughout the dry season.",
        lure: "Rattling hard-body 90mm, bone or pearl",
        hotness: "hot",
        notes:
          "Barra in the Flinders mid-estuary are less pressured than Norman River fish and tend to be larger on average. The junction of the Flinders and the Carron River is a productive convergence point worth targeting.",
      },
      {
        minM: 5,
        maxM: 7,
        label: "Deep Hole / Channel Bend",
        species: ["Black Jewfish", "Barramundi", "Mud Crab"],
        tideStage: "Run-out at night",
        technique:
          "Drop heavy vibes or live mullet into the deepest channel bends on the Flinders lower reach. Jewfish and large barra hold in the deepest water through the middle of the day and feed actively at night on the run-out.",
        lure: "Heavy vibe 60g, live mullet, cut bait",
        hotness: "warm",
        notes:
          "The Flinders lower reach produces some of the biggest jewfish in the Gulf. Fish the deep bends at night during the run-out for best results. Set crab pots in the tidal zone on arrival.",
      },
    ],
    historicalNote:
      "The Flinders River was surveyed by explorer Frederick Walker in 1861. Commercial prawn trawling in the lower tidal reach and adjacent Gulf waters continued until the 1990s when Queensland Fisheries restructured effort limits. The river system remains a major barramundi nursery.",
    proTip:
      "Run south from Karumba Point to the Flinders mouth on a flood tide — the run across the Gulf flats is shallow and the timing means you arrive at the mouth as the run-out begins. A productive two-tide loop is possible from Karumba in a day.",
    lat: -17.508,
    lng: 140.499,
  },
  {
    id: "leichhardt",
    name: "Leichhardt River",
    shortName: "Leichhardt R.",
    region: "Southern Gulf",
    distanceFromKarumba: "320 km south (Cloncurry area)",
    maxDepth: 6,
    access: "Burke Developmental Road to Burketown. River crossing at Julius Dam Road. 4WD required for lower estuary access. No boat ramp at tidal reach.",
    bestSeason: "Dry Season May–Aug",
    character:
      "The Leichhardt River drains the Mount Isa plateau and enters the Gulf south of the Albert River system. Its lower tidal reaches hold resident barra in deeply undercut clay banks. The river is remote and rarely fished — one of the Gulf's sleeper destinations.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "Outer Bar / Gulf Fringe",
        species: ["Barramundi", "Queenfish", "Threadfin Salmon"],
        tideStage: "Run-out at dawn",
        technique:
          "Work the outer bar and beach zone with surface lures and metal slices at the Leichhardt mouth. This section is accessible only by boat from Burketown — a 50 km run south-west across open Gulf water.",
        lure: "Surface popper 90mm, metal slice 30g",
        hotness: "warm",
        notes:
          "The Leichhardt mouth is extremely remote — plan a full-day or overnight trip from Burketown. The isolation means fish are large and naive. Queenfish run the bar hard in the dry season early mornings.",
      },
      {
        minM: 2,
        maxM: 6,
        label: "Tidal Estuary / Deep Clay Banks",
        species: ["Barramundi", "Mangrove Jack", "Mud Crab"],
        tideStage: "Run-out — mid-tide",
        technique:
          "Cast hard-body lures to the deep clay banks where fallen timber creates ambush points. The Leichhardt's clay bank character differs from the mangrove systems further north — fish tight to the bank undercuts.",
        lure: "Suspending minnow 90mm, rattling hard-body 85mm",
        hotness: "hot",
        notes:
          "Deep undercut clay banks on the lower Leichhardt hold trophy barra year-round. The dry season concentrates fish in the remaining tidal pools — large resident fish that have never seen a lure are common.",
      },
    ],
    historicalNote:
      "Explorer Ludwig Leichhardt noted the river during his 1844–45 overland expedition from Moreton Bay to Port Essington. The river's lower reaches supported a remote cattle station economy from the 1870s. Commercial barramundi netting operated intermittently through the 20th century from Burketown.",
    proTip:
      "The Leichhardt is best fished in combination with the Albert River from a Burketown base. Run south to the Leichhardt mouth on day one, fish the evening and dawn sessions, then head back to the Albert for day two. Two river systems, two overnight tides, and almost no competition.",
    lat: -17.912,
    lng: 139.199,
  },
  {
    id: "staaten",
    name: "Staaten River",
    shortName: "Staaten R.",
    region: "Gulf of Carpentaria",
    distanceFromKarumba: "130 km north",
    maxDepth: 8,
    access: "Boat access only from Karumba or Pormpuraaw. Extremely remote — full self-sufficiency required. No facilities or communications.",
    bestSeason: "Build-Up Oct–Dec",
    character:
      "The Staaten River drains the vast Mitchell grass plains of the Gulf Country and enters the Gulf north of the Gilbert. Almost never fished, the Staaten represents one of Queensland's true frontier fishing destinations. Trophy barra in exceptional numbers characterise every trip that makes it in.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "River Bar / Beach",
        species: ["Barramundi", "Queenfish", "Threadfin Salmon"],
        tideStage: "Run-out — any session",
        technique:
          "Work the Staaten mouth bar with surface lures — the fish here have never seen a lure and will attack almost anything. Threadfin to 10 kg run the outer bar. Cast across the current and work the lure back through the bar formation.",
        lure: "Surface popper 100mm, metal slice 40g",
        hotness: "fire",
        notes:
          "The Staaten mouth bar is one of the Gulf's best-kept secrets. Anglers who get here — typically via a long boat run from Karumba or Pormpuraaw — report exceptional fishing. All fish are large, all fish are naive.",
      },
      {
        minM: 2,
        maxM: 8,
        label: "Lower Estuary / Snag Country",
        species: ["Barramundi", "Mangrove Jack", "Mud Crab"],
        tideStage: "Run-out and run-in both productive",
        technique:
          "Systematically work every timber snag and mangrove bank on both the run-in and run-out. Fish don't need to see many presentations before committing in a river this remote. Standard hard-body lures outperform at first and allow you to cover water efficiently.",
        lure: "Hard-body minnow 90–100mm, rattling",
        hotness: "fire",
        notes:
          "The Staaten's lower estuary may be the closest thing in Queensland to 'virgin' barra fishing. Fish the snag banks methodically — you will find resident barra at every significant timber feature. Keep fishing the same snag if you miss a strike, the fish will come back quickly.",
      },
    ],
    historicalNote:
      "The Staaten River was named during exploration of the Gulf of Carpentaria in the 17th century by Dutch navigator Jan Carstensz. Queensland Fisheries have identified it as a pristine barramundi and mud crab habitat — one of the few remaining Gulf systems with negligible recreational fishing pressure.",
    proTip:
      "Plan a 4–5 day live-aboard camping trip to the Staaten from Karumba — the boat run is long (3–4 hrs depending on conditions) and the tidal flats between the Norman and Staaten are shallow. A high-speed tinny on a spring tide flood is the most reliable approach. Fish for two full days to justify the run.",
    lat: -16.243,
    lng: 141.099,
  },
  {
    id: "gregory",
    name: "Gregory River",
    shortName: "Gregory R.",
    region: "Southern Gulf",
    distanceFromKarumba: "240 km south-west (Lawn Hill area)",
    maxDepth: 8,
    access: "Sealed road to Gregory Downs pub (350 km from Mt Isa). Public boat ramp at Gregory Downs. River is accessible by 4WD to multiple bank-fishing spots.",
    bestSeason: "Dry Season May–Sep",
    character:
      "The Gregory River near Gregory Downs is one of the Gulf's most beautiful fishing destinations — clear spring-fed water over sandstone substrate with pandanus-lined banks. Barra, sooty grunter, and tarpon share the system. The Gregory flows into the Nicholson River south of Burketown and ultimately the Albert system.",
    zones: [
      {
        minM: 0,
        maxM: 1.5,
        label: "Shallow Run / Sand Bar",
        species: ["Barramundi", "Sooty Grunter", "Jungle Perch"],
        tideStage: "Dawn and dusk — any tide stage",
        technique:
          "Cast surface lures across shallow sand-bar runs in the Gregory River below Gregory Downs. Sooty grunter attack surface lures aggressively in the clear shallow runs. Barra hold in the first deep pool below each sand bar.",
        lure: "Surface popper 65–80mm, small stickbait 70mm",
        hotness: "hot",
        notes:
          "The Gregory is one of very few Gulf rivers with clear water — you can sight-fish for barra and sooty grunter in the shallower pools. Polaroiding for large barra in the first deep bend below a sand bar run is an exceptional experience unique to this river.",
      },
      {
        minM: 1.5,
        maxM: 5,
        label: "Deep Pool / Sandstone Ledge",
        species: ["Barramundi", "Sooty Grunter", "Golden Perch"],
        tideStage: "Morning — falling barometer after cold front",
        technique:
          "Work suspending minnows slowly through the deep pools behind the Gregory Downs crossing and south towards the Nicholson junction. Barra hold behind sandstone ledges and large submerged boulders — different snag structure to the typical Gulf river.",
        lure: "Suspending minnow 85–100mm, natural shad colours",
        hotness: "hot",
        notes:
          "The Gregory's sandstone-bottom deep pools hold larger-than-average barra for the southern Gulf region. The clear water rewards stealth — approach pools from downstream and keep noise to a minimum. Light leader (20–30 lb fluorocarbon) is warranted.",
      },
      {
        minM: 5,
        maxM: 8,
        label: "Lower Gregory / Nicholson Junction",
        species: ["Barramundi", "Black Jewfish", "Mud Crab"],
        tideStage: "Run-out at night",
        technique:
          "Fish the Nicholson River junction with the Gregory on the run-out tide. This is where tidal influence returns and the water deepens — black jewfish and large resident barra hold in the junction scour hole.",
        lure: "Heavy vibe 60g, live mullet, fresh cut bait",
        hotness: "warm",
        notes:
          "The Gregory/Nicholson junction is where the upper clear-water fishery meets the tidal estuarine fishery. The scour hole at the junction holds trophy barra and jewfish. Best fished at night on the run-out for the largest fish.",
      },
    ],
    historicalNote:
      "The Gregory River area was explored by A.C. Gregory in 1855–56 during his North Australian Exploring Expedition. The Gregory Downs area became one of the Gulf's premier cattle station districts. The river has been recognised by Queensland Parks and Wildlife as a spring-fed system of high ecological value.",
    proTip:
      "Fish the Gregory River on a falling barometer — the clear-water barra are highly sensitive to pressure changes and will switch on aggressively as a cold front approaches from the south in May–August. The Gregory Downs pub is the staging point; check in and get local intel on which pools are holding fish.",
    lat: -18.566,
    lng: 139.261,
  },
  {
    id: "wenlock",
    name: "Wenlock River",
    shortName: "Wenlock R.",
    region: "Western Cape York",
    distanceFromKarumba: "600 km north-east (Weipa area)",
    maxDepth: 10,
    access: "Peninsula Developmental Road to Moreton Telegraph Station (unsealed). 4WD essential — road closes in wet season (Nov–Apr). Weipa-based charter operators run boat trips to the Wenlock mouth.",
    bestSeason: "Dry Season May–Oct (road access); year-round by charter boat",
    character:
      "The Wenlock River drains central Cape York Peninsula and enters the Gulf near the Archer River system. Dense rainforest-to-savanna country characterises the Wenlock — one of the most diverse freshwater systems on Cape York. The tidal reach holds barramundi and mangrove jack; the freshwater reaches above tidal influence have sooty grunter, jungle perch, and saratoga.",
    zones: [
      {
        minM: 0,
        maxM: 2,
        label: "River Mouth Bar / Beach",
        species: ["Barramundi", "Queenfish", "Giant Trevally"],
        tideStage: "Run-out — dawn to mid-morning",
        technique:
          "Work the Wenlock mouth bar with surface poppers and metal slices at first light. GTs and queenfish patrol the outer bar formation while barra hold in the current break on the river mouth point. Accurate casting into the current edge produces the best results.",
        lure: "GT popper 140mm, surface walker 100mm, metal slice 40g",
        hotness: "fire",
        notes:
          "The Wenlock mouth is accessible by boat from Weipa — a significant run (2–3 hrs) that keeps pressure minimal. The combination of GT, queenfish, and barra in the one location makes for an extraordinary dawn session. Fish the first 2 hours of the run-out for maximum action.",
      },
      {
        minM: 2,
        maxM: 6,
        label: "Tidal Estuary / Mangrove System",
        species: ["Barramundi", "Mangrove Jack", "Golden Snapper"],
        tideStage: "Run-out — mid-estuary",
        technique:
          "Work suspending minnows and hard-body lures through the Wenlock tidal estuary. The dense mangrove structure and low fishing pressure produce excellent results with standard presentations. Work upstream on the run-out, targeting every point and snag.",
        lure: "Suspending minnow 90–100mm, rattling hard-body 90mm",
        hotness: "hot",
        notes:
          "The Wenlock tidal estuary has received virtually no recreational fishing pressure compared to NT and Kimberley systems. Mangrove jack to 4 kg and barra over 90 cm are encountered regularly. Fish with standard 30 lb braid and 40 lb leader — the structure is heavy.",
      },
      {
        minM: 6,
        maxM: 10,
        label: "Freshwater Transition / Deep Pools",
        species: ["Sooty Grunter", "Jungle Perch", "Saratoga"],
        tideStage: "Morning — any tide in freshwater section",
        technique:
          "Work surface lures and small hard-bodies through the freshwater transition zone above tidal influence. Saratoga and jungle perch are surface-oriented — dawn and dusk sessions with 65–80mm poppers produce the most visual fishing of any Queensland river system.",
        lure: "Small surface popper 65mm, shallow hard-body 75mm",
        hotness: "hot",
        notes:
          "The Wenlock freshwater reaches above the tidal influence offer some of Queensland's most spectacular sportfishing — saratoga and jungle perch on surface lures in Cape York rainforest is a bucket-list experience. Accessible only in the dry season (May–October).",
      },
    ],
    historicalNote:
      "The Wenlock River was explored during the Cape York expeditions of the 1860s. The river system flows through country of significant Aboriginal cultural importance — much of the Wenlock catchment falls within Cape York Aboriginal land. Queensland Parks and Wildlife manage the river corridor as a conservation zone within the Cape York Wilderness Area.",
    proTip:
      "Combine a Wenlock River trip with an Archer River session — both systems are accessible by charter from Weipa on a 2-3 day live-aboard run. The Archer/Wenlock combination covers both the Gulf river barra experience and the Cape York freshwater fishing unique to this region. Book a Weipa-based guide for local knowledge on timing the tides at each river mouth.",
    lat: -12.693,
    lng: 141.942,
  },
];
