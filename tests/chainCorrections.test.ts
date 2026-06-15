import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  DriverRoute,
  ThuOperation,
} from "../src/domain/documents.ts";
import {
  applyChainCorrections,
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
});
