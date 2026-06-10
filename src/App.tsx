import { Calculator, Clock3, Layers3, Settings } from "lucide-react";
import { useState } from "react";
import { ByTimeScreen } from "./screens/ByTimeScreen";
import { QuickScreen } from "./screens/QuickScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SummaryScreen } from "./screens/SummaryScreen";

type Screen = "byTime" | "quick" | "summary" | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>("byTime");

  return (
    <div className="app">
      <header className="appHeader">
        <div>
          <p className="appEyebrow">PWA калькулятор</p>
          <h1>Горячий простой</h1>
        </div>
      </header>

      <main className="appMain">
        {screen === "byTime" && <ByTimeScreen />}
        {screen === "quick" && <QuickScreen />}
        {screen === "summary" && <SummaryScreen />}
        {screen === "settings" && <SettingsScreen />}
      </main>

      <nav className="bottomNav">
        <button
          className={screen === "byTime" ? "navButton active" : "navButton"}
          onClick={() => setScreen("byTime")}
        >
          <Clock3 size={21} />
          <span>Время</span>
        </button>

        <button
          className={screen === "quick" ? "navButton active" : "navButton"}
          onClick={() => setScreen("quick")}
        >
          <Calculator size={21} />
          <span>Быстро</span>
        </button>

        <button
          className={screen === "summary" ? "navButton active" : "navButton"}
          onClick={() => setScreen("summary")}
        >
          <Layers3 size={21} />
          <span>Сумма</span>
        </button>

        <button
          className={screen === "settings" ? "navButton active" : "navButton"}
          onClick={() => setScreen("settings")}
        >
          <Settings size={21} />
          <span>Ещё</span>
        </button>
      </nav>
    </div>
  );
}