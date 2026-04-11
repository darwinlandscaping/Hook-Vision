import { useEffect, useState } from "react";

const SPECIES_ARTICLE: Record<string, string> = {
  barramundi: "Barramundi",
  "lates calcarifer": "Barramundi",
  "mangrove jack": "Mangrove_jack",
  "lutjanus argentimaculatus": "Mangrove_jack",
  "spanish mackerel": "Scomberomorus_commerson",
  "scomberomorus commerson": "Scomberomorus_commerson",
  "giant trevally": "Giant_trevally",
  "caranx ignobilis": "Giant_trevally",
  gt: "Giant_trevally",
  "coral trout": "Coral_trout",
  "plectropomus leopardus": "Coral_trout",
  queenfish: "Queenfish",
  "scomberoides commersonnianus": "Queenfish",
  "threadfin salmon": "Threadfin_salmon",
  "king threadfin": "Polydactylus_sheridani",
  "black jewfish": "Black_jewfish",
  "protonibea diacanthus": "Black_jewfish",
  jewfish: "Black_jewfish",
  "red emperor": "Red_emperor",
  "lutjanus sebae": "Red_emperor",
  "bluebone groper": "Tuskfish",
  "baldchin groper": "Baldchin_groper",
  nannygai: "Nannygai",
  redfish: "Nannygai",
};

function resolveArticle(species: string): string | null {
  const clean = species.replace(/\s*\(\d+%\)/, "").toLowerCase().trim();
  for (const [key, article] of Object.entries(SPECIES_ARTICLE)) {
    if (clean.includes(key)) return article;
  }
  return null;
}

const cache: Record<string, string | null> = {};

export function useFishImage(species: string): string | null {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const article = resolveArticle(species);
    if (!article) return;

    if (cache[article] !== undefined) {
      setImageUrl(cache[article]);
      return;
    }

    fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`,
      { headers: { Accept: "application/json" } }
    )
      .then((r) => r.json())
      .then((data) => {
        const url: string | null = data?.thumbnail?.source ?? null;
        cache[article] = url;
        setImageUrl(url);
      })
      .catch(() => {
        cache[article] = null;
      });
  }, [species]);

  return imageUrl;
}
