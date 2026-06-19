import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  DriverRoute,
  ThuOperation,
} from "../src/domain/documents.ts";
import {
  applyChainCorrections,
  buildChainCorrectionScenarios,
  buildChainCorrections,
  validateCorrectedChain,
} from "../src/utils/chainCorrections.ts";

const thu: ThuOperation = {
  id: "thu",
  documentNumber: "1",
  shiftStart: "2026-06-15T08:00",
  shiftEnd: "2026-06-15T20:00",
  operationType: "idle",
  operationStart: "2026-06-15T09:00",
  operationEnd: "2026-06-15T10:00",
  sections: [{
    id: "s",
    series: "ТЭМ",
    locomotiveNumber: "1",
    sectionNumber: "1",
    fuelAtStart: 1000,
    fuelAtEnd: 950,
    fuelAdded: null,
  }],
  createdAt: "",
  updatedAt: "",
};

const route: DriverRoute = {
  id: "mm",
  routeNumber: "2",
  driverName: "",
  routeStart: "2026-06-15T10:00",
  routeEnd: "2026-06-15T18:00",
  sections: [{
    ...thu.sections[0],
    fuelAtStart: 950,
    fuelAtEnd: 800,
  }],
  isZeroRoute: false,
  normFuel: 200,
  actualFuel: 150,
  creditedResult: 22.2,
  createdAt: "",
  updatedAt: "",
};

describe("chain corrections", () => {
  it("applies corrections without mutating source documents", () => {
    const source = [
      { type: "thu" as const, document: thu },
      { type: "driverRoute" as const, document: route },
    ];
    const corrected = applyChainCorrections(source, [{
      type: "driverRoute",
      documentId: "mm",
      sections: [{
        sectionKey: "ТЭМ|1|1",
        fuelAtStart: 940,
        fuelAtEnd: 800,
      }],
    }]);

    assert.equal(source[1].document.sections[0].fuelAtStart, 950);
    assert.equal(corrected[1].document.sections[0].fuelAtStart, 940);
  });

  it("builds only changed correction records", () => {
    const source = [{ type: "thu" as const, document: thu }];
    const corrected = applyChainCorrections(source);
    corrected[0].document.sections[0].fuelAtEnd = 940;

    assert.equal(buildChainCorrections(source, corrected).length, 1);
  });

  it("rejects values above tank capacity", () => {
    assert.equal(
      validateCorrectedChain([{ type: "thu", document: thu }], 900),
      "Корректировка превышает заданный лимит бака."
    );
  });

  it("builds a scenario that closes a fuel gap through the next document", () => {
    const routeWithGap: DriverRoute = {
      ...route,
      sections: [{ ...route.sections[0], fuelAtStart: 930 }],
    };
    const scenario = buildChainCorrectionScenarios(
      [
        { type: "thu", document: thu },
        { type: "driverRoute", document: routeWithGap },
      ],
      null
    ).find((item) => item.id === "close-gaps")!;

    assert.equal(scenario.validationError, null);
    assert.equal(scenario.documents[1].document.sections[0].fuelAtStart, 950);
    assert.equal(scenario.changedCount, 1);
  });

  it("closes a time gap in the hot idle preserving scenario", () => {
    const routeAfterGap: DriverRoute = {
      ...route,
      routeStart: "2026-06-15T11:00",
      sections: [{ ...route.sections[0], fuelAtStart: 950 }],
    };
    const scenario = buildChainCorrectionScenarios(
      [
        { type: "thu", document: thu },
        { type: "driverRoute", document: routeAfterGap },
      ],
      null
    ).find((item) => item.id === "close-gaps")!;

    assert.equal(scenario.validationError, null);
    assert.equal(scenario.documents[0].document.operationEnd, "2026-06-15T11:00");
  });

  it("can protect a driver route by correcting the previous THU", () => {
    const routeWithGap: DriverRoute = {
      ...route,
      sections: [{ ...route.sections[0], fuelAtStart: 930 }],
    };
    const scenario = buildChainCorrectionScenarios(
      [
        { type: "thu", document: thu },
        { type: "driverRoute", document: routeWithGap },
      ],
      null
    ).find((item) => item.id === "protect-routes")!;

    assert.equal(scenario.validationError, null);
    assert.equal(scenario.documents[0].document.sections[0].fuelAtEnd, 930);
    assert.equal(scenario.documents[1].document.sections[0].fuelAtStart, 930);
  });

  it("can split a fuel gap between adjacent documents", () => {
    const routeWithGap: DriverRoute = {
      ...route,
      sections: [{ ...route.sections[0], fuelAtStart: 930 }],
    };
    const scenario = buildChainCorrectionScenarios(
      [
        { type: "thu", document: thu },
        { type: "driverRoute", document: routeWithGap },
      ],
      null
    ).find((item) => item.id === "balanced")!;

    assert.equal(scenario.validationError, null);
    assert.equal(scenario.documents[0].document.sections[0].fuelAtEnd, 940);
    assert.equal(scenario.documents[1].document.sections[0].fuelAtStart, 940);
  });
});
