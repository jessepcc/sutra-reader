import { useParams, Link } from "react-router-dom";

export function GatedNoticePage() {
  const { canonId = "" } = useParams();
  return (
    <main>
      <h1>{canonId}　非本 App 收錄</h1>
      <p>
        以下藏典之版權由第三方持有（如：呂澂佛學著作集、印順法師、太虛大師著作），
        並非以 Creative Commons 授權釋出，因此 v1 未納入本 App 瀏覽。
      </p>
      <p>欲閱讀此類典籍，請至 CBETA 官方網站：</p>
      <p>
        <a href="https://cbeta.org/" target="_blank" rel="noopener noreferrer">
          cbeta.org
        </a>
      </p>
      <hr />
      <p>
        <Link to="/browse">← 回到藏目</Link>
      </p>
    </main>
  );
}
