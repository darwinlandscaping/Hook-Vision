import { Link, useLocation } from "wouter";
import { Waves, Fish, Target, Camera, CloudSun, Users } from "lucide-react";

const navItems = [
  { path: "/", label: "Home", icon: CloudSun },
  { path: "/tides", label: "Tides", icon: Waves },
  { path: "/barra", label: "Barra", icon: Target },
  { path: "/fishid", label: "Catch ID", icon: Camera },
  { path: "/forecast", label: "Forecast", icon: Fish },
  { path: "/community", label: "Community", icon: Users },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div
      className="flex justify-center items-stretch min-h-screen"
      style={{ backgroundColor: "hsl(216 60% 6%)" }}
    >
      <div
        className="relative flex flex-col w-full"
        style={{
          maxWidth: 430,
          minHeight: "100dvh",
          backgroundColor: "hsl(216 60% 10%)",
        }}
      >
        <header
          className="flex items-center justify-between px-5 pt-12 pb-3 flex-shrink-0"
          style={{ backgroundColor: "hsl(216 56% 7%)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "hsl(168 100% 42%)" }}
            >
              <Fish size={15} style={{ color: "hsl(216 60% 10%)" }} />
            </div>
            <span
              className="text-base font-bold tracking-widest uppercase"
              style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}
            >
              HookVision
            </span>
          </div>
          <span
            className="text-xs tracking-wider uppercase"
            style={{ color: "hsl(195 44% 50%)" }}
          >
            WA · NQ · NT
          </span>
        </header>

        <main
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 72 }}
        >
          {children}
        </main>

        <nav
          className="fixed bottom-0 left-1/2 -translate-x-1/2 flex items-center justify-around w-full z-50"
          style={{
            maxWidth: 430,
            height: 64,
            backgroundColor: "hsl(216 56% 7%)",
            borderTop: "1px solid hsl(216 56% 18%)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = path === "/" ? location === "/" : location.startsWith(path);
            return (
              <Link
                key={path}
                href={path}
                className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-opacity"
                data-testid={`tab-${label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon
                  size={22}
                  style={{ color: isActive ? "hsl(168 100% 42%)" : "hsl(195 44% 45%)" }}
                />
                <span
                  className="text-[10px] font-medium tracking-wide"
                  style={{ color: isActive ? "hsl(168 100% 42%)" : "hsl(195 44% 45%)" }}
                >
                  {label}
                </span>
                {isActive && (
                  <div
                    className="absolute bottom-0 h-0.5 w-8 rounded-t-full"
                    style={{ backgroundColor: "hsl(168 100% 42%)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
