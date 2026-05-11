import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATALOG } from "../lib/catalog-context";
import { findText } from "../lib/catalog";
import { getBookmarks, removeBookmark } from "../lib/db";
import type { Bookmark } from "../lib/types";

export function BookmarksPage() {
  const [items, setItems] = useState<Bookmark[] | null>(null);

  useEffect(() => {
    void getBookmarks().then(setItems);
  }, []);

  async function remove(b: Bookmark) {
    await removeBookmark(b.textId, b.lb);
    setItems(await getBookmarks());
  }

  return (
    <main>
      <h1>標記</h1>
      {items === null ? (
        <p className="muted">…</p>
      ) : items.length === 0 ? (
        <p className="empty">尚無標記。閱讀時點擊「標記此處」即可記錄當前位置。</p>
      ) : (
        <ul className="list">
          {items.map((b) => {
            const t = findText(CATALOG, b.textId);
            return (
              <li key={`${b.textId}#${b.lb}`}>
                <Link to={`/read/${b.textId}#lb_${b.lb}`}>{b.label}</Link>
                <div className="muted">
                  {t?.title ?? b.textId}　·　{b.lb}　·　{new Date(b.createdAt).toLocaleString("zh-Hant")}
                  <button className="icon" onClick={() => remove(b)} aria-label="移除">
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
