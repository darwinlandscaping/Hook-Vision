export type FishCategory = "estuary" | "reef" | "pelagic" | "freshwater" | "shellfish";
export type EatingRating = 1 | 2 | 3 | 4 | 5;

export interface NTSpecies {
  id: string;
  name: string;
  scientificName: string;
  category: FishCategory;
  bagLimit: number | "no limit";
  minSize: number | null;
  maxSize?: number | null;
  eatRating: EatingRating;
  description: string;
  habitat: string;
  bestBait: string[];
  bestLures: string[];
  bestTechnique: string;
  seasonNotes: string;
  regulations: string;
  weight?: string;
  colors?: string;
  image?: string;
}

export const NT_SPECIES: NTSpecies[] = [
  {
    id: "barramundi",
    name: "Barramundi",
    scientificName: "Lates calcarifer",
    category: "estuary",
    bagLimit: 5,
    minSize: 58,
    maxSize: null,
    eatRating: 5,
    description: "The iconic Gulf Country sportfish. Queensland Fisheries sets a 58 cm minimum and 5-fish bag limit. Barra run hard in the Gulf rivers from October through January — Karumba and Norman River produce fish over 1 m every season.",
    habitat: "Estuaries, mangrove creeks, river mouths, tidal flats — Norman, Mitchell, Flinders, Gilbert rivers plus Karumba Point channels.",
    bestBait: ["Live mullet", "Live bream", "Prawns", "Mud crabs"],
    bestLures: ["Jackall Mask Vibe 75", "Zerek Tango Shad", "Molix Glide Swimmer", "Berkley Gulp Jerkshad"],
    bestTechnique: "Work lures along undercut mangrove banks and submerged timber on the run-out tide. Barra face up-current — cast past them and retrieve through the strike zone.",
    seasonNotes: "Pre-wet season (Oct–Nov) and early wet (Dec–Jan) produce the largest fish in Gulf rivers. Wet season floods push fish into flooded grasslands. Dry season (May–Sep) fish concentrate in deep holes and creek mouths.",
    regulations: "QLD Fisheries: 5-fish bag, 58 cm minimum. No night-lighting of barra in Queensland. Closed season applies to some river systems — check current QLD regulations before fishing.",
    weight: "Common 3–12 kg, trophy fish 20+ kg",
    colors: "Silver-grey flanks, bronze belly, distinctive red eye"
  },
  {
    id: "coral-trout",
    name: "Coral Trout",
    scientificName: "Plectropomus leopardus",
    category: "reef",
    bagLimit: 8,
    minSize: 38,
    maxSize: null,
    eatRating: 5,
    description: "Queensland's premier reef fish. GBR coral trout are prized for their stunning colours and superb eating quality. QLD Fisheries enforces an 8-fish combined bag with 38 cm minimum across all three species.",
    habitat: "Coral reef structures on the Great Barrier Reef, outer reef systems, Coral Sea atolls.",
    bestBait: ["Live baitfish", "Whole dead squid", "Pilchards"],
    bestLures: ["Slow-pitch jigs 80–150 g", "Poppers", "Stickbaits on reef edges"],
    bestTechnique: "Slow-pitch jigging over hard coral structure. Live baiting in gutters and bommie edges at first and last light.",
    seasonNotes: "Year-round on the GBR. Coral spawning aggregations Oct–Nov produce best sport fishing. Wet season (Nov–Apr) sees increased topwater action.",
    regulations: "QLD Fisheries: 8-fish combined bag for all coral trout species, 38 cm minimum. Check reef closure maps for no-take zones and seasonal closures on the GBR.",
    weight: "Common 1–4 kg, trophy 8+ kg",
    colors: "Orange-red body with vivid blue spots"
  },
  {
    id: "spanish-mackerel",
    name: "Spanish Mackerel",
    scientificName: "Scomberomorus commerson",
    category: "pelagic",
    bagLimit: 5,
    minSize: 75,
    maxSize: null,
    eatRating: 5,
    description: "The speedster of Queensland waters. Spaniards run the Gulf of Carpentaria coast from Weipa to Karumba and the Whitsundays in season. QLD has reduced the bag limit to 5 with a 75 cm minimum to protect stocks.",
    habitat: "Open water, reef edges, channel markers, shipping lanes, river mouths in the Gulf.",
    bestBait: ["Live garfish", "Live mullet", "Whole pilchards"],
    bestLures: ["Halco Laser Pro 120", "Rapala X-Rap Magnum", "Koolpak 8/0 wire gang lures"],
    bestTechnique: "Troll skirted lures at 8–12 knots along reef edges and channel edges. Live bait drifting under birds.",
    seasonNotes: "Gulf run May–August (dry season). Whitsundays run Aug–Nov. Cairns offshore Oct–Jan. Avoid trolling in the wet season when water is dirty.",
    regulations: "QLD Fisheries: 5-fish bag, 75 cm minimum. Wire trace or heavy mono leader essential. Release large females quickly — use a de-hooking device.",
    weight: "Common 4–12 kg, trophy 30+ kg",
    colors: "Bright silver with iridescent blue-green back, wavy markings"
  },
  {
    id: "mangrove-jack",
    name: "Mangrove Jack",
    scientificName: "Lutjanus argentimaculatus",
    category: "estuary",
    bagLimit: 10,
    minSize: 35,
    maxSize: null,
    eatRating: 4,
    description: "A savage, structure-hugging fighter of NQ estuaries and reef systems. Mangrove Jack are notorious snag divers — you need heavy tackle and braid to stop them.",
    habitat: "Mangrove creeks, submerged rock bars, reef structures, river mouths from Cairns to Karumba.",
    bestBait: ["Live prawns", "Live mullet", "Crabs"],
    bestLures: ["Ecogear ZX35 Vibe", "Jackall TN60", "Hardbody minnows 70–90 mm"],
    bestTechnique: "Pin your lure tight to snags on the high tide. Hard drag, immediate pressure on the strike. Vibes bounced through rocky structure on the run-out tide.",
    seasonNotes: "Post-wet season (April–June) peak as fish move from flooded rivers back to creeks. Dry season fish concentrate in permanent deep holes.",
    regulations: "QLD Fisheries: 10-fish bag, 35 cm minimum. Handle carefully — jack spines are sharp.",
    weight: "Common 0.5–3 kg, trophy 6+ kg",
    colors: "Deep red to copper flanks, large scales"
  },
  {
    id: "mud-crab",
    name: "Mud Crab",
    scientificName: "Scylla serrata",
    category: "shellfish",
    bagLimit: 10,
    minSize: 13,
    maxSize: null,
    eatRating: 5,
    description: "Queensland's most prized shellfish. Gulf Country mud crabs are legendary — large, full-fleshed, and found throughout the mangrove systems of every major Gulf river.",
    habitat: "Mangrove creeks, river mouth flats, tidal channels throughout Gulf Country rivers.",
    bestBait: ["Mullet heads", "Chicken frames", "Bony bream"],
    bestLures: [],
    bestTechnique: "Deploy pots on the run-in tide in mangrove channels. Check after 2–4 hours. Night fishing produces larger crabs.",
    seasonNotes: "Year-round in NQ Gulf, peak September–December. Female crabs berried (carrying eggs) must be released immediately.",
    regulations: "QLD Fisheries: 10-crab possession limit, 13 cm carapace width minimum. No berried or soft-shell crabs. Max 4 pots per person. All female crabs must be released in some areas — check current QLD regulations.",
    weight: "Common 0.5–1.5 kg, trophy 2+ kg",
    colors: "Dark olive-green to black carapace, orange-red when cooked"
  },
  {
    id: "queenfish",
    name: "Queenfish",
    scientificName: "Scomberoides commersonnianus",
    category: "pelagic",
    bagLimit: 20,
    minSize: null,
    maxSize: null,
    eatRating: 2,
    description: "One of the most aerial fighters in NQ waters. Queenfish smash surface lures and perform multiple leaps when hooked — they're the quintessential lure fishing species on the Gulf Coast.",
    habitat: "Shallow Gulf beaches, sandflats, river mouths, creek entrances. Karumba beachfront is famous for queenfish at dawn.",
    bestBait: ["Live mullet", "Small baitfish"],
    bestLures: ["Samaki Pacemaker 85 mm", "Nomad Dartwing", "GT Ice Cream poppers"],
    bestTechnique: "Walk surface lures through nervous bait schools at dawn. Cast into beach gutters as queenfish chase mullet up onto the sand.",
    seasonNotes: "Dry season (May–September) peak around Karumba and Normanton. Still active year-round in warmer months.",
    regulations: "QLD Fisheries: 20-fish combined bag for trevally/queenfish/similar. Handle with wet hands — release if not eating.",
    weight: "Common 1–4 kg, trophy 8+ kg",
    colors: "Silver with distinctive row of oval spots along the flank"
  },
  {
    id: "black-jewfish",
    name: "Mulloway / Black Jewfish",
    scientificName: "Protonibea diacanthus",
    category: "estuary",
    bagLimit: 5,
    minSize: 75,
    maxSize: null,
    eatRating: 4,
    description: "The Gulf Country's most sought-after estuarine sportfish after barra. Black jewfish produce distinctive knocking sounds and put up tremendous fights in deep holes and channel edges.",
    habitat: "Deep estuary holes, channel edges, rocky bars, river bends in Norman, Mitchell, and Flinders rivers.",
    bestBait: ["Live mullet", "Whole prawns", "Squid"],
    bestLures: ["Heavy vibes 80–120 g", "Large slow-pitch jigs"],
    bestTechnique: "Bottom vibing in deep holes on the run-out tide. Use fish finders to locate schools holding tight to the bottom.",
    seasonNotes: "Dry season (May–September) concentrates fish in deep permanent holes. Listen for their underwater grunts — a sure sign of a school below.",
    regulations: "QLD Fisheries: 5-fish bag, 75 cm minimum. Jewfish are often important breeders at large sizes — consider releasing trophy fish.",
    weight: "Common 5–25 kg, trophy 45+ kg",
    colors: "Dark bronze-brown back, silver flanks, distinctive lateral line"
  },
  {
    id: "grunter",
    name: "Sooty Grunter",
    scientificName: "Hephaestus fuliginosus",
    category: "freshwater",
    bagLimit: 20,
    minSize: 25,
    maxSize: null,
    eatRating: 3,
    description: "Queensland's premier native freshwater sportfish. Sooty grunter are aggressive lure takers that inhabit rocky freshwater streams from the Mitchell Plateau down to the Burdekin. Popular in rivers above the tidal zone.",
    habitat: "Rocky freshwater streams, rapids, clear river sections above tidal influence — Mitchell, Tully, North Johnstone, Barron rivers.",
    bestBait: ["Freshwater prawns", "Scrub worms", "Crickets"],
    bestLures: ["Hard body minnow 50–70 mm", "Small spinners", "Surface walk-the-dog lures"],
    bestTechnique: "Upstream cast into pool tails and rapid edges. Retrieve slowly through current. Small surface lures at dawn in glassy pools.",
    seasonNotes: "Year-round in permanent rivers. Dry season (June–Oct) when rivers run clear and fish concentrate below rocky waterfalls.",
    regulations: "QLD Fisheries: 20-fish bag, 25 cm minimum. Check freshwater fishing licence requirements — needed for inland fishing in Queensland.",
    weight: "Common 0.3–1.5 kg, trophy 3+ kg",
    colors: "Dark sooty grey-black flanks with prominent scales"
  },
  {
    id: "golden-snapper",
    name: "Golden Snapper",
    scientificName: "Lutjanus johnii",
    category: "estuary",
    bagLimit: 20,
    minSize: 35,
    maxSize: null,
    eatRating: 4,
    description: "Also called fingermark, golden snapper are a classic Gulf Country target. They school on mangrove edges and reef structure and take lures, live bait, and soft plastics enthusiastically.",
    habitat: "Mangrove edges, rock bars, reef patches from Cairns to the Gulf — particularly abundant around the Embley and Edward Rivers near Weipa.",
    bestBait: ["Live prawns", "Live mullet", "Pilchards"],
    bestLures: ["Soft plastics on jig heads", "Small vibes", "Hardbodies 70–90 mm"],
    bestTechnique: "Fish the mangrove edge on the high tide. Work soft plastics slowly along the bottom.",
    seasonNotes: "Best March–July as fish school on post-wet creek edges. Still caught year-round in NQ.",
    regulations: "QLD Fisheries: 20-fish combined snapper/nannygai bag, 35 cm minimum.",
    weight: "Common 0.5–2.5 kg, trophy 5+ kg",
    colors: "Golden-bronze with large scales, red-orange fins"
  },
  {
    id: "giant-trevally",
    name: "Giant Trevally",
    scientificName: "Caranx ignobilis",
    category: "pelagic",
    bagLimit: 10,
    minSize: 45,
    maxSize: null,
    eatRating: 3,
    description: "The GT — one of the most powerful inshore pelagics in Australia. Weipa, the Gulf islands, and Coral Sea GTing are world class. GTs are catch-and-release favourite for sport anglers.",
    habitat: "Reef edges, channel markers, surf beaches, outer GBR atolls, Gulf island reef systems.",
    bestBait: ["Live fish", "Large crabs", "Octopus"],
    bestLures: ["GT Ice Cream 200 mm", "Nomad Dartwing", "Large metal stickbaits"],
    bestTechnique: "High-speed popper and stickbait retrieves over reef crests at dawn. Patience — one strike often makes the whole session.",
    seasonNotes: "Weipa GT season peaks May–August. GBR reef GT fish year-round. Afternoon tidal changes produce best surface action.",
    regulations: "QLD Fisheries: 10-fish combined trevally bag, 45 cm minimum. Most sport anglers practice C&R for GT.",
    weight: "Common 5–20 kg, trophy 50+ kg",
    colors: "Silver-white flanks, dark back, distinctive blunt head profile"
  }
];

export default NT_SPECIES;
