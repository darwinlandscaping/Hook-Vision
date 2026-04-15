export interface TideLocation {
  id: string;
  name: string;
  region: string;
  bomPort: string;
  lat: number;
  lon: number;
  timezone: string;
  description: string;
  fishingNotes: string;
}

export const TIDE_LOCATIONS: TideLocation[] = [
  {
    id: "karumba",
    name: "Karumba",
    region: "Gulf of Carpentaria",
    bomPort: "QLD_TP001",
    lat: -17.487,
    lon: 140.836,
    timezone: "Australia/Brisbane",
    description: "Karumba sits at the mouth of the Norman River on the eastern Gulf coast. Famous for its massive barramundi and queenfish runs, especially around the Karumba Point boat ramp area.",
    fishingNotes: "Run-out tide 2–3 hours after high tide is prime for barra on the Norman River mouth. Queenfish school on the beach in front of town from May–September. Mud crabs in mangrove drains on the high tide."
  },
  {
    id: "normanton",
    name: "Norman River / Normanton",
    region: "Gulf of Carpentaria",
    bomPort: "QLD_TP001",
    lat: -17.667,
    lon: 141.078,
    timezone: "Australia/Brisbane",
    description: "The Norman River is one of Queensland's most productive barramundi fisheries. The tidal estuary stretches from Normanton to Karumba — over 60 km of prime barra water.",
    fishingNotes: "Barra stack under mangrove cut banks on run-out tides. Best results 1–3 hours after high water. Black jewfish in the deep holes near Normanton wharf at night."
  },
  {
    id: "weipa",
    name: "Weipa",
    region: "Western Cape York",
    bomPort: "QLD_TP002",
    lat: -12.667,
    lon: 141.867,
    timezone: "Australia/Brisbane",
    description: "Weipa on Cape York's western coast offers world-class GT fishing on the Embley and Ducie rivers, plus outstanding barra, fingermark, and mud crab fishing in surrounding estuaries.",
    fishingNotes: "GT session peak at the Weipa causeway on morning tides May–August. Barra best on the Embley River from Sept–January. Fingermark school on rocky bars around the point year-round."
  },
  {
    id: "mitchell-river",
    name: "Mitchell River Mouth",
    region: "Gulf of Carpentaria",
    bomPort: "QLD_TP001",
    lat: -15.225,
    lon: 141.583,
    timezone: "Australia/Brisbane",
    description: "The Mitchell River is Queensland's largest Gulf waterway and a legendary barra system. The river mouth produces trophy fish during October–January.",
    fishingNotes: "Trophy barra in the 60–90 cm range are common. Fish the outer bars and channel edges on the run-out tide. Access by boat from Kowanyama or charter from Normanton."
  },
  {
    id: "cairns",
    name: "Cairns",
    region: "Far North Queensland",
    bomPort: "QLD_TP003",
    lat: -16.9186,
    lon: 145.778,
    timezone: "Australia/Brisbane",
    description: "Cairns is the gateway to the Great Barrier Reef and offers diverse fishing including reef fish, marlin, Spanish mackerel, and estuarine species in Trinity Bay and the Barron River delta.",
    fishingNotes: "Black marlin season September–December on the GBR edge. Reef fishing year-round at Hastings, Saxon, and Fitzroy reefs. Barra in Barron River and Hartley Creek on autumn run-out tides."
  },
  {
    id: "cooktown",
    name: "Cooktown",
    region: "Far North Queensland",
    bomPort: "QLD_TP004",
    lat: -15.4677,
    lon: 145.248,
    timezone: "Australia/Brisbane",
    description: "Cooktown sits at the mouth of the Endeavour River. The river system holds excellent barra and jack, while offshore reefs produce world-class coral trout and red emperor.",
    fishingNotes: "Barra best in the Endeavour River March–July. Coral trout on nearby Endeavour Reef. Spanish mackerel troll August–November off the coast. GT at reef bombies year-round."
  },
  {
    id: "gilbert-river",
    name: "Gilbert River / Critters Camp",
    region: "Gulf of Carpentaria",
    bomPort: "QLD_TP001",
    lat: -16.983,
    lon: 141.333,
    timezone: "Australia/Brisbane",
    description: "The Gilbert River flows through some of Queensland's most remote Gulf Country to enter the Gulf between the Norman and Mitchell rivers. It consistently produces large barramundi.",
    fishingNotes: "Restricted access but premium barra fishing. Best accessed via helicopter or remote camp. October–January wet season build-up period is prime. Mud crabs in every mangrove drain."
  },
  {
    id: "flinders-river",
    name: "Flinders River",
    region: "Gulf of Carpentaria",
    bomPort: "QLD_TP001",
    lat: -17.733,
    lon: 141.167,
    timezone: "Australia/Brisbane",
    description: "The Flinders River mouth near Karumba is a short boat trip from the town. The tidal section between the Bynoe and Flinders mouth holds good barra numbers.",
    fishingNotes: "Barra on lures and live bait in the lower tidal section October–January. Combined with Norman River fishing as part of a Karumba-based trip."
  },
  {
    id: "port-douglas",
    name: "Port Douglas",
    region: "Far North Queensland",
    bomPort: "QLD_TP003",
    lat: -16.484,
    lon: 145.466,
    timezone: "Australia/Brisbane",
    description: "Port Douglas offers a short run to Agincourt Reef and the outer Great Barrier Reef. Spanish mackerel, coral trout, and GTs are the targets offshore.",
    fishingNotes: "Spanish mack run May–October on the outer reef edge. Coral trout on Agincourt year-round. Snapper and sweetlip on the mid-shelf reefs. Sailfish and mahi-mahi offshore November–April."
  },
  {
    id: "burketown",
    name: "Albert River / Burketown",
    region: "Gulf of Carpentaria",
    bomPort: "QLD_TP001",
    lat: -17.733,
    lon: 139.548,
    timezone: "Australia/Brisbane",
    description: "Burketown on the Albert River is deep Gulf Country — famous for Morning Glory clouds and huge barramundi. The Albert River estuary has some of the best fishing in the Gulf.",
    fishingNotes: "Remote access but some of Queensland's finest barra fishing. Barra to 1 m+ in the Albert River. Mud crabs, black jewfish, and queenfish also common. Dry season access only May–October."
  }
];

export default TIDE_LOCATIONS;
