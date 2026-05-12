import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { findTextById } from "../lib/catalog-context";
import { getBookmarks, removeBookmark } from "../lib/db";
import type { Bookmark, TextEntry } from "../lib/types";

export function BookmarksPage() {
  const [items, setItems] = useState<(Bookmark & { text?: TextEntry })[] | null>(null);

  useEffect(() => {
    void loadBookmarks().then(setItems);
  }, []);

  async function remove(b: Bookmark) {
    await removeBookmark(b.textId, b.lb);
    setItems(await loadBookmarks());
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
            return (
              <li key={`${b.textId}#${b.lb}`}>
                <Link to={`/read/${b.textId}#lb_${b.lb}`}>{b.label}</Link>
                <div className="muted">
                  {b.text?.title ?? b.textId}　·　{b.lb}　·　{new Date(b.createdAt).toLocaleString("zh-Hant")}
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

async function loadBookmarks(): Promise<(Bookmark & { text?: TextEntry })[]> {
  const bookmarks = await getBookmarks();
  return Promise.all(
    bookmarks.map(async (b) => ({
      ...b,
      text: await findTextById(b.textId),
    })),
  );
}
