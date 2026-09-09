/**
 * Garde-fou : un fichier `"use server"` n'exporte que des fonctions async.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE QUE CE CONTRÔLE DÉFEND.                                               │
 * │                                                                          │
 * │ Chaque export d'un fichier `"use server"` devient un point d'entrée RPC. │
 * │ Un objet n'en est pas un, et Next refuse alors le module ENTIER :        │
 * │                                                                          │
 * │   A "use server" file can only export async functions, found object.     │
 * │                                                                          │
 * │ L'erreur ne remonte pas dans le fichier fautif ni dans la page qui s'en  │
 * │ sert : elle remonte dans la première garde qui tire le graphe d'imports  │
 * │ (`organization-checker`), donc au chargement de TOUT le tableau de bord. │
 * │ Un objet de libellés exporté depuis `reports.actions.ts` a ainsi cassé   │
 * │ le tableau de bord entier, et le message ne désignait rien d'utile.      │
 * │                                                                          │
 * │ `tsc` ne le voit pas - c'est du JavaScript parfaitement valide - et      │
 * │ `next build` ne le voit qu'à l'exécution de la page. D'où ce balayage.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les `export type` et `export interface` sont EFFACÉS à la compilation : ils
 * ne deviennent aucun point d'entrée, et rester dans un fichier d'actions est
 * légitime pour eux.
 *
 *   node scripts/check-use-server.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const IGNORES = new Set(["node_modules", ".next", ".git", "public"]);

function* fichiers(dossier) {
  for (const nom of readdirSync(dossier)) {
    if (IGNORES.has(nom)) continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) yield* fichiers(chemin);
    else if (/\.tsx?$/.test(chemin)) yield chemin;
  }
}

/** `"use server"` ou `'use server'`, en tête de fichier (avant tout import). */
function estFichierServeur(source) {
  const tete = source.slice(0, 400);
  return /^\s*(["'])use server\1\s*;?/m.test(tete);
}

const fautifs = [];
for (const f of fichiers(RACINE)) {
  const source = readFileSync(f, "utf8");
  if (!estFichierServeur(source)) continue;

  for (const m of source.matchAll(/^export\s+(?!type\b|interface\b)(\w+)/gm)) {
    const suite = source.slice(m.index);
    // `export async function` et `export default async function` passent ;
    // `export const`, `export let`, `export enum`, `export class` et une
    // fonction NON asynchrone deviendraient des points d'entrée invalides.
    const valide =
      /^export\s+async\s+function\b/.test(suite) ||
      /^export\s+default\s+async\s+function\b/.test(suite) ||
      /^export\s+\{/.test(suite);
    if (!valide) {
      const ligne = source.slice(0, m.index).split("\n").length;
      fautifs.push(`${f.replace(RACINE + "/", "")}:${ligne}  ${suite.split("\n")[0].trim()}`);
    }
  }
}

if (fautifs.length > 0) {
  console.error(
    "\nUn fichier \"use server\" n'exporte que des fonctions asynchrones.\n" +
      "Déplacer ces valeurs dans un module ordinaire (lib/), ou les rendre async.\n"
  );
  for (const f of fautifs) console.error("  " + f);
  console.error("");
  process.exit(1);
}

console.log("use server : aucun export non asynchrone.");
