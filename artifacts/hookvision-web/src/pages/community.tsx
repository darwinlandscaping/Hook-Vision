import { useQuery } from "@tanstack/react-query";
import { Users, MapPin, TrendingUp, Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

async function fetchFeed(): Promise<unknown[]> {
  const res = await fetch("/api/community/feed");
  if (!res.ok) throw new Error("Failed to fetch community feed");
  const data = await res.json();
  return Array.isArray(data) ? data : data.reports ?? data.feed ?? [];
}

async function fetchHotspots(): Promise<unknown[]> {
  const res = await fetch("/api/community/hotspots");
  if (!res.ok) throw new Error("Failed to fetch hotspots");
  const data = await res.json();
  return Array.isArray(data) ? data : data.hotspots ?? [];
}

async function fetchInsights(): Promise<unknown> {
  const res = await fetch("/api/community/insights");
  if (!res.ok) throw new Error("Failed to fetch insights");
  return res.json();
}

interface Report {
  location?: string;
  spot?: string;
  species?: string;
  notes?: string;
  description?: string;
  rating?: number;
  author?: string;
  createdAt?: string;
  date?: string;
  [key: string]: unknown;
}

interface Hotspot {
  name?: string;
  location?: string;
  species?: string;
  score?: number;
  activity?: string;
  [key: string]: unknown;
}

function ReportCard({ report }: { report: Report }) {
  const location = report.location ?? report.spot ?? "Unknown location";
  const text = report.notes ?? report.description ?? "";
  const when = report.createdAt ?? report.date;

  return (
    <div
      className="rounded-lg p-4"
      style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <MapPin size={12} style={{ color: "hsl(168 100% 42%)" }} />
          <span className="text-sm font-bold" style={{ color: "hsl(195 44% 90%)", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>
            {location}
          </span>
        </div>
        {when && (
          <span className="text-xs flex-shrink-0" style={{ color: "hsl(195 44% 50%)" }}>
            {new Date(when).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>
      {report.species && (
        <div className="text-xs mb-1.5" style={{ color: "hsl(168 100% 42%)" }}>
          {String(report.species)}
        </div>
      )}
      {text && <p className="text-xs" style={{ color: "hsl(195 44% 70%)" }}>{text}</p>}
      {report.author && (
        <div className="text-xs mt-2 pt-2" style={{ color: "hsl(195 44% 45%)", borderTop: "1px solid hsl(216 56% 18%)" }}>
          {String(report.author)}
        </div>
      )}
    </div>
  );
}

function HotspotCard({ spot, index }: { spot: Hotspot; index: number }) {
  const name = spot.name ?? spot.location ?? `Hotspot ${index + 1}`;
  const score = spot.score;

  return (
    <div
      className="flex items-center gap-3 rounded-lg p-3"
      style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}
      data-testid={`card-hotspot-${index}`}
    >
      <div
        className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={{ backgroundColor: index < 3 ? "hsl(51 100% 50% / 0.2)" : "hsl(216 56% 20%)", color: index < 3 ? "hsl(51 100% 50%)" : "hsl(195 44% 65%)", fontFamily: "'Oswald', sans-serif" }}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate" style={{ color: "hsl(195 44% 90%)", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>
          {name}
        </div>
        {spot.species && (
          <div className="text-xs" style={{ color: "hsl(168 100% 42%)" }}>{String(spot.species)}</div>
        )}
        {spot.activity && (
          <div className="text-xs" style={{ color: "hsl(195 44% 55%)" }}>{String(spot.activity)}</div>
        )}
      </div>
      {score !== undefined && (
        <div className="text-sm font-bold" style={{ color: "hsl(51 100% 50%)", fontFamily: "'Oswald', sans-serif" }}>
          {String(score)}
        </div>
      )}
    </div>
  );
}

export default function Community() {
  const feedQuery = useQuery({ queryKey: ["community", "feed"], queryFn: fetchFeed });
  const hotspotsQuery = useQuery({ queryKey: ["community", "hotspots"], queryFn: fetchHotspots });
  const insightsQuery = useQuery({ queryKey: ["community", "insights"], queryFn: fetchInsights });

  const feed = (feedQuery.data ?? []) as Report[];
  const hotspots = (hotspotsQuery.data ?? []) as Hotspot[];
  const insights = insightsQuery.data as Record<string, unknown> | null | undefined;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
          Community Intel
        </h1>
        <p className="text-sm" style={{ color: "hsl(195 44% 60%)" }}>
          Real-time catch reports and hot spots from anglers across northern Australia
        </p>
      </div>

      {insights && (
        <div className="rounded-lg p-5" style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(168 100% 42% / 0.25)" }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} style={{ color: "hsl(168 100% 42%)" }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
              AI Insights
            </span>
          </div>
          {typeof insights === "object" ? (
            <div className="space-y-2">
              {Object.entries(insights)
                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                .slice(0, 4)
                .map(([key, value]) => (
                  <div key={key} className="text-sm" style={{ color: "hsl(195 44% 80%)" }}>
                    <span className="font-medium" style={{ color: "hsl(195 44% 55%)" }}>
                      {key.replace(/([A-Z])/g, " $1").trim()}:{" "}
                    </span>
                    {typeof value === "object" ? JSON.stringify(value) : String(value)}
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "hsl(195 44% 80%)" }}>{String(insights)}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} style={{ color: "hsl(168 100% 42%)" }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "hsl(195 44% 60%)", fontFamily: "'Oswald', sans-serif" }}>
              Recent Reports
            </span>
          </div>

          {feedQuery.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          )}

          {feedQuery.isError && (
            <div className="rounded-lg p-5 text-center" style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}>
              <p className="text-sm" style={{ color: "hsl(195 44% 55%)" }}>No reports available</p>
            </div>
          )}

          {feed.length === 0 && !feedQuery.isLoading && !feedQuery.isError && (
            <div className="rounded-lg p-8 text-center" style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px dashed hsl(216 56% 25%)" }}>
              <Users size={32} className="mx-auto mb-2" style={{ color: "hsl(168 100% 42% / 0.4)" }} />
              <p className="text-sm" style={{ color: "hsl(195 44% 55%)" }}>No recent reports</p>
            </div>
          )}

          {feed.slice(0, 10).map((report, i) => (
            <ReportCard key={i} report={report} />
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={14} style={{ color: "hsl(51 100% 50%)" }} />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "hsl(195 44% 60%)", fontFamily: "'Oswald', sans-serif" }}>
              Hot Spots
            </span>
          </div>

          {hotspotsQuery.isLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          )}

          {hotspots.slice(0, 8).map((spot, i) => (
            <HotspotCard key={i} spot={spot} index={i} />
          ))}

          {hotspots.length === 0 && !hotspotsQuery.isLoading && (
            <div className="rounded-lg p-4 text-center" style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}>
              <p className="text-xs" style={{ color: "hsl(195 44% 50%)" }}>No hot spots data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
