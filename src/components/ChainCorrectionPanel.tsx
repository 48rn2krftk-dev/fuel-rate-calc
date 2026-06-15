import { RotateCcw, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { NormComparison } from "./NormComparison";
import { uiText } from "../content";
import type {
  FuelChain,
  FuelChainCorrection,
} from "../domain/documents";
import {
  analyzeChainLinks,
  calculateChainHotIdle,
  sectionKey,
  sortChainDocuments,
  type ChainDocument,
} from "../utils/chainAnalysis";
import {
  applyChainCorrections,
  buildChainCorrections,
  cloneChainDocuments,
  validateCorrectedChain,
} from "../utils/chainCorrections";
import { formatNumber, formatTime } from "../utils/format";
import { calculateDriverRouteTaxation } from "../utils/driverRouteCalculations";

type ChainCorrectionPanelProps = {
  chain: FuelChain;
  documents: ChainDocument[];
  normFuelPerHour: number | null;
  onCancel: () => void;
  onSave: (corrections: FuelChainCorrection[]) => Promise<void>;
};

function documentKey(item: ChainDocument): string {
  return `${item.type}:${item.document.id}`;
}

function documentTitle(item: ChainDocument): string {
  return item.type === "thu"
    ? `ТХУ-3 № ${item.document.documentNumber}`
    : `ММ № ${item.document.routeNumber}`;
}

function resultLabel(value: number): string {
  if (value > 0) return uiText.mmLibrary.economy;
  if (value < 0) return uiText.mmLibrary.overrun;
  return uiText.mmLibrary.zero;
}

function formatDateTimeInput(value: string): string {
  return value.slice(0, 16);
}

export function ChainCorrectionPanel({
  chain,
  documents,
  normFuelPerHour,
  onCancel,
  onSave,
}: ChainCorrectionPanelProps) {
  const originals = useMemo(
    () => sortChainDocuments(cloneChainDocuments(documents)),
    [documents]
  );
  const [corrected, setCorrected] = useState(() =>
    sortChainDocuments(applyChainCorrections(documents, chain.corrections))
  );
  const [error, setError] = useState("");

  const links = analyzeChainLinks(corrected);
  const hotIdleBefore = calculateChainHotIdle(originals);
  const hotIdleAfter = calculateChainHotIdle(corrected);
  const corrections = buildChainCorrections(originals, corrected);
  const instructionLines = useMemo(() => {
    const lines: string[] = [];

    for (const item of corrected) {
      const original = originals.find(
        (entry) => documentKey(entry) === documentKey(item)
      );
      if (!original) continue;
      const title = documentTitle(item);

      if (item.type === "thu" && original.type === "thu") {
        if (
          item.document.operationStart !==
            original.document.operationStart ||
          item.document.operationEnd !== original.document.operationEnd
        ) {
          lines.push(
            `${title}: время ${formatDateTimeInput(
              original.document.operationStart
            ).replace("T", " ")}–${formatDateTimeInput(
              original.document.operationEnd
            ).replace("T", " ")} → ${formatDateTimeInput(
              item.document.operationStart
            ).replace("T", " ")}–${formatDateTimeInput(
              item.document.operationEnd
            ).replace("T", " ")}`
          );
        }
      }

      for (const section of item.document.sections) {
        const sourceSection = original.document.sections.find(
          (entry) => sectionKey(entry) === sectionKey(section)
        );
        if (
          !sourceSection ||
          (sourceSection.fuelAtStart === section.fuelAtStart &&
            sourceSection.fuelAtEnd === section.fuelAtEnd)
        ) {
          continue;
        }

        lines.push(
          `${title}, ${uiText.chains.sectionLabel(
            sectionKey(section)
          )}: топливо ${formatNumber(
            sourceSection.fuelAtStart
          )}/${formatNumber(sourceSection.fuelAtEnd)} → ${formatNumber(
            section.fuelAtStart
          )}/${formatNumber(section.fuelAtEnd)} кг`
        );
      }
    }

    return lines;
  }, [corrected, originals]);

  function updateThuTime(
    key: string,
    field: "operationStart" | "operationEnd",
    value: string
  ) {
    setCorrected((items) =>
      items.map((item) =>
        documentKey(item) === key && item.type === "thu"
          ? {
              ...item,
              document: {
                ...item.document,
                [field]: value,
              },
            }
          : item
      )
    );
  }

  function updateFuel(
    key: string,
    targetSectionKey: string,
    field: "fuelAtStart" | "fuelAtEnd",
    value: number
  ) {
    if (!Number.isFinite(value)) return;

    setCorrected((items) =>
      items.map((item) => {
        if (documentKey(item) !== key) return item;

        const sections = item.document.sections.map((section) => {
          if (sectionKey(section) !== targetSectionKey) return section;

          if (
            item.type === "thu" &&
            item.document.operationType === "fueling" &&
            section.fuelAdded !== null
          ) {
            return field === "fuelAtStart"
              ? {
                  ...section,
                  fuelAtStart: value,
                  fuelAtEnd: value + section.fuelAdded,
                }
              : {
                  ...section,
                  fuelAtStart: value - section.fuelAdded,
                  fuelAtEnd: value,
                };
          }

          return { ...section, [field]: value };
        });

        if (item.type === "thu") {
          return {
            ...item,
            document: { ...item.document, sections },
          };
        }

        const actualFuel = sections.reduce(
          (sum, section) =>
            sum + section.fuelAtStart - section.fuelAtEnd,
          0
        );
        const taxation = calculateDriverRouteTaxation(
          item.document.normFuel ?? actualFuel,
          actualFuel,
          item.document.isZeroRoute
        );

        return {
          ...item,
          document: {
            ...item.document,
            sections,
            normFuel: taxation?.normFuel ?? item.document.normFuel,
            actualFuel,
            creditedResult:
              taxation?.creditedResult ?? item.document.creditedResult,
          },
        };
      })
    );
  }

  async function handleSave() {
    const validationError = validateCorrectedChain(
      corrected,
      chain.tankCapacity
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    await onSave(corrections);
  }

  return (
    <div className="correctionPanel">
      <div className="documentFormHeader">
        <div>
          <h3>{uiText.chains.correctionTitle}</h3>
          <p>{uiText.chains.correctionDescription}</p>
        </div>
        <button
          className="iconButton"
          type="button"
          aria-label={uiText.chains.cancel}
          onClick={onCancel}
        >
          <X size={19} />
        </button>
      </div>

      <div className="correctionDocuments">
        {corrected.map((item, itemIndex) => {
          const original = originals.find(
            (entry) => documentKey(entry) === documentKey(item)
          )!;

          return (
            <div className="correctionDocument" key={documentKey(item)}>
              <div className="correctionDocumentTitle">
                <span className="chainIndex">{itemIndex + 1}</span>
                <b>{documentTitle(item)}</b>
              </div>

              {item.type === "thu" ? (
                <div className="twoColumnGrid">
                  <label className="field">
                    <span>{uiText.chains.operationStartAfter}</span>
                    <input
                      type="datetime-local"
                      value={formatDateTimeInput(
                        item.document.operationStart
                      )}
                      onChange={(event) =>
                        updateThuTime(
                          documentKey(item),
                          "operationStart",
                          event.target.value
                        )
                      }
                    />
                    <small>
                      {uiText.chains.before}:{" "}
                      {formatDateTimeInput(
                        original.type === "thu"
                          ? original.document.operationStart
                          : ""
                      ).replace("T", " ")}
                    </small>
                  </label>
                  <label className="field">
                    <span>{uiText.chains.operationEndAfter}</span>
                    <input
                      type="datetime-local"
                      value={formatDateTimeInput(item.document.operationEnd)}
                      onChange={(event) =>
                        updateThuTime(
                          documentKey(item),
                          "operationEnd",
                          event.target.value
                        )
                      }
                    />
                    <small>
                      {uiText.chains.before}:{" "}
                      {formatDateTimeInput(
                        original.type === "thu"
                          ? original.document.operationEnd
                          : ""
                      ).replace("T", " ")}
                    </small>
                  </label>
                </div>
              ) : (
                <p className="lockedTimeHint">
                  {uiText.chains.routeTimeLocked}
                </p>
              )}

              <div className="correctionSections">
                {item.document.sections.map((section) => {
                  const originalSection = original.document.sections.find(
                    (entry) => sectionKey(entry) === sectionKey(section)
                  )!;

                  return (
                    <div
                      className="correctionSection"
                      key={sectionKey(section)}
                    >
                      <b>
                        {uiText.chains.sectionLabel(sectionKey(section))}
                      </b>
                      <div className="twoColumnGrid">
                        <label className="field">
                          <span>{uiText.chains.fuelStartAfter}</span>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={section.fuelAtStart}
                            onChange={(event) =>
                              updateFuel(
                                documentKey(item),
                                sectionKey(section),
                                "fuelAtStart",
                                event.target.valueAsNumber
                              )
                            }
                          />
                          <small>
                            {uiText.chains.before}:{" "}
                            {formatNumber(originalSection.fuelAtStart)} кг
                          </small>
                        </label>
                        <label className="field">
                          <span>{uiText.chains.fuelEndAfter}</span>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={section.fuelAtEnd}
                            onChange={(event) =>
                              updateFuel(
                                documentKey(item),
                                sectionKey(section),
                                "fuelAtEnd",
                                event.target.valueAsNumber
                              )
                            }
                          />
                          <small>
                            {uiText.chains.before}:{" "}
                            {formatNumber(originalSection.fuelAtEnd)} кг
                          </small>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {item.type === "driverRoute" && (
                <div className="routeCorrectionResult">
                  <span>
                    {uiText.chains.before}:{" "}
                    {resultLabel(
                      original.type === "driverRoute"
                        ? original.document.creditedResult
                        : 0
                    )}{" "}
                    {formatNumber(
                      Math.abs(
                        original.type === "driverRoute"
                          ? original.document.creditedResult
                          : 0
                      )
                    )}{" "}
                    кг
                  </span>
                  <span>
                    {uiText.chains.after}:{" "}
                    <b>
                      {resultLabel(item.document.creditedResult)}{" "}
                      {formatNumber(
                        Math.abs(item.document.creditedResult)
                      )}{" "}
                      кг
                    </b>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="correctionAnalysis">
        <h3>{uiText.chains.afterCorrection}</h3>
        {links.map((link, index) => (
          <div className="chainLinkCard" key={index}>
            <b>
              {index + 1} → {index + 2}
            </b>
            <span className={`chainStatus ${link.timeStatus}`}>
              {link.timeStatus === "continuous"
                ? uiText.chains.timeContinuous
                : link.timeStatus === "gap"
                  ? `${uiText.chains.timeGap}: ${formatTime(
                      link.timeDifferenceMinutes
                    )}`
                  : `${uiText.chains.timeOverlap}: ${formatTime(
                      Math.abs(link.timeDifferenceMinutes)
                    )}`}
            </span>
            {link.fuelGaps.map((gap) => (
              <span
                className={`chainStatus fuel ${gap.status}`}
                key={gap.sectionKey}
              >
                <b>{uiText.chains.sectionLabel(gap.sectionKey)}</b>
                {gap.status === "continuous"
                  ? uiText.chains.fuelContinuous
                  : gap.status === "missing"
                    ? uiText.chains.sectionMissing
                    : `${uiText.chains.fuelGap}: ${
                        gap.difference! > 0 ? "+" : ""
                      }${formatNumber(gap.difference!)} кг`}
              </span>
            ))}
          </div>
        ))}
      </div>

      {(hotIdleBefore || hotIdleAfter) && (
        <div className="hotIdleComparison">
          <h3>{uiText.chains.hotIdle}</h3>
          {hotIdleBefore && (
            <span>
              {uiText.chains.before}: {formatTime(hotIdleBefore.minutes)} ·{" "}
              {formatNumber(hotIdleBefore.fuelPerHour)} кг/ч
            </span>
          )}
          {hotIdleAfter && (
            <>
              <span>
                {uiText.chains.after}: {formatTime(hotIdleAfter.minutes)} ·{" "}
                {formatNumber(hotIdleAfter.fuelPerHour)} кг/ч
              </span>
              <NormComparison
                result={hotIdleAfter}
                normFuelPerHour={normFuelPerHour}
              />
            </>
          )}
        </div>
      )}

      <div className="paperInstructions">
        <h3>{uiText.chains.paperInstructions}</h3>
        {instructionLines.length === 0 ? (
          <p>{uiText.chains.noCorrections}</p>
        ) : (
          <ol>
            {instructionLines.map((line) => (
              <li key={line}>
                {line}
              </li>
            ))}
          </ol>
        )}
      </div>

      {error && <div className="errorBox">{error}</div>}

      <div className="documentFormActions">
        <button
          className="primaryButton inlineButton"
          type="button"
          onClick={() => void handleSave()}
        >
          <Save size={18} />
          {uiText.chains.saveDraft}
        </button>
        <button
          className="secondaryButton compact inlineButton"
          type="button"
          onClick={() =>
            setCorrected(sortChainDocuments(cloneChainDocuments(originals)))
          }
        >
          <RotateCcw size={18} />
          {uiText.chains.resetDraft}
        </button>
      </div>
    </div>
  );
}
