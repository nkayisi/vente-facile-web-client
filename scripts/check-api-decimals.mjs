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
 * ⚠ LES CHAMPS HÉRITÉS SONT LUS AUSSI, DEPUIS LE MODÈLE. C'est l'extension qui
 * manquait, et son absence avait un coût mesuré : `quantity`, `quantity_counted`,
 * `quantity_expected` et `quantity_difference` sont tous hérités d'un
 * `ModelSerializer`, donc invisibles à ce balayage. `StockAdjustmentItem` les
 * déclarait `number` dans `actions/stock.actions.ts`, et la fiche d'ajustement
 * faisait `item.quantity_difference || 0` - or `"0.000" || 0` est TRUTHY, donc
 * ce garde-fou ne gardait rien : l'écart s'affichait « -0.500 » et restait une
 * CHAÎNE dans `diff * item.unit_cost`.
 *
 * Portée, et elle est assumée :
 *   - un champ hérité n'est retenu que si `Meta.fields` l'énumère. Un
 *     `fields = '__all__'` n'est pas déplié : on préfère taire un champ que
 *     d'en inventer un ;
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
 *
 * Mesuré à 62 champs le jour de l'écriture, puis à 143 sur 40 interfaces quand
 * les champs HÉRITÉS d'un `ModelSerializer` sont entrés dans le contrôle, puis
 * à 232 sur 64 quand les serializers de LECTURE (`XxxList`, `XxxDetail`) ont
 * été appariés à l'interface `Xxx`. La marge couvre les renommages d'interfaces, pas l'effondrement
 * d'un parseur : si ce nombre s'effondre, c'est qu'une des deux passes a cessé
 * de lire, et un vert ne voudrait plus rien dire.
 */
const PLANCHER = 180;

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

/**
 * `products.Product` -> Set des champs `DecimalField` du MODÈLE.
 *
 * Un `ModelSerializer` les expose sans les redéclarer, et DRF les sérialise en
 * chaîne comme les autres. Sans cette lecture, les champs les plus risqués du
 * projet - les quantités - échappaient entièrement au contrôle.
 */
const modeles = new Map();

for (const app of readdirSync(APPS)) {
  const fichier = join(APPS, app, "models.py");
  if (!existsSync(fichier)) continue;

  const lignes = readFileSync(fichier, "utf8").split("\n");
  let classe = null;

  for (const ligne of lignes) {
    if (/^\S/.test(ligne)) {
      const m = /^class (\w+)\s*\(/.exec(ligne);
      classe = m ? m[1] : null;
      continue;
    }
    if (!classe) continue;
    const champ = /^ {4}(\w+)\s*=\s*models\.DecimalField\s*\(/.exec(ligne);
    if (!champ) continue;
    if (!modeles.has(classe)) modeles.set(classe, new Set());
    modeles.get(classe).add(champ[1]);
  }
}

if (modeles.size === 0) sortirSansAvoirLu("aucun modèle lu dans backend/apps");

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

  // Seconde passe : les champs HÉRITÉS d'un `ModelSerializer`.
  //
  // On ne retient que ce que `Meta.fields` énumère. Un `'__all__'` n'est pas
  // déplié : le modèle porte des colonnes que le serializer n'expose pas, et
  // en inventer serait pire que d'en taire.
  const source = readFileSync(fichier, "utf8");
  const CLASSE = /^class (\w+)Serializer\s*\([^)]*\)\s*:/gm;
  let m;
  while ((m = CLASSE.exec(source)) !== null) {
    const suivant = source.indexOf("\nclass ", m.index + 1);
    const corps = source.slice(m.index, suivant === -1 ? undefined : suivant);

    const modele = /^\s{8}model\s*=\s*(\w+)/m.exec(corps);
    if (!modele) continue;
    const champsModele = modeles.get(modele[1]);
    if (!champsModele) continue;

    const liste = /^\s{8}fields\s*=\s*[\[(]([\s\S]*?)[\])]/m.exec(corps);
    if (!liste) continue;

    const exposes = new Set(
      [...liste[1].matchAll(/['"](\w+)['"]/g)].map((x) => x[1])
    );

    // ⚠ UNE REDÉCLARATION PRIME SUR L'HÉRITAGE, et on ne présume pas de ce
    // qu'elle fait. Les points de fidélité passent par `points_field()`, qui
    // pose `coerce_to_string=False` sous une docstring qui dit pourquoi : les
    // signaler reviendrait à demander de casser un choix documenté, et un
    // garde-fou qui crie sur du code sain finit désactivé. Une redéclaration
    // en `serializers.DecimalField(...)` sans ce drapeau est, elle, déjà
    // signalée par la première passe.
    const redeclares = new Set(
      [...corps.matchAll(/^\s{4}(\w+)\s*=\s*\S/gm)].map((x) => x[1])
    );

    for (const champ of champsModele) {
      if (!exposes.has(champ) || redeclares.has(champ)) continue;
      if (!serializers.has(m[1])) serializers.set(m[1], new Set());
      serializers.get(m[1]).add(champ);
    }
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

/**
 * `ProductListSerializer` décrit l'interface `Product`.
 *
 * ⚠ SEULS LES SUFFIXES DE LECTURE, et c'est ce qui garde l'appariement sûr.
 * `ProductCreateSerializer` décrit un PAYLOAD, où DRF coerce très bien un
 * `number` en entrée : l'y apparier ramènerait les dix-neuf faux positifs que
 * l'appariement par nom exact avait écartés. `List` et `Detail` ne servent,
 * eux, qu'à lire.
 *
 * Sans cette passe, `Product.min_stock_level` restait déclaré `number` alors
 * que le serveur venait de le passer en `DecimalField` - c'est-à-dire
 * exactement le mensonge que ce script existe pour attraper.
 */
const SUFFIXES_DE_LECTURE = ["List", "Detail"];

function nomsCandidats(nom) {
  const candidats = [nom];
  for (const suffixe of SUFFIXES_DE_LECTURE) {
    if (nom.endsWith(suffixe) && nom.length > suffixe.length) {
      candidats.push(nom.slice(0, -suffixe.length));
    }
  }
  return candidats;
}

for (const [nom, champsServeur] of serializers) {
  const retenu = nomsCandidats(nom).find((n) => interfaces.has(n));
  const champsTs = retenu ? interfaces.get(retenu) : null;
  if (!champsTs) continue;
  appariees++;

  for (const { champ, type, fichier, ligne } of champsTs) {
    if (!champsServeur.has(champ)) continue;
    couverts++;
    if (TYPE_FAUTIF.test(type)) {
      fautifs.push(`actions/${fichier}:${ligne}  ${retenu}.${champ} : ${type}  (${nom}Serializer)`);
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
