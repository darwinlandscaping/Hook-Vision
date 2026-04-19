import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Waves, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const PORTS = [
  { value: "broome", label: "Broome", region: "WA" },
  { value: "derby", label: "Derby (King Sound)", region: "WA" },
  { value: "port-hedland", label: "Port Hedland", region: "WA" },
  { value: "exmouth", label: "Exmouth (Learmonth)", region: "WA" },
  { value: "carnarvon", label: "Carnarvon", region: "WA" },
  { value: "dampier", label: "Dampier", region: "WA" },
  { value: "wyndham", label: "Wyndham (Cambridge Gulf)", region: "WA" },
  { value: "darwin", label: "Darwin", region: "NT" },
  { value: "nhulunbuy", label: "Nhulunbuy (Gove)", region: "NT" },
  { value: "karumba", label: "Karumba", region: "NQ" },
  { value: "weipa", label: "Weipa", region: "NQ" },
  { value: "cairns", label: "Cairns", region: "NQ" },
];

interface TideEntry {
  time: string;
  type: "HW" | "LW";
  height: number;
  timestamp: number;
}

interface TideDay {
  date: string;
  tides: TideEntry[];
}

async function fetchTides(port: string): Promise<TideDay[]> {
  const res = await fetch(`/api/tides?port=${port}&days=3`);
  if (!res.ok) throw new Error("Failed to fetch tides");
  return res.json();
}

function TideBar({ tides }: { tides: TideEntry[] }) {
  if (!tides.length) return null;
  const heights = tides.map(t => t.height);
  const max = Math.max(...heights, 1);

  return (
    <div className="flex items-end gap-2 h-16 mt-3">
      {tides.map((tide, i) => {
        const pct = (tide.height / max) * 100;
        const isHigh = tide.type === "HW";
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full rounded-t relative flex items-end justify-center" style={{ height: 48 }}>
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${pct}%`,
                  backgroundColor: isHigh ? "hsl(168 100% 42% / 0.7)" : "hsl(200 100% 50% / 0.4)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Tides() {
  const [port, setPort] = useState("broome");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tides", port, 3],
    queryFn: () => fetchTides(port),
  });

  const portLabel = PORTS.find(p => p.value === port)?.label ?? port;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
            Tide Charts
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(195 44% 60%)" }}>BOM tide data — 3-day outlook</p>
        </div>
        <div className="relative">
          <select
            value={port}
            onChange={e => setPort(e.target.value)}
            data-testid="select-port"
            className="appearance-none pr-8 pl-3 py-2 rounded text-sm font-medium"
            style={{
              backgroundColor: "hsl(216 56% 13%)",
              border: "1px solid hsl(216 56% 25%)",
              color: "hsl(195 44% 90%)",
            }}
          >
            {["WA", "NT", "NQ"].map(region => (
              <optgroup key={region} label={region}>
                {PORTS.filter(p => p.region === region).map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "hsl(195 44% 60%)" }} />
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      )}

      {isError && (
        <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}>
          <Waves size={32} className="mx-auto mb-2" style={{ color: "hsl(195 44% 50%)" }} />
          <p className="text-sm" style={{ color: "hsl(195 44% 60%)" }}>Tide data unavailable — check connection</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {data.map((day) => (
            <div
              key={day.date}
              className="rounded-lg p-5"
              style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}
              data-testid={`card-tide-day-${day.date}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-bold tracking-widest uppercase mb-0.5" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
                    {portLabel}
                  </div>
                  <div className="text-lg font-bold" style={{ color: "hsl(195 44% 94%)", fontFamily: "'Oswald', sans-serif" }}>
                    {new Date(day.date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs" style={{ color: "hsl(195 44% 60%)" }}>
                    {day.tides.length} tides
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                {day.tides.map((tide, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 rounded"
                    style={{ backgroundColor: "hsl(216 60% 10%)" }}
                    data-testid={`row-tide-${day.date}-${i}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: tide.type === "HW" ? "hsl(168 100% 42% / 0.2)" : "hsl(216 56% 20%)",
                          color: tide.type === "HW" ? "hsl(168 100% 42%)" : "hsl(195 44% 70%)",
                          fontFamily: "'Oswald', sans-serif",
                        }}
                      >
                        {tide.type === "HW" ? "HIGH" : "LOW"}
                      </span>
                      <span className="text-sm font-medium" style={{ color: "hsl(195 44% 85%)" }}>
                        {tide.time}
                      </span>
                    </div>
                    <span className="text-xl font-bold" style={{ color: "hsl(195 44% 94%)", fontFamily: "'Oswald', sans-serif" }}>
                      {tide.height.toFixed(2)}m
                    </span>
                  </div>
                ))}
              </div>

              <TideBar tides={day.tides} />

              {day.tides.length > 0 && (
                <div className="mt-3 pt-3 flex gap-4 text-xs" style={{ borderTop: "1px solid hsl(216 56% 18%)", color: "hsl(195 44% 60%)" }}>
                  <span>Range: {(Math.max(...day.tides.map(t => t.height)) - Math.min(...day.tides.map(t => t.height))).toFixed(2)}m</span>
                  <span>Max: {Math.max(...day.tides.map(t => t.height)).toFixed(2)}m</span>
                  <span>Min: {Math.min(...day.tides.map(t => t.height)).toFixed(2)}m</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
