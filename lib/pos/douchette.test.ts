import { describe, expect, it } from "vitest";
import { candidatsDuScan, DOUCHETTE_AU_REPOS, frapper, type EtatDouchette } from "./douchette";

/** Tape une suite de touches, aux instants donnés, et rend les codes lus. */
function taper(touches: [string, number][]): { codes: string[]; etat: EtatDouchette } {
  let etat = DOUCHETTE_AU_REPOS;
  const codes: string[] = [];
  for (const [touche, instant] of touches) {
    const r = frapper(etat, touche, instant);
    etat = r.etat;
    if (r.code) codes.push(r.code);
  }
  return { codes, etat };
}

/** Une rafale de douchette : un caractère toutes les `pas` millisecondes, puis Entrée. */
function rafale(code: string, depart = 1000, pas = 8): [string, number][] {
  const touches: [string, number][] = [...code].map((c, i) => [c, depart + i * pas]);
  touches.push(["Enter", depart + code.length * pas]);
  return touches;
}

describe("la douchette", () => {
  it("une rafale rapide terminée par Entrée est un scan", () => {
    expect(taper(rafale("6001087011234")).codes).toEqual(["6001087011234"]);
  });

  it("une frappe humaine n'est PAS un scan", () => {
    const humain: [string, number][] = [
      ["5", 0], ["0", 180], ["0", 350], ["0", 520], ["Enter", 700],
    ];
    expect(taper(humain).codes).toEqual([]);
  });

  it("un code trop court n'est pas un code-barres", () => {
    expect(taper(rafale("123")).codes).toEqual([]);
  });

  it("la rafale repart quand la frappe ralentit : le début humain est oublié", () => {
    const touches: [string, number][] = [["s", 0], ["a", 200], ...rafale("96385074", 500)];
    expect(taper(touches).codes).toEqual(["96385074"]);
  });

  it("Maj n'interrompt pas la rafale (douchette en AZERTY)", () => {
    const touches: [string, number][] = [
      ["Shift", 1000], ["6", 1004], ["Shift", 1008], ["0", 1012], ["0", 1020], ["1", 1028], ["Enter", 1036],
    ];
    expect(taper(touches).codes).toEqual(["6001"]);
  });

  it("une Entrée trop tardive après la rafale n'est pas un scan", () => {
    const touches: [string, number][] = [...rafale("96385074").slice(0, -1), ["Enter", 5000]];
    expect(taper(touches).codes).toEqual([]);
  });

  it("deux scans de suite donnent deux codes", () => {
    const touches = [...rafale("11112222", 0), ...rafale("33334444", 2000)];
    expect(taper(touches).codes).toEqual(["11112222", "33334444"]);
  });
});

describe("les codes à essayer après un scan", () => {
  it("un scan tronqué en tête retrouve le code entier dans le champ", () => {
    expect(candidatsDuScan("7687GJHGD", "87687GJHGD")).toEqual(["7687GJHGD", "87687GJHGD"]);
  });

  it("le code lu seul quand le champ ne le prolonge pas", () => {
    expect(candidatsDuScan("87687GJHGD", "87687GJHGD")).toEqual(["87687GJHGD"]);
    expect(candidatsDuScan("ABCD", "XYZ")).toEqual(["ABCD"]);
    expect(candidatsDuScan("ABCD", null)).toEqual(["ABCD"]);
  });
});
