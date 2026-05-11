import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CATALOG, GAIJI } from "../lib/catalog-context";
import { findText, isGatedCanon } from "../lib/catalog";
import { loadText, type LoadedText } from "../lib/fetcher";
import {
  addBookmark,
  isSaved,
  recordRecent,
  toggleSaved as toggleSavedDb,
} from "../lib/db";
import { useSettings } from "../lib/settings-context";
import type { PaperMode, ReadingDirection } from "../lib/types";

const PAPER_LABELS: Record<PaperMode, string> = {
  paper: "紙",
  ink: "墨",
  ash: "灰",
};

export function ReaderPage() {
  const { textId = "" } = useParams();
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const entry = useMemo(() => findText(CATALOG, textId), [textId]);
  const [loaded, setLoaded] = useState<LoadedText | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showOrigin, setShowOrigin] = useState(false);
  const [query, setQuery] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!entry) return;
    setLoaded(null);
    setError(null);

    if (isGatedCanon(entry.canon)) {
      navigate(`/gated/${entry.canon}`, { replace: true });
      return;
    }

    loadText(entry, { gaiji: GAIJI })
      .then((r) => setLoaded(r))
      .catch((err: Error) => setError(err.message));

    void isSaved(entry.id).then(setSaved);
    void recordRecent({ textId: entry.id, openedAt: Date.now() });
  }, [entry, navigate]);

  // jump to #lb_xxx after first paint
  useEffect(() => {
    if (!loaded) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  }, [loaded]);

  const toggleDirection = useCallback(() => {
    const next: ReadingDirection =
      settings.direction === "vertical-rl" ? "horizontal-lr" : "vertical-rl";
    void update({ direction: next });
  }, [settings.direction, update]);

  const cyclePaper = useCallback(() => {
    const order: PaperMode[] = ["paper", "ink", "ash"];
    const i = order.indexOf(settings.paperMode);
    void update({ paperMode: order[(i + 1) % order.length] });
  }, [settings.paperMode, update]);

  const toggleSaved = useCallback(async () => {
    if (!entry) return;
    setSaved(await toggleSavedDb(entry.id));
  }, [entry]);

  const bookmarkHere = useCallback(async () => {
    if (!entry || !contentRef.current) return;
    const lb = findNearestLb(contentRef.current);
    if (!lb) {
      window.alert("此頁未含可標記之行號。");
      return;
    }
    const label = window.prompt("為此標記命名：", `卷 — ${lb}`) ?? "";
    if (!label) return;
    await addBookmark({ textId: entry.id, lb, label });
    window.location.hash = `lb_${lb}`;
  }, [entry]);

  const searchMatches = useMemo(() => {
    if (!loaded || !query) return 0;
    return loaded.rendered.juans.reduce(
      (sum, j) => sum + (j.html.match(new RegExp(escapeRegex(query), "g")) ?? []).length,
      0,
    );
  }, [loaded, query]);

  if (!entry) {
    return (
      <main>
        <p className="empty">找不到此典：{textId}</p>
        <p>
          <Link to="/browse">← 回到藏目</Link>
        </p>
      </main>
    );
  }

  return (
    <div className="reader-shell">
      <header className="appbar">
        <Link to={`/browse/${entry.canon}/${entry.volume}`} className="brand">
          ← {entry.title}
        </Link>
        <button
          className="icon"
          aria-pressed={saved}
          aria-label={saved ? "已收藏，點擊取消" : "加入收藏"}
          onClick={toggleSaved}
        >
          {saved ? "★" : "☆"}
        </button>
      </header>

      {error && (
        <main>
          <p className="empty">無法載入文本：{error}</p>
        </main>
      )}

      {!error && !loaded && (
        <main>
          <p className="muted">載入中…</p>
        </main>
      )}

      {loaded && (
        <>
          <div
            className="reader-content"
            data-direction={settings.direction}
            data-dyslexia={settings.dyslexiaFont ? "true" : "false"}
            ref={contentRef}
          >
            {showOrigin && loaded.rendered.header.publicationStmt && (
              <aside aria-label="出處">
                <h2>出處</h2>
                <div
                  className="muted"
                  dangerouslySetInnerHTML={{ __html: loaded.rendered.header.publicationStmt }}
                />
                {loaded.rendered.header.sourceDesc && (
                  <div
                    className="muted"
                    dangerouslySetInnerHTML={{ __html: loaded.rendered.header.sourceDesc }}
                  />
                )}
              </aside>
            )}

            {loaded.rendered.juans.map((j) => (
              <section key={j.id} data-juan={j.id} aria-label={j.head ?? `卷 ${j.id}`}>
                {/* eslint-disable-next-line react/no-danger */}
                <div dangerouslySetInnerHTML={{ __html: j.html }} />
              </section>
            ))}

            <hr />
            <div className="muted">
              {loaded.fromCache ? "離線快取" : "已快取此典"}　·　{loaded.rendered.issues.length} 個渲染註記
            </div>
          </div>

          <div className="controls" role="toolbar" aria-label="閱讀控制">
            <div className="group">
              <label>紙</label>
              <button onClick={cyclePaper} aria-label={`紙色 ${PAPER_LABELS[settings.paperMode]}`}>
                {PAPER_LABELS[settings.paperMode]}
              </button>
            </div>
            <div className="group">
              <label>向</label>
              <button onClick={toggleDirection} aria-label="切換閱讀方向">
                {settings.direction === "vertical-rl" ? "縱" : "橫"}
              </button>
            </div>
            <div className="group">
              <label>字</label>
              <button
                onClick={() =>
                  void update({ fontScale: Math.max(0.7, settings.fontScale - 0.1) })
                }
                aria-label="字級減小"
              >
                A-
              </button>
              <button
                onClick={() =>
                  void update({ fontScale: Math.min(1.8, settings.fontScale + 0.1) })
                }
                aria-label="字級加大"
              >
                A+
              </button>
            </div>
            <div className="group">
              <button onClick={() => setShowOrigin((s) => !s)} aria-pressed={showOrigin}>
                出處
              </button>
              <button onClick={bookmarkHere}>標記此處</button>
            </div>
            <div className="group">
              <input
                type="text"
                placeholder="搜尋本卷"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="搜尋本卷"
              />
              {query && <span className="muted">{searchMatches} 處</span>}
            </div>
          </div>

          <footer className="attribution" lang="zh-Hant">
            資料來源：CBETA《{entry.canon}》{entry.id}　©︎ 財團法人佛教電子佛典基金會 — 非賣品‧非營利性使用 —
            <a href="https://cbeta.org/copyright" target="_blank" rel="noreferrer noopener">
              {" "}
              CC BY-NC-SA 3.0 TW
            </a>
          </footer>
        </>
      )}
    </div>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findNearestLb(root: HTMLElement): string | null {
  // Pick the first <span.tei-lb> visible inside the viewport, else the first overall.
  const lbs = root.querySelectorAll<HTMLElement>(".tei-lb");
  for (const el of lbs) {
    const rect = el.getBoundingClientRect();
    if (rect.top >= 0 && rect.left >= 0 && rect.top < window.innerHeight) {
      return el.dataset.lb ?? null;
    }
  }
  return lbs[0]?.dataset.lb ?? null;
}
