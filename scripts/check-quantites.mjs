#!/usr/bin/env node
/**
 * Une quantité sous l'unité n'est une exception nulle part.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE DÉFAUT NE LÈVE RIEN, ET `tsc` RESTE VERT.                            │
 * │                                                                          │
 * │ Les quantités se vendent au POIDS : tout champ de quantité du serveur   │
 * │ est un `DecimalField(max_digits=15, decimal_places=3)`, et le minimum    │
 * │ enregistrable est 0,001. Trois formes d'écriture trahissent cette règle  │
 * │ sans qu'aucun outil ne le voie :                                         │
 * │                                                                          │
 * │  1. un seuil au littéral 1. Le caissier tapait 0,5 pour un demi-kilo    │
 * │     de farine, et le bouton « Ajouter au panier » restait GRIS, sans    │
 * │     un mot ;                                                             │
 * │  2. une somme de quantités non quantisée. `0,1 + 0,2` rend              │
 * │     `0.30000000000000004` : le contrôle de stock refuse alors sur un    │
 * │     rayon de 0,3 qui couvrait la demande, et le serveur répond 400 sur  │
 * │     un champ borné à trois décimales, ticket déjà imprimé ;             │
 * │  3. un formateur d'ENTIERS sur une quantité. `formatNumber(0.5)` rend   │
 * │     « 1 » et `formatNumber(0.3)` rend « 0 », sous les yeux du caissier. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LE REMÈDE DE LA RÈGLE 3 EST GRATUIT, et c'est ce qui rend ce balayage
 * tenable. `formatQuantity(12)` et `formatNumber(12)` rendent tous deux
 * « 12 » : les deux formateurs ne diffèrent QUE sur une valeur fractionnaire.
 * Un faux positif se corrige donc en changeant un nom de fonction, sans
 * changer un pixel. Un garde-fou qui crie sur du code sain finit désactivé,
 * et on perd le contrôle avec lui.
 *
 * ⚠ LA RÈGLE 4 RAISONNE PAR ADJACENCE, jamais sur le nom de la valeur. Elle
 * constate qu'un nombre est collé à une unité accordée, ce qu'aucun comptage
 * d'objets ne fait : un `pluralizeUnit(retailWord, 2)` posé seul dans un
 * libellé de champ est parfaitement légitime et n'est pas signalé.
 *
 * Portée, et elle est assumée :
 *   - la règle 4 ne voit PAS les enveloppes du type
 *     `const mot = (n) => pluralizeUnit(l.unite ?? "unité", n)`, où rien ne
 *     relie textuellement le mot au nombre. C'est le même aveu que le
 *     garde-fou mobile formule pour la devise typée : prétendre le contraire
 *     produirait soit du bruit, soit un faux sentiment de couverture ;
 *   - les commentaires sont BLANCHIS avant lecture, sans quoi ce fichier
 *     signalerait sa propre prose ;
 *   - l'arbre mobile a SON garde-fou, dans `src/ui/doctrine.test.ts`. Le
 *     mobile tourne sur jest, le web sur `pnpm check:*`, et aucun des deux ne
 *     lance l'autre : chaque arbre est couvert par exactement un balayage, et
 *     le risque résiduel est que l'un devienne plus faible que l'autre.
 *
 * Lancé par `pnpm check:quantites`, à côté de `check:api-decimals`.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE = process.cwd();
const ARBRES = [
  join(RACINE, "app"),
  join(RACINE, "components"),
  join(RACINE, "lib"),
  join(RACINE, "actions"),
  join(RACINE, "..", "core", "src"),
];

/**
 * Sous ce plancher, le balayage n'a rien balayé et son vert ne vaut rien.
 * Mesuré le jour de l'écriture ; la marge couvre un déplacement de dossier,
 * pas l'effondrement d'un parseur.
 */
const PLANCHER_FICHIERS = 150;

const IGNORES = new Set([
  "node_modules",
  ".next",
  ".pnpm-store",
  ".playwright-cli",
  "dist",
  "scripts",
]);

function sortirSansAvoirLu(quoi) {
  console.error(
    `quantites : ${quoi}\n` +
      "Un contrôle muet est pire qu'aucun contrôle : il passe au vert sans rien avoir lu."
  );
  process.exit(2);
}

/** Les sources d'un arbre, hors dossiers de construction. */
function fichiers(racine) {
  if (!existsSync(racine)) return [];
  const sortie = [];
  const pile = [racine];
  while (pile.length > 0) {
    const dossier = pile.pop();
    for (const entree of readdirSync(dossier)) {
      if (IGNORES.has(entree)) continue;
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) pile.push(chemin);
      else if (/\.(ts|tsx)$/.test(entree) && !/\.test\.tsx?$/.test(entree)) sortie.push(chemin);
    }
  }
  return sortie;
}

/**
 * Remplace le contenu des commentaires par des espaces.
 *
 * Les sauts de ligne sont PRÉSERVÉS : le numéro de ligne reste juste, donc le
 * chemin signalé reste cliquable. Sans ce blanchiment, ce fichier et les
 * encadrés qui expliquent les correctifs se signaleraient eux-mêmes.
 */
function blanchirCommentaires(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, avant) => avant + " ".repeat(m.length - avant.length));
}

/** Noms sans ambiguïté. `total` en est ABSENT : il désigne un montant aussi souvent. */
const NOM_QUANTITE =
  "quantity|quantite|qty|newQty|nextQuantity|base|loose|vrac|packages|packageQuantity|contenants|scelles|counted|compte|stockQty|maxBase";

const REGLES = [
  {
    nom: "une quantité comparée au littéral 1",
    motif: new RegExp(`\\b(?:${NOM_QUANTITE})\\b\\s*(?:<=|>=|<|>)\\s*1\\b(?![\\d.])`, "g"),
    /**
     * ⚠ UNE TERNAIRE N'EST PAS UN SEUIL, C'EST UN ACCORD.
     *
     * `packages > 1 ? "scellés" : "scellé"` choisit un mot ; il ne décide
     * d'aucun refus. Sans cette exemption, le balayage criait sur quatre
     * accords de pluriel pour un seul vrai défaut, et un garde-fou qui crie
     * sur du code sain finit désactivé.
     *
     * Le prix est écrit : un seuil de validité rédigé en ternaire échapperait.
     * C'est rare, et moins coûteux qu'un balayage que personne ne lance.
     */
    exempte: (ligne, _c, apres) => /^\s*\?/.test(apres),
    remede:
      "Le seuil d'une quantité est `MIN_QUANTITY` (0,001), celui du serveur.\n" +
      "  Un seuil à 1 refuse un demi-kilo que le serveur accepte, et il le refuse en silence.",
  },
  {
    nom: "une somme de quantités non quantisée",
    motif: /\*\s*(?:factor|facteur)\s*\+/g,
    exempte: (ligne) => /roundQuantity|toBaseQuantity/.test(ligne),
    remede:
      "Enveloppez la somme dans `roundQuantity(...)`, comme `verifierAjout` le fait.\n" +
      "  En flottant, `2 * 12 + 0,3` peut sortir à `24.299999999999997` : le serveur,\n" +
      "  lui, travaille en `Decimal`, et l'écart se voit sur un ticket déjà remis.",
  },
  {
    nom: "un formateur d'ENTIERS sur une quantité",
    // ⚠ SANS FRONTIÈRE DE MOT EN TÊTE, et insensible à la casse : la casse
    // chameau n'en offre pas. `formatNumber(totalQuantity)` échappait à un
    // `\\bquantity\\b`, et c'était un vrai défaut (« Unités au total » de
    // l'écran Stock, qui rendait « 1 » pour un demi-kilo).
    motif: new RegExp(
      `\\bformatNumber\\s*\\(\\s*[^;]{0,80}?(?:${NOM_QUANTITE}|stock_loose|stock_quantity|units_sold|quantity_sold)` +
        `|\\bformatNumberFr\\s*\\(\\s*[^,;]{0,60}?(?:${NOM_QUANTITE})[^,;]{0,20},\\s*0\\s*\\)`,
      "gi"
    ),
    remede:
      "Employez `formatQuantity` (écran) ou `receipt.formatQuantityWithUnit` (papier).\n" +
      "  `formatNumber` rend « 1 » pour 0,5 et « 0 » pour 0,3 : son contrat est d'être\n" +
      "  un formateur d'entiers, et il est juste. Ce sont ses appelants qui mentent.",
  },
  {
    nom: "un nombre brut collé à une unité accordée",
    // Les deux écritures : interpolation de gabarit, et JSX.
    motif: /(?:\$\{([^{}]+)\}\s*\$\{\s*pluralizeUnit|\{([^{}]+)\}\s*\{\s*pluralizeUnit)/g,
    exempte: (_ligne, capture) =>
      /format(?:Quantity|UnitQuantity|Decimal|NumberFr|Packaged)/.test(capture ?? ""),
    remede:
      "Employez `formatUnitQuantity(valeur, mot)`, le seul endroit où une quantité\n" +
      "  se colle à son unité. Interpolé brut, un demi sort « 0.5 » au point anglais,\n" +
      "  et une part vrac dérivée sort « 0.3000000000000007 ».",
  },
];

let lus = 0;
const fautifs = [];

for (const arbre of ARBRES) {
  for (const chemin of fichiers(arbre)) {
    lus++;
    const source = blanchirCommentaires(readFileSync(chemin, "utf8"));
    const lignes = source.split("\n");

    for (const regle of REGLES) {
      regle.motif.lastIndex = 0;
      let m;
      while ((m = regle.motif.exec(source)) !== null) {
        const ligne = source.slice(0, m.index).split("\n").length;
        const texte = lignes[ligne - 1] ?? "";
        const capture = m[1] ?? m[2];
        const apres = source.slice(m.index + m[0].length, m.index + m[0].length + 8);
        if (regle.exempte?.(texte, capture, apres)) continue;
        fautifs.push({
          regle: regle.nom,
          remede: regle.remede,
          ou: `${relative(join(RACINE, ".."), chemin)}:${ligne}`,
          extrait: texte.trim().slice(0, 110),
        });
      }
    }
  }
}

if (lus < PLANCHER_FICHIERS) {
  sortirSansAvoirLu(`seulement ${lus} fichiers lus (plancher ${PLANCHER_FICHIERS})`);
}

if (fautifs.length > 0) {
  const parRegle = new Map();
  for (const f of fautifs) {
    if (!parRegle.has(f.regle)) parRegle.set(f.regle, { remede: f.remede, sites: [] });
    parRegle.get(f.regle).sites.push(f);
  }
  console.error(`quantites : ${fautifs.length} site(s) où une quantité sous 1 se perd.\n`);
  for (const [regle, { remede, sites }] of parRegle) {
    console.error(`  ${regle} (${sites.length}) :`);
    for (const s of sites) console.error(`    ${s.ou}\n      ${s.extrait}`);
    console.error(`  ${remede}\n`);
  }
  process.exit(1);
}

console.log(
  `quantites : ${lus} fichiers lus, ${REGLES.length} règles, ` +
    "aucune quantité sous l'unité perdue en route."
);
