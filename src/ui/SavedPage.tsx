import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { findTextById } from "../lib/catalog-context";
import { getSaved, removeSaved } from "../lib/db";
import type { SavedEntry, TextEntry } from "../lib/types";

export function SavedPage() {
  const [items, setItems] = useState<(SavedEntry & { text?: TextEntry })[] | null>(null);

  useEffect(() => {
    void loadSaved().then(setItems);
  }, []);

  async function remove(textId: string) {
    if (!window.confirm("移除此收藏？")) return;
    await removeSaved(textId);
    setItems(await loadSaved());
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
            return (
              <li key={s.textId}>
                <Link to={`/read/${s.textId}`}>{s.text?.title ?? s.textId}</Link>
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

async function loadSaved(): Promise<(SavedEntry & { text?: TextEntry })[]> {
  const saved = await getSaved();
  return Promise.all(
    saved.map(async (s) => ({
      ...s,
      text: await findTextById(s.textId),
    })),
  );
}
