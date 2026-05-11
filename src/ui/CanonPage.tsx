import { Link, useParams } from "react-router-dom";
import { CATALOG } from "../lib/catalog-context";
import { findCanon, isGatedCanon } from "../lib/catalog";

export function CanonPage() {
  const { canonId = "" } = useParams();
  if (isGatedCanon(canonId)) {
    return <Navigate canonId={canonId} />;
  }
  const canon = findCanon(CATALOG, canonId);
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
  const volumes = CATALOG.volumes.filter((v) => v.canon === canonId);

  return (
    <main>
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

function Navigate({ canonId }: { canonId: string }) {
  return (
    <main>
      <h1>{canonId}　受授權限制</h1>
      <p>此藏內容由第三方持有，v1 未納入瀏覽。詳情見《關於》或</p>
      <p>
        <a href={`https://cbeta.org/`} target="_blank" rel="noreferrer noopener">
          cbeta.org
        </a>
      </p>
    </main>
  );
}
