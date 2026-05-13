export function AboutPage() {
  return (
    <main>
      <h1>關於　經閣</h1>
      <p>
        經閣（Sutra Reader）是一個簡素的 CBETA 漢文佛典閱讀器，
        以 wabi-sabi 為視覺語言，遵循「無賬戶、無分析、無追蹤」的原則。
        原始碼公開於{" "}
        <a href="https://github.com/jessepcc/sutra-reader" target="_blank" rel="noreferrer noopener">
          GitHub
        </a>
        。
      </p>

      <h2>授權</h2>
      <p>
        App 程式碼採用 <strong>MIT 授權</strong>。
        文本內容由 CBETA 中華電子佛典協會釋出，依 <strong>CC BY-NC-SA 3.0 台灣</strong> 授權。
      </p>
      <p>
        本 App 文本資料來自{" "}
        <a href="https://github.com/cbeta-org/xml-p5" target="_blank" rel="noreferrer noopener">
          CBETA 中華電子佛典協會
        </a>
        ，依姓名標示-非商業性-相同方式分享 3.0 台灣 授權條款釋出。
        © 財團法人佛教電子佛典基金會 — Comprehensive Buddhist Electronic Text Archive Foundation —
        非賣品‧非營利性使用。版權詳情：
        <a href="https://cbeta.org/copyright" target="_blank" rel="noreferrer noopener">
          cbeta.org/copyright
        </a>
        。
      </p>

      <h2>非本 App 收錄</h2>
      <p>
        以下典籍因第三方版權限制，未納入 v1 瀏覽：
      </p>
      <ul>
        <li>呂澂佛學著作集（canon 編號 LC）</li>
        <li>印順法師（Y…）、太虛大師（TX…）著作</li>
      </ul>

      <h2>隱私</h2>
      <p>
        無賬戶、無雲端同步、無第三方分析。
        對外連線僅限：GitHub raw（取文本）、本 App 的 catalog / manifest JSON，以及 Google Fonts（字體）。
      </p>

      <h2>商業利用</h2>
      <p>
        Fork 此程式碼並重新部署於商業用途者，違反的是「內容授權」而非「程式碼授權」。
        若您欲商業利用，請先剔除所有 CBETA 文本。
      </p>
    </main>
  );
}
