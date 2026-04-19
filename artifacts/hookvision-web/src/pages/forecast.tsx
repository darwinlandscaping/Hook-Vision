import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CloudSun, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const REGIONS = [
  { id: "wa", label: "WA / Kimberley" },
  { id: "nq", label: "NQ / Gulf Country" },
  { id: "nt", label: "NT / Kakadu" },
];

async function fetchForecast(region: string): Promise<unknown> {
  const res = await fetch("/api/forecast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region }),
  });
  if (!res.ok) throw new Error("Forecast failed");
  return res.json();
}

interface Spot {
  name?: string;
  spot?: string;
  location?: string;
  species?: string;
  technique?: string;
  advice?: string;
  rating?: number;
  conditions?: string;
  [key: string]: unknown;
}

function SpotCard({ spot, index }: { spot: Spot; index: number }) {
  const name = spot.name ?? spot.spot ?? spot.location ?? `Spot ${index + 1}`;
  const fields = Object.entries(spot).filter(
    ([k, v]) => !["name", "spot", "location"].includes(k) && v !== null && v !== undefined && v !== ""
  );

  return (
    <div
      className="rounded-lg p-5"
      style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}
      data-testid={`card-spot-${index}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-sm font-bold"
          style={{ backgroundColor: "hsl(168 100% 42% / 0.15)", color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}
        >
          {index + 1}
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <MapPin size={12} style={{ color: "hsl(168 100% 42%)" }} />
            <span className="text-base font-bold" style={{ color: "hsl(195 44% 94%)", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>
              {name}
            </span>
          </div>
          {spot.species && (
            <span className="text-xs" style={{ color: "hsl(195 44% 65%)" }}>
              Target: {String(spot.species)}
            </span>
          )}
        </div>
        {spot.rating && (
          <div className="ml-auto flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <Star
                key={s}
                size={12}
                style={{ color: s <= Number(spot.rating) ? "hsl(51 100% 50%)" : "hsl(216 56% 25%)", fill: s <= Number(spot.rating) ? "hsl(51 100% 50%)" : "transparent" }}
              />
            ))}
          </div>
        )}
      </div>

      {(spot.advice ?? spot.conditions) && (
        <p className="text-sm mb-3" style={{ color: "hsl(195 44% 80%)" }}>
          {String(spot.advice ?? spot.conditions)}
        </p>
      )}

      <div className="space-y-1.5">
        {fields
          .filter(([k]) => !["rating", "species", "advice", "conditions"].includes(k))
          .map(([key, value]) => {
            const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
            return (
              <div key={key} className="flex gap-2 text-xs">
                <span className="flex-shrink-0 font-medium" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif", minWidth: 72 }}>
                  {label}:
                </span>
                <span style={{ color: "hsl(195 44% 75%)" }}>{String(value)}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default function Forecast() {
  const [region, setRegion] = useState("wa");

  const mutation = useMutation({
    mutationFn: () => fetchForecast(region),
  });

  const data = mutation.data as { spots?: Spot[]; [key: string]: unknown } | null | undefined;
  const spots: Spot[] = Array.isArray(data?.spots) ? data!.spots : Array.isArray(data) ? (data as unknown as Spot[]) : [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
          Fishing Forecast
        </h1>
        <p className="text-sm" style={{ color: "hsl(195 44% 60%)" }}>
          AI-powered spot recommendations based on current moon, tides and season
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {REGIONS.map(r => (
          <button
            key={r.id}
            onClick={() => setRegion(r.id)}
            data-testid={`button-forecast-region-${r.id}`}
            className="px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: region === r.id ? "hsl(168 100% 42%)" : "hsl(216 56% 13%)",
              color: region === r.id ? "hsl(216 60% 10%)" : "hsl(195 44% 75%)",
              border: `1px solid ${region === r.id ? "hsl(168 100% 42%)" : "hsl(216 56% 22%)"}`,
              fontFamily: "'Oswald', sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {r.label}
          </button>
        ))}
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          data-testid="button-get-forecast"
          className="ml-auto"
          style={{ backgroundColor: "hsl(168 100% 42%)", color: "hsl(216 60% 10%)", fontFamily: "'Oswald', sans-serif" }}
        >
          {mutation.isPending ? "Loading..." : "Get Forecast"}
        </Button>
      </div>

      {mutation.isPending && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-lg" />)}
        </div>
      )}

      {mutation.isError && (
        <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}>
          <p className="text-sm" style={{ color: "hsl(0 84% 65%)" }}>Forecast unavailable — check API connection</p>
        </div>
      )}

      {!mutation.isPending && !data && !mutation.isError && (
        <div
          className="rounded-lg p-8 text-center"
          style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px dashed hsl(216 56% 25%)" }}
        >
          <CloudSun size={40} className="mx-auto mb-3" style={{ color: "hsl(168 100% 42% / 0.4)" }} />
          <p className="text-sm font-medium" style={{ color: "hsl(195 44% 75%)", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>
            Select a region and get your forecast
          </p>
        </div>
      )}

      {spots.length > 0 && (
        <div className="space-y-4">
          {spots.map((spot, i) => <SpotCard key={i} spot={spot} index={i} />)}
        </div>
      )}

      {data && spots.length === 0 && (
        <div
          className="rounded-lg p-5"
          style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}
          data-testid="card-forecast-raw"
        >
          <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
            Forecast
          </div>
          <pre className="text-xs whitespace-pre-wrap" style={{ color: "hsl(195 44% 75%)" }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
