/**
 * L'accord, et le garde-fou qui proscrit « (s) » dans les libellés.
 *
 * ⚠ Le balayage lit l'AST TypeScript - chaînes, gabarits, texte JSX - et non
 *   des lignes : `restant(s)` posé seul sur sa ligne de JSX n'a ni guillemet
 *   ni chevron, et un motif ligne à ligne passerait à côté, pendant qu'un
 *   appel `setError(e)` le ferait crier.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { accord, pluriel } from "./accord";

describe("pluriel", () => {
  it("singulier sous deux", () => {
    expect(pluriel(0, "produit", "produits")).toBe("0 produit");
    expect(pluriel(1, "produit", "produits")).toBe("1 produit");
    expect(pluriel(1.5, "unité", "unités")).toBe("1.5 unité");
    expect(pluriel(2, "produit", "produits")).toBe("2 produits");
    expect(accord(3, "a", "ont")).toBe("ont");
  });
});

const RACINE = resolve(__dirname, "..");
const DOSSIERS = ["app", "components", "lib", "hooks", "actions"];
const RACCOURCI = /[a-zàâçéèêëîïôûùü]\((?:s|es|e|x)\)/i;

function fichiers(dir: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

/** Les morceaux de LIBELLÉ d'un fichier, avec leur ligne. */
export function libellesDe(code: string, nom = "x.tsx"): { texte: string; ligne: number }[] {
  const source = ts.createSourceFile(nom, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sortie: { texte: string; ligne: number }[] = [];
  const visiter = (n: ts.Node) => {
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n) ||
      ts.isJsxText(n)
    ) {
      const ligne = source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1;
      sortie.push({ texte: n.text, ligne });
    }
    ts.forEachChild(n, visiter);
  };
  visiter(source);
  return sortie;
}

describe("aucun libellé ne s'accorde par « (s) »", () => {
  it("le balayage MORD, et laisse passer le code", () => {
    const fautif = "const t = `${n} produit(s) importé(s)`;\n<p>\n  restant(s)\n</p>;";
    expect(libellesDe(fautif).filter((l) => RACCOURCI.test(l.texte)).map((l) => l.ligne)).toEqual([1, 3]);
    const sain = "setError(e);\nconst x = f(s);\nitems.map((s) => total(s));";
    expect(libellesDe(sain).some((l) => RACCOURCI.test(l.texte))).toBe(false);
  });

  it("aucun fichier du back-office n'en porte", () => {
    const fautifs: string[] = [];
    let balayes = 0;
    for (const dossier of DOSSIERS) {
      for (const f of fichiers(join(RACINE, dossier))) {
        balayes += 1;
        for (const l of libellesDe(readFileSync(f, "utf8"), f)) {
          if (RACCOURCI.test(l.texte)) fautifs.push(`${relative(RACINE, f)}:${l.ligne}`);
        }
      }
    }
    // Un balayage qui ne balaie rien passe au vert et ne prouve rien.
    expect(balayes).toBeGreaterThan(200);
    expect(fautifs).toEqual([]);
  });
});
