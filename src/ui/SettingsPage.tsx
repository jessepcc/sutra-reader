import { useRef, useState } from "react";
import { useSettings } from "../lib/settings-context";
import { bundleToJson, buildExport, importBundle, parseBundle } from "../lib/backup";
import { clearScope, type ClearScope } from "../lib/db";
import { CATALOG } from "../lib/catalog-context";
import { diffManifest } from "../lib/catalog";

export function SettingsPage() {
  const { settings, update } = useSettings();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onExport() {
    const bundle = await buildExport();
    const blob = new Blob([bundleToJson(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sutra-reader-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("已匯出資料。");
  }

  async function onImport(file: File) {
    const text = await file.text();
    try {
      const incoming = parseBundle(text);
      await importBundle(incoming);
      setStatus("已匯入並合併資料。");
    } catch (err) {
      setStatus(`匯入失敗：${(err as Error).message}`);
    }
  }

  async function onClear(scope: ClearScope) {
    const labels: Record<ClearScope, string> = {
      cache: "清除快取（保留收藏與標記）",
      saves: "清除所有收藏與標記",
      everything: "完全清除（恢復出廠）",
    };
    if (!window.confirm(`確定要 ${labels[scope]} 嗎？`)) return;
    await clearScope(scope);
    setStatus("已清除。");
  }

  async function onCheckUpdate() {
    setStatus("檢查中…");
    try {
      // sutra-manifest URL is configurable in v2; for v1 we report against
      // the bundled catalog SHA.
      const res = await fetch("/manifest.json").catch(() => null);
      if (!res || !res.ok) {
        setStatus("尚無可用的更新清單（佈署時請放置 /manifest.json）。");
        return;
      }
      const manifest = await res.json();
      const stale = diffManifest(CATALOG, manifest);
      setStatus(stale.length ? `${stale.length} 個文本有更新。` : "已是最新。");
    } catch (err) {
      setStatus(`檢查失敗：${(err as Error).message}`);
    }
  }

  return (
    <main>
      <h1>設定</h1>

      <section className="home-section">
        <div className="subtle">閱讀</div>
        <p>
          <label>方向　</label>
          <button onClick={() => void update({ direction: "vertical-rl" })} aria-pressed={settings.direction === "vertical-rl"}>
            縱書（RTL）
          </button>{" "}
          <button onClick={() => void update({ direction: "horizontal-lr" })} aria-pressed={settings.direction === "horizontal-lr"}>
            橫書（LTR）
          </button>
        </p>
        <p>
          <label>紙色　</label>
          {(["paper", "ink", "ash"] as const).map((m) => (
            <button
              key={m}
              onClick={() => void update({ paperMode: m })}
              aria-pressed={settings.paperMode === m}
              style={{ marginRight: 4 }}
            >
              {m === "paper" ? "紙" : m === "ink" ? "墨" : "灰"}
            </button>
          ))}
        </p>
        <p>
          <label>字級　{settings.fontScale.toFixed(2)}</label>{" "}
          <input
            type="range"
            min="0.7"
            max="1.8"
            step="0.05"
            value={settings.fontScale}
            onChange={(e) => void update({ fontScale: Number(e.target.value) })}
          />
        </p>
        <p>
          <label>行高　{settings.lineHeight.toFixed(2)}</label>{" "}
          <input
            type="range"
            min="1.4"
            max="2.4"
            step="0.05"
            value={settings.lineHeight}
            onChange={(e) => void update({ lineHeight: Number(e.target.value) })}
          />
        </p>
        <p>
          <label>
            <input
              type="checkbox"
              checked={settings.dyslexiaFont}
              onChange={(e) => void update({ dyslexiaFont: e.target.checked })}
            />{" "}
            無障礙字體（OpenDyslexic）
          </label>
        </p>
      </section>

      <section className="home-section">
        <div className="subtle">同步</div>
        <p>
          <label>
            <input
              type="checkbox"
              checked={settings.autoUpdate}
              onChange={(e) => void update({ autoUpdate: e.target.checked })}
            />{" "}
            自動更新已快取文本
          </label>
        </p>
        <p>
          <button onClick={() => void onCheckUpdate()}>檢查更新</button>
        </p>
      </section>

      <section className="home-section">
        <div className="subtle">資料</div>
        <p>
          <button onClick={() => void onExport()}>匯出資料</button>{" "}
          <button onClick={() => fileInput.current?.click()}>匯入資料</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.currentTarget.value = "";
            }}
          />
        </p>
        <p>
          <button onClick={() => void onClear("cache")}>清除快取</button>{" "}
          <button onClick={() => void onClear("saves")}>清除收藏與標記</button>{" "}
          <button onClick={() => void onClear("everything")}>完全清除</button>
        </p>
      </section>

      {status && <p className="muted">{status}</p>}
    </main>
  );
}
