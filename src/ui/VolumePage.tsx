import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { findCanon, findVolume } from "../lib/catalog";
import { loadCatalogIndex, loadVolumeTexts } from "../lib/catalog-context";
import type { CatalogIndex, TextEntry } from "../lib/types";

export function VolumePage() {
  const { canonId = "", volumeId = "" } = useParams();
  const [catalog, setCatalog] = useState<CatalogIndex | null>(null);
  const [texts, setTexts] = useState<TextEntry[] | null>(null);

  useEffect(() => {
    void (async () => {
      const nextCatalog = await loadCatalogIndex();
      setCatalog(nextCatalog);
      setTexts(await loadVolumeTexts(canonId, volumeId));
    })();
  }, [canonId, volumeId]);

  if (!catalog || texts === null) {
    return (
      <main>
        <p className="muted">…</p>
      </main>
    );
  }

  const catalogForFind = { ...catalog, texts: [] };
  const canon = findCanon(catalogForFind, canonId);
  const volume = findVolume(catalogForFind, volumeId);
  if (!canon || !volume || volume.canon !== canonId) {
    return (
      <main>
        <p className="empty">找不到此冊。</p>
        <p>
          <Link to="/browse">← 回到藏目</Link>
        </p>
      </main>
    );
  }
  return (
    <main>
      <p className="muted">
        <Link to="/browse">瀏覽</Link>
        {"　"}
        <Link to={`/browse/${canonId}`}>《{canon.name}》</Link>
        {"　"}
        {volume.label}
      </p>
      <h1>{volume.label}</h1>
      <ul className="list">
        {texts.map((t) => (
          <li key={t.id}>
            <Link to={`/read/${t.id}`}>{t.title}</Link>
            <div className="muted">{t.id}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
