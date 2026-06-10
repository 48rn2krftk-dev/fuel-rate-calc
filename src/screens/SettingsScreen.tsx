import { useEffect, useState } from "react";
import type { AppSettings } from "../types";
import { parseFuel } from "../utils/calculations";
import { formatNumber, formatTime } from "../utils/format";
import {
  clearSlot,
  getSettings,
  getSlots,
  saveSettings,
  subscribeSlotsChange,
} from "../utils/storage";

export function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [normInput, setNormInput] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [slots, setSlots] = useState(() => getSlots());

  useEffect(() => {
    setNormInput(
      settings.normFuelPerHour === null
        ? ""
        : formatNumber(settings.normFuelPerHour)
    );
  }, [settings.normFuelPerHour]);

  useEffect(() => {
  return subscribeSlotsChange(() => {
    setSlots(getSlots());
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
              {formatTime(slot.minutes)} · {formatNumber(slot.fuelUsed)} кг ·{" "}
              {formatNumber(slot.fuelPerHour)} кг/ч
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
        <div className="sectionTitle">
          <h2>Формула расчёта</h2>
          <p>Как приложение считает горячий простой.</p>
        </div>

        <div className="formulaBox">
          <p>
            <b>Расход в час</b>
          </p>
          <p>Израсходованное топливо ÷ Время прогрева</p>
        </div>

        <div className="formulaBox">
          <p>
            <b>Отклонение от нормы</b>
          </p>
          <p>(Факт − Норма) ÷ Норма × 100%</p>
        </div>

        <p className="hint">
          Если фактический расход ниже нормы — приложение показывает зелёную
          стрелку вниз. Если выше нормы — красную стрелку вверх.
        </p>
      </div>
    </section>
  );
}