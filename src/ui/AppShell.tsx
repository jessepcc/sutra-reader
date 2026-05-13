import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { SettingsProvider } from "../lib/settings-context";
import { runBackgroundPrecache } from "../lib/sync";
import { BottomNav } from "./BottomNav";
import { Enso } from "./Enso";

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "首頁", end: true },
  { to: "/browse", label: "瀏覽" },
  { to: "/saved", label: "收藏" },
  { to: "/bookmarks", label: "標記" },
  { to: "/settings", label: "設定" },
];

export function AppShell() {
  const location = useLocation();
  const isReader = location.pathname.startsWith("/read/");

  useEffect(() => {
    runBackgroundPrecache();
  }, []);

  return (
    <SettingsProvider>
      <div className="app">
        {!isReader && (
          <header className="appbar">
            <Link to="/" className="brand" aria-label="經閣 首頁">
              <Enso size={22} /> 經閣
            </Link>
            <nav className="nav" aria-label="主要導覽">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </header>
        )}
        <Outlet />
        <BottomNav />
      </div>
    </SettingsProvider>
  );
}
