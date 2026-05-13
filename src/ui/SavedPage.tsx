import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { findTextById } from "../lib/catalog-context";
import { getSaved, removeSaved } from "../lib/db";
import type { SavedEntry, TextEntry } from "../lib/types";

export function SavedPage() {
  const [items, setItems] = useState<(SavedEntry & { text?: TextEntry })[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    void loadSaved().then(setItems);
  }, []);

  async function remove(textId: string) {
    if (pendingDelete === textId) {
      await removeSaved(textId);
      setPendingDelete(null);
      setItems(await loadSaved());
    } else {
      setPendingDelete(textId);
    }
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
            const isPending = pendingDelete === s.textId;
            return (
              <li key={s.textId}>
                <Link to={`/read/${s.textId}`}>{s.text?.title ?? s.textId}</Link>
                <div className="muted">
                  收藏於 {new Date(s.savedAt).toLocaleString("zh-Hant")}
                  {isPending ? (
                    <>
                      <button className="icon" onClick={() => void remove(s.textId)} aria-label="確認移除">確認</button>
                      <button className="icon" onClick={() => setPendingDelete(null)} aria-label="取消">取消</button>
                    </>
                  ) : (
                    <button className="icon" onClick={() => void remove(s.textId)} aria-label="移除">
                      ✕
                    </button>
                  )}
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
