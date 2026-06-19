import type {
  FuelChainCorrection,
  LocomotiveSection,
} from "../domain/documents";
import {
  analyzeChainLinks,
  calculateChainHotIdle,
  getChainDocumentEnd,
  getChainDocumentStart,
  getChainDocumentSections,
  sectionKey,
  sortChainDocuments,
  type ChainDocument,
} from "./chainAnalysis.ts";
import { durationMinutes } from "./documentTime.ts";
import { calculateDriverRouteTaxation } from "./driverRouteCalculations.ts";

function cloneSections(sections: LocomotiveSection[]): LocomotiveSection[] {
  return sections.map((section) => ({ ...section }));
}

export function cloneChainDocuments(
  items: ChainDocument[]
): ChainDocument[] {
  return items.map((item) =>
    item.type === "thu"
      ? {
          type: "thu",
          document: {
            ...item.document,
            sections: cloneSections(item.document.sections),
          },
        }
      : {
          type: "driverRoute",
          document: {
            ...item.document,
            sections: cloneSections(item.document.sections),
          },
        }
  );
}

export function applyChainCorrections(
  items: ChainDocument[],
  corrections: FuelChainCorrection[] = []
): ChainDocument[] {
  const corrected = cloneChainDocuments(items);

  for (const item of corrected) {
    const correction = corrections.find(
      (entry) =>
        entry.type === item.type && entry.documentId === item.document.id
    );
    if (!correction) continue;

    if (item.type === "thu") {
      item.document.operationStart =
        correction.operationStart ?? item.document.operationStart;
      item.document.operationEnd =
        correction.operationEnd ?? item.document.operationEnd;
    }

    item.document.sections = item.document.sections.map((section) => {
      const sectionCorrection = correction.sections.find(
        (entry) => entry.sectionKey === sectionKey(section)
      );
      return sectionCorrection
        ? {
            ...section,
            fuelAtStart: sectionCorrection.fuelAtStart,
            fuelAtEnd: sectionCorrection.fuelAtEnd,
          }
        : section;
    });

    if (item.type === "driverRoute") {
      const actualFuel = item.document.sections.reduce(
        (sum, section) => sum + section.fuelAtStart - section.fuelAtEnd,
        0
      );
      const taxation = calculateDriverRouteTaxation(
        item.document.normFuel ?? actualFuel,
        actualFuel,
        item.document.isZeroRoute
      );
      if (taxation) {
        item.document.normFuel = taxation.normFuel;
        item.document.actualFuel = taxation.actualFuel;
        item.document.creditedResult = taxation.creditedResult;
      }
    }
  }

  return corrected;
}

export type ChainCorrectionScenarioId =
  | "close-gaps"
  | "protect-routes"
  | "balanced";

export type ChainCorrectionScenario = {
  id: ChainCorrectionScenarioId;
  documents: ChainDocument[];
  corrections: FuelChainCorrection[];
  changedCount: number;
  validationError: string | null;
};

function documentKey(item: ChainDocument): string {
  return `${item.type}:${item.document.id}`;
}

function recalculateDriverRoute(item: ChainDocument): ChainDocument {
  if (item.type !== "driverRoute") return item;

  const actualFuel = item.document.sections.reduce(
    (sum, section) => sum + section.fuelAtStart - section.fuelAtEnd,
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
      normFuel: taxation?.normFuel ?? item.document.normFuel,
      actualFuel,
      creditedResult: taxation?.creditedResult ?? item.document.creditedResult,
    },
  };
}

function updateFuelBoundary(
  item: ChainDocument,
  targetSectionKey: string,
  field: "fuelAtStart" | "fuelAtEnd",
  value: number
): ChainDocument {
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

  const updated =
    item.type === "thu"
      ? {
          ...item,
          document: { ...item.document, sections },
        }
      : {
          ...item,
          document: { ...item.document, sections },
        };

  return recalculateDriverRoute(updated);
}

function replaceDocument(
  items: ChainDocument[],
  updated: ChainDocument
): ChainDocument[] {
  return items.map((item) =>
    documentKey(item) === documentKey(updated) ? updated : item
  );
}

function findDocument(
  items: ChainDocument[],
  target: ChainDocument
): ChainDocument | null {
  return items.find((item) => documentKey(item) === documentKey(target)) ?? null;
}

function canSetThuTime(
  item: ChainDocument,
  field: "operationStart" | "operationEnd",
  value: string
): boolean {
  if (item.type !== "thu") return false;

  const start =
    field === "operationStart" ? value : item.document.operationStart;
  const end = field === "operationEnd" ? value : item.document.operationEnd;

  return (
    durationMinutes(start, end) > 0 &&
    new Date(start).getTime() >= new Date(item.document.shiftStart).getTime() &&
    new Date(end).getTime() <= new Date(item.document.shiftEnd).getTime()
  );
}

function setThuTime(
  item: ChainDocument,
  field: "operationStart" | "operationEnd",
  value: string
): ChainDocument {
  if (item.type !== "thu") return item;
  return {
    ...item,
    document: {
      ...item.document,
      [field]: value,
    },
  };
}

function closeTimeGap(
  items: ChainDocument[],
  previousSource: ChainDocument,
  nextSource: ChainDocument,
  preferRouteProtection: boolean
): ChainDocument[] {
  const previous = findDocument(items, previousSource);
  const next = findDocument(items, nextSource);
  if (!previous || !next) return items;

  const previousEnd = getChainDocumentEnd(previous);
  const nextStart = getChainDocumentStart(next);

  const previousCandidate =
    previous.type === "thu" &&
    canSetThuTime(previous, "operationEnd", nextStart);
  const nextCandidate =
    next.type === "thu" && canSetThuTime(next, "operationStart", previousEnd);

  if (
    previousCandidate &&
    (!preferRouteProtection || next.type === "driverRoute" || !nextCandidate)
  ) {
    return replaceDocument(
      items,
      setThuTime(previous, "operationEnd", nextStart)
    );
  }

  if (nextCandidate) {
    return replaceDocument(items, setThuTime(next, "operationStart", previousEnd));
  }

  return items;
}

function applyScenarioStrategy(
  sourceItems: ChainDocument[],
  strategy: ChainCorrectionScenarioId
): ChainDocument[] {
  let items = sortChainDocuments(cloneChainDocuments(sourceItems));

  for (const link of analyzeChainLinks(items)) {
    if (link.timeStatus === "gap") {
      items = closeTimeGap(
        items,
        link.previous,
        link.next,
        strategy === "protect-routes"
      );
    }

    for (const gap of link.fuelGaps) {
      if (
        gap.status !== "gap" ||
        gap.previousFuel === null ||
        gap.nextFuel === null
      ) {
        continue;
      }

      const previous = findDocument(items, link.previous);
      const next = findDocument(items, link.next);
      if (!previous || !next) continue;

      if (strategy === "close-gaps") {
        const changePrevious = replaceDocument(
          items,
          updateFuelBoundary(
            previous,
            gap.sectionKey,
            "fuelAtEnd",
            gap.nextFuel
          )
        );
        const changeNext = replaceDocument(
          items,
          updateFuelBoundary(next, gap.sectionKey, "fuelAtStart", gap.previousFuel)
        );
        const previousHotIdle =
          calculateChainHotIdle(changePrevious)?.fuelUsed ?? Number.POSITIVE_INFINITY;
        const nextHotIdle =
          calculateChainHotIdle(changeNext)?.fuelUsed ?? Number.POSITIVE_INFINITY;

        items = nextHotIdle <= previousHotIdle ? changeNext : changePrevious;
        continue;
      }

      if (strategy === "balanced") {
        const midpoint = (gap.previousFuel + gap.nextFuel) / 2;
        items = replaceDocument(
          items,
          updateFuelBoundary(previous, gap.sectionKey, "fuelAtEnd", midpoint)
        );
        const nextAfterPreviousUpdate = findDocument(items, next);
        if (nextAfterPreviousUpdate) {
          items = replaceDocument(
            items,
            updateFuelBoundary(
              nextAfterPreviousUpdate,
              gap.sectionKey,
              "fuelAtStart",
              midpoint
            )
          );
        }
        continue;
      }

      if (
        strategy === "protect-routes" &&
        next.type === "driverRoute" &&
        previous.type !== "driverRoute"
      ) {
        items = replaceDocument(
          items,
          updateFuelBoundary(
            previous,
            gap.sectionKey,
            "fuelAtEnd",
            gap.nextFuel
          )
        );
        continue;
      }

      items = replaceDocument(
        items,
        updateFuelBoundary(next, gap.sectionKey, "fuelAtStart", gap.previousFuel)
      );
    }
  }

  return sortChainDocuments(items);
}

export function buildChainCorrectionScenarios(
  sourceItems: ChainDocument[],
  tankCapacity: number | null
): ChainCorrectionScenario[] {
  const originals = sortChainDocuments(cloneChainDocuments(sourceItems));
  const scenarios: ChainCorrectionScenarioId[] = [
    "close-gaps",
    "protect-routes",
    "balanced",
  ];

  return scenarios.map((id) => {
    const documents = applyScenarioStrategy(originals, id);
    const corrections = buildChainCorrections(originals, documents);

    return {
      id,
      documents,
      corrections,
      changedCount: corrections.reduce(
        (sum, correction) =>
          sum +
          correction.sections.length +
          (correction.operationStart || correction.operationEnd ? 1 : 0),
        0
      ),
      validationError: validateCorrectedChain(documents, tankCapacity),
    };
  });
}

export function buildChainCorrections(
  original: ChainDocument[],
  corrected: ChainDocument[]
): FuelChainCorrection[] {
  return corrected.flatMap((item) => {
    const source = original.find(
      (entry) =>
        entry.type === item.type && entry.document.id === item.document.id
    );
    if (!source) return [];

    const sections = getChainDocumentSections(item).flatMap((section) => {
      const sourceSection = getChainDocumentSections(source).find(
        (entry) => sectionKey(entry) === sectionKey(section)
      );
      if (
        !sourceSection ||
        (sourceSection.fuelAtStart === section.fuelAtStart &&
          sourceSection.fuelAtEnd === section.fuelAtEnd)
      ) {
        return [];
      }
      return [
        {
          sectionKey: sectionKey(section),
          fuelAtStart: section.fuelAtStart,
          fuelAtEnd: section.fuelAtEnd,
        },
      ];
    });

    const timeChanged =
      item.type === "thu" &&
      source.type === "thu" &&
      (item.document.operationStart !== source.document.operationStart ||
        item.document.operationEnd !== source.document.operationEnd);

    if (!timeChanged && sections.length === 0) return [];

    return [
      {
        type: item.type,
        documentId: item.document.id,
        operationStart:
          item.type === "thu" ? item.document.operationStart : undefined,
        operationEnd:
          item.type === "thu" ? item.document.operationEnd : undefined,
        sections,
      },
    ];
  });
}

export function validateCorrectedChain(
  items: ChainDocument[],
  tankCapacity: number | null
): string | null {
  for (const item of items) {
    if (item.type === "thu") {
      if (
        durationMinutes(
          item.document.operationStart,
          item.document.operationEnd
        ) <= 0 ||
        new Date(item.document.operationStart).getTime() <
          new Date(item.document.shiftStart).getTime() ||
        new Date(item.document.operationEnd).getTime() >
          new Date(item.document.shiftEnd).getTime()
      ) {
        return "Время операции ТХУ-3 должно находиться внутри смены.";
      }
    }

    for (const section of item.document.sections) {
      if (section.fuelAtStart < 0 || section.fuelAtEnd < 0) {
        return "Количество топлива не может быть отрицательным.";
      }
      if (
        tankCapacity !== null &&
        (section.fuelAtStart > tankCapacity ||
          section.fuelAtEnd > tankCapacity)
      ) {
        return "Корректировка превышает заданный лимит бака.";
      }
      if (
        item.type !== "thu" ||
        item.document.operationType !== "fueling"
      ) {
        if (section.fuelAtEnd > section.fuelAtStart) {
          return "При сдаче топлива должно быть не больше, чем при приёмке.";
        }
      } else if (
        section.fuelAdded !== null &&
        Math.abs(
          section.fuelAtEnd -
            section.fuelAtStart -
            section.fuelAdded
        ) > 0.001
      ) {
        return "При корректировке экипировки количество набранного топлива должно сохраняться.";
      }
    }
  }

  return null;
}
