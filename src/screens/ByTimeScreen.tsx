import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { NormComparison } from "../components/NormComparison";
import { SaveResultPanel } from "../components/SaveResultPanel";
import { uiText } from "../content";
import type { HistoryEntry } from "../types";
import {
  calculateByFuelDifference,
  parseFuel,
} from "../utils/calculations";
import {
  addDays,
  dateWithTime,
  formatDateTime,
  formatInputValue,
  getHeatingMinutes,
  parseDateTime,
} from "../utils/dateTime";
import { formatNumber, formatTime } from "../utils/format";
import { getSettings, subscribeSettingsChange } from "../utils/storage";

type ByTimeScreenProps = {
  initialEntry: HistoryEntry | null;
};

export function ByTimeScreen({ initialEntry }: ByTimeScreenProps) {
  const initialSource =
    initialEntry?.source.type === "byTime" ? initialEntry.source : null;
  const [startTime, setStartTime] = useState(initialSource?.startTime ?? "");
  const [endTime, setEndTime] = useState(initialSource?.endTime ?? "");
  const [fuelStart, setFuelStart] = useState(
    initialSource ? formatNumber(initialSource.fuelStart) : ""
  );
  const [fuelEnd, setFuelEnd] = useState(
    initialSource ? formatNumber(initialSource.fuelEnd) : ""
  );
  const [nextDay, setNextDay] = useState(false);

  const [settings, setSettings] = useState(() => getSettings());

useEffect(() => {
  return subscribeSettingsChange(() => {
    setSettings(getSettings());
  });
}, []);

  const parsedStart = parseDateTime(startTime);
  const parsedEnd = parseDateTime(endTime);

  const calculation = (() => {
    const start = parseDateTime(startTime);
    const end = parseDateTime(endTime);
    const startFuel = parseFuel(fuelStart);
    const endFuel = parseFuel(fuelEnd);

    if (
      start === null ||
      end === null ||
      startFuel === null ||
      endFuel === null
    ) {
      return null;
    }

    const minutes = getHeatingMinutes(start, end, nextDay);

    if (minutes === null) {
      return null;
    }

    return calculateByFuelDifference(minutes, startFuel, endFuel);
  })();

  const needNextDayWarning = (() => {
    if (!parsedStart || !parsedEnd || nextDay) return false;

    if (parsedStart.type === "time" && parsedEnd.type === "time") {
      return parsedEnd.minutes <= parsedStart.minutes;
    }

    if (parsedStart.type === "datetime" && parsedEnd.type === "time") {
      const endDate = dateWithTime(parsedStart.date, parsedEnd.minutes);
      return endDate.getTime() <= parsedStart.date.getTime();
    }

    if (parsedStart.type === "datetime" && parsedEnd.type === "datetime") {
      return parsedEnd.date.getTime() <= parsedStart.date.getTime();
    }

    return false;
  })();

  const fuelStartParsed = parseFuel(fuelStart);
  const fuelEndParsed = parseFuel(fuelEnd);

  const fuelError =
    fuelStartParsed !== null &&
    fuelEndParsed !== null &&
    fuelEndParsed > fuelStartParsed;

  const mixedDateError =
    parsedStart !== null &&
    parsedEnd !== null &&
    parsedStart.type === "time" &&
    parsedEnd.type === "datetime";

  function handleStartBlur() {
    const parsed = parseDateTime(startTime);
    const formatted = formatInputValue(parsed);

    if (formatted) {
      setStartTime(formatted);
    }
  }

  function handleEndBlur() {
    const parsed = parseDateTime(endTime);
    const start = parseDateTime(startTime);

    const formatted = formatInputValue(
      parsed,
      start?.type === "datetime" ? start.date : undefined
    );

    if (formatted) {
      setEndTime(formatted);
    }
  }

  function confirmNextDay() {
    setNextDay(true);

    const start = parseDateTime(startTime);
    const end = parseDateTime(endTime);

    if (start?.type === "datetime" && end?.type === "time") {
      const endDate = addDays(dateWithTime(start.date, end.minutes), 1);
      setEndTime(formatDateTime(endDate));
    }

    if (
      start?.type === "datetime" &&
      end?.type === "datetime" &&
      end.date.getTime() <= start.date.getTime()
    ) {
      setEndTime(formatDateTime(addDays(end.date, 1)));
    }
  }

  function clearAll() {
    setStartTime("");
    setEndTime("");
    setFuelStart("");
    setFuelEnd("");
    setNextDay(false);
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="sectionTitle">
          <h2>{uiText.byTime.title}</h2>
          <p>{uiText.byTime.description}</p>
        </div>

        <div className="grid">
          <label className="field">
            <span>{uiText.byTime.startTime}</span>
            <input
              value={startTime}
              onBlur={handleStartBlur}
              onChange={(e) => {
                setStartTime(e.target.value);
                setNextDay(false);
              }}
              placeholder={uiText.byTime.startTimePlaceholder}
              inputMode="numeric"
            />
          </label>

          <label className="field">
            <span>{uiText.byTime.endTime}</span>
            <input
              value={endTime}
              onBlur={handleEndBlur}
              onChange={(e) => {
                setEndTime(e.target.value);
                setNextDay(false);
              }}
              placeholder={uiText.byTime.endTimePlaceholder}
              inputMode="numeric"
            />
          </label>

          <label className="field">
            <span>{uiText.byTime.fuelStart}</span>
            <input
              value={fuelStart}
              onChange={(e) => setFuelStart(e.target.value)}
              inputMode="decimal"
              placeholder={uiText.byTime.fuelPlaceholder}
            />
          </label>

          <label className="field">
            <span>{uiText.byTime.fuelEnd}</span>
            <input
              value={fuelEnd}
              onChange={(e) => setFuelEnd(e.target.value)}
              inputMode="decimal"
              placeholder={uiText.byTime.fuelEndPlaceholder}
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

        <button className="secondaryButton ocrButton" type="button" disabled>
          <span>{uiText.byTime.ocr}</span>
          <span className="soonBadge">{uiText.byTime.soon}</span>
        </button>

        {needNextDayWarning && (
          <div className="warningBox">
            <p>{uiText.byTime.nextDayQuestion}</p>
            <button onClick={confirmNextDay}>
              {uiText.byTime.nextDayConfirm}
            </button>
          </div>
        )}

        {mixedDateError && (
          <div className="errorBox">
            {uiText.byTime.mixedDateError}
          </div>
        )}

        {fuelError && (
          <div className="errorBox">
            {uiText.byTime.fuelError}
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
            fuelAtStart={fuelStartParsed}
          />
        )}

        <SaveResultPanel
          result={calculation}
          defaultTitle={uiText.byTime.title}
          source={
            calculation &&
            fuelStartParsed !== null &&
            fuelEndParsed !== null
              ? {
                  type: "byTime",
                  startTime,
                  endTime,
                  fuelStart: fuelStartParsed,
                  fuelEnd: fuelEndParsed,
                }
              : null
          }
        />
      </div>
    </section>
  );
}
