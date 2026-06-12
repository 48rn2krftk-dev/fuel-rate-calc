import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { NormComparison } from "../components/NormComparison";
import type { CalculationResult, SlotData } from "../types";
import {
  calculateManual,
  parseFuel,
} from "../utils/calculations";
import {
  formatDurationInput,
  parseDurationToMinutes,
} from "../utils/duration";
import { formatNumber, formatTime } from "../utils/format";
import {
  getSettings,
  getSlots,
  subscribeSettingsChange,
  subscribeSlotsChange,
} from "../utils/storage";

type SummaryMode = "manual" | "slot";

type SummaryRow = {
  id: number;
  mode: SummaryMode;
  duration: string;
  fuelUsed: string;
  slotSavedAt: string;
};

let nextRowId = 1;

function createRow(): SummaryRow {
  return {
    id: nextRowId++,
    mode: "manual",
    duration: "",
    fuelUsed: "",
    slotSavedAt: "",
  };
}

function createInitialRows(): SummaryRow[] {
  return [createRow(), createRow()];
}

function getRowResult(
  row: SummaryRow,
  slots: Array<SlotData | null>
): CalculationResult | null {
  if (row.mode === "slot") {
    return slots.find((slot) => slot?.savedAt === row.slotSavedAt) ?? null;
  }

  const minutes = parseDurationToMinutes(row.duration);
  const fuelUsed = parseFuel(row.fuelUsed);

  if (minutes === null || fuelUsed === null) {
    return null;
  }

  return calculateManual(minutes, fuelUsed);
}

export function SummaryScreen() {
  const [rows, setRows] = useState<SummaryRow[]>(createInitialRows);
  const [slots, setSlots] = useState(() => getSlots());
  const [settings, setSettings] = useState(() => getSettings());

  useEffect(() => {
    return subscribeSlotsChange(() => {
      setSlots(getSlots());
    });
  }, []);

  useEffect(() => {
    return subscribeSettingsChange(() => {
      setSettings(getSettings());
    });
  }, []);

  const filledSlots = slots.filter((slot): slot is SlotData => slot !== null);
  const rowResults = rows.map((row) => getRowResult(row, slots));
  const allRowsComplete = rowResults.every(
    (result): result is CalculationResult => result !== null
  );

  const calculation = allRowsComplete
    ? rowResults.reduce<CalculationResult>(
        (total, result) => ({
          minutes: total.minutes + result.minutes,
          fuelUsed: total.fuelUsed + result.fuelUsed,
          fuelPerHour: 0,
        }),
        { minutes: 0, fuelUsed: 0, fuelPerHour: 0 }
      )
    : null;

  if (calculation && calculation.minutes > 0) {
    calculation.fuelPerHour =
      calculation.fuelUsed / (calculation.minutes / 60);
  }

  function updateRow(id: number, patch: Partial<SummaryRow>) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function setMode(row: SummaryRow, mode: SummaryMode) {
    updateRow(row.id, {
      mode,
      slotSavedAt:
        mode === "slot" ? row.slotSavedAt || filledSlots[0]?.savedAt || "" : "",
    });
  }

  function handleDurationBlur(row: SummaryRow) {
    const minutes = parseDurationToMinutes(row.duration);

    if (minutes !== null) {
      updateRow(row.id, { duration: formatDurationInput(minutes) });
    }
  }

  function removeRow(id: number) {
    setRows((currentRows) => currentRows.filter((row) => row.id !== id));
  }

  function clearRows() {
    setRows(createInitialRows());
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="sectionTitle">
          <h2>Суммирование</h2>
          <p>
            Сложи несколько прогревов из сохранённых слотов или введи их
            вручную.
          </p>
        </div>

        <div className="summaryRows">
          {rows.map((row, index) => {
            const result = rowResults[index];
            const durationError =
              row.mode === "manual" &&
              row.duration.trim() !== "" &&
              parseDurationToMinutes(row.duration) === null;
            const fuelError =
              row.mode === "manual" &&
              row.fuelUsed.trim() !== "" &&
              parseFuel(row.fuelUsed) === null;

            return (
              <div className="summaryRowCard" key={row.id}>
                <div className="summaryRowHeader">
                  <b>Прогрев {index + 1}</b>

                  {rows.length > 2 && (
                    <button
                      className="iconDangerButton"
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label={`Удалить прогрев ${index + 1}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div className="segmentedControl">
                  <button
                    className={
                      row.mode === "manual"
                        ? "segmentButton active"
                        : "segmentButton"
                    }
                    type="button"
                    onClick={() => setMode(row, "manual")}
                  >
                    Вручную
                  </button>
                  <button
                    className={
                      row.mode === "slot"
                        ? "segmentButton active"
                        : "segmentButton"
                    }
                    type="button"
                    onClick={() => setMode(row, "slot")}
                    disabled={filledSlots.length === 0}
                  >
                    Из слота
                  </button>
                </div>

                {row.mode === "slot" ? (
                  <label className="field">
                    <span>Сохранённый расчёт</span>
                    <select
                      className="selectInput"
                      value={row.slotSavedAt}
                      onChange={(event) =>
                        updateRow(row.id, {
                          slotSavedAt: event.target.value,
                        })
                      }
                    >
                      {filledSlots.map((slot, slotIndex) => (
                        <option value={slot.savedAt} key={slot.savedAt}>
                          Слот {slotIndex + 1}: {slot.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="grid">
                    <label className="field">
                      <span>Время прогрева</span>
                      <input
                        value={row.duration}
                        onBlur={() => handleDurationBlur(row)}
                        onChange={(event) =>
                          updateRow(row.id, { duration: event.target.value })
                        }
                        placeholder="01:35 или 0135"
                        inputMode="text"
                      />
                    </label>

                    <label className="field">
                      <span>Израсходовано топлива, кг</span>
                      <input
                        value={row.fuelUsed}
                        onChange={(event) =>
                          updateRow(row.id, { fuelUsed: event.target.value })
                        }
                        placeholder="40,000"
                        inputMode="decimal"
                      />
                    </label>

                    {durationError && (
                      <div className="errorBox">
                        Введи время в формате 01:35, 0135 или 1ч35.
                      </div>
                    )}

                    {fuelError && (
                      <div className="errorBox">
                        Введи топливо от 0 до 9999,999 кг.
                      </div>
                    )}
                  </div>
                )}

                {result && (
                  <div className="miniResult">
                    {formatTime(result.minutes)} ·{" "}
                    {formatNumber(result.fuelUsed)} кг
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="summaryActions">
          <button
            className="primaryButton"
            type="button"
            onClick={() => setRows((currentRows) => [...currentRows, createRow()])}
          >
            <Plus size={18} />
            Добавить ещё
          </button>

          <button
            className="secondaryButton compact"
            type="button"
            onClick={clearRows}
          >
            <RotateCcw size={18} />
            Очистить
          </button>
        </div>
      </div>

      <div className="resultCard">
        <p>
          Общее время: {calculation ? formatTime(calculation.minutes) : "—"}
        </p>
        <p>
          Общий расход:{" "}
          {calculation ? `${formatNumber(calculation.fuelUsed)} кг` : "—"}
        </p>
        <p>
          Средний расход в час:{" "}
          {calculation
            ? `${formatNumber(calculation.fuelPerHour)} кг/ч`
            : "—"}
        </p>

        {calculation && (
          <NormComparison
            result={calculation}
            normFuelPerHour={settings.normFuelPerHour}
          />
        )}
      </div>
    </section>
  );
}
