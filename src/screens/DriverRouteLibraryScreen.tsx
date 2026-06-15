import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { uiText } from "../content";
import type {
  DriverRoute,
  LocomotiveSection,
} from "../domain/documents";
import { parseFuel } from "../utils/calculations";
import { formatDateTime } from "../utils/dateTime";
import {
  durationMinutes,
  formatTimeOnly,
  resolveEndDateTime,
} from "../utils/documentTime";
import {
  deleteDocument,
  getDocuments,
  saveDocument,
} from "../utils/documentStorage";
import { calculateDriverRouteTaxation } from "../utils/driverRouteCalculations";
import { formatNumber } from "../utils/format";

type SectionForm = {
  id: string;
  series: string;
  locomotiveNumber: string;
  sectionNumber: string;
  fuelAtStart: string;
  fuelAtEnd: string;
};

type DriverRouteForm = {
  id: string | null;
  routeNumber: string;
  driverName: string;
  routeStart: string;
  routeEnd: string;
  sections: SectionForm[];
  isZeroRoute: boolean;
  normFuel: string;
  createdAt: string | null;
};

function createSection(): SectionForm {
  return {
    id: crypto.randomUUID(),
    series: "",
    locomotiveNumber: "",
    sectionNumber: "",
    fuelAtStart: "",
    fuelAtEnd: "",
  };
}

function createForm(): DriverRouteForm {
  return {
    id: null,
    routeNumber: "",
    driverName: "",
    routeStart: "",
    routeEnd: "",
    sections: [createSection()],
    isZeroRoute: false,
    normFuel: "",
    createdAt: null,
  };
}

function toForm(route: DriverRoute): DriverRouteForm {
  return {
    id: route.id,
    routeNumber: route.routeNumber,
    driverName: route.driverName,
    routeStart: route.routeStart,
    routeEnd:
      durationMinutes(route.routeStart, route.routeEnd) <= 24 * 60
        ? formatTimeOnly(route.routeEnd)
        : formatDateTime(new Date(route.routeEnd)),
    sections: route.sections.map((section) => ({
      id: section.id,
      series: section.series,
      locomotiveNumber: section.locomotiveNumber,
      sectionNumber: section.sectionNumber,
      fuelAtStart: formatNumber(section.fuelAtStart),
      fuelAtEnd: formatNumber(section.fuelAtEnd),
    })),
    isZeroRoute: route.isZeroRoute,
    normFuel: route.isZeroRoute ? "" : formatNumber(route.normFuel ?? 0),
    createdAt: route.createdAt,
  };
}

function formatRouteDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function parseNorm(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!/^\d{1,5}([.,]\d{1,3})?$/.test(value.trim())) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resultLabel(route: DriverRoute): string {
  if (route.creditedResult > 0) return uiText.mmLibrary.economy;
  if (route.creditedResult < 0) return uiText.mmLibrary.overrun;
  return uiText.mmLibrary.zero;
}

export function DriverRouteLibraryScreen() {
  const [routes, setRoutes] = useState<DriverRoute[]>([]);
  const [form, setForm] = useState<DriverRouteForm | null>(null);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);

  async function loadRoutes() {
    try {
      const stored = await getDocuments("driverRoutes");
      setRoutes(
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
      void loadRoutes();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function updateSection(index: number, patch: Partial<SectionForm>) {
    if (!form) return;
    setForm({
      ...form,
      sections: form.sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...patch } : section
      ),
    });
  }

  const sectionPreview = useMemo(() => {
    if (!form) return null;

    const sections = form.sections.map<number | null>((section) => {
      const fuelAtStart = parseFuel(section.fuelAtStart);
      const fuelAtEnd = parseFuel(section.fuelAtEnd);
      return fuelAtStart !== null &&
        fuelAtEnd !== null &&
        fuelAtEnd <= fuelAtStart
        ? fuelAtStart - fuelAtEnd
        : null;
    });

    return sections.every((value): value is number => value !== null)
      ? sections.reduce((sum, value) => sum + value, 0)
      : null;
  }, [form]);

  const taxationPreview =
    form && sectionPreview !== null
      ? calculateDriverRouteTaxation(
          form.isZeroRoute ? sectionPreview : (parseNorm(form.normFuel) ?? -1),
          sectionPreview,
          form.isZeroRoute
        )
      : null;

  function validateSections(): {
    sections: LocomotiveSection[] | null;
    error: string;
  } {
    if (!form) {
      return { sections: null, error: uiText.mmLibrary.requiredFields };
    }

    let validationError = "";
    const firstSection = form.sections[0];
    const sections = form.sections.map<LocomotiveSection | null>(
      (section, index) => {
      const series =
        section.series.trim() || (index > 0 ? firstSection.series.trim() : "");
      const locomotiveNumber =
        section.locomotiveNumber.trim() ||
        (index > 0 ? firstSection.locomotiveNumber.trim() : "");
      const fuelAtStart = parseFuel(section.fuelAtStart);
      const fuelAtEnd = parseFuel(section.fuelAtEnd);

      if (
        !series ||
        !locomotiveNumber ||
        !section.sectionNumber.trim() ||
        fuelAtStart === null ||
        fuelAtEnd === null
      ) {
        validationError = uiText.mmLibrary.requiredFields;
        return null;
      }

      if (fuelAtEnd > fuelAtStart) {
        validationError = uiText.mmLibrary.fuelDecrease;
        return null;
      }

      return {
        id: section.id,
        series,
        locomotiveNumber,
        sectionNumber: section.sectionNumber.trim(),
        fuelAtStart,
        fuelAtEnd,
        fuelAdded: null,
      };
      }
    );

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
      !form.routeNumber.trim() ||
      !form.routeStart ||
      !form.routeEnd
    ) {
      setError(uiText.mmLibrary.requiredFields);
      return;
    }

    const routeEndValue = resolveEndDateTime(
      form.routeStart,
      form.routeEnd
    );

    if (!routeEndValue) {
      setError(uiText.mmLibrary.invalidPeriod);
      return;
    }

    const sectionValidation = validateSections();
    if (!sectionValidation.sections) {
      setError(sectionValidation.error);
      return;
    }

    const actualFuel = sectionValidation.sections.reduce(
      (sum, section) => sum + section.fuelAtStart - section.fuelAtEnd,
      0
    );
    const normFuel = form.isZeroRoute ? actualFuel : parseNorm(form.normFuel);

    if (normFuel === null) {
      setError(uiText.mmLibrary.normError);
      return;
    }

    const taxation = calculateDriverRouteTaxation(
      normFuel,
      actualFuel,
      form.isZeroRoute
    );
    if (!taxation) {
      setError(uiText.mmLibrary.normError);
      return;
    }

    const now = new Date().toISOString();
    const route: DriverRoute = {
      id: form.id ?? crypto.randomUUID(),
      routeNumber: form.routeNumber.trim(),
      driverName: form.driverName.trim(),
      routeStart: form.routeStart,
      routeEnd: routeEndValue,
      sections: sectionValidation.sections,
      isZeroRoute: form.isZeroRoute,
      normFuel: taxation.normFuel,
      actualFuel: taxation.actualFuel,
      creditedResult: taxation.creditedResult,
      createdAt: form.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await saveDocument("driverRoutes", route);
      setForm(null);
      await loadRoutes();
    } catch {
      setStorageError(true);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDocument("driverRoutes", id);
      if (form?.id === id) setForm(null);
      await loadRoutes();
    } catch {
      setStorageError(true);
    }
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="libraryHeader">
          <div className="sectionTitle">
            <h2>{uiText.mmLibrary.title}</h2>
            <p>{uiText.mmLibrary.description}</p>
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
              {uiText.mmLibrary.add}
            </button>
          )}
        </div>

        {storageError && (
          <div className="errorBox">{uiText.mmLibrary.storageError}</div>
        )}

        {form && (
          <div className="documentForm">
            <div className="documentFormHeader">
              <h3>
                {form.id ? uiText.mmLibrary.edit : uiText.mmLibrary.add}
              </h3>
              <button
                className="iconButton"
                type="button"
                aria-label={uiText.mmLibrary.cancel}
                onClick={() => setForm(null)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="grid">
              <div className="twoColumnGrid">
                <label className="field">
                  <span>{uiText.mmLibrary.routeNumber}</span>
                  <input
                    value={form.routeNumber}
                    inputMode="numeric"
                    onChange={(event) =>
                      setForm({ ...form, routeNumber: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>{uiText.mmLibrary.driverName}</span>
                  <input
                    value={form.driverName}
                    onChange={(event) =>
                      setForm({ ...form, driverName: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className="twoColumnGrid">
                <label className="field">
                  <span>{uiText.mmLibrary.routeStart}</span>
                  <input
                    type="datetime-local"
                    value={form.routeStart}
                    onChange={(event) =>
                      setForm({ ...form, routeStart: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>{uiText.mmLibrary.routeEnd}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.routeEnd}
                    placeholder={uiText.mmLibrary.routeEndPlaceholder}
                    onChange={(event) =>
                      setForm({ ...form, routeEnd: event.target.value })
                    }
                  />
                </label>
              </div>

              <label className="toggleField">
                <input
                  type="checkbox"
                  checked={form.isZeroRoute}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      isZeroRoute: event.target.checked,
                      normFuel: event.target.checked ? "" : form.normFuel,
                    })
                  }
                />
                <span>
                  <b>{uiText.mmLibrary.zeroRoute}</b>
                  <small>{uiText.mmLibrary.zeroRouteHint}</small>
                </span>
              </label>

              {!form.isZeroRoute && (
                <label className="field">
                  <span>{uiText.mmLibrary.normFuel}</span>
                  <input
                    value={form.normFuel}
                    inputMode="decimal"
                    onChange={(event) =>
                      setForm({ ...form, normFuel: event.target.value })
                    }
                  />
                </label>
              )}
            </div>

            <div className="sectionForms">
              {form.sections.map((section, index) => (
                <div className="sectionFormCard" key={section.id}>
                  <div className="sectionFormHeader">
                    <b>{uiText.mmLibrary.section(index + 1)}</b>
                    {form.sections.length > 1 && (
                      <button
                        className="iconDangerButton"
                        type="button"
                        aria-label={uiText.mmLibrary.removeSection}
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
                      <span>{uiText.mmLibrary.series}</span>
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
                      <span>{uiText.mmLibrary.locomotiveNumber}</span>
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
                      <span>{uiText.mmLibrary.sectionNumber}</span>
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
                        {uiText.mmLibrary.inheritedLocomotive}
                      </p>
                    )}

                  <div className="twoColumnGrid">
                    <label className="field">
                      <span>{uiText.mmLibrary.fuelAtStart}</span>
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
                      <span>{uiText.mmLibrary.fuelAtEnd}</span>
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
                {uiText.mmLibrary.addSection}
              </button>
            )}

            {taxationPreview && (
              <div className="taxationPreview">
                <span>
                  {uiText.mmLibrary.actualFuel}:{" "}
                  <b>{formatNumber(taxationPreview.actualFuel)} кг</b>
                </span>
                <span>
                  {uiText.mmLibrary.normFuel}:{" "}
                  <b>{formatNumber(taxationPreview.normFuel)} кг</b>
                </span>
                <span
                  className={
                    taxationPreview.resultType === "economy"
                      ? "good"
                      : taxationPreview.resultType === "overrun"
                        ? "bad"
                        : "neutral"
                  }
                >
                  {taxationPreview.resultType === "economy"
                    ? uiText.mmLibrary.economy
                    : taxationPreview.resultType === "overrun"
                      ? uiText.mmLibrary.overrun
                      : uiText.mmLibrary.zero}
                  :{" "}
                  <b>
                    {formatNumber(
                      Math.abs(taxationPreview.creditedResult)
                    )}{" "}
                    кг
                  </b>
                </span>
              </div>
            )}

            {error && <div className="errorBox">{error}</div>}

            <div className="documentFormActions">
              <button
                className="primaryButton"
                type="button"
                onClick={() => void handleSave()}
              >
                {uiText.mmLibrary.save}
              </button>
              <button
                className="secondaryButton compact"
                type="button"
                onClick={() => setForm(null)}
              >
                {uiText.mmLibrary.cancel}
              </button>
            </div>
          </div>
        )}

        {!form && routes.length === 0 && !storageError && (
          <p className="emptyHistory">{uiText.mmLibrary.empty}</p>
        )}

        {!form && routes.length > 0 && (
          <div className="documentList">
            {routes.map((route) => (
              <article className="documentCard" key={route.id}>
                <div className="documentCardHeader">
                  <div>
                    <b>
                      ММ № {route.routeNumber} ·{" "}
                      {route.driverName || uiText.mmLibrary.withoutDriver}
                    </b>
                    <p>
                      {route.isZeroRoute
                        ? uiText.mmLibrary.zeroRoute
                        : resultLabel(route)}{" "}
                      · {uiText.mmLibrary.sectionsCount(route.sections.length)}
                    </p>
                  </div>
                  <div className="documentCardActions">
                    <button
                      className="iconButton"
                      type="button"
                      aria-label={uiText.mmLibrary.editAction}
                      onClick={() => {
                        setError("");
                        setForm(toForm(route));
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="iconDangerButton"
                      type="button"
                      aria-label={uiText.mmLibrary.delete}
                      onClick={() => void handleDelete(route.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <p className="documentPeriod">
                  {formatRouteDate(route.routeStart)} →{" "}
                  {formatRouteDate(route.routeEnd)}
                </p>

                <div className="routeTaxation">
                  <span>
                    {uiText.mmLibrary.normFuel}:{" "}
                    <b>{formatNumber(route.normFuel ?? 0)} кг</b>
                  </span>
                  <span>
                    {uiText.mmLibrary.actualFuel}:{" "}
                    <b>{formatNumber(route.actualFuel)} кг</b>
                  </span>
                  <span>
                    {resultLabel(route)}:{" "}
                    <b>{formatNumber(Math.abs(route.creditedResult))} кг</b>
                  </span>
                </div>

                <div className="documentSections">
                  {route.sections.map((section) => (
                    <span key={section.id}>
                      {section.series}-{section.locomotiveNumber}/
                      {section.sectionNumber}:{" "}
                      {formatNumber(section.fuelAtStart)} →{" "}
                      {formatNumber(section.fuelAtEnd)} кг
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
