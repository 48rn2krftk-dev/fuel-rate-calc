import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NormComparison } from "../components/NormComparison";
import { SaveResultPanel } from "../components/SaveResultPanel";
import type { HistoryEntry } from "../types";
import { calculateManual, parseFuel } from "../utils/calculations";
import {
  formatDurationInput,
  parseDurationToMinutes,
} from "../utils/duration";
import { formatNumber, formatTime } from "../utils/format";
import { getSettings, subscribeSettingsChange } from "../utils/storage";

type QuickScreenProps = {
  initialEntry: HistoryEntry | null;
};

export function QuickScreen({ initialEntry }: QuickScreenProps) {
  const initialSource =
    initialEntry?.source.type === "quick" ? initialEntry.source : null;
  const [duration, setDuration] = useState(initialSource?.duration ?? "");
  const [fuelUsed, setFuelUsed] = useState(
    initialSource ? formatNumber(initialSource.fuelUsed) : ""
  );

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

  function handleDurationBlur() {
    const parsed = parseDurationToMinutes(duration);

    if (parsed !== null) {
      setDuration(formatDurationInput(parsed));
    }
  }

  function clearAll() {
    setDuration("");
    setFuelUsed("");
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
              placeholder="2214 или 163559"
              inputMode="numeric"
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

        <button
          className="secondaryButton clearAllButton"
          type="button"
          onClick={clearAll}
        >
          <RotateCcw size={18} />
          Очистить всё
        </button>

        {durationError && (
          <div className="errorBox">
            Введи время в формате 22:14, 2214 или 163559.
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

        {calculation && (
          <NormComparison
            result={calculation}
            normFuelPerHour={settings.normFuelPerHour}
          />
        )}

        <SaveResultPanel
          result={calculation}
          defaultTitle="Быстрый расчёт"
          source={
            calculation
              ? {
                  type: "quick",
                  duration: formatDurationInput(calculation.minutes),
                  fuelUsed: calculation.fuelUsed,
                }
              : null
          }
        />
      </div>
    </section>
  );
}
