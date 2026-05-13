import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { findTextById, loadCatalogIndex } from "../lib/catalog-context";
import { getRecents, removeRecent } from "../lib/db";
import type { CatalogIndex, RecentEntry, TextEntry } from "../lib/types";
import dailySutras from "../data/daily-sutras.json";
import { SUTRA_ICONS } from "./SutraIcons";

interface DailySutra {
  key: string;
  title: string;
  fullTitle: string;
  textId: string;
  anchor?: string;
  chars: number;
  readMinutes: number;
}

export function HomePage() {
  const [catalog, setCatalog] = useState<CatalogIndex | null>(null);
  const [recents, setRecents] = useState<(RecentEntry & { text?: TextEntry })[] | null>(null);

  useEffect(() => {
    void (async () => {
      setCatalog(await loadCatalogIndex());
      const all = await getRecents();
      const live: (RecentEntry & { text?: TextEntry })[] = [];
      for (const r of all) {
        const text = await findTextById(r.textId);
        if (text) live.push({ ...r, text });
        else await removeRecent(r.textId);
      }
      setRecents(live);
    })();
  }, []);

  return (
    <main>
      <h1>經閣</h1>
      <p className="muted">CBETA 漢文佛典　簡素閱讀器</p>

      <section className="home-section">
        <div className="subtle">常誦</div>
        <ul className="daily-grid">
          {(dailySutras.items as DailySutra[]).map((s) => {
            const Icon = SUTRA_ICONS[s.key];
            const href = s.anchor
              ? `/read/${s.textId}#lb_${s.anchor}`
              : `/read/${s.textId}`;
            return (
              <li key={s.key}>
                <Link to={href} className="daily-tile" title={s.fullTitle}>
                  <span className="daily-icon" aria-hidden="true">
                    {Icon && <Icon size={40} />}
                  </span>
                  <span className="daily-text">
                    <strong>{s.title}</strong>
                    <span className="muted daily-meta">
                      {s.chars.toLocaleString("zh-Hant")}字 · ~{s.readMinutes}分
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="home-section">
        <div className="subtle">繼續閱讀</div>
        {recents === null ? (
          <p className="muted">…</p>
        ) : recents.length === 0 ? (
          <p className="empty">尚未開卷。</p>
        ) : (
          <ul className="list">
            {recents.slice(0, 6).map((r) => {
              return (
                <li key={r.textId}>
                  <Link to={`/read/${r.textId}${r.lastLb ? `#lb_${r.lastLb}` : ""}`}>
                    {r.text?.title ?? r.textId}
                  </Link>
                  <div className="muted">{new Date(r.openedAt).toLocaleString("zh-Hant")}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="home-section">
        <div className="subtle">瀏覽</div>
        <ul className="list">
          {(catalog?.canons ?? []).map((c) => (
            <li key={c.id}>
              <Link to={`/browse/${c.id}`}>
                《{c.name}》<span className="muted">　{c.abbr}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
