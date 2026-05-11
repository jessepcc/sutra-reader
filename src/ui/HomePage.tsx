import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATALOG } from "../lib/catalog-context";
import { getRecents } from "../lib/db";
import { findText } from "../lib/catalog";
import type { RecentEntry } from "../lib/types";

export function HomePage() {
  const [recents, setRecents] = useState<RecentEntry[] | null>(null);

  useEffect(() => {
    void getRecents().then(setRecents);
  }, []);

  return (
    <main>
      <h1>經閣</h1>
      <p className="muted">CBETA 漢文佛典　簡素閱讀器</p>

      <section className="home-section">
        <div className="subtle">繼續閱讀</div>
        {recents === null ? (
          <p className="muted">…</p>
        ) : recents.length === 0 ? (
          <p className="empty">尚未開卷。</p>
        ) : (
          <ul className="list">
            {recents.slice(0, 6).map((r) => {
              const t = findText(CATALOG, r.textId);
              return (
                <li key={r.textId}>
                  <Link to={`/read/${r.textId}${r.lastLb ? `#lb_${r.lastLb}` : ""}`}>
                    {t?.title ?? r.textId}
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
          {CATALOG.canons.map((c) => (
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
