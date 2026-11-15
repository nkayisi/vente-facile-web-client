import type { MembrePerimetre } from "@vente-facile/core";
import { describe, expect, it } from "vitest";

import {
  basculerVoirTout,
  casesAffectation,
  membresVisibles,
  permissionsAccordables,
} from "./equipe";

const NORD = { id: "nord", name: "Boutique Nord", is_active: true };
const SUD = { id: "sud", name: "Dépôt Sud", is_active: true };
const FERME = { id: "ferme", name: "Ancien entrepôt", is_active: false };

const gerant = (affectes: MembrePerimetre["affectes"], consulteTout = false): MembrePerimetre => ({
  role: "manager",
  consulteTout,
  voitCollegues: true,
  affectes,
});
const proprio: MembrePerimetre = { role: "owner", consulteTout: false, voitCollegues: true, affectes: [] };

describe("membresVisibles", () => {
  const membres = [
    { id: "p", role: "owner", assigned_warehouses: [] },
    { id: "a", role: "cashier", assigned_warehouses: [{ id: "nord" }] },
    { id: "b", role: "cashier", assigned_warehouses: [{ id: "sud" }] },
    { id: "c", role: "stock_keeper", assigned_warehouses: [] },
  ];

  it("le propriétaire voit tout le monde", () => {
    expect(membresVisibles(proprio, membres).map((m) => m.id)).toEqual(["p", "a", "b", "c"]);
  });

  it("un gérant voit le propriétaire et ceux de ses entrepôts", () => {
    expect(membresVisibles(gerant([NORD]), membres).map((m) => m.id)).toEqual(["p", "a"]);
  });

  it("la consultation de tous ne lui ouvre pas la gestion des autres", () => {
    expect(membresVisibles(gerant([NORD], true), membres).map((m) => m.id)).toEqual(["p", "a"]);
  });
});

describe("permissionsAccordables", () => {
  const toutes = ["warehouses.create", "warehouses.delete", "sales.view_all", "reports.view", "cashbook.view"];

  it("jamais une permission réservée au propriétaire, même pour lui", () => {
    expect(
      permissionsAccordables({ role: "owner", permissions: [] }, toutes, []),
    ).toEqual(["sales.view_all", "reports.view", "cashbook.view"]);
  });

  it("un gérant n'accorde que ce qu'il possède", () => {
    expect(
      permissionsAccordables({ role: "manager", permissions: ["sales.view_all"] }, toutes, []),
    ).toEqual(["sales.view_all"]);
  });

  it("une permission déjà accordée reste proposée, pour pouvoir la retirer", () => {
    expect(
      permissionsAccordables(
        { role: "manager", permissions: [] },
        toutes,
        ["warehouses.create", "reports.view"],
      ),
    ).toEqual(["warehouses.create", "reports.view"]);
  });
});

describe("basculerVoirTout", () => {
  it("ajoute et retire sales.view_all sans toucher au reste", () => {
    expect(basculerVoirTout(["reports.view"], true)).toEqual(["reports.view", "sales.view_all"]);
    expect(basculerVoirTout(["sales.view_all", "reports.view"], false)).toEqual(["reports.view"]);
    expect(basculerVoirTout(["sales.view_all"], true)).toEqual(["sales.view_all"]);
  });
});

describe("casesAffectation", () => {
  it("le propriétaire coche tout actif, et un inactif se montre fermé", () => {
    const cases = casesAffectation(proprio, [NORD, SUD, FERME], [], []);
    expect(cases.map((c) => [c.id, c.desactivee])).toEqual([
      ["ferme", true],
      ["nord", false],
      ["sud", false],
    ]);
    expect(cases.find((c) => c.id === "ferme")?.motif).toBe("Inactif : ne s'affecte pas");
  });

  it("un gérant qui consulte tout n'affecte que dans ses entrepôts", () => {
    const cases = casesAffectation(gerant([NORD], true), [NORD, SUD, FERME], [], []);
    expect(cases.map((c) => c.id)).toEqual(["nord"]);
  });

  it("une affectation hors de son périmètre reste affichée, cochée et fermée", () => {
    const cases = casesAffectation(gerant([NORD]), [NORD], [SUD], ["sud"]);
    const sud = cases.find((c) => c.id === "sud");
    expect(sud).toMatchObject({ coche: true, desactivee: true, motif: "Hors de votre périmètre" });
  });

  it("retirer une affectation inactive de son périmètre reste permis", () => {
    const cases = casesAffectation(gerant([NORD, FERME]), [NORD, FERME], [FERME], ["ferme"]);
    expect(cases.find((c) => c.id === "ferme")).toMatchObject({ coche: true, desactivee: false });
  });
});
