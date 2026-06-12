import { Calculator, Clock3, Layers3, Settings } from "lucide-react";
import { useState } from "react";
import { ByTimeScreen } from "./screens/ByTimeScreen";
import { QuickScreen } from "./screens/QuickScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import type { HistoryEntry } from "./types";

type Screen = "byTime" | "quick" | "summary" | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>("byTime");
  const [restoredEntry, setRestoredEntry] = useState<HistoryEntry | null>(null);

  function navigate(screenName: Screen) {
    setRestoredEntry(null);
    setScreen(screenName);
  }

  function openHistoryEntry(entry: HistoryEntry) {
    setRestoredEntry(entry);
    setScreen(entry.source.type);
  }

  return (
    <div className="app">
      <header className="appHeader">
        <div>
          <p className="appEyebrow">PWA калькулятор</p>
          <h1>Горячий простой</h1>
        </div>
      </header>

      <main className="appMain">
        {screen === "byTime" && (
          <ByTimeScreen
            key={restoredEntry?.id ?? "byTime-new"}
            initialEntry={
              restoredEntry?.source.type === "byTime" ? restoredEntry : null
            }
          />
        )}
        {screen === "quick" && (
          <QuickScreen
            key={restoredEntry?.id ?? "quick-new"}
            initialEntry={
              restoredEntry?.source.type === "quick" ? restoredEntry : null
            }
          />
        )}
        {screen === "summary" && (
          <SummaryScreen
            key={restoredEntry?.id ?? "summary-new"}
            initialEntry={
              restoredEntry?.source.type === "summary" ? restoredEntry : null
            }
          />
        )}
        {screen === "settings" && (
          <SettingsScreen onOpenHistoryEntry={openHistoryEntry} />
        )}
      </main>

      <nav className="bottomNav">
        <button
          className={screen === "byTime" ? "navButton active" : "navButton"}
          onClick={() => navigate("byTime")}
        >
          <Clock3 size={21} />
          <span>Время</span>
        </button>

        <button
          className={screen === "quick" ? "navButton active" : "navButton"}
          onClick={() => navigate("quick")}
        >
          <Calculator size={21} />
          <span>Быстро</span>
        </button>

        <button
          className={screen === "summary" ? "navButton active" : "navButton"}
          onClick={() => navigate("summary")}
        >
          <Layers3 size={21} />
          <span>Сумма</span>
        </button>

        <button
          className={screen === "settings" ? "navButton active" : "navButton"}
          onClick={() => navigate("settings")}
        >
          <Settings size={21} />
          <span>Ещё</span>
        </button>
      </nav>
    </div>
  );
}
