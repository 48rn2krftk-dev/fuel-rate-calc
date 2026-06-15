import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NormComparison } from "../components/NormComparison";
import { uiText } from "../content";
import type {
  LocomotiveSection,
  ThuOperation,
  ThuOperationType,
} from "../domain/documents";
import { calculateManual, parseFuel } from "../utils/calculations";
import {
  durationMinutes,
  formatTimeOnly,
  resolveEndDateTime,
  resolveTimeInsidePeriod,
} from "../utils/documentTime";
import {
  deleteDocument,
  getDocuments,
  saveDocument,
} from "../utils/documentStorage";
import { formatNumber, formatTime } from "../utils/format";
import { getSettings, subscribeSettingsChange } from "../utils/storage";

type SectionForm = {
  id: string;
  series: string;
  locomotiveNumber: string;
  sectionNumber: string;
  fuelAtStart: string;
  fuelAtEnd: string;
  fuelAdded: string;
};

type ThuForm = {
  id: string | null;
  documentNumber: string;
  shiftStart: string;
  shiftEnd: string;
  operationType: ThuOperationType;
  operationStart: string;
  operationEnd: string;
  sections: SectionForm[];
  createdAt: string | null;
};

const operationTypes: ThuOperationType[] = [
  "idle",
  "fueling",
];

function createSection(): SectionForm {
  return {
    id: crypto.randomUUID(),
    series: "",
    locomotiveNumber: "",
    sectionNumber: "",
    fuelAtStart: "",
    fuelAtEnd: "",
    fuelAdded: "",
  };
}

function createForm(): ThuForm {
  return {
    id: null,
    documentNumber: "",
    shiftStart: "",
    shiftEnd: "",
    operationType: "idle",
    operationStart: "",
    operationEnd: "",
    sections: [createSection()],
    createdAt: null,
  };
}

function toForm(operation: ThuOperation): ThuForm {
  return {
    id: operation.id,
    documentNumber: operation.documentNumber,
    shiftStart: operation.shiftStart,
    shiftEnd: formatTimeOnly(operation.shiftEnd),
    operationType:
      operation.operationType === "fueling" ? "fueling" : "idle",
    operationStart: formatTimeOnly(operation.operationStart),
    operationEnd: formatTimeOnly(operation.operationEnd),
    sections: operation.sections.map((section) => ({
      id: section.id,
      series: section.series,
      locomotiveNumber: section.locomotiveNumber,
      sectionNumber: section.sectionNumber,
      fuelAtStart: formatNumber(section.fuelAtStart),
      fuelAtEnd: formatNumber(section.fuelAtEnd),
      fuelAdded:
        section.fuelAdded === null ? "" : formatNumber(section.fuelAdded),
    })),
    createdAt: operation.createdAt,
  };
}

function formatOperationDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getHotIdleCalculation(operation: ThuOperation) {
  if (operation.operationType === "fueling") return null;

  const minutes = durationMinutes(
    operation.operationStart,
    operation.operationEnd
  );
  const fuelUsed = operation.sections.reduce(
    (sum, section) => sum + section.fuelAtStart - section.fuelAtEnd,
    0
  );

  return calculateManual(minutes, fuelUsed);
}

export function ThuLibraryScreen() {
  const [operations, setOperations] = useState<ThuOperation[]>([]);
  const [form, setForm] = useState<ThuForm | null>(null);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [settings, setSettings] = useState(() => getSettings());

  async function loadOperations() {
    try {
      const stored = await getDocuments("thuOperations");
      setOperations(
        stored.sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt)
        )
      );
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOperations();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    return subscribeSettingsChange(() => setSettings(getSettings()));
  }, []);

  const formCalculation = useMemo(() => {
    if (!form || form.operationType === "fueling") return null;

    const operationStart = resolveTimeInsidePeriod(
      form.shiftStart,
      form.operationStart
    );
    const operationEnd = operationStart
      ? resolveTimeInsidePeriod(
          form.shiftStart,
          form.operationEnd,
          operationStart
        )
      : null;
    if (!operationStart || !operationEnd) return null;

    const fuelValues = form.sections.map((section) => {
      const start = parseFuel(section.fuelAtStart);
      const end = parseFuel(section.fuelAtEnd);
      return start !== null && end !== null && end <= start
        ? start - end
        : null;
    });
    if (!fuelValues.every((value): value is number => value !== null)) {
      return null;
    }

    return calculateManual(
      durationMinutes(operationStart, operationEnd),
      fuelValues.reduce((sum, value) => sum + value, 0)
    );
  }, [form]);

  function updateSection(index: number, patch: Partial<SectionForm>) {
    if (!form) return;
    const sections = form.sections.map((section, sectionIndex) =>
      sectionIndex === index ? { ...section, ...patch } : section
    );
    setForm({ ...form, sections });
  }

  function validateSections(): {
    sections: LocomotiveSection[] | null;
    error: string;
  } {
    if (!form) {
      return { sections: null, error: uiText.thuLibrary.requiredFields };
    }

    let validationError = "";

    const firstSection = form.sections[0];
    const sections = form.sections.map((section, index) => {
      const series =
        section.series.trim() || (index > 0 ? firstSection.series.trim() : "");
      const locomotiveNumber =
        section.locomotiveNumber.trim() ||
        (index > 0 ? firstSection.locomotiveNumber.trim() : "");
      const fuelAtStart = parseFuel(section.fuelAtStart);
      const fuelAtEnd = parseFuel(section.fuelAtEnd);
      const fuelAdded =
        form.operationType === "fueling"
          ? parseFuel(section.fuelAdded)
          : null;

      if (
        !series ||
        !locomotiveNumber ||
        !section.sectionNumber.trim() ||
        fuelAtStart === null ||
        fuelAtEnd === null ||
        (form.operationType === "fueling" && fuelAdded === null)
      ) {
        validationError = uiText.thuLibrary.requiredFields;
        return null;
      }

      if (form.operationType !== "fueling" && fuelAtEnd > fuelAtStart) {
        validationError = uiText.thuLibrary.fuelDecrease;
        return null;
      }

      if (
        form.operationType === "fueling" &&
        fuelAdded !== null &&
        Math.abs(fuelAtEnd - fuelAtStart - fuelAdded) > 0.001
      ) {
        validationError = uiText.thuLibrary.fuelingMismatch;
        return null;
      }

      return {
        id: section.id,
        series,
        locomotiveNumber,
        sectionNumber: section.sectionNumber.trim(),
        fuelAtStart,
        fuelAtEnd,
        fuelAdded,
      };
    });

    const validSections = sections.every(
      (section): section is LocomotiveSection => section !== null
    )
      ? sections
      : null;

    return {
      sections: validSections,
      error: validSections ? "" : validationError,
    };
  }

  async function handleSave() {
    if (!form) return;
    setError("");

    if (
      !form.documentNumber.trim() ||
      !form.shiftStart ||
      !form.shiftEnd ||
      !form.operationStart ||
      !form.operationEnd
    ) {
      setError(uiText.thuLibrary.requiredFields);
      return;
    }

    const shiftEndValue = resolveEndDateTime(form.shiftStart, form.shiftEnd);
    const operationStartValue = resolveTimeInsidePeriod(
      form.shiftStart,
      form.operationStart
    );
    const operationEndValue = operationStartValue
      ? resolveTimeInsidePeriod(
          form.shiftStart,
          form.operationEnd,
          operationStartValue
        )
      : null;

    if (
      !shiftEndValue ||
      !operationStartValue ||
      !operationEndValue ||
      durationMinutes(operationStartValue, operationEndValue) <= 0 ||
      new Date(operationStartValue).getTime() <
        new Date(form.shiftStart).getTime() ||
      new Date(operationEndValue).getTime() >
        new Date(shiftEndValue).getTime()
    ) {
      setError(uiText.thuLibrary.invalidPeriod);
      return;
    }

    if (durationMinutes(form.shiftStart, shiftEndValue) > 12 * 60) {
      setError(uiText.thuLibrary.shiftTooLong);
      return;
    }

    const sectionValidation = validateSections();
    const sections = sectionValidation.sections;
    if (!sections) {
      setError(sectionValidation.error || uiText.thuLibrary.requiredFields);
      return;
    }

    const now = new Date().toISOString();
    const operation: ThuOperation = {
      id: form.id ?? crypto.randomUUID(),
      documentNumber: form.documentNumber.trim(),
      shiftStart: form.shiftStart,
      shiftEnd: shiftEndValue,
      operationType: form.operationType,
      operationStart: operationStartValue,
      operationEnd: operationEndValue,
      sections,
      createdAt: form.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await saveDocument("thuOperations", operation);
      setForm(null);
      await loadOperations();
    } catch {
      setStorageError(true);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDocument("thuOperations", id);
      if (form?.id === id) setForm(null);
      await loadOperations();
    } catch {
      setStorageError(true);
    }
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="libraryHeader">
          <div className="sectionTitle">
            <h2>{uiText.thuLibrary.title}</h2>
            <p>{uiText.thuLibrary.description}</p>
          </div>

          {!form && (
            <button
              className="primaryIconButton"
              type="button"
              onClick={() => {
                setError("");
                setForm(createForm());
              }}
            >
              <Plus size={19} />
              {uiText.thuLibrary.add}
            </button>
          )}
        </div>

        {storageError && (
          <div className="errorBox">{uiText.thuLibrary.storageError}</div>
        )}

        {form && (
          <div className="documentForm">
            <div className="documentFormHeader">
              <h3>
                {form.id
                  ? uiText.thuLibrary.edit
                  : uiText.thuLibrary.add}
              </h3>
              <button
                className="iconButton"
                type="button"
                aria-label={uiText.thuLibrary.cancel}
                onClick={() => setForm(null)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="grid">
              <label className="field">
                <span>{uiText.thuLibrary.documentNumber}</span>
                <input
                  value={form.documentNumber}
                  onChange={(event) =>
                    setForm({ ...form, documentNumber: event.target.value })
                  }
                  inputMode="numeric"
                />
              </label>

              <div className="twoColumnGrid">
                <label className="field">
                  <span>{uiText.thuLibrary.shiftStart}</span>
                  <input
                    type="datetime-local"
                    value={form.shiftStart}
                    onChange={(event) =>
                      setForm({ ...form, shiftStart: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>{uiText.thuLibrary.shiftEnd}</span>
                  <input
                    type="time"
                    value={form.shiftEnd}
                    onChange={(event) =>
                      setForm({ ...form, shiftEnd: event.target.value })
                    }
                  />
                </label>
              </div>

              <label className="field">
                <span>{uiText.thuLibrary.operationType}</span>
                <select
                  className="selectInput"
                  value={form.operationType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      operationType: event.target.value as ThuOperationType,
                    })
                  }
                >
                  {operationTypes.map((type) => (
                    <option value={type} key={type}>
                      {uiText.thuLibrary.operationTypes[type]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="twoColumnGrid">
                <label className="field">
                  <span>{uiText.thuLibrary.operationStart}</span>
                  <input
                    type="time"
                    value={form.operationStart}
                    onChange={(event) =>
                      setForm({ ...form, operationStart: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>{uiText.thuLibrary.operationEnd}</span>
                  <input
                    type="time"
                    value={form.operationEnd}
                    onChange={(event) =>
                      setForm({ ...form, operationEnd: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>

            <div className="sectionForms">
              {form.sections.map((section, index) => (
                <div className="sectionFormCard" key={section.id}>
                  <div className="sectionFormHeader">
                    <b>{uiText.thuLibrary.section(index + 1)}</b>
                    {form.sections.length > 1 && (
                      <button
                        className="iconDangerButton"
                        type="button"
                        aria-label={uiText.thuLibrary.removeSection}
                        onClick={() =>
                          setForm({
                            ...form,
                            sections: form.sections.filter(
                              (item) => item.id !== section.id
                            ),
                          })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>

                  <div className="threeColumnGrid">
                    <label className="field">
                      <span>{uiText.thuLibrary.series}</span>
                      <input
                        value={section.series}
                        placeholder={
                          index > 0 ? form.sections[0].series : undefined
                        }
                        onChange={(event) =>
                          updateSection(index, { series: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{uiText.thuLibrary.locomotiveNumber}</span>
                      <input
                        value={section.locomotiveNumber}
                        placeholder={
                          index > 0
                            ? form.sections[0].locomotiveNumber
                            : undefined
                        }
                        inputMode="numeric"
                        onChange={(event) =>
                          updateSection(index, {
                            locomotiveNumber: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{uiText.thuLibrary.sectionNumber}</span>
                      <input
                        value={section.sectionNumber}
                        inputMode="numeric"
                        onChange={(event) =>
                          updateSection(index, {
                            sectionNumber: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>

                  {index > 0 &&
                    (!section.series || !section.locomotiveNumber) && (
                      <p className="inheritanceHint">
                        {uiText.thuLibrary.inheritedLocomotive}
                      </p>
                    )}

                  <div className="twoColumnGrid">
                    <label className="field">
                      <span>{uiText.thuLibrary.fuelAtStart}</span>
                      <input
                        value={section.fuelAtStart}
                        inputMode="decimal"
                        onChange={(event) =>
                          updateSection(index, {
                            fuelAtStart: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{uiText.thuLibrary.fuelAtEnd}</span>
                      <input
                        value={section.fuelAtEnd}
                        inputMode="decimal"
                        onChange={(event) =>
                          updateSection(index, {
                            fuelAtEnd: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>

                  {form.operationType === "fueling" && (
                    <label className="field">
                      <span>{uiText.thuLibrary.fuelAdded}</span>
                      <input
                        value={section.fuelAdded}
                        inputMode="decimal"
                        onChange={(event) =>
                          updateSection(index, {
                            fuelAdded: event.target.value,
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>

            {form.sections.length < 3 && (
              <button
                className="secondaryButton"
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    sections: [...form.sections, createSection()],
                  })
                }
              >
                <Plus size={18} />
                {uiText.thuLibrary.addSection}
              </button>
            )}

            {formCalculation && (
              <div className="hotIdleResult">
                <b>{uiText.thuLibrary.hotIdle}</b>
                <span>{formatTime(formCalculation.minutes)}</span>
                <span>{formatNumber(formCalculation.fuelUsed)} кг</span>
                <span>{formatNumber(formCalculation.fuelPerHour)} кг/ч</span>
                <NormComparison
                  result={formCalculation}
                  normFuelPerHour={settings.normFuelPerHour}
                />
              </div>
            )}

            {error && <div className="errorBox">{error}</div>}

            <div className="documentFormActions">
              <button
                className="primaryButton"
                type="button"
                onClick={() => void handleSave()}
              >
                {uiText.thuLibrary.save}
              </button>
              <button
                className="secondaryButton compact"
                type="button"
                onClick={() => setForm(null)}
              >
                {uiText.thuLibrary.cancel}
              </button>
            </div>
          </div>
        )}

        {!form && operations.length === 0 && !storageError && (
          <p className="emptyHistory">{uiText.thuLibrary.empty}</p>
        )}

        {!form && operations.length > 0 && (
          <div className="documentList">
            {operations.map((operation) => (
              <article className="documentCard" key={operation.id}>
                <div className="documentCardHeader">
                  <div>
                    <b>ТХУ-3 № {operation.documentNumber}</b>
                    <p>
                      {uiText.thuLibrary.operationTypes[
                        operation.operationType
                      ]}{" "}
                      · {uiText.thuLibrary.sectionsCount(
                        operation.sections.length
                      )}
                    </p>
                  </div>
                  <div className="documentCardActions">
                    <button
                      className="iconButton"
                      type="button"
                      aria-label={uiText.thuLibrary.editAction}
                      onClick={() => {
                        setError("");
                        setForm(toForm(operation));
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="iconDangerButton"
                      type="button"
                      aria-label={uiText.thuLibrary.delete}
                      onClick={() => void handleDelete(operation.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                <p className="documentPeriod">
                  {formatOperationDate(operation.operationStart)} →{" "}
                  {formatOperationDate(operation.operationEnd)}
                </p>
                <div className="documentSections">
                  {operation.sections.map((section) => (
                    <span key={section.id}>
                      {section.series}-{section.locomotiveNumber}/
                      {section.sectionNumber}:{" "}
                      {formatNumber(section.fuelAtStart)} →{" "}
                      {formatNumber(section.fuelAtEnd)} кг
                    </span>
                  ))}
                </div>
                {getHotIdleCalculation(operation) &&
                  (() => {
                    const calculation = getHotIdleCalculation(operation)!;
                    return (
                      <div className="hotIdleResult compactResult">
                        <b>{uiText.thuLibrary.hotIdle}</b>
                        <span>{formatTime(calculation.minutes)}</span>
                        <span>{formatNumber(calculation.fuelUsed)} кг</span>
                        <span>{formatNumber(calculation.fuelPerHour)} кг/ч</span>
                        <NormComparison
                          result={calculation}
                          normFuelPerHour={settings.normFuelPerHour}
                        />
                      </div>
                    );
                  })()}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
