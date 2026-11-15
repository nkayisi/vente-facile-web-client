/**
 * Garde-fous de SOURCE sur les sélecteurs d'entrepôts.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN SÉLECTEUR D'ACTION SANS MEMBRE PROPOSE CE QU'ON NE PEUT QUE LIRE.   │
 * │                                                                          │
 * │ Sans le membre, `createWarehouseSearchHandler(…, "action")` ne sait pas  │
 * │ ce qui est affecté : il retombe sur tous les actifs de la liste de       │
 * │ lecture, c'est-à-dire, pour un membre qui consulte tous les entrepôts,   │
 * │ des entrepôts où le serveur lui répondra « consultation seule » après la │
 * │ saisie. Rien ne le signale : le sélecteur a l'air juste.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ Le balayage COMPTE d'abord ce qu'il lit : un balayage qui ne trouve aucun
 * fichier passe au vert sans rien démontrer.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const DOSSIERS = ["app", "components", "hooks", "lib"];

function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom.startsWith(".")) continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(ts|tsx)$/.test(nom) && !nom.endsWith(".test.ts")) sortie.push(chemin);
  }
  return sortie;
}

/** Le texte de chaque appel `nom(…)`, parenthèses équilibrées. */
function appels(source: string, nom: string): string[] {
  const sortie: string[] = [];
  let i = source.indexOf(`${nom}(`);
  while (i !== -1) {
    let profondeur = 0;
    let j = i + nom.length;
    for (; j < source.length; j++) {
      if (source[j] === "(") profondeur++;
      else if (source[j] === ")" && --profondeur === 0) break;
    }
    sortie.push(source.slice(i, j + 1));
    i = source.indexOf(`${nom}(`, j);
  }
  return sortie;
}

describe("sélecteurs d'entrepôts", () => {
  const sources = DOSSIERS.flatMap((d) => fichiers(join(RACINE, d))).map((f) => ({
    fichier: relative(RACINE, f),
    texte: readFileSync(f, "utf8"),
  }));

  it("le balayage lit bien le dépôt", () => {
    expect(sources.length).toBeGreaterThan(150);
  });

  it("tout sélecteur d'ACTION reçoit le membre", () => {
    const fautifs: string[] = [];
    let vus = 0;
    for (const { fichier, texte } of sources) {
      if (fichier === "lib/select-search-handlers.ts") continue;
      for (const appel of appels(texte, "createWarehouseSearchHandler")) {
        if (!/["']action["']/.test(appel)) continue;
        vus++;
        if (!/\bmembre\b/.test(appel)) fautifs.push(`${fichier} : ${appel.replace(/\s+/g, " ")}`);
      }
    }
    expect(vus).toBeGreaterThan(0);
    expect(fautifs).toEqual([]);
  });

  it("aucun écran ne force `is_active` sur la liste des entrepôts", () => {
    // Forcer les actifs côté serveur cachait les inactifs des filtres de
    // LECTURE, et c'est l'une des façons dont un entrepôt « disparaissait ».
    // L'action filtre par `entrepotsActionnables`, la lecture ne filtre pas.
    const fautifs = sources
      .filter(({ fichier }) => fichier.startsWith("app/") || fichier.startsWith("components/"))
      .flatMap(({ fichier, texte }) =>
        appels(texte, "getWarehouses")
          .filter((a) => /is_active/.test(a))
          .map((a) => `${fichier} : ${a.replace(/\s+/g, " ")}`),
      );
    expect(fautifs).toEqual([]);
  });
});
