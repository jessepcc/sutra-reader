import { Link, useParams } from "react-router-dom";
import { CATALOG } from "../lib/catalog-context";
import { findCanon, findVolume } from "../lib/catalog";

export function VolumePage() {
  const { canonId = "", volumeId = "" } = useParams();
  const canon = findCanon(CATALOG, canonId);
  const volume = findVolume(CATALOG, volumeId);
  if (!canon || !volume) {
    return (
      <main>
        <p className="empty">找不到此冊。</p>
        <p>
          <Link to="/browse">← 回到藏目</Link>
        </p>
      </main>
    );
  }
  const texts = CATALOG.texts.filter((t) => t.volume === volumeId);
  return (
    <main>
      <p className="muted">
        <Link to={`/browse/${canonId}`}>《{canon.name}》</Link>　{volume.label}
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
