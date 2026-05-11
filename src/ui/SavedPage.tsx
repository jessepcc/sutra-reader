import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATALOG } from "../lib/catalog-context";
import { findText } from "../lib/catalog";
import { getSaved, removeSaved } from "../lib/db";
import type { SavedEntry } from "../lib/types";

export function SavedPage() {
  const [items, setItems] = useState<SavedEntry[] | null>(null);

  useEffect(() => {
    void getSaved().then(setItems);
  }, []);

  async function remove(textId: string) {
    if (!window.confirm("移除此收藏？")) return;
    await removeSaved(textId);
    setItems(await getSaved());
  }

  return (
    <main>
      <h1>收藏</h1>
      {items === null ? (
        <p className="muted">…</p>
      ) : items.length === 0 ? (
        <p className="empty">尚無收藏。閱讀時點擊頁首的星號即可加入。</p>
      ) : (
        <ul className="list">
          {items.map((s) => {
            const t = findText(CATALOG, s.textId);
            return (
              <li key={s.textId}>
                <Link to={`/read/${s.textId}`}>{t?.title ?? s.textId}</Link>
                <div className="muted">
                  收藏於 {new Date(s.savedAt).toLocaleString("zh-Hant")}
                  <button className="icon" onClick={() => remove(s.textId)} aria-label="移除">
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
