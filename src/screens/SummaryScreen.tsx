import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { NormComparison } from "../components/NormComparison";
import { SaveResultPanel } from "../components/SaveResultPanel";
import type { CalculationResult, HistoryEntry, SlotData } from "../types";
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

function createInitialRows(entry?: HistoryEntry | null): SummaryRow[] {
  if (entry?.source.type === "summary") {
    return entry.source.items.map((item) => ({
      id: nextRowId++,
      mode: "manual",
      duration: formatDurationInput(item.minutes),
      fuelUsed: formatNumber(item.fuelUsed),
      slotSavedAt: "",
    }));
  }

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

type SummaryScreenProps = {
  initialEntry: HistoryEntry | null;
};

export function SummaryScreen({ initialEntry }: SummaryScreenProps) {
  const initialSource =
    initialEntry?.source.type === "summary" ? initialEntry.source : null;
  const [rows, setRows] = useState<SummaryRow[]>(() =>
    createInitialRows(initialEntry)
  );
  const [fuelStart, setFuelStart] = useState(
    initialSource?.fuelStart === null || initialSource?.fuelStart === undefined
      ? ""
      : formatNumber(initialSource.fuelStart)
  );
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

  const parsedFuelStart =
    fuelStart.trim() === "" ? null : parseFuel(fuelStart);
  const fuelStartError = fuelStart.trim() !== "" && parsedFuelStart === null;
  const fuelChainError =
    calculation !== null &&
    parsedFuelStart !== null &&
    calculation.fuelUsed > parsedFuelStart;
  const visibleCalculation =
    fuelStartError || fuelChainError ? null : calculation;
  const actualFuelEnd =
    visibleCalculation !== null && parsedFuelStart !== null
      ? parsedFuelStart - visibleCalculation.fuelUsed
      : null;

  const historySource = calculation
    ? {
        type: "summary" as const,
        fuelStart: parsedFuelStart,
        items: rowResults.map((result, index) => {
          const row = rows[index];
          const slot =
            row.mode === "slot"
              ? slots.find((item) => item?.savedAt === row.slotSavedAt)
              : null;

          return {
            title: slot?.title || `Прогрев ${index + 1}`,
            minutes: result?.minutes ?? 0,
            fuelUsed: result?.fuelUsed ?? 0,
          };
        }),
      }
    : null;

  function updateRow(id: number, patch: Partial<SummaryRow>) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function applyFirstRowFuelStart(rowId: number, savedAt: string) {
    if (rows[0]?.id !== rowId) return;

    const slot = slots.find((item) => item?.savedAt === savedAt);

    if (slot?.source?.type === "byTime") {
      setFuelStart(formatNumber(slot.source.fuelStart));
    }
  }

  function setMode(row: SummaryRow, mode: SummaryMode) {
    const slotSavedAt =
      mode === "slot" ? row.slotSavedAt || filledSlots[0]?.savedAt || "" : "";

    updateRow(row.id, {
      mode,
      slotSavedAt,
    });

    if (mode === "slot") {
      applyFirstRowFuelStart(row.id, slotSavedAt);
    }
  }

  function selectSlot(row: SummaryRow, savedAt: string) {
    updateRow(row.id, { slotSavedAt: savedAt });
    applyFirstRowFuelStart(row.id, savedAt);
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
    setFuelStart("");
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

        <label className="field summaryFuelStart">
          <span>Топливо в начале цепочки, кг (необязательно)</span>
          <input
            value={fuelStart}
            onChange={(event) => setFuelStart(event.target.value)}
            placeholder="411,000"
            inputMode="decimal"
          />
        </label>

        {fuelStartError && (
          <div className="errorBox">
            Введи начальное топливо от 0 до 9999,999 кг.
          </div>
        )}

        {fuelChainError && (
          <div className="errorBox">
            Общий расход не может превышать топливо в начале цепочки.
          </div>
        )}

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
                        selectSlot(row, event.target.value)
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
                        placeholder="0135"
                        inputMode="numeric"
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
            Очистить всё
          </button>
        </div>
      </div>

      <div className="resultCard">
        <p>
          Общее время:{" "}
          {visibleCalculation ? formatTime(visibleCalculation.minutes) : "—"}
        </p>
        <p>
          Общий расход:{" "}
          {visibleCalculation
            ? `${formatNumber(visibleCalculation.fuelUsed)} кг`
            : "—"}
        </p>
        <p>
          Средний расход в час:{" "}
          {visibleCalculation
            ? `${formatNumber(visibleCalculation.fuelPerHour)} кг/ч`
            : "—"}
        </p>

        {actualFuelEnd !== null && (
          <div className="actualFuelEnd">
            <span>Остаток по фактическому расходу</span>
            <b>{formatNumber(actualFuelEnd)} кг</b>
          </div>
        )}

        {visibleCalculation && (
          <NormComparison
            result={visibleCalculation}
            normFuelPerHour={settings.normFuelPerHour}
            fuelAtStart={parsedFuelStart}
          />
        )}

        <SaveResultPanel
          result={visibleCalculation}
          defaultTitle="Суммирование"
          source={visibleCalculation ? historySource : null}
        />
      </div>
    </section>
  );
}
