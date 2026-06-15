import { Pencil, Plus, Trash2, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChainCorrectionPanel } from "../components/ChainCorrectionPanel";
import { NormComparison } from "../components/NormComparison";
import { uiText } from "../content";
import type {
  DriverRoute,
  FuelChain,
  ThuOperation,
} from "../domain/documents";
import {
  analyzeChainLinks,
  calculateChainHotIdle,
  getChainDocumentStart,
  sortChainDocuments,
  type ChainDocument,
} from "../utils/chainAnalysis";
import {
  deleteDocument,
  getDocuments,
  saveDocument,
} from "../utils/documentStorage";
import { formatNumber, formatTime } from "../utils/format";
import { getSettings, subscribeSettingsChange } from "../utils/storage";

type ChainForm = {
  id: string | null;
  title: string;
  tankCapacity: string;
  selectedKeys: string[];
  createdAt: string | null;
};

function itemKey(item: ChainDocument): string {
  return `${item.type}:${item.document.id}`;
}

function itemTitle(item: ChainDocument): string {
  return item.type === "thu"
    ? `${uiText.chains.thu} № ${item.document.documentNumber} · ${
        uiText.thuLibrary.operationTypes[item.document.operationType]
      }`
    : `${uiText.chains.driverRoute} № ${item.document.routeNumber}${
        item.document.driverName ? ` · ${item.document.driverName}` : ""
      }`;
}

function itemPeriod(item: ChainDocument): string {
  const start = new Date(getChainDocumentStart(item));
  const end = new Date(
    item.type === "thu"
      ? item.document.operationEnd
      : item.document.routeEnd
  );
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(start)} → ${formatter.format(end)}`;
}

function itemLocomotives(item: ChainDocument): string {
  const locomotives = [
    ...new Set(
      item.document.sections.map(
        (section) =>
          `${section.series}-${section.locomotiveNumber}/${section.sectionNumber}`
      )
    ),
  ];

  return locomotives.join(" · ");
}

function parseCapacity(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toForm(chain: FuelChain): ChainForm {
  return {
    id: chain.id,
    title: chain.title,
    tankCapacity:
      chain.tankCapacity === null ? "" : formatNumber(chain.tankCapacity),
    selectedKeys: chain.itemIds.map((item) => `${item.type}:${item.id}`),
    createdAt: chain.createdAt,
  };
}

export function FuelChainLibraryScreen() {
  const [chains, setChains] = useState<FuelChain[]>([]);
  const [thuOperations, setThuOperations] = useState<ThuOperation[]>([]);
  const [driverRoutes, setDriverRoutes] = useState<DriverRoute[]>([]);
  const [form, setForm] = useState<ChainForm | null>(null);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [correctingChainId, setCorrectingChainId] = useState<string | null>(
    null
  );
  const [savedMessage, setSavedMessage] = useState("");
  const [settings, setSettings] = useState(() => getSettings());

  async function loadData() {
    try {
      const [storedChains, storedThu, storedRoutes] = await Promise.all([
        getDocuments("fuelChains"),
        getDocuments("thuOperations"),
        getDocuments("driverRoutes"),
      ]);
      setChains(
        storedChains.sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt)
        )
      );
      setThuOperations(storedThu);
      setDriverRoutes(storedRoutes);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    return subscribeSettingsChange(() => setSettings(getSettings()));
  }, []);

  const availableDocuments = useMemo<ChainDocument[]>(
    () =>
      sortChainDocuments([
        ...thuOperations.map(
          (document): ChainDocument => ({ type: "thu", document })
        ),
        ...driverRoutes.map(
          (document): ChainDocument => ({ type: "driverRoute", document })
        ),
      ]),
    [driverRoutes, thuOperations]
  );

  function resolveChainDocuments(chain: FuelChain): ChainDocument[] {
    return chain.itemIds
      .map((reference) => {
        if (reference.type === "thu") {
          const document = thuOperations.find(
            (item) => item.id === reference.id
          );
          return document
            ? ({ type: "thu", document } as ChainDocument)
            : null;
        }

        const document = driverRoutes.find(
          (item) => item.id === reference.id
        );
        return document
          ? ({ type: "driverRoute", document } as ChainDocument)
          : null;
      })
      .filter((item): item is ChainDocument => item !== null);
  }

  function selectedDocuments(): ChainDocument[] {
    if (!form) return [];
    return availableDocuments.filter((item) =>
      form.selectedKeys.includes(itemKey(item))
    );
  }

  async function handleSave() {
    if (!form) return;
    const selected = sortChainDocuments(selectedDocuments());

    if (!form.title.trim() || selected.length < 2) {
      setError(uiText.chains.selectAtLeastTwo);
      return;
    }

    const capacity = parseCapacity(form.tankCapacity);
    if (form.tankCapacity.trim() && capacity === null) {
      setError(uiText.chains.tankCapacityError);
      return;
    }

    const now = new Date().toISOString();
    const chain: FuelChain = {
      id: form.id ?? crypto.randomUUID(),
      title: form.title.trim(),
      itemIds: selected.map((item) => ({
        type: item.type,
        id: item.document.id,
      })),
      tankCapacity: capacity,
      corrections:
        chains.find((item) => item.id === form.id)?.corrections ?? [],
      createdAt: form.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await saveDocument("fuelChains", chain);
      setForm(null);
      setError("");
      await loadData();
    } catch {
      setStorageError(true);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDocument("fuelChains", id);
      if (form?.id === id) setForm(null);
      await loadData();
    } catch {
      setStorageError(true);
    }
  }

  async function saveCorrections(
    chain: FuelChain,
    corrections: FuelChain["corrections"]
  ) {
    try {
      await saveDocument("fuelChains", {
        ...chain,
        corrections,
        updatedAt: new Date().toISOString(),
      });
      setCorrectingChainId(null);
      setSavedMessage(uiText.chains.draftSaved);
      window.setTimeout(() => setSavedMessage(""), 1800);
      await loadData();
    } catch {
      setStorageError(true);
    }
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="libraryHeader">
          <div className="sectionTitle">
            <h2>{uiText.chains.title}</h2>
            <p>{uiText.chains.description}</p>
          </div>
          {!form && availableDocuments.length >= 2 && (
            <button
              className="primaryIconButton"
              type="button"
              onClick={() =>
                setForm({
                  id: null,
                  title: "",
                  tankCapacity: "",
                  selectedKeys: [],
                  createdAt: null,
                })
              }
            >
              <Plus size={19} />
              {uiText.chains.add}
            </button>
          )}
        </div>

        {storageError && (
          <div className="errorBox">{uiText.chains.storageError}</div>
        )}
        {savedMessage && <div className="successBox">{savedMessage}</div>}

        {!form && availableDocuments.length < 2 && !storageError && (
          <p className="emptyHistory">{uiText.chains.noDocuments}</p>
        )}

        {form && (
          <div className="documentForm">
            <div className="documentFormHeader">
              <h3>{form.id ? uiText.chains.edit : uiText.chains.add}</h3>
              <button
                className="iconButton"
                type="button"
                aria-label={uiText.chains.cancel}
                onClick={() => setForm(null)}
              >
                <X size={19} />
              </button>
            </div>

            <label className="field">
              <span>{uiText.chains.titleLabel}</span>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>{uiText.chains.tankCapacity}</span>
              <input
                value={form.tankCapacity}
                inputMode="decimal"
                onChange={(event) =>
                  setForm({ ...form, tankCapacity: event.target.value })
                }
              />
            </label>

            <div>
              <b>{uiText.chains.documents}</b>
              <div className="chainDocumentPicker">
                {availableDocuments.map((item) => {
                  const key = itemKey(item);
                  const checked = form.selectedKeys.includes(key);
                  return (
                    <label className="chainDocumentOption" key={key}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setForm({
                            ...form,
                            selectedKeys: checked
                              ? form.selectedKeys.filter(
                                  (itemKeyValue) => itemKeyValue !== key
                                )
                              : [...form.selectedKeys, key],
                          })
                        }
                      />
                      <span>
                        <b>{itemTitle(item)}</b>
                        <small className="chainDocumentLocomotives">
                          {itemLocomotives(item)}
                        </small>
                        <small>{itemPeriod(item)}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {error && <div className="errorBox">{error}</div>}

            <div className="documentFormActions">
              <button
                className="primaryButton"
                type="button"
                onClick={() => void handleSave()}
              >
                {uiText.chains.save}
              </button>
              <button
                className="secondaryButton compact"
                type="button"
                onClick={() => setForm(null)}
              >
                {uiText.chains.cancel}
              </button>
            </div>
          </div>
        )}

        {!form && chains.length === 0 && availableDocuments.length >= 2 && (
          <p className="emptyHistory">{uiText.chains.empty}</p>
        )}

        {!form && chains.length > 0 && (
          <div className="documentList">
            {chains.map((chain) => {
              const documents = resolveChainDocuments(chain);
              const links = analyzeChainLinks(documents);
              const hotIdle = calculateChainHotIdle(documents);
              const issueCount = links.reduce(
                (count, link) =>
                  count +
                  (link.timeStatus === "continuous" ? 0 : 1) +
                  link.fuelGaps.filter(
                    (gap) => gap.status !== "continuous"
                  ).length,
                0
              );

              return (
                <article className="documentCard chainCard" key={chain.id}>
                  <div className="documentCardHeader">
                    <div>
                      <b>{chain.title}</b>
                      <p>
                        {uiText.chains.documentsCount(documents.length)} ·{" "}
                        {uiText.chains.linksCount(links.length)}
                      </p>
                    </div>
                    <div className="documentCardActions">
                      <button
                        className={
                          correctingChainId === chain.id
                            ? "iconButton active"
                            : "iconButton"
                        }
                        type="button"
                        aria-label={uiText.chains.correct}
                        title={uiText.chains.correct}
                        onClick={() =>
                          setCorrectingChainId(
                            correctingChainId === chain.id ? null : chain.id
                          )
                        }
                      >
                        <Wrench size={17} />
                      </button>
                      <button
                        className="iconButton"
                        type="button"
                        aria-label={uiText.chains.editAction}
                        onClick={() => setForm(toForm(chain))}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="iconDangerButton"
                        type="button"
                        aria-label={uiText.chains.delete}
                        onClick={() => void handleDelete(chain.id)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>

                  {correctingChainId === chain.id ? (
                    <ChainCorrectionPanel
                      chain={chain}
                      documents={documents}
                      normFuelPerHour={settings.normFuelPerHour}
                      onCancel={() => setCorrectingChainId(null)}
                      onSave={(corrections) =>
                        saveCorrections(chain, corrections)
                      }
                    />
                  ) : (
                    <>
                  <div className="chainTimeline">
                    {documents.map((item, index) => (
                      <div className="chainTimelineItem" key={itemKey(item)}>
                        <span className="chainIndex">{index + 1}</span>
                        <span>
                          <b>{itemTitle(item)}</b>
                          <small>{itemPeriod(item)}</small>
                        </span>
                      </div>
                    ))}
                  </div>

                  {issueCount === 0 && (
                    <div className="successBox">
                      {uiText.chains.chainIsContinuous}
                    </div>
                  )}

                  <div className="chainLinks">
                    {links.map((link, index) => (
                      <div className="chainLinkCard" key={index}>
                        <b>
                          {index + 1} → {index + 2}
                        </b>
                        <span
                          className={`chainStatus ${link.timeStatus}`}
                        >
                          {link.timeStatus === "gap"
                            ? `${uiText.chains.timeGap}: ${formatTime(
                                link.timeDifferenceMinutes
                              )}`
                            : link.timeStatus === "overlap"
                              ? `${uiText.chains.timeOverlap}: ${formatTime(
                                  Math.abs(link.timeDifferenceMinutes)
                                )}`
                              : uiText.chains.timeContinuous}
                        </span>

                        {link.fuelGaps.map((gap) => (
                          <span
                            className={`chainStatus fuel ${gap.status}`}
                            key={gap.sectionKey}
                          >
                            <b>
                              {uiText.chains.sectionLabel(gap.sectionKey)}
                            </b>
                            {gap.status === "missing"
                              ? uiText.chains.sectionMissing
                              : gap.status === "continuous"
                                ? uiText.chains.fuelContinuous
                                : `${uiText.chains.fuelGap}: ${
                                    gap.difference! > 0 ? "+" : ""
                                  }${formatNumber(gap.difference!)} кг`}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>

                  {hotIdle && (
                    <div className="hotIdleResult compactResult">
                      <b>{uiText.chains.hotIdle}</b>
                      <span>{formatTime(hotIdle.minutes)}</span>
                      <span>{formatNumber(hotIdle.fuelUsed)} кг</span>
                      <span>{formatNumber(hotIdle.fuelPerHour)} кг/ч</span>
                      <NormComparison
                        result={hotIdle}
                        normFuelPerHour={settings.normFuelPerHour}
                      />
                    </div>
                  )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
