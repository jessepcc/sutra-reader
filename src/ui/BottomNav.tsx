import { NavLink, useLocation } from "react-router-dom";

const TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "首頁", end: true },
  { to: "/browse", label: "瀏覽" },
  { to: "/saved", label: "收藏" },
  { to: "/bookmarks", label: "標記" },
  { to: "/settings", label: "設定" },
];

export function BottomNav() {
  const location = useLocation();
  if (location.pathname.startsWith("/read/")) return null;
  return (
    <nav className="bottom-nav" aria-label="主要導覽">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="bottom-nav-item">
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
