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

const REPO_URL = "https://github.com/jessepcc/sutra-reader";

export function AppShell() {
  const location = useLocation();
  const isReader = location.pathname.startsWith("/read/");
  const isHome = location.pathname === "/";

  useEffect(() => {
    runBackgroundPrecache();
  }, []);

  return (
    <SettingsProvider>
      <div className={`app${isHome ? " app-home" : ""}`}>
        {!isReader && (
          <header className="appbar">
            <Link to="/" className="brand" aria-label="經閣 首頁">
              <Enso size={22} />
              <span className="brand-text">經閣</span>
            </Link>
            <nav className="nav" aria-label="主要導覽">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end}>
                  {n.label}
                </NavLink>
              ))}
              <a
                className="nav-icon"
                href={REPO_URL}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="GitHub 原始碼"
                title="GitHub"
              >
                <GithubMark />
              </a>
            </nav>
          </header>
        )}
        <Outlet />
        <BottomNav />
      </div>
    </SettingsProvider>
  );
}

function GithubMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="18"
      height="18"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
