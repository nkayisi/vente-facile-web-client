import type { MembrePerimetre } from "@vente-facile/core";
import { describe, expect, it } from "vitest";

import {
  annuaireDepuisListe,
  champsModifies,
  cotesDuTransfert,
  destinationsDeTransfert,
  entrepotsPourUsage,
  libelleEntrepot,
  optionsEntrepots,
  peutModifierEntrepot,
} from "./entrepots";

const NORD = { id: "nord", name: "Boutique Nord", code: "BN", is_active: true };
const SUD = { id: "sud", name: "Dépôt Sud", code: "DS", is_active: true };
const FERME = { id: "ferme", name: "Ancien entrepôt", code: "AE", is_active: false };
const TOUS = [NORD, SUD, FERME];

const membre = (m: Partial<MembrePerimetre>): MembrePerimetre => ({
  role: "manager",
  consulteTout: false,
  voitCollegues: true,
  affectes: [],
  ...m,
});

describe("entrepotsPourUsage", () => {
  it("en lecture, rend tout ce que le serveur a rendu, inactifs compris", () => {
    const gerant = membre({ affectes: [NORD] });
    expect(entrepotsPourUsage(gerant, TOUS, "lecture").map((e) => e.id)).toEqual([
      "nord",
      "sud",
      "ferme",
    ]);
  });

  it("en action, un « consulter tous » n'agit que chez lui", () => {
    const gerant = membre({ consulteTout: true, affectes: [NORD] });
    expect(entrepotsPourUsage(gerant, TOUS, "action").map((e) => e.id)).toEqual(["nord"]);
  });

  it("en action, un entrepôt affecté mais désactivé n'est pas proposé", () => {
    const gerant = membre({ affectes: [NORD, FERME] });
    expect(entrepotsPourUsage(gerant, TOUS, "action").map((e) => e.id)).toEqual(["nord"]);
  });

  it("en action, le propriétaire agit partout, sauf sur un inactif", () => {
    const proprio = membre({ role: "owner" });
    expect(entrepotsPourUsage(proprio, TOUS, "action").map((e) => e.id)).toEqual(["nord", "sud"]);
  });

  it("droits encore inconnus : les actifs, jamais une liste vide", () => {
    expect(entrepotsPourUsage(null, TOUS, "action").map((e) => e.id)).toEqual(["nord", "sud"]);
    expect(
      entrepotsPourUsage(membre({ role: null }), TOUS, "action").map((e) => e.id),
    ).toEqual(["nord", "sud"]);
  });
});

describe("libellés et options", () => {
  it("suffixe un inactif en lecture seulement", () => {
    expect(libelleEntrepot(FERME, "lecture")).toBe("Ancien entrepôt (inactif)");
    expect(libelleEntrepot(FERME, "action")).toBe("Ancien entrepôt");
  });

  it("cherche sans accents, sur le nom et le code", () => {
    const proprio = membre({ role: "owner" });
    expect(optionsEntrepots(TOUS, "lecture", proprio, "depot")).toEqual([
      { value: "sud", label: "Dépôt Sud" },
    ]);
    expect(optionsEntrepots(TOUS, "lecture", proprio, "ae")).toEqual([
      { value: "ferme", label: "Ancien entrepôt (inactif)" },
    ]);
  });
});

describe("annuaire et destinations", () => {
  it("range les actifs d'abord, puis par nom", () => {
    expect(annuaireDepuisListe(TOUS).map((e) => e.id)).toEqual(["nord", "sud", "ferme"]);
  });

  it("ne propose ni la source ni un inactif comme destination", () => {
    const annuaire = annuaireDepuisListe(TOUS);
    expect(destinationsDeTransfert(annuaire, "nord").map((e) => e.id)).toEqual(["sud"]);
  });

  it("une entrée d'annuaire ne porte qu'un nom", () => {
    expect(Object.keys(annuaireDepuisListe([NORD])[0]).sort()).toEqual(["id", "is_active", "name"]);
  });
});

describe("modifier un entrepôt", () => {
  it("le propriétaire modifie tout", () => {
    expect(peutModifierEntrepot(membre({ role: "owner" }), false, "sud")).toBe(true);
  });

  it("un gérant ne modifie que ses entrepôts, même s'il lit tout", () => {
    const gerant = membre({ consulteTout: true, affectes: [NORD] });
    expect(peutModifierEntrepot(gerant, true, "nord")).toBe(true);
    expect(peutModifierEntrepot(gerant, true, "sud")).toBe(false);
    expect(peutModifierEntrepot(gerant, false, "nord")).toBe(false);
  });

  it("n'envoie que ce qui a changé, dans les champs autorisés", () => {
    const avant = { name: "Nord", address: "", is_default: true, code: "BN" };
    const apres = { name: "Nord 2", address: "", is_default: false, code: "BN" };
    expect(champsModifies(avant, apres, ["name", "address"])).toEqual({ name: "Nord 2" });
  });

  it("ne lit pas un champ vide et un champ absent comme un changement", () => {
    expect(
      champsModifies(
        { name: "Nord", address: undefined as string | undefined },
        { name: "Nord", address: "" },
        ["name", "address"],
      ),
    ).toEqual({});
  });
});

describe("cotesDuTransfert", () => {
  const transfert = { source_warehouse: "nord", destination_warehouse: "sud" };

  it("la source approuve, expédie et annule ; la destination réceptionne", () => {
    expect(cotesDuTransfert(membre({ affectes: [NORD] }), transfert)).toEqual({
      source: true,
      destination: false,
    });
    expect(cotesDuTransfert(membre({ affectes: [SUD] }), transfert)).toEqual({
      source: false,
      destination: true,
    });
  });

  it("consulter tous n'ouvre aucun des deux côtés", () => {
    expect(cotesDuTransfert(membre({ consulteTout: true, affectes: [] }), transfert)).toEqual({
      source: false,
      destination: false,
    });
  });

  it("le propriétaire tient les deux côtés", () => {
    expect(cotesDuTransfert(membre({ role: "owner" }), transfert)).toEqual({
      source: true,
      destination: true,
    });
  });

  it("une affectation désactivée n'ouvre pas le geste", () => {
    expect(cotesDuTransfert(membre({ affectes: [{ ...NORD, is_active: false }] }), transfert).source).toBe(false);
  });
});
