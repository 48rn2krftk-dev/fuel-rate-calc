import { Calculator, Clock3, Layers3, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { ByTimeScreen } from "./screens/ByTimeScreen";
import { QuickScreen } from "./screens/QuickScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import type { HistoryEntry } from "./types";

type Screen = "byTime" | "quick" | "summary" | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>("byTime");
  const [restoredEntry, setRestoredEntry] = useState<HistoryEntry | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    let isMounted = true;
    let activeController: AbortController | null = null;

    async function checkConnection() {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 4000);

      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}manifest.webmanifest?online=${Date.now()}`,
          {
            method: "HEAD",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (isMounted && activeController === controller) {
          setIsOnline(response.ok);
        }
      } catch {
        if (isMounted && activeController === controller) {
          setIsOnline(false);
        }
      } finally {
        window.clearTimeout(timeoutId);

        if (activeController === controller) {
          activeController = null;
        }
      }
    }

    function handleOffline() {
      activeController?.abort();
      setIsOnline(false);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkConnection();
      }
    }

    void checkConnection();

    const intervalId = window.setInterval(() => {
      void checkConnection();
    }, 15000);

    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", checkConnection);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      activeController?.abort();
      window.clearInterval(intervalId);
      window.removeEventListener("online", checkConnection);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", checkConnection);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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

        <div
          className={isOnline ? "connectionStatus online" : "connectionStatus offline"}
          role="status"
          aria-live="polite"
        >
          <span className="connectionDot" />
          {isOnline ? "Онлайн" : "Офлайн"}
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
