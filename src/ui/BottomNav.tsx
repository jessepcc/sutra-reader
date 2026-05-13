import { NavLink, useLocation } from "react-router-dom";

interface IconProps {
  size?: number;
}

function svg({ children, size = 22 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

// 首頁 — torii-style gate: two posts under a softly curved lintel.
function HomeIcon(p: IconProps) {
  return svg({
    ...p,
    children: (
      <>
        <path d="M4 9c4-3 12-3 16 0" />
        <path d="M5 9v11" />
        <path d="M19 9v11" />
        <path d="M5 13h14" opacity="0.45" />
      </>
    ),
  });
}

// 瀏覽 — stack of fascicles: three brush lines, decreasing slightly.
function BrowseIcon(p: IconProps) {
  return svg({
    ...p,
    children: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" opacity="0.7" />
        <path d="M4 17h12" opacity="0.5" />
      </>
    ),
  });
}

// 收藏 — a vessel/bowl: closed rounded curve resting on the line.
function SavedIcon(p: IconProps) {
  return svg({
    ...p,
    children: (
      <>
        <path d="M5 10c0 5 3 9 7 9s7-4 7-9" />
        <path d="M4 10h16" opacity="0.6" />
      </>
    ),
  });
}

// 標記 — bookmark ribbon: rectangle with a V-cut at the bottom.
function BookmarkIcon(p: IconProps) {
  return svg({
    ...p,
    children: <path d="M7 4h10v17l-5-4-5 4z" />,
  });
}

// 設定 — three abstracted slider rails with one knob each.
function SettingsIcon(p: IconProps) {
  return svg({
    ...p,
    children: (
      <>
        <path d="M4 7h16" />
        <circle cx="9" cy="7" r="1.6" fill="currentColor" stroke="none" />
        <path d="M4 12h16" />
        <circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <path d="M4 17h16" />
        <circle cx="11" cy="17" r="1.6" fill="currentColor" stroke="none" />
      </>
    ),
  });
}

const TABS: {
  to: string;
  label: string;
  icon: (p: IconProps) => JSX.Element;
  end?: boolean;
}[] = [
  { to: "/", label: "首頁", icon: HomeIcon, end: true },
  { to: "/browse", label: "瀏覽", icon: BrowseIcon },
  { to: "/saved", label: "收藏", icon: SavedIcon },
  { to: "/bookmarks", label: "標記", icon: BookmarkIcon },
  { to: "/settings", label: "設定", icon: SettingsIcon },
];

export function BottomNav() {
  const location = useLocation();
  if (location.pathname.startsWith("/read/")) return null;
  return (
    <nav className="bottom-nav" aria-label="主要導覽">
      {TABS.map((t) => {
        const Icon = t.icon;
        return (
          <NavLink key={t.to} to={t.to} end={t.end} className="bottom-nav-item">
            <Icon size={22} />
            <span className="bottom-nav-label">{t.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
