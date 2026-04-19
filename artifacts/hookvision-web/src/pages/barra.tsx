import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Target, MapPin, Clock, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const REGIONS = [
  { id: "wa", label: "WA / Kimberley" },
  { id: "nq", label: "NQ / Gulf Country" },
  { id: "nt", label: "NT / Kakadu" },
];

interface BarraPrediction {
  rank: number;
  river: string;
  spot: string;
  targetDepth: string;
  why: string;
  lure: string;
  rig: string;
  technique: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  windowHours: number;
  windowNote: string;
}

interface BarraResponse {
  predictions: BarraPrediction[];
  bigPictureRead: string;
  topDepth: string;
  topTechnique: string;
}

async function fetchBarra(region: string): Promise<BarraResponse> {
  const res = await fetch("/api/barra", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      region,
      month: new Date().getMonth() + 1,
    }),
  });
  if (!res.ok) throw new Error("Barra prediction failed");
  return res.json();
}

const confidenceStyle = {
  HIGH: { bg: "hsl(168 100% 42% / 0.2)", color: "hsl(168 100% 42%)" },
  MEDIUM: { bg: "hsl(51 100% 50% / 0.2)", color: "hsl(51 100% 50%)" },
  LOW: { bg: "hsl(216 56% 25%)", color: "hsl(195 44% 65%)" },
};

export default function Barra() {
  const [region, setRegion] = useState("wa");

  const mutation = useMutation({
    mutationFn: () => fetchBarra(region),
  });

  const data = mutation.data;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
          Barra Predictor
        </h1>
        <p className="text-sm" style={{ color: "hsl(195 44% 60%)" }}>
          AI predictions for trophy 70cm+ barramundi based on moon, tides and season
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {REGIONS.map(r => (
          <button
            key={r.id}
            onClick={() => setRegion(r.id)}
            data-testid={`button-region-${r.id}`}
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
          data-testid="button-predict"
          className="ml-auto"
          style={{ backgroundColor: "hsl(168 100% 42%)", color: "hsl(216 60% 10%)", fontFamily: "'Oswald', sans-serif" }}
        >
          {mutation.isPending ? "Analysing..." : "Run Prediction"}
        </Button>
      </div>

      {mutation.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      )}

      {mutation.isError && (
        <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}>
          <p className="text-sm" style={{ color: "hsl(0 84% 65%)" }}>Prediction failed — check API connection</p>
        </div>
      )}

      {!mutation.isPending && !data && !mutation.isError && (
        <div
          className="rounded-lg p-8 text-center"
          style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px dashed hsl(216 56% 25%)" }}
        >
          <Target size={40} className="mx-auto mb-3" style={{ color: "hsl(168 100% 42% / 0.4)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "hsl(195 44% 75%)", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>
            Select a region and run prediction
          </p>
          <p className="text-xs" style={{ color: "hsl(195 44% 50%)" }}>
            AI analyses current moon phase, tidal state, season and historical data
          </p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div
            className="rounded-lg p-5"
            style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(168 100% 42% / 0.3)" }}
          >
            <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
              Conditions Read
            </div>
            <p className="text-sm mb-3" style={{ color: "hsl(195 44% 85%)" }}>{data.bigPictureRead}</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <div>
                <span style={{ color: "hsl(195 44% 55%)" }}>Best depth: </span>
                <span style={{ color: "hsl(51 100% 50%)" }}>{data.topDepth}</span>
              </div>
              <div>
                <span style={{ color: "hsl(195 44% 55%)" }}>Technique: </span>
                <span style={{ color: "hsl(195 44% 85%)" }}>{data.topTechnique}</span>
              </div>
            </div>
          </div>

          {data.predictions.map((pred, i) => {
            const conf = confidenceStyle[pred.confidence] ?? confidenceStyle.LOW;
            return (
              <div
                key={i}
                className="rounded-lg p-5"
                style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}
                data-testid={`card-prediction-${i}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold" style={{ color: "hsl(168 100% 42% / 0.5)", fontFamily: "'Oswald', sans-serif" }}>
                      #{pred.rank}
                    </span>
                    <div>
                      <div className="text-base font-bold" style={{ color: "hsl(195 44% 94%)", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>
                        {pred.river}
                      </div>
                      <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "hsl(195 44% 65%)" }}>
                        <MapPin size={11} />
                        {pred.spot}
                      </div>
                    </div>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded flex-shrink-0"
                    style={{ backgroundColor: conf.bg, color: conf.color, fontFamily: "'Oswald', sans-serif", letterSpacing: "0.08em" }}
                  >
                    {pred.confidence}
                  </span>
                </div>

                <p className="text-sm mb-4" style={{ color: "hsl(195 44% 80%)" }}>{pred.why}</p>

                <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                  <div className="rounded p-2.5" style={{ backgroundColor: "hsl(216 60% 10%)" }}>
                    <div className="font-medium mb-0.5 uppercase" style={{ color: "hsl(195 44% 55%)", fontFamily: "'Oswald', sans-serif", fontSize: 10, letterSpacing: "0.08em" }}>
                      Target Depth
                    </div>
                    <div style={{ color: "hsl(195 44% 90%)" }}>
                      <Layers size={11} className="inline mr-1" style={{ color: "hsl(168 100% 42%)" }} />
                      {pred.targetDepth}
                    </div>
                  </div>
                  <div className="rounded p-2.5" style={{ backgroundColor: "hsl(216 60% 10%)" }}>
                    <div className="font-medium mb-0.5 uppercase" style={{ color: "hsl(195 44% 55%)", fontFamily: "'Oswald', sans-serif", fontSize: 10, letterSpacing: "0.08em" }}>
                      Window
                    </div>
                    <div style={{ color: "hsl(195 44% 90%)" }}>
                      <Clock size={11} className="inline mr-1" style={{ color: "hsl(168 100% 42%)" }} />
                      {pred.windowHours}h
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  {[
                    { label: "Lure", value: pred.lure },
                    { label: "Rig", value: pred.rig },
                    { label: "Technique", value: pred.technique },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-2">
                      <span className="flex-shrink-0 font-medium" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif", minWidth: 64 }}>
                        {label}:
                      </span>
                      <span style={{ color: "hsl(195 44% 80%)" }}>{value}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs mt-3 pt-3" style={{ color: "hsl(195 44% 55%)", borderTop: "1px solid hsl(216 56% 18%)" }}>
                  {pred.windowNote}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
