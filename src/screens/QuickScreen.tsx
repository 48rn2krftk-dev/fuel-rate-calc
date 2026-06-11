import { useEffect, useMemo, useState } from "react";
import { calculateDeviation, calculateManual, parseFuel } from "../utils/calculations";
import { formatNumber, formatTime } from "../utils/format";
import { getSettings, subscribeSettingsChange } from "../utils/storage";
import { SaveResultPanel } from "../components/SaveResultPanel";

function parseDurationToMinutes(value: string): number | null {
  const raw = value.trim().toLowerCase();

  if (!raw) return null;

  // 1:35, 01:35, 1.35
  const colonMatch = raw.match(/^(\d{1,3})[:.](\d{1,2})$/);
  if (colonMatch) {
    const h = Number(colonMatch[1]);
    const m = Number(colonMatch[2]);

    if (h >= 0 && m >= 0 && m <= 59) {
      const total = h * 60 + m;
      return total > 0 ? total : null;
    }

    return null;
  }

  // 0135 = 01:35
  // 1230 = 12:30
  const compactTimeMatch = raw.match(/^(\d{2})(\d{2})$/);
  if (compactTimeMatch) {
    const h = Number(compactTimeMatch[1]);
    const m = Number(compactTimeMatch[2]);

    if (h >= 0 && m >= 0 && m <= 59) {
      const total = h * 60 + m;
      return total > 0 ? total : null;
    }

    return null;
  }

  // 1ч35, 1 ч 35 м, 1ч 35м
  const textMatch = raw.match(/^(\d{1,3})\s*ч(?:ас(?:а|ов)?)?\s*(\d{1,2})?\s*м?$/);
  if (textMatch) {
    const h = Number(textMatch[1]);
    const m = textMatch[2] ? Number(textMatch[2]) : 0;

    if (h >= 0 && m >= 0 && m <= 59) {
      const total = h * 60 + m;
      return total > 0 ? total : null;
    }

    return null;
  }

  return null;
}

function formatDurationInput(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function QuickScreen() {
  const [duration, setDuration] = useState("");
  const [fuelUsed, setFuelUsed] = useState("");

  const [settings, setSettings] = useState(() => getSettings());

useEffect(() => {
  return subscribeSettingsChange(() => {
    setSettings(getSettings());
  });
}, []);

  const calculation = useMemo(() => {
    const minutes = parseDurationToMinutes(duration);
    const fuel = parseFuel(fuelUsed);

    if (minutes === null || fuel === null) {
      return null;
    }

    return calculateManual(minutes, fuel);
  }, [duration, fuelUsed]);

  const durationParsed = parseDurationToMinutes(duration);
  const fuelParsed = parseFuel(fuelUsed);

  const durationError = duration.trim() !== "" && durationParsed === null;
  const fuelError = fuelUsed.trim() !== "" && fuelParsed === null;

  const deviation = calculation
    ? calculateDeviation(calculation.fuelPerHour, settings.normFuelPerHour)
    : null;

  function handleDurationBlur() {
    const parsed = parseDurationToMinutes(duration);

    if (parsed !== null) {
      setDuration(formatDurationInput(parsed));
    }
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="sectionTitle">
          <h2>Быстрый расчёт</h2>
          <p>Введи готовое время прогрева и израсходованное топливо.</p>
        </div>

        <div className="grid">
          <label className="field">
            <span>Время прогрева</span>
            <input
              value={duration}
              onBlur={handleDurationBlur}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="01:35 или 0135"
              inputMode="text"
            />
          </label>

          <label className="field">
            <span>Израсходовано топлива, кг</span>
            <input
              value={fuelUsed}
              onChange={(e) => setFuelUsed(e.target.value)}
              placeholder="40,000"
              inputMode="decimal"
            />
          </label>
        </div>

        {durationError && (
          <div className="errorBox">
            Введи время в формате 01:35, 0135 или 1ч35.
          </div>
        )}

        {fuelError && (
          <div className="errorBox">
            Введи топливо от 0 до 9999,999 кг (не более 3-ех знаков после запятой).
          </div>
        )}
      </div>

      <div className="resultCard">
        <p>Время прогрева: {calculation ? formatTime(calculation.minutes) : "—"}</p>
        <p>
          Израсходовано:{" "}
          {calculation ? `${formatNumber(calculation.fuelUsed)} кг` : "—"}
        </p>
        <p>
          Расход в час:{" "}
          {calculation ? `${formatNumber(calculation.fuelPerHour)} кг/ч` : "—"}
        </p>

        {deviation !== null && deviation !== 0 && (
  <p className={deviation < 0 ? "deviation good" : "deviation bad"}>
    {deviation < 0 ? "↓" : "↑"}{" "}
    {formatNumber(deviation > 0 ? 100 + deviation : 100 - Math.abs(deviation))} %
    от нормы
  </p>
)}

        <SaveResultPanel result={calculation} defaultTitle="Быстрый расчёт" />
      </div>
    </section>
  );
}