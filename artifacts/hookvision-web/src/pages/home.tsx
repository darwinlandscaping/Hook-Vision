import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Waves, Target, Camera, CloudSun, Users, ArrowRight, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const REGIONS = [
  { id: "wa", label: "WA / Kimberley", port: "broome", description: "Broome · Ord River · Cambridge Gulf", color: "#00d4aa" },
  { id: "nq", label: "NQ / Gulf Country", port: "karumba", description: "Karumba · Weipa · Cape York", color: "#00a8ff" },
  { id: "nt", label: "NT / Kakadu", port: "darwin", description: "Darwin · Kakadu · Arnhem Land", color: "#ffd700" },
];

const features = [
  { path: "/tides", label: "Tide Charts", desc: "BOM-sourced tide tables for all major northern ports", icon: Waves },
  { path: "/barra", label: "Barra Predictor", desc: "AI prediction engine for trophy 70cm+ barramundi", icon: Target },
  { path: "/fishid", label: "Catch ID", desc: "Upload a photo, get instant species ID with regs", icon: Camera },
  { path: "/forecast", label: "Fishing Forecast", desc: "Spot-by-spot tactical advice for current conditions", icon: CloudSun },
  { path: "/community", label: "Community Intel", desc: "Real-time reports and hot spots from local anglers", icon: Users },
];

async function fetchTides(port: string) {
  const res = await fetch(`/api/tides?port=${port}&days=1`);
  if (!res.ok) throw new Error("Failed to fetch tides");
  return res.json() as Promise<Array<{ date: string; tides: Array<{ time: string; type: string; height: number }> }>>;
}

function TideCard({ region }: { region: typeof REGIONS[0] }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tides", region.port],
    queryFn: () => fetchTides(region.port),
  });

  const nextTide = data?.[0]?.tides?.[0];

  return (
    <div
      className="rounded-lg p-4"
      style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}
      data-testid={`card-region-${region.id}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: region.color }} />
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: region.color, fontFamily: "'Oswald', sans-serif" }}>
          {region.label}
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: "hsl(195 44% 60%)" }}>{region.description}</p>
      {isLoading && <Skeleton className="h-8 w-32" />}
      {isError && <p className="text-xs" style={{ color: "hsl(195 44% 50%)" }}>Tide data unavailable</p>}
      {nextTide && (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold" style={{ color: "hsl(195 44% 94%)", fontFamily: "'Oswald', sans-serif" }}>
            {nextTide.height.toFixed(1)}m
          </span>
          <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{
            backgroundColor: nextTide.type === "HW" ? "hsl(168 100% 42% / 0.2)" : "hsl(216 56% 20%)",
            color: nextTide.type === "HW" ? "hsl(168 100% 42%)" : "hsl(195 44% 70%)",
          }}>
            {nextTide.type === "HW" ? "HIGH" : "LOW"}
          </span>
          <span className="text-xs" style={{ color: "hsl(195 44% 60%)" }}>{nextTide.time}</span>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [selectedRegion, setSelectedRegion] = useState("wa");

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          HookVision
        </h1>
        <p className="text-sm" style={{ color: "hsl(195 44% 60%)" }}>
          AI fishing intelligence for northern Australia — WA, NQ, NT
        </p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Waves size={14} style={{ color: "hsl(168 100% 42%)" }} />
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "hsl(195 44% 60%)", fontFamily: "'Oswald', sans-serif" }}>
            Current Conditions
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {REGIONS.map(r => <TideCard key={r.id} region={r} />)}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} style={{ color: "hsl(168 100% 42%)" }} />
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "hsl(195 44% 60%)", fontFamily: "'Oswald', sans-serif" }}>
            Intelligence Tools
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map(({ path, label, desc, icon: Icon }) => (
            <Link
              key={path}
              href={path}
              data-testid={`link-feature-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className="group flex flex-col gap-3 rounded-lg p-4 transition-colors"
              style={{
                backgroundColor: "hsl(216 56% 13%)",
                border: "1px solid hsl(216 56% 20%)",
              }}
            >
              <div className="flex items-center justify-between">
                <Icon size={18} style={{ color: "hsl(168 100% 42%)" }} />
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "hsl(168 100% 42%)" }} />
              </div>
              <div>
                <div className="text-sm font-bold mb-1" style={{ color: "hsl(195 44% 94%)", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  {label}
                </div>
                <div className="text-xs" style={{ color: "hsl(195 44% 60%)" }}>{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
