import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { findCanon, isGatedCanon } from "../lib/catalog";
import { loadCatalogIndex } from "../lib/catalog-context";
import type { CatalogIndex } from "../lib/types";

export function CanonPage() {
  const { canonId = "" } = useParams();
  const [catalog, setCatalog] = useState<CatalogIndex | null>(null);

  useEffect(() => {
    void loadCatalogIndex().then(setCatalog);
  }, []);

  if (isGatedCanon(canonId)) {
    return <Navigate to={`/gated/${canonId}`} replace />;
  }
  if (!catalog) {
    return (
      <main>
        <p className="muted">…</p>
      </main>
    );
  }
  const canon = findCanon({ ...catalog, texts: [] }, canonId);
  if (!canon) {
    return (
      <main>
        <p className="empty">找不到此藏：{canonId}</p>
        <p className="muted">
          <Link to="/browse">← 回到藏目</Link>
        </p>
      </main>
    );
  }
  const volumes = catalog.volumes.filter((v) => v.canon === canonId);

  return (
    <main>
      <p className="muted">
        <Link to="/browse">瀏覽</Link>　《{canon.name}》
      </p>
      <h1>《{canon.name}》</h1>
      <p className="muted">{canon.description}</p>
      <h2>冊</h2>
      <ul className="list">
        {volumes.map((v) => (
          <li key={v.id}>
            <Link to={`/browse/${canonId}/${v.id}`}>{v.label}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
