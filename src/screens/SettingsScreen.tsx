import {
  ExternalLink,
  Gift,
  GitFork,
  Mail,
  MessageCircle,
  Monitor,
  Moon,
  Send,
  Sun,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { links, uiText } from "../content";
import type { AppSettings, HistoryEntry } from "../types";
import { parseFuel } from "../utils/calculations";
import { formatNumber, formatTime } from "../utils/format";
import {
  clearHistory,
  clearHistoryEntry,
  clearSlot,
  getHistory,
  getSettings,
  getSlots,
  saveSettings,
  subscribeHistoryChange,
  subscribeSlotsChange,
} from "../utils/storage";

function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getHistoryType(entry: HistoryEntry): string {
  if (entry.source.type === "byTime") {
    return uiText.settings.historyType.byTime;
  }
  if (entry.source.type === "quick") {
    return uiText.settings.historyType.quick;
  }
  return uiText.settings.historyType.summary;
}

function HistorySource({ entry }: { entry: HistoryEntry }) {
  if (entry.source.type === "byTime") {
    return (
      <p className="historySource">
        {entry.source.startTime} → {entry.source.endTime}
        <br />
        {uiText.settings.balances}: {formatNumber(entry.source.fuelStart)} →{" "}
        {formatNumber(entry.source.fuelEnd)}{" "}
        {uiText.common.units.kilograms}
      </p>
    );
  }

  if (entry.source.type === "quick") {
    return (
      <p className="historySource">
        {uiText.settings.time}: {entry.source.duration}
        <br />
        {uiText.settings.fuel}: {formatNumber(entry.source.fuelUsed)}{" "}
        {uiText.common.units.kilograms}
      </p>
    );
  }

  return (
    <p className="historySource">
      {entry.source.fuelStart !== null &&
        entry.source.fuelStart !== undefined && (
          <>
            {uiText.settings.chainStart}:{" "}
            {formatNumber(entry.source.fuelStart)}{" "}
            {uiText.common.units.kilograms}
            <br />
          </>
        )}
      {entry.source.items
        .map(
          (item) =>
            `${item.title}: ${formatTime(item.minutes)}, ${formatNumber(item.fuelUsed)} ${uiText.common.units.kilograms}`
        )
        .join(" · ")}
    </p>
  );
}

type SettingsScreenProps = {
  onOpenHistoryEntry: (entry: HistoryEntry) => void;
};

export function SettingsScreen({
  onOpenHistoryEntry,
}: SettingsScreenProps) {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [normInput, setNormInput] = useState(() => {
    const norm = getSettings().normFuelPerHour;
    return norm === null ? "" : formatNumber(norm);
  });
  const [savedMessage, setSavedMessage] = useState("");
  const [slots, setSlots] = useState(() => getSlots());
  const [history, setHistory] = useState(() => getHistory());

  useEffect(() => {
    return subscribeSlotsChange(() => {
      setSlots(getSlots());
    });
  }, []);

  useEffect(() => {
    return subscribeHistoryChange(() => {
      setHistory(getHistory());
    });
  }, []);

  const parsedNorm = normInput.trim() === "" ? null : parseFuel(normInput);
  const normError = normInput.trim() !== "" && parsedNorm === null;

  function handleSaveNorm() {
    if (normError) return;

    const nextSettings: AppSettings = {
      ...settings,
      normFuelPerHour: parsedNorm,
    };

    setSettings(nextSettings);
    saveSettings(nextSettings);

    setSavedMessage(uiText.settings.normSaved);

    window.setTimeout(() => {
      setSavedMessage("");
    }, 1800);
  }

  function handleClearNorm() {
    const nextSettings: AppSettings = {
      ...settings,
      normFuelPerHour: null,
    };

    setSettings(nextSettings);
    saveSettings(nextSettings);
    setNormInput("");
    setSavedMessage(uiText.settings.normCleared);

    window.setTimeout(() => {
      setSavedMessage("");
    }, 1800);
  }

  function handleThemeChange(theme: AppSettings["theme"]) {
    const nextSettings: AppSettings = {
      ...settings,
      theme,
    };

    setSettings(nextSettings);
    saveSettings(nextSettings);
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="sectionTitle">
          <h2>{uiText.settings.title}</h2>
          <p>{uiText.settings.description}</p>
        </div>

        <label className="field">
          <span>{uiText.settings.normLabel}</span>
          <input
            value={normInput}
            onChange={(e) => setNormInput(e.target.value)}
            inputMode="decimal"
            placeholder={uiText.settings.normPlaceholder}
          />
        </label>

        {normError && (
          <div className="errorBox">
            {uiText.settings.normError}
          </div>
        )}

        <div className="buttonRow">
          <button
            className="primaryButton"
            type="button"
            onClick={handleSaveNorm}
            disabled={normError}
          >
            {uiText.settings.saveNorm}
          </button>

          <button
            className="secondaryButton compact"
            type="button"
            onClick={handleClearNorm}
          >
            {uiText.common.clear}
          </button>
        </div>

        {savedMessage && <div className="successBox">{savedMessage}</div>}
      </div>

      <div className="card">
        <div className="sectionTitle">
          <h2>{uiText.settings.appearanceTitle}</h2>
          <p>{uiText.settings.appearanceDescription}</p>
        </div>

        <div
          className="themeSelector"
          role="group"
          aria-label={uiText.settings.themeSelectorLabel}
        >
          <button
            className={
              settings.theme === "system"
                ? "themeButton active"
                : "themeButton"
            }
            type="button"
            aria-pressed={settings.theme === "system"}
            onClick={() => handleThemeChange("system")}
          >
            <Monitor size={18} />
            {uiText.settings.theme.system}
          </button>
          <button
            className={
              settings.theme === "light"
                ? "themeButton active"
                : "themeButton"
            }
            type="button"
            aria-pressed={settings.theme === "light"}
            onClick={() => handleThemeChange("light")}
          >
            <Sun size={18} />
            {uiText.settings.theme.light}
          </button>
          <button
            className={
              settings.theme === "dark"
                ? "themeButton active"
                : "themeButton"
            }
            type="button"
            aria-pressed={settings.theme === "dark"}
            onClick={() => handleThemeChange("dark")}
          >
            <Moon size={18} />
            {uiText.settings.theme.dark}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="sectionTitle">
          <h2>{uiText.settings.slotsTitle}</h2>
          <p>{uiText.settings.slotsDescription}</p>
        </div>

        <div className="slotList">
          {slots.map((slot, index) => (
            <div className="slotInfo" key={index}>
              <div>
                <b>{uiText.settings.slot(index + 1)}</b>

                {slot ? (
                  <p>
                    {slot.title}
                    <br />
                    {formatTime(slot.minutes)} · {formatNumber(slot.fuelUsed)}{" "}
                    {uiText.common.units.kilograms} ·{" "}
                    {formatNumber(slot.fuelPerHour)}{" "}
                    {uiText.common.units.kilogramsPerHour}
                  </p>
                ) : (
                  <p>{uiText.settings.emptySlot}</p>
                )}
              </div>

              {slot && (
                <button
                  className="dangerButton"
                  type="button"
                  onClick={() => clearSlot(index)}
                >
                  {uiText.common.clear}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="historyTitle">
          <div className="sectionTitle">
            <h2>{uiText.settings.historyTitle}</h2>
            <p>{uiText.settings.historyDescription}</p>
          </div>

          {history.length > 0 && (
            <button
              className="dangerButton"
              type="button"
              onClick={clearHistory}
            >
              {uiText.common.clearAll}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="emptyHistory">{uiText.settings.emptyHistory}</p>
        ) : (
          <div className="historyList">
            {history.map((entry) => {
              const normFuel =
                entry.normFuelPerHour === null
                  ? null
                  : entry.normFuelPerHour * (entry.minutes / 60);

              return (
                <article
                  className="historyCard interactive"
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenHistoryEntry(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenHistoryEntry(entry);
                    }
                  }}
                >
                  <div className="historyHeader">
                    <div>
                      <b>{entry.title}</b>
                      <p>
                        {getHistoryType(entry)} ·{" "}
                        {formatHistoryDate(entry.createdAt)}
                      </p>
                    </div>

                    <button
                      className="iconDangerButton"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        clearHistoryEntry(entry.id);
                      }}
                      aria-label={uiText.settings.deleteHistoryEntry(
                        entry.title
                      )}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  <HistorySource entry={entry} />

                  <div className="historyResult">
                    <span>{formatTime(entry.minutes)}</span>
                    <span>
                      {formatNumber(entry.fuelUsed)}{" "}
                      {uiText.common.units.kilograms}
                    </span>
                    <b>
                      {formatNumber(entry.fuelPerHour)}{" "}
                      {uiText.common.units.kilogramsPerHour}
                    </b>
                  </div>

                  {entry.normFuelPerHour !== null && normFuel !== null && (
                    <p className="historyNorm">
                      {uiText.settings.calculationNorm}:{" "}
                      {formatNumber(entry.normFuelPerHour)}{" "}
                      {uiText.common.units.kilogramsPerHour} ·{" "}
                      {formatNumber(normFuel)} {uiText.common.units.kilograms}{" "}
                      {uiText.settings.forPeriod}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="sectionTitle">
          <h2>{uiText.settings.feedbackTitle}</h2>
          <p>{uiText.settings.feedbackDescription}</p>
        </div>

        <div className="contactLinks">
          <a className="contactLink" href={links.email}>
            <Mail size={21} />
            <span>
              <b>{uiText.settings.emailTitle}</b>
              <small>{uiText.settings.emailDescription}</small>
            </span>
            <ExternalLink size={18} />
          </a>

          <a
            className="contactLink"
            href={links.telegram}
            target="_blank"
            rel="noreferrer"
          >
            <Send size={21} />
            <span>
              <b>{uiText.settings.telegramTitle}</b>
              <small>{uiText.settings.telegramDescription}</small>
            </span>
            <ExternalLink size={18} />
          </a>

          <a
            className="contactLink"
            href={links.express}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={21} />
            <span>
              <b>{uiText.settings.expressTitle}</b>
              <small>{uiText.settings.expressDescription}</small>
            </span>
            <ExternalLink size={18} />
          </a>
        </div>
      </div>

      <div className="card supportCard">
        <Gift className="supportIcon" size={26} />
        <div>
          <h2>{uiText.settings.supportTitle}</h2>
          <p>{uiText.settings.supportDescription}</p>
        </div>
        <a
          className="supportButton"
          href={links.support}
          target="_blank"
          rel="noreferrer"
        >
          {uiText.settings.supportButton}
          <ExternalLink size={18} />
        </a>
      </div>

      <div className="card">
        <div className="sectionTitle">
          <h2>{uiText.settings.aboutTitle}</h2>
          <p>{uiText.app.version}</p>
        </div>

        <a
          className="githubLink"
          href={links.github}
          target="_blank"
          rel="noreferrer"
        >
          <GitFork size={21} />
          <span>
            <b>{uiText.settings.githubTitle}</b>
            <small>{uiText.settings.developer}</small>
          </span>
          <ExternalLink size={18} />
        </a>

        <p className="installHint">
          {uiText.settings.installHint}
        </p>
      </div>
    </section>
  );
}
