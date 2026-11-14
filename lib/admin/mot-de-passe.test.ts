import { describe, expect, it } from "vitest";

import { ALPHABET, estConforme, genererMotDePasse } from "./mot-de-passe";

describe("genererMotDePasse", () => {
  it("rend trois groupes de quatre, séparés par des tirets", () => {
    for (let i = 0; i < 200; i++) {
      expect(genererMotDePasse()).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    }
  });

  it("n'emploie aucun caractère que la voix confond", () => {
    for (let i = 0; i < 200; i++) {
      expect(genererMotDePasse()).not.toMatch(/[01ilo]/);
    }
    expect(ALPHABET).not.toMatch(/[01ilo]/);
  });

  it("porte toujours des lettres ET des chiffres", () => {
    for (let i = 0; i < 500; i++) expect(estConforme(genererMotDePasse())).toBe(true);
  });

  it("retire un tirage tout en chiffres au lieu de le rendre", () => {
    // Le premier tirage ne donne que des « 2 », puis l'aléa reprend : le
    // générateur doit rejeter le premier candidat, sinon le serveur refuserait
    // un mot de passe « entièrement numérique ».
    let appels = 0;
    const aleatoire = (o: Uint8Array) => {
      appels++;
      o[0] = appels <= 12 ? ALPHABET.indexOf("2") : (appels * 37) % 248;
      return o;
    };
    const mot = genererMotDePasse(aleatoire);
    expect(estConforme(mot)).toBe(true);
    expect(appels).toBeGreaterThan(12);
  });

  it("emploie le générateur cryptographique du moteur", () => {
    const vus = new Set(Array.from({ length: 50 }, () => genererMotDePasse()));
    expect(vus.size).toBe(50);
  });
});

describe("estConforme", () => {
  it("refuse ce que le serveur refuserait ou ce qu'on dicterait mal", () => {
    expect(estConforme("2345-6789-2345")).toBe(false);
    expect(estConforme("abcd-efgh-jkmn")).toBe(false);
    expect(estConforme("ab1d-ef2h-jkmn")).toBe(false);
    expect(estConforme("ab3d-ef2h-jkmn")).toBe(true);
  });
});
