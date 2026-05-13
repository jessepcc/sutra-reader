import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadCatalogIndex } from "../lib/catalog-context";
import { GATED_CANONS } from "../lib/catalog";
import type { CatalogIndex } from "../lib/types";

export function BrowsePage() {
  const [catalog, setCatalog] = useState<CatalogIndex | null>(null);

  useEffect(() => {
    void loadCatalogIndex().then(setCatalog);
  }, []);

  return (
    <main>
      <h1>瀏覽　藏</h1>
      <ul className="list">
        {(catalog?.canons ?? []).map((c) => (
          <li key={c.id}>
            <Link to={`/browse/${c.id}`}>
              <strong>{c.abbr}</strong>　{c.name}
            </Link>
            {c.description && (
              <div className="muted">{stripChineseSuffix(c.description)}</div>
            )}
          </li>
        ))}
        {[...GATED_CANONS].map((id) => (
          <li key={id}>
            <Link to={`/gated/${id}`} className="muted">
              <strong>{id}</strong>　（受授權限制 · 點此說明）
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

// Catalog descriptions follow "English title — 中文名" — the Chinese tag is
// always shown above as the canon name, so drop the trailing em-dash clause.
function stripChineseSuffix(description: string): string {
  return description.replace(/\s+[—–]\s+\S.*$/, "").trim();
}
