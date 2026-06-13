import { ExternalLink, GitFork, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
  if (entry.source.type === "byTime") return "Расчёт по времени";
  if (entry.source.type === "quick") return "Быстрый расчёт";
  return "Суммирование";
}

function HistorySource({ entry }: { entry: HistoryEntry }) {
  if (entry.source.type === "byTime") {
    return (
      <p className="historySource">
        {entry.source.startTime} → {entry.source.endTime}
        <br />
        Остатки: {formatNumber(entry.source.fuelStart)} →{" "}
        {formatNumber(entry.source.fuelEnd)} кг
      </p>
    );
  }

  if (entry.source.type === "quick") {
    return (
      <p className="historySource">
        Время: {entry.source.duration}
        <br />
        Топливо: {formatNumber(entry.source.fuelUsed)} кг
      </p>
    );
  }

  return (
    <p className="historySource">
      {entry.source.fuelStart !== null &&
        entry.source.fuelStart !== undefined && (
          <>
            Начало цепочки: {formatNumber(entry.source.fuelStart)} кг
            <br />
          </>
        )}
      {entry.source.items
        .map(
          (item) =>
            `${item.title}: ${formatTime(item.minutes)}, ${formatNumber(item.fuelUsed)} кг`
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

    setSavedMessage("Норматив сохранён");

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
    setSavedMessage("Норматив очищен");

    window.setTimeout(() => {
      setSavedMessage("");
    }, 1800);
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="sectionTitle">
          <h2>Настройки</h2>
          <p>Норматив нужен для сравнения фактического расхода с плановым.</p>
        </div>

        <label className="field">
          <span>Норматив удельного расхода, кг/ч</span>
          <input
            value={normInput}
            onChange={(e) => setNormInput(e.target.value)}
            inputMode="decimal"
            placeholder="Например 45,0"
          />
        </label>

        {normError && (
          <div className="errorBox">
            Введи норматив от 0 до 9999,999 кг/ч.
          </div>
        )}

        <div className="buttonRow">
          <button
            className="primaryButton"
            type="button"
            onClick={handleSaveNorm}
            disabled={normError}
          >
            Сохранить норматив
          </button>

          <button
            className="secondaryButton compact"
            type="button"
            onClick={handleClearNorm}
          >
            Очистить
          </button>
        </div>

        {savedMessage && <div className="successBox">{savedMessage}</div>}
      </div>

      <div className="card">
        <div className="sectionTitle">
          <h2>Слоты сохранения</h2>
          <p>Здесь хранятся временные сохранения для суммирования.</p>
        </div>

        <div className="slotList">
          {slots.map((slot, index) => (
            <div className="slotInfo" key={index}>
              <div>
                <b>Слот {index + 1}</b>

                {slot ? (
                  <p>
                    {slot.title}
                    <br />
                    {formatTime(slot.minutes)} · {formatNumber(slot.fuelUsed)} кг
                    · {formatNumber(slot.fuelPerHour)} кг/ч
                  </p>
                ) : (
                  <p>Пустой</p>
                )}
              </div>

              {slot && (
                <button
                  className="dangerButton"
                  type="button"
                  onClick={() => clearSlot(index)}
                >
                  Очистить
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="historyTitle">
          <div className="sectionTitle">
            <h2>История расчётов</h2>
            <p>
              Постоянный журнал сохранённых результатов и исходных данных.
            </p>
          </div>

          {history.length > 0 && (
            <button
              className="dangerButton"
              type="button"
              onClick={clearHistory}
            >
              Очистить всё
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="emptyHistory">Сохранённых расчётов пока нет.</p>
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
                      aria-label={`Удалить запись ${entry.title}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  <HistorySource entry={entry} />

                  <div className="historyResult">
                    <span>{formatTime(entry.minutes)}</span>
                    <span>{formatNumber(entry.fuelUsed)} кг</span>
                    <b>{formatNumber(entry.fuelPerHour)} кг/ч</b>
                  </div>

                  {entry.normFuelPerHour !== null && normFuel !== null && (
                    <p className="historyNorm">
                      Норма на момент расчёта:{" "}
                      {formatNumber(entry.normFuelPerHour)} кг/ч ·{" "}
                      {formatNumber(normFuel)} кг за период
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
          <h2>О приложении</h2>
          <p>Горячий простой · версия 1.0.3</p>
        </div>

        <a
          className="githubLink"
          href="https://github.com/48rn2krftk-dev/fuel-rate-calc"
          target="_blank"
          rel="noreferrer"
        >
          <GitFork size={21} />
          <span>
            <b>GitHub разработчика</b>
            <small>48rn2krftk-dev</small>
          </span>
          <ExternalLink size={18} />
        </a>

        <div className="feedbackLinks">
          <a
            className="feedbackLink"
            href="https://github.com/48rn2krftk-dev/fuel-rate-calc/issues/new?template=bug_report.yml"
            target="_blank"
            rel="noreferrer"
          >
            <span>
              <b>Сообщить об ошибке</b>
              <small>Что произошло и как это повторить</small>
            </span>
            <ExternalLink size={18} />
          </a>

          <a
            className="feedbackLink"
            href="https://github.com/48rn2krftk-dev/fuel-rate-calc/issues/new?template=feature_request.yml"
            target="_blank"
            rel="noreferrer"
          >
            <span>
              <b>Предложить улучшение</b>
              <small>Идея новой функции или изменения</small>
            </span>
            <ExternalLink size={18} />
          </a>
        </div>

        <p className="feedbackHint">
          Для отправки потребуется аккаунт GitHub.
        </p>

        <p className="installHint">
          Установка на iPhone: открой приложение в Safari, нажми «Поделиться» и
          выбери «На экран Домой».
        </p>

      </div>
    </section>
  );
}
