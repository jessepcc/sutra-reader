import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { findCanon, isGatedCanon } from "../lib/catalog";
import { loadCatalogIndex, loadVolumeTexts } from "../lib/catalog-context";
import type { CatalogIndex, TextEntry, Volume } from "../lib/types";

interface VolumeRow {
  volume: Volume;
  texts: TextEntry[] | null; // null = still loading
}

export function CanonPage() {
  const { canonId = "" } = useParams();
  const [catalog, setCatalog] = useState<CatalogIndex | null>(null);
  const [rows, setRows] = useState<VolumeRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cat = await loadCatalogIndex();
      if (cancelled) return;
      setCatalog(cat);
      const myVolumes = cat.volumes.filter((v) => v.canon === canonId);
      setRows(myVolumes.map((v) => ({ volume: v, texts: null })));
      await Promise.all(
        myVolumes.map(async (v) => {
          const texts = await loadVolumeTexts(canonId, v.id);
          if (cancelled) return;
          setRows((prev) =>
            prev.map((r) => (r.volume.id === v.id ? { ...r, texts } : r)),
          );
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [canonId]);

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

  return (
    <main>
      <p className="muted">
        <Link to="/browse">瀏覽</Link>　《{canon.name}》
      </p>
      <h1>《{canon.name}》</h1>
      {canon.description && (
        <p className="muted">{stripChineseSuffix(canon.description)}</p>
      )}
      <ul className="list">
        {rows.map(({ volume, texts }) => (
          <li key={volume.id}>
            <VolumeLink canonId={canonId} volume={volume} texts={texts} />
          </li>
        ))}
      </ul>
    </main>
  );
}

function VolumeLink({
  canonId,
  volume,
  texts,
}: {
  canonId: string;
  volume: Volume;
  texts: TextEntry[] | null;
}) {
  // Still loading the shard — show the label and nothing else.
  if (texts === null) {
    return (
      <Link to={`/browse/${canonId}/${volume.id}`}>
        <strong>{volume.label}</strong>
      </Link>
    );
  }
  // Single-text volume: skip the intermediate volume page entirely.
  if (texts.length === 1) {
    const t = texts[0];
    return (
      <Link to={`/read/${t.id}`}>
        <strong>{volume.label}</strong>
        {"　"}
        {t.title}
      </Link>
    );
  }
  // Multi-text volume: preview the first title, link to the volume page.
  if (texts.length > 1) {
    return (
      <Link to={`/browse/${canonId}/${volume.id}`}>
        <strong>{volume.label}</strong>
        {"　"}
        {texts[0].title}
        <span className="muted">　等 {texts.length} 部</span>
      </Link>
    );
  }
  // Empty shard (defensive — shouldn't happen for a generated catalog).
  return (
    <Link to={`/browse/${canonId}/${volume.id}`}>
      <strong>{volume.label}</strong>
    </Link>
  );
}

function stripChineseSuffix(description: string): string {
  return description.replace(/\s+[—–]\s+\S.*$/, "").trim();
}
