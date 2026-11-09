/**
 * Garde-fou : un chemin d'export ne porte JAMAIS sa propre chaîne de requête.
 *
 * `fetchExportFile(path, …)` ajoute TOUJOURS son `?export_format=…` en collant
 * un `?` au chemin reçu. Un appelant qui a déjà posé un `?` produit donc une
 * URL à DEUX points d'interrogation : tout ce qui suit le second est avalé par
 * le dernier paramètre, le serveur refuse en 400, et le format demandé
 * n'arrive jamais.
 *
 * Mesuré le 2026-11-08 sur `exportCustomerReport` :
 *   …/report/export/?date_from=2026-11-02&date_to=2026-11-08?export_format=pdf
 *   → 400 « Date attendue au format AAAA-MM-JJ »
 * alors que la même requête en `&` rend un PDF de 2 953 octets.
 *
 * ⚠ RIEN NE LE SIGNALE : l'URL se construit sans erreur, `tsc` est vert, et le
 *   marchand lit un refus sur un bouton d'export qui a l'air correct. Le
 *   cinquième paramètre `params` existe précisément pour cela - douze des
 *   treize appelants l'employaient déjà.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RACINE = new URL("..", import.meta.url).pathname;
const DOSSIERS = ["actions", "lib", "app", "components", "hooks"];
const IGNORE = new Set(["node_modules", ".next", ".pnpm-store", ".git"]);
/** Sous ce nombre d'appels vus, le balayage ne balaie rien : on refuse. */
const PLANCHER = 8;

function fichiers(dossier) {
  const trouves = [];
  let entrees;
  try {
    entrees = readdirSync(dossier);
  } catch {
    return trouves;
  }
  for (const nom of entrees) {
    if (IGNORE.has(nom)) continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin));
    else if (/\.(ts|tsx)$/.test(nom)) trouves.push(chemin);
  }
  return trouves;
}

/**
 * Le premier argument de l'appel, quel que soit le nombre de sauts de ligne.
 * On ne lit que jusqu'à la première virgule de profondeur zéro : un gabarit
 * `` `/a/${b}/c/` `` ne contient pas de virgule, et un argument plus complexe
 * qu'un littéral n'est de toute façon pas jugeable ici.
 */
function premierArgument(source, indexOuverture) {
  let profondeur = 0;
  for (let i = indexOuverture; i < source.length; i += 1) {
    const c = source[i];
    if (c === "(" || c === "[" || c === "{") profondeur += 1;
    else if (c === ")" || c === "]" || c === "}") {
      profondeur -= 1;
      if (profondeur === 0) return source.slice(indexOuverture + 1, i);
    } else if (c === "," && profondeur === 1) {
      return source.slice(indexOuverture + 1, i);
    }
  }
  return null;
}

const fautes = [];
let appelsVus = 0;

for (const dossier of DOSSIERS) {
  for (const fichier of fichiers(join(RACINE, dossier))) {
    const source = readFileSync(fichier, "utf8");
    // La définition elle-même pose légitimement le `?` : on ne la juge pas.
    if (fichier.endsWith("lib/export/fetch-export.ts")) continue;

    const motif = /\bfetchExportFile\s*\(/g;
    let m;
    while ((m = motif.exec(source)) !== null) {
      appelsVus += 1;
      const argument = premierArgument(source, motif.lastIndex - 1);
      if (argument === null) continue;
      if (!argument.includes("?")) continue;
      const ligne = source.slice(0, m.index).split("\n").length;
      fautes.push({
        fichier: fichier.replace(RACINE, ""),
        ligne,
        argument: argument.trim().replace(/\s+/g, " ").slice(0, 90),
      });
    }
  }
}

if (appelsVus < PLANCHER) {
  console.error(
    `✗ check:exports — ${appelsVus} appel(s) à fetchExportFile vus, ` +
      `au moins ${PLANCHER} attendus.\n` +
      `  Le balayage ne balaie plus rien : corriger le script, pas le seuil.`
  );
  process.exit(2);
}

if (fautes.length > 0) {
  console.error(
    `✗ check:exports — ${fautes.length} chemin(s) d'export portent leur propre ` +
      `chaîne de requête :\n`
  );
  for (const f of fautes) {
    console.error(`  ${f.fichier}:${f.ligne}`);
    console.error(`    ${f.argument}`);
  }
  console.error(
    `\n  fetchExportFile colle TOUJOURS son propre « ? » : le chemin en` +
      `\n  porterait un second, et le serveur refuserait en 400.` +
      `\n  Passer les filtres par le 5e paramètre « params ».`
  );
  process.exit(1);
}

console.log(`✓ check:exports — ${appelsVus} appels, aucun chemin ne porte de « ? ».`);
