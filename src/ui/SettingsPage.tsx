import { useState } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../lib/settings-context";
import { clearScope, type ClearScope } from "../lib/db";
import {
  applyAutoUpdateSetting,
  checkCachedTextUpdates,
  precacheSavedTexts,
} from "../lib/sync";
import { isIos, isInStandaloneMode, useInstallPrompt } from "../lib/pwa";

export function SettingsPage() {
  const { settings, update } = useSettings();
  const [status, setStatus] = useState<string | null>(null);
  const { canInstall, install } = useInstallPrompt();
  const standalone = isInStandaloneMode();
  const ios = isIos();

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
      const result = await checkCachedTextUpdates();
      if (settings.autoUpdate && result.expiredCount > 0) {
        await precacheSavedTexts();
      }
      setStatus(
        result.expiredCount
          ? `${result.expiredCount} 個已快取文本已過期，下次開啟時自動更新。`
          : "所有快取文本均在有效期內。",
      );
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
                onChange={(e) => void applyAutoUpdateSetting(e.target.checked)}
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
          <button onClick={() => void onClear("cache")}>清除快取</button>{" "}
          <button onClick={() => void onClear("saves")}>清除收藏與標記</button>{" "}
          <button onClick={() => void onClear("everything")}>完全清除</button>
        </p>
      </section>

      {status && <p className="muted">{status}</p>}

      <section className="home-section">
        <div className="subtle">安裝</div>
        {standalone ? (
          <p className="muted">已安裝為應用程式。</p>
        ) : canInstall ? (
          <p>
            <button onClick={() => void install()}>安裝至主畫面</button>
          </p>
        ) : ios ? (
          <p>
            在 Safari 底部點選<strong>分享</strong>按鈕，再選「<strong>加入主畫面</strong>」即可安裝。
          </p>
        ) : (
          <>
            <p className="muted">瀏覽器尚未提供安裝提示。</p>
            <p>可手動安裝：點選瀏覽器右上角選單（<strong>⋮</strong>），選「<strong>安裝應用程式</strong>」或「<strong>加入主畫面</strong>」。</p>
          </>
        )}
      </section>

      <section className="home-section">
        <div className="subtle">關於</div>
        <p>
          <Link to="/about">關於 經閣 · 致謝與授權</Link>
        </p>
      </section>
    </main>
  );
}
