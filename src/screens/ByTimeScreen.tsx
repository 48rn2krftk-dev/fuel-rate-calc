import { useEffect, useMemo, useState } from "react";
import {
  calculateByFuelDifference,
  calculateDeviation,
  parseFuel,
} from "../utils/calculations";
import { formatNumber, formatTime } from "../utils/format";
import { getSettings, subscribeSettingsChange } from "../utils/storage";
import { SaveResultPanel } from "../components/SaveResultPanel";

type ParsedDateTime =
  | {
      type: "datetime";
      date: Date;
    }
  | {
      type: "time";
      minutes: number;
    };

function normalizeYear(year: string): number {
  const num = Number(year);

  if (year.length === 2) {
    return 2000 + num;
  }

  return num;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTime(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatOnlyTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${pad(h)}:${pad(m)}`;
}

function dateWithTime(baseDate: Date, minutes: number): Date {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    h,
    m
  );
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseDateTime(value: string): ParsedDateTime | null {
  const raw = value.trim();

  if (!raw) return null;

  // 15:06 или 15.06
  const onlyTimeMatch = raw.match(/^(\d{1,2})[:.](\d{2})$/);
  if (onlyTimeMatch) {
    const h = Number(onlyTimeMatch[1]);
    const m = Number(onlyTimeMatch[2]);

    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return {
        type: "time",
        minutes: h * 60 + m,
      };
    }

    return null;
  }

  // 1506
  const compactTimeMatch = raw.match(/^(\d{2})(\d{2})$/);
  if (compactTimeMatch) {
    const h = Number(compactTimeMatch[1]);
    const m = Number(compactTimeMatch[2]);

    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return {
        type: "time",
        minutes: h * 60 + m,
      };
    }

    return null;
  }

  // 12.05.2026 15:06
  // 12.05.26 15:06
  // 12.05.2026 1506
  // 12.05.26 1506
  const dottedDateTimeMatch = raw.match(
    /^(\d{2})[.](\d{2})[.](\d{2}|\d{4})\s+(\d{1,2})[:.]?(\d{2})$/
  );

  if (dottedDateTimeMatch) {
    const day = Number(dottedDateTimeMatch[1]);
    const month = Number(dottedDateTimeMatch[2]);
    const year = normalizeYear(dottedDateTimeMatch[3]);
    const h = Number(dottedDateTimeMatch[4]);
    const m = Number(dottedDateTimeMatch[5]);

    const date = new Date(year, month - 1, day, h, m);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      h >= 0 &&
      h <= 23 &&
      m >= 0 &&
      m <= 59
    ) {
      return {
        type: "datetime",
        date,
      };
    }

    return null;
  }

  // 010126 0100
  // 01012026 0100
  // 010126 01:00
  // 01012026 01:00
  const compactDateTimeMatch = raw.match(
    /^(\d{2})(\d{2})(\d{2}|\d{4})\s+(\d{1,2})[:.]?(\d{2})$/
  );

  if (compactDateTimeMatch) {
    const day = Number(compactDateTimeMatch[1]);
    const month = Number(compactDateTimeMatch[2]);
    const year = normalizeYear(compactDateTimeMatch[3]);
    const h = Number(compactDateTimeMatch[4]);
    const m = Number(compactDateTimeMatch[5]);

    const date = new Date(year, month - 1, day, h, m);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      h >= 0 &&
      h <= 23 &&
      m >= 0 &&
      m <= 59
    ) {
      return {
        type: "datetime",
        date,
      };
    }

    return null;
  }

  return null;
}

function getHeatingMinutes(
  start: ParsedDateTime,
  end: ParsedDateTime,
  nextDay: boolean
): number | null {
  if (start.type === "datetime" && end.type === "datetime") {
    let endDate = end.date;

    if (endDate.getTime() <= start.date.getTime() && nextDay) {
      endDate = addDays(endDate, 1);
    }

    const diffMs = endDate.getTime() - start.date.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    return diffMinutes > 0 ? diffMinutes : null;
  }

  if (start.type === "datetime" && end.type === "time") {
    let endDate = dateWithTime(start.date, end.minutes);

    if (endDate.getTime() <= start.date.getTime() && nextDay) {
      endDate = addDays(endDate, 1);
    }

    const diffMs = endDate.getTime() - start.date.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    return diffMinutes > 0 ? diffMinutes : null;
  }

  if (start.type === "time" && end.type === "time") {
    let minutes = end.minutes - start.minutes;

    if (minutes < 0 && nextDay) {
      minutes += 24 * 60;
    }

    return minutes > 0 ? minutes : null;
  }

  return null;
}

function formatInputValue(
  parsed: ParsedDateTime | null,
  baseDate?: Date
): string | null {
  if (!parsed) return null;

  if (parsed.type === "datetime") {
    return formatDateTime(parsed.date);
  }

  if (baseDate) {
    return formatDateTime(dateWithTime(baseDate, parsed.minutes));
  }

  return formatOnlyTime(parsed.minutes);
}

export function ByTimeScreen() {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [fuelStart, setFuelStart] = useState("");
  const [fuelEnd, setFuelEnd] = useState("");
  const [nextDay, setNextDay] = useState(false);

  const [settings, setSettings] = useState(() => getSettings());

useEffect(() => {
  return subscribeSettingsChange(() => {
    setSettings(getSettings());
  });
}, []);

  const parsedStart = parseDateTime(startTime);
  const parsedEnd = parseDateTime(endTime);

  const calculation = useMemo(() => {
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
  }, [startTime, endTime, fuelStart, fuelEnd, nextDay]);

  const needNextDayWarning = (() => {
    if (!parsedStart || !parsedEnd || nextDay) return false;

    if (parsedStart.type === "time" && parsedEnd.type === "time") {
      return parsedEnd.minutes < parsedStart.minutes;
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

  const deviation = calculation
    ? calculateDeviation(calculation.fuelPerHour, settings.normFuelPerHour)
    : null;

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

  return (
    <section className="screen">
      <div className="card">
        <div className="sectionTitle">
          <h2>Расчёт по времени</h2>
          <p>Введи время начала, окончания и остатки топлива.</p>
        </div>

        <div className="grid">
          <label className="field">
            <span>Начало прогрева</span>
            <input
              value={startTime}
              onBlur={handleStartBlur}
              onChange={(e) => {
                setStartTime(e.target.value);
                setNextDay(false);
              }}
              placeholder="07:35 или 010126 0735"
            />
          </label>

          <label className="field">
            <span>Окончание прогрева</span>
            <input
              value={endTime}
              onBlur={handleEndBlur}
              onChange={(e) => {
                setEndTime(e.target.value);
                setNextDay(false);
              }}
              placeholder="09:10 или 020126 0910"
            />
          </label>

          <label className="field">
            <span>Топливо при приёмке, кг</span>
            <input
              value={fuelStart}
              onChange={(e) => setFuelStart(e.target.value)}
              inputMode="decimal"
              placeholder="411,000"
            />
          </label>

          <label className="field">
            <span>Топливо при сдаче, кг</span>
            <input
              value={fuelEnd}
              onChange={(e) => setFuelEnd(e.target.value)}
              inputMode="decimal"
              placeholder="371,000"
            />
          </label>
        </div>

        <button className="secondaryButton" type="button">
          📷 Считать из ведомости
        </button>

        {needNextDayWarning && (
          <div className="warningBox">
            <p>Окончание меньше начала. Считать окончание следующими сутками?</p>
            <button onClick={confirmNextDay}>Да, следующими</button>
          </div>
        )}

        {mixedDateError && (
          <div className="errorBox">
            Если дата указана только в одном поле, она должна быть в поле начала.
          </div>
        )}

        {fuelError && (
          <div className="errorBox">
            Топливо при сдаче не может превышать топливо при приёмке.
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

        <SaveResultPanel result={calculation} defaultTitle="Расчёт по времени" />
      </div>
    </section>
  );
}