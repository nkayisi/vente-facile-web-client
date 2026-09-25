#!/usr/bin/env node
/**
 * Aucun code de permission inventé dans le back-office.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN CODE FAUX NE LÈVE RIEN : LE BOUTON DISPARAÎT, SIMPLEMENT.            │
 * │                                                                          │
 * │ `hasPermission("sales.refund")` rend `false` en silence. L'utilisateur   │
 * │ conclut que la fonction n'existe pas, et personne ne cherche un bug là   │
 * │ où il n'y a pas d'erreur. Le terminal a payé ce défaut deux fois         │
 * │ (`sales.refund`, `stock.adjust`) avant de se doter de                    │
 * │ `session/permissions.test.ts` ; le back-office n'avait aucun équivalent. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LA LISTE DE RÉFÉRENCE EST LUE À LA SOURCE, jamais recopiée. Une liste
 * tenue à la main est exactement ce qui a laissé passer trois codes fantômes
 * dans le test du terminal : il validait ce qu'il aurait dû refuser.
 *
 * Lancé par `pnpm check:permissions`, à côté de `check:server-actions`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE = process.cwd();
const CATALOGUE = join(RACINE, "..", "backend", "apps", "core", "permissions_catalog.py");
const DOSSIERS = ["app", "components", "hooks", "lib", "actions"];

/**
 * Les trois formes sous lesquelles un code de permission apparaît.
 *
 * ⚠ LA TROISIÈME EST LA PLUS RISQUÉE, et ma première version la manquait : le
 * menu latéral et les gardes de route portent leurs codes dans des TABLES
 * DÉCLARATIVES (`permission: "sales.view"`), pas dans des appels. Un code faux
 * y fait disparaître une entrée de menu entière, et le balayage l'ignorait -
 * il déclarait le back-office conforme en n'ayant vu que dix codes sur trente.
 */
const FORMES = [
  // `hasPermission("a.b")`, `hasAnyPermission(["a.b", "c.d"])`
  /\b(?:hasPermission|hasAnyPermission|hasAllPermissions)\(\s*\[?\s*"([a-z_]+\.[a-z_]+)"/g,
  // `permission: "a.b"` / `permissions: ["a.b", ...]`
  /\bpermissions?:\s*\[?\s*"([a-z_]+\.[a-z_]+)"/g,
];
/** La suite d'une liste littérale. */
const DANS_LISTE = /"([a-z_]+\.[a-z_]+)"/g;

function codesDuCatalogue() {
  let brut;
  try {
    brut = readFileSync(CATALOGUE, "utf8");
  } catch {
    // Un catalogue introuvable fait ÉCHOUER, il ne fait pas passer : sans lui
    // ce contrôle ne prouve plus rien, et un contrôle muet est pire qu'aucun.
    console.error(`permissions : catalogue introuvable (${CATALOGUE}).`);
    process.exit(2);
  }
  const codes = new Set();
  for (const m of brut.matchAll(/"([a-z_]+\.[a-z_]+)"/g)) codes.add(m[1]);
  if (codes.size < 50) {
    console.error(
      `permissions : ${codes.size} codes lus dans le catalogue, c'est trop peu. ` +
        "Le balayage ne balaie plus rien."
    );
    process.exit(2);
  }
  return codes;
}

function fichiers(base) {
  const sortie = [];
  const pile = [base];
  while (pile.length) {
    const d = pile.pop();
    let entrees;
    try {
      entrees = readdirSync(d);
    } catch {
      continue;
    }
    for (const e of entrees) {
      if (e === "node_modules" || e === ".next" || e.startsWith(".")) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) pile.push(p);
      else if (/\.tsx?$/.test(p)) sortie.push(p);
    }
  }
  return sortie;
}

const catalogue = codesDuCatalogue();
const fautifs = [];
let vus = 0;

for (const dossier of DOSSIERS) {
  for (const f of fichiers(join(RACINE, dossier))) {
    const code = readFileSync(f, "utf8");
    for (const forme of FORMES) {
      for (const m of code.matchAll(forme)) {
        vus += 1;
        if (!catalogue.has(m[1])) {
          fautifs.push(`${relative(RACINE, f)} : « ${m[1]} » n'existe pas côté serveur`);
        }
        // La suite d'une liste littérale, quand il y en a une.
        if (!m[0].includes("[")) continue;
        const apres = code.slice(m.index + m[0].length, m.index + m[0].length + 200);
        const fin = apres.indexOf("]");
        for (const n of apres.slice(0, fin === -1 ? 0 : fin).matchAll(DANS_LISTE)) {
          vus += 1;
          if (!catalogue.has(n[1])) {
            fautifs.push(`${relative(RACINE, f)} : « ${n[1]} » n'existe pas côté serveur`);
          }
        }
      }
    }
  }
}

if (vus < 25) {
  console.error(
    `permissions : seulement ${vus} codes trouvés dans le code. ` +
      "Un balayage qui ne balaie rien passe au vert sans rien démontrer."
  );
  process.exit(2);
}

if (fautifs.length > 0) {
  console.error("permissions : codes inventés.\n");
  for (const f of [...new Set(fautifs)]) console.error(`  ${f}`);
  console.error(
    "\nUn code faux ne lève rien : le bouton disparaît, et personne ne cherche " +
      "un bug là où il n'y a pas d'erreur."
  );
  process.exit(1);
}

console.log(`permissions : ${vus} codes vérifiés contre le catalogue serveur, aucun inventé.`);
