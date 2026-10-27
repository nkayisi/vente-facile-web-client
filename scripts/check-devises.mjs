#!/usr/bin/env node
/**
 * Le catalogue de devises des CLIENTS et celui du SERVEUR ne peuvent pas diverger.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE COUPLE A DÉJÀ DIVERGÉ, ET C'EST LE MARCHAND QUI L'A DÉCOUVERT.       │
 * │                                                                          │
 * │ `core/src/currencies.ts` offrait vingt et une devises dans le sélecteur  │
 * │ d'inscription pendant que le serveur n'en acceptait que deux. Choisir le │
 * │ franc CFA rendait 400 : « « XAF » n'est pas un choix valide. » Rien côté │
 * │ client ne pouvait le voir - l'écran faisait exactement son travail.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les deux fichiers croisés sont les deux bouts de la chaîne :
 *   - `core/src/currencies.ts` est ce que les DEUX clients offrent au choix ;
 *   - `settings/migrations/0004_add_all_supported_currencies.py` est ce qui
 *     peuple la table `Currency`, seule autorité du serveur à la validation.
 *
 * ⚠ LES DÉCIMALES COMPTENT AUTANT QUE LES CODES. Un XAF déclaré à 2 décimales
 * d'un côté et 0 de l'autre ne refuse rien : il imprime « 12 500,00 FCFA » sur
 * une monnaie qui n'en a pas, et ce sont les tickets du marchand qui sont faux.
 *
 * ⚠ CE CROISEMENT NE PEUT PAS ÊTRE UN TEST PYTEST. Le conteneur backend ne monte
 * que `./backend:/app` : un test qui lirait `../core/src/` échouerait en Docker,
 * et un test qui se SAUTE quand sa référence manque ne prouve plus rien.
 *
 * Lancé par `pnpm check:devises`, à côté de `check:permissions`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const NOYAU = join(RACINE, "..", "core", "src", "currencies.ts");
const MIGRATION = join(
  RACINE, "..", "backend", "apps", "settings", "migrations",
  "0004_add_all_supported_currencies.py",
);

/** Un contrôle muet est pire qu'aucun contrôle : on sort en 2, jamais en 0. */
function lire(chemin, quoi) {
  try {
    return readFileSync(chemin, "utf8");
  } catch {
    console.error(
      `devises : ${quoi} est introuvable (${chemin}).\n` +
        "Sans référence, ce contrôle ne prouverait rien."
    );
    process.exit(2);
  }
}

// `{ code: "XAF", name: "Franc CFA (CEMAC)", symbol: "FCFA", decimal_places: 0 }`
const ENTREE_TS =
  /\{\s*code:\s*"([A-Z]{3})",\s*name:\s*"([^"]+)",\s*symbol:\s*"([^"]+)",\s*decimal_places:\s*(\d+)\s*\}/g;
// `{'code': 'XAF', 'name': 'Franc CFA (CEMAC)', 'symbol': 'FCFA', 'decimal_places': 0}`
const ENTREE_PY =
  /\{'code':\s*'([A-Z]{3})',\s*'name':\s*'([^']+)',\s*'symbol':\s*'([^']+)',\s*'decimal_places':\s*(\d+)\}/g;

function extraire(source, motif) {
  const table = new Map();
  for (const [, code, name, symbol, decimales] of source.matchAll(motif)) {
    table.set(code, { name, symbol, decimal_places: Number(decimales) });
  }
  return table;
}

const noyau = extraire(lire(NOYAU, "le catalogue du noyau"), ENTREE_TS);
const serveur = extraire(lire(MIGRATION, "la migration du référentiel"), ENTREE_PY);

const PLANCHER = 21;
for (const [quoi, table] of [["noyau", noyau], ["migration", serveur]]) {
  if (table.size < PLANCHER) {
    console.error(
      `devises : seulement ${table.size} devises lues dans le ${quoi}, ` +
        `${PLANCHER} attendues. Un balayage qui ne balaie rien passe au vert ` +
        "sans rien démontrer."
    );
    process.exit(2);
  }
}

const fautes = [];
for (const [code, attendu] of serveur) {
  const offert = noyau.get(code);
  if (!offert) {
    fautes.push(`« ${code} » est en base et le sélecteur ne l'offre pas`);
    continue;
  }
  for (const champ of ["name", "symbol", "decimal_places"]) {
    if (offert[champ] !== attendu[champ]) {
      fautes.push(
        `« ${code} » : ${champ} vaut ${JSON.stringify(offert[champ])} dans le ` +
          `noyau et ${JSON.stringify(attendu[champ])} en base`
      );
    }
  }
}
for (const code of noyau.keys()) {
  if (!serveur.has(code)) {
    fautes.push(
      `« ${code} » est offert au choix et n'est pas en base : le serveur le refusera`
    );
  }
}

if (fautes.length > 0) {
  console.error("devises : le catalogue client et le référentiel serveur divergent.\n");
  for (const f of fautes) console.error(`  ${f}`);
  console.error(
    "\nUn code offert mais absent de la table rend 400 à l'inscription ; des " +
      "décimales divergentes impriment un montant faux sur le ticket du client."
  );
  process.exit(1);
}

console.log(
  `devises : ${noyau.size} devises croisées entre le noyau et le référentiel ` +
    "serveur, aucune divergence."
);
