import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NormComparison } from "../components/NormComparison";
import { SaveResultPanel } from "../components/SaveResultPanel";
import { uiText } from "../content";
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
          <h2>{uiText.quick.title}</h2>
          <p>{uiText.quick.description}</p>
        </div>

        <div className="grid">
          <label className="field">
            <span>{uiText.quick.duration}</span>
            <input
              value={duration}
              onBlur={handleDurationBlur}
              onChange={(e) => setDuration(e.target.value)}
              placeholder={uiText.quick.durationPlaceholder}
              inputMode="numeric"
            />
          </label>

          <label className="field">
            <span>{uiText.quick.fuelUsed}</span>
            <input
              value={fuelUsed}
              onChange={(e) => setFuelUsed(e.target.value)}
              placeholder={uiText.quick.fuelPlaceholder}
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
          {uiText.common.clearAll}
        </button>

        {durationError && (
          <div className="errorBox">
            {uiText.quick.durationError}
          </div>
        )}

        {fuelError && (
          <div className="errorBox">
            {uiText.quick.fuelError}
          </div>
        )}
      </div>

      <div className="resultCard">
        <p>
          {uiText.common.result.heatingTime}:{" "}
          {calculation
            ? formatTime(calculation.minutes)
            : uiText.common.emptyValue}
        </p>
        <p>
          {uiText.common.result.fuelUsed}:{" "}
          {calculation
            ? `${formatNumber(calculation.fuelUsed)} ${uiText.common.units.kilograms}`
            : uiText.common.emptyValue}
        </p>
        <p>
          {uiText.common.result.fuelPerHour}:{" "}
          {calculation
            ? `${formatNumber(calculation.fuelPerHour)} ${uiText.common.units.kilogramsPerHour}`
            : uiText.common.emptyValue}
        </p>

        {calculation && (
          <NormComparison
            result={calculation}
            normFuelPerHour={settings.normFuelPerHour}
          />
        )}

        <SaveResultPanel
          result={calculation}
          defaultTitle={uiText.quick.title}
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
