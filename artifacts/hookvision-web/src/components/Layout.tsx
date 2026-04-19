import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Waves, Fish, Target, Camera, CloudSun, Users, Menu, X } from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: CloudSun },
  { path: "/tides", label: "Tides", icon: Waves },
  { path: "/barra", label: "Barra Predictor", icon: Target },
  { path: "/fishid", label: "Catch ID", icon: Camera },
  { path: "/forecast", label: "Forecast", icon: Fish },
  { path: "/community", label: "Community", icon: Users },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "hsl(216 60% 10%)" }}>
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-200 md:relative md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ backgroundColor: "hsl(216 56% 7%)", borderRight: "1px solid hsl(216 56% 18%)" }}
      >
        <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: "1px solid hsl(216 56% 18%)" }}>
          <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: "hsl(168 100% 42%)" }}>
            <Fish size={18} style={{ color: "hsl(216 60% 10%)" }} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-widest uppercase" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
              HookVision
            </div>
            <div className="text-xs" style={{ color: "hsl(195 44% 60%)" }}>AI Fishing Intelligence</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = path === "/" ? location === "/" : location.startsWith(path);
            return (
              <Link
                key={path}
                href={path}
                onClick={() => setMobileOpen(false)}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? "hsl(168 100% 42% / 0.15)" : "transparent",
                  color: isActive ? "hsl(168 100% 42%)" : "hsl(195 44% 75%)",
                  borderLeft: isActive ? "2px solid hsl(168 100% 42%)" : "2px solid transparent",
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4" style={{ borderTop: "1px solid hsl(216 56% 18%)" }}>
          <div className="text-xs" style={{ color: "hsl(195 44% 50%)" }}>WA · NQ · NT</div>
          <div className="text-xs mt-0.5" style={{ color: "hsl(195 44% 40%)" }}>Northern Australia</div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="md:hidden flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: "hsl(216 56% 7%)", borderBottom: "1px solid hsl(216 56% 18%)" }}
        >
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
            HookVision
          </span>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ color: "hsl(195 44% 75%)" }}
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
