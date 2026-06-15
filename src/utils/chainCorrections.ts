import type {
  FuelChainCorrection,
  LocomotiveSection,
} from "../domain/documents";
import {
  getChainDocumentSections,
  sectionKey,
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
