import { Calculator, Clock3, Layers3, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { uiText } from "./content";
import { ByTimeScreen } from "./screens/ByTimeScreen";
import { QuickScreen } from "./screens/QuickScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import type { HistoryEntry } from "./types";
import {
  getSettings,
  subscribeSettingsChange,
} from "./utils/storage";
import { applyTheme } from "./utils/theme";

type Screen = "byTime" | "quick" | "summary" | "settings";
type ConnectionStatus = "checking" | "online" | "offline";

export default function App() {
  const [screen, setScreen] = useState<Screen>("byTime");
  const [restoredEntry, setRestoredEntry] = useState<HistoryEntry | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    () => (navigator.onLine ? "checking" : "offline")
  );

  useEffect(() => {
    let stopWatchingSystemTheme = applyTheme(getSettings().theme);

    const unsubscribeSettings = subscribeSettingsChange(() => {
      stopWatchingSystemTheme();
      stopWatchingSystemTheme = applyTheme(getSettings().theme);
    });

    return () => {
      stopWatchingSystemTheme();
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let activeController: AbortController | null = null;

    async function checkConnection() {
      if (!navigator.onLine) {
        setConnectionStatus("offline");
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
          setConnectionStatus(response.ok ? "online" : "offline");
        }
      } catch {
        if (isMounted && activeController === controller) {
          setConnectionStatus("offline");
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
      setConnectionStatus("offline");
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
          <p className="appEyebrow">{uiText.app.eyebrow}</p>
          <h1>{uiText.app.title}</h1>
        </div>

        <div
          className={`connectionStatus ${connectionStatus}`}
          role="status"
          aria-live="polite"
        >
          <span className="connectionDot" />
          {connectionStatus === "checking"
            ? uiText.app.connection.checking
            : connectionStatus === "online"
              ? uiText.app.connection.online
              : uiText.app.connection.offline}
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
          <span>{uiText.app.navigation.byTime}</span>
        </button>

        <button
          className={screen === "quick" ? "navButton active" : "navButton"}
          onClick={() => navigate("quick")}
        >
          <Calculator size={21} />
          <span>{uiText.app.navigation.quick}</span>
        </button>

        <button
          className={screen === "summary" ? "navButton active" : "navButton"}
          onClick={() => navigate("summary")}
        >
          <Layers3 size={21} />
          <span>{uiText.app.navigation.summary}</span>
        </button>

        <button
          className={screen === "settings" ? "navButton active" : "navButton"}
          onClick={() => navigate("settings")}
        >
          <Settings size={21} />
          <span>{uiText.app.navigation.settings}</span>
        </button>
      </nav>
    </div>
  );
}
