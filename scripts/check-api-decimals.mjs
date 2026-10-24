#!/usr/bin/env node
/**
 * Aucun champ décimal du serveur n'est déclaré `number` dans le back-office.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN TYPE QUI MENT NE LÈVE RIEN, ET `tsc` RESTE VERT.                     │
 * │                                                                          │
 * │ DRF sérialise un `DecimalField` en CHAÎNE. Le jour où un champ passe de  │
 * │ `IntegerField` à `DecimalField` côté serveur - ce qui est une CORRECTION │
 * │ (une vente de 0,5 kg s'affichait « 0 ») - sa valeur passe de `5` à       │
 * │ `"5.000"`, et le type TypeScript resté `number` ne le signale nulle      │
 * │ part. `stock + quantity_sold` CONCATÈNE alors au lieu d'additionner, et  │
 * │ le `.toFixed()` qui suit fait tomber la page entière sur                 │
 * │ « r.toFixed is not a function ».                                         │
 * │                                                                          │
 * │ C'est arrivé en production sur « Rapports & statistiques », et rien dans │
 * │ la chaîne - ni `tsc`, ni le lint - ne pouvait le voir.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LA RÉFÉRENCE EST LUE À LA SOURCE, jamais recopiée. Une liste tenue à la
 * main est exactement ce qui a laissé passer trois codes fantômes dans le test
 * du terminal : il validait ce qu'il aurait dû refuser.
 *
 * ⚠ L'APPARIEMENT SE FAIT PAR NOM DE CLASSE, et c'est ce qui rend le contrôle
 * utilisable. Croiser sur le seul nom de CHAMP produisait 27 signalements dont
 * 19 parfaitement légitimes : les payloads d'écriture (`CreateSaleItemData`,
 * `AddPaymentData`...), où DRF coerce très bien un `number` en entrée, plus
 * `Product.min_stock_level`, homonyme d'un champ décimal d'un autre serializer
 * alors qu'il est un `PositiveIntegerField`. Un garde-fou qui crie sur du code
 * sain finit désactivé, et on perd le contrôle avec lui. Par classe, ces
 * dix-neuf disparaissent par CONSTRUCTION : `CreateSaleItemData` n'a pas de
 * `CreateSaleItemDataSerializer`.
 *
 * Portée, et elle est assumée :
 *   - seuls les champs DÉCLARÉS `serializers.DecimalField(...)` sont lus. Ceux
 *     qu'un `ModelSerializer` hérite de son modèle ne le sont pas - on préfère
 *     taire un champ que d'en inventer un ;
 *   - `coerce_to_string=False` est RESPECTÉ. Les points de fidélité sont
 *     délibérément exposés en nombre JSON (voir `points_field`), et les
 *     signaler reviendrait à demander de casser un choix documenté.
 *
 * Lancé par `pnpm check:api-decimals`, à côté de `check:permissions`.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const APPS = join(RACINE, "..", "backend", "apps");
const ACTIONS = join(RACINE, "actions");

/**
 * Sous ce plancher, le balayage n'a rien balayé et son vert ne vaut rien.
 * Mesuré à 62 champs couverts le jour de l'écriture ; la marge couvre les
 * renommages d'interfaces, pas l'effondrement d'un parseur.
 */
const PLANCHER = 30;

/** `number` et `number | null` sont faux ; `number | string` est déjà défensif. */
const TYPE_FAUTIF = /^number(\s*\|\s*null)?$/;

function sortirSansAvoirLu(quoi) {
  console.error(
    `api-decimals : ${quoi}\n` +
      "Un contrôle muet est pire qu'aucun contrôle : il passe au vert sans rien avoir lu."
  );
  process.exit(2);
}

if (!existsSync(APPS)) sortirSansAvoirLu(`dossier introuvable : ${APPS}`);
if (!existsSync(ACTIONS)) sortirSansAvoirLu(`dossier introuvable : ${ACTIONS}`);

// ---------------------------------------------------------------------------
// 1. Les serializers, à la source.
// ---------------------------------------------------------------------------

/** `TopProduct` -> Set des champs décimaux sérialisés en CHAÎNE. */
const serializers = new Map();

for (const app of readdirSync(APPS)) {
  const fichier = join(APPS, app, "serializers.py");
  if (!existsSync(fichier)) continue;

  const lignes = readFileSync(fichier, "utf8").split("\n");
  let classe = null;

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];

    // Toute ligne non indentée ferme la classe courante ; seule une déclaration
    // de serializer en rouvre une. Sans cela, une fonction du module continuerait
    // d'alimenter la dernière classe vue.
    if (/^\S/.test(ligne)) {
      const m = /^class (\w+)Serializer\s*\(/.exec(ligne);
      classe = m ? m[1] : null;
      continue;
    }
    if (!classe) continue;

    const champ = /^ {4}(\w+)\s*=\s*serializers\.DecimalField\s*\(/.exec(ligne);
    if (!champ) continue;

    // Les arguments débordent souvent sur plusieurs lignes : on lit jusqu'à la
    // parenthèse refermée pour voir un éventuel `coerce_to_string`.
    let bloc = "";
    let profondeur = 0;
    for (let j = i; j < lignes.length; j++) {
      bloc += lignes[j];
      for (const c of lignes[j]) {
        if (c === "(") profondeur++;
        else if (c === ")") profondeur--;
      }
      if (profondeur <= 0) break;
    }
    if (/coerce_to_string\s*=\s*False/.test(bloc)) continue;

    if (!serializers.has(classe)) serializers.set(classe, new Set());
    serializers.get(classe).add(champ[1]);
  }
}

if (serializers.size === 0) sortirSansAvoirLu("aucun serializer lu dans backend/apps");

// ---------------------------------------------------------------------------
// 2. Les interfaces du back-office.
// ---------------------------------------------------------------------------

/** `TopProduct` -> [{ champ, type, fichier, ligne }] */
const interfaces = new Map();

for (const nom of readdirSync(ACTIONS).filter((n) => n.endsWith(".ts"))) {
  const lignes = readFileSync(join(ACTIONS, nom), "utf8").split("\n");
  let courante = null;

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];

    const entete = /^(?:export\s+)?interface\s+(\w+)/.exec(ligne);
    if (entete) {
      courante = entete[1];
      if (!interfaces.has(courante)) interfaces.set(courante, []);
      continue;
    }
    if (/^\}/.test(ligne)) {
      courante = null;
      continue;
    }
    if (!courante) continue;

    // Deux espaces exactement : les champs d'un objet imbriqué sont plus
    // profonds, et ils ne décrivent pas ce serializer.
    const champ = /^ {2}(\w+)\??\s*:\s*(.+?);\s*$/.exec(ligne);
    if (champ) {
      interfaces.get(courante).push({
        champ: champ[1],
        type: champ[2].trim(),
        fichier: nom,
        ligne: i + 1,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Le croisement.
// ---------------------------------------------------------------------------

let couverts = 0;
let appariees = 0;
const fautifs = [];

for (const [nom, champsServeur] of serializers) {
  const champsTs = interfaces.get(nom);
  if (!champsTs) continue;
  appariees++;

  for (const { champ, type, fichier, ligne } of champsTs) {
    if (!champsServeur.has(champ)) continue;
    couverts++;
    if (TYPE_FAUTIF.test(type)) {
      fautifs.push(`actions/${fichier}:${ligne}  ${nom}.${champ} : ${type}`);
    }
  }
}

if (couverts < PLANCHER) {
  sortirSansAvoirLu(
    `seulement ${couverts} champs décimaux croisés (plancher ${PLANCHER}), ` +
      `pour ${serializers.size} serializers et ${interfaces.size} interfaces`
  );
}

if (fautifs.length > 0) {
  console.error("api-decimals : champs décimaux déclarés `number`.\n");
  for (const f of fautifs) console.error(`  ${f}`);
  console.error(
    "\nLe serveur envoie une CHAÎNE pour ces champs. Déclarez-les `string` et " +
      "coercez au point de calcul (`parseFloat`) ou d'affichage (`formatDecimal`) :\n" +
      "un type qui ment ne lève rien, il fait concaténer une addition."
  );
  process.exit(1);
}

console.log(
  `api-decimals : ${couverts} champs décimaux vérifiés sur ${appariees} interfaces ` +
    `appariées à leur serializer, aucun déclaré \`number\`.`
);
