import { Link } from "react-router-dom";
import { CATALOG } from "../lib/catalog-context";
import { GATED_CANONS } from "../lib/catalog";

export function BrowsePage() {
  return (
    <main>
      <h1>瀏覽　藏</h1>
      <ul className="list">
        {CATALOG.canons.map((c) => (
          <li key={c.id}>
            <Link to={`/browse/${c.id}`}>
              <strong>{c.abbr}</strong>　{c.name}
            </Link>
            {c.description && <div className="muted">{c.description}</div>}
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
