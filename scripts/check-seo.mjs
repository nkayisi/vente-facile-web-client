#!/usr/bin/env node
/**
 * Le socle de référencement ne peut pas se défaire en silence.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ TOUS LES DÉFAUTS QUE CE BALAYAGE ATTRAPE SONT MUETS.                     │
 * │                                                                          │
 * │ Une page sans canonical propre hérite de celui de l'accueil et déclare à  │
 * │ Google « je suis un doublon » : elle s'affiche parfaitement et n'est      │
 * │ jamais indexée. Une page absente du registre n'entre pas au plan de site  │
 * │ ET se fait éjecter par le middleware sur un cookie périmé. Un chemin au   │
 * │ registre sans fichier est une URL déclarée à Google qui rend 404.         │
 * │                                                                          │
 * │ Aucun de ces trois défauts ne lève, n'apparaît au type-check, ni ne se    │
 * │ voit à l'écran. On les découvre dans Search Console, des mois plus tard.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Lancé par `pnpm check:seo`, à côté de `check:permissions` et
 * `check:server-actions`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE = process.cwd();
const REGISTRE = join(RACINE, "lib", "seo", "pages-publiques.ts");
const MIDDLEWARE = join(RACINE, "middleware.ts");
const GROUPE = join(RACINE, "app", "(marketing)");

/**
 * ⚠ LE PLANCHER N'EST PAS DÉCORATIF. Ce dépôt a payé quatre fois un balayage
 * qui ne balayait rien et passait au vert : `\bqueryset\b` qui ne mordait pas
 * sur `self.get_queryset()`, un `apps/apps/` qui n'existait pas, un motif
 * d'UUID complet là où le libellé était tronqué, `\buseMargesSysteme\b` qui
 * voyait l'import et pas l'appel. Un contrôle qui ne trouve rien doit ÉCHOUER.
 *
 * ⚠ TROIS, ET NON LE NOMBRE DE PAGES DU JOUR. Ce plancher détecte un motif de
 * lecture qui ne mord PLUS, pas un registre incomplet : le caler sur le compte
 * courant obligerait à le relever à chaque page ajoutée, et il finirait par être
 * abaissé pour faire passer le balayage. Le registre incomplet, lui, est déjà
 * couvert deux fois par les règles 1 et 2, qui se répondent dans les deux sens :
 * un motif qui ne lirait rien ferait déclarer TOUTES les pages absentes du
 * registre, donc échouer bruyamment.
 */
const PLANCHER_PAGES = 3;

const fautes = [];
const lire = (chemin) => readFileSync(chemin, "utf8");

/** Les chemins déclarés au registre, lus à la source. */
function cheminsDuRegistre() {
  const source = lire(REGISTRE);
  const trouves = [...source.matchAll(/^\s{4}chemin:\s*"([^"]+)"/gm)].map((m) => m[1]);

  if (trouves.length < PLANCHER_PAGES) {
    fautes.push(
      `lib/seo/pages-publiques.ts : ${trouves.length} chemin(s) reconnu(s), ` +
        `au moins ${PLANCHER_PAGES} attendus. Le motif de lecture ne mord plus, ` +
        `ou le registre a été vidé. Ce balayage ne prouve plus rien.`,
    );
  }

  return trouves;
}

/** Toute `page.tsx` du groupe marketing, avec le chemin d'URL qu'elle sert. */
function pagesDuGroupe() {
  const trouvees = [];

  const descendre = (dossier, segments) => {
    for (const entree of readdirSync(dossier)) {
      const complet = join(dossier, entree);

      if (statSync(complet).isDirectory()) {
        // Un groupe de routes entre parenthèses ne produit pas de segment.
        descendre(complet, entree.startsWith("(") ? segments : [...segments, entree]);
      } else if (entree === "page.tsx") {
        trouvees.push({
          fichier: complet,
          chemin: segments.length === 0 ? "/" : `/${segments.join("/")}`,
        });
      }
    }
  };

  descendre(GROUPE, []);
  return trouvees;
}

const registre = cheminsDuRegistre();
const pages = pagesDuGroupe();

// 1. Une page du groupe marketing absente du registre.
for (const page of pages) {
  if (!registre.includes(page.chemin)) {
    fautes.push(
      `${relative(RACINE, page.fichier)} sert « ${page.chemin} », absent du ` +
        `registre. Sans lui : aucune entrée au plan de site, et le middleware ` +
        `éjectera vers /auth/login tout visiteur au cookie périmé.`,
    );
  }
}

// 2. Un chemin du registre sans fichier de page.
const servis = new Set(pages.map((page) => page.chemin));
for (const chemin of registre) {
  if (!servis.has(chemin)) {
    fautes.push(
      `« ${chemin} » est au registre et au plan de site, mais aucune page ne le ` +
        `sert : l'URL serait déclarée à Google et rendrait 404.`,
    );
  }
}

// 3. Le middleware dérive-t-il encore sa liste du registre ?
const middleware = lire(MIDDLEWARE);
if (!/\.\.\.CHEMINS_PUBLICS/.test(middleware)) {
  fautes.push(
    `middleware.ts ne répand plus CHEMINS_PUBLICS dans PUBLIC_ROUTES. Une ` +
      `liste écrite à la main oubliera une page, et le défaut ne se voit qu'avec ` +
      `un cookie de session périmé, donc jamais en développement.`,
  );
}

/**
 * Le chemin passé à `metadonneesDePage()`, littéral ou par constante.
 *
 * ⚠ LES DEUX FORMES, ET C'EST LA LEÇON D'UNE PREMIÈRE VERSION FAUSSE. Elle
 * n'acceptait que le littéral et déclarait donc fautives trois pages
 * parfaitement correctes, dont le canonical servi était vérifié juste. Un
 * garde-fou qui crie sur du code juste finit désactivé, et on perd le contrôle
 * avec lui. Pire : il aurait poussé à écrire le chemin DEUX fois par page, ce
 * qui est la dérive qu'il existe pour empêcher.
 */
function cheminDeLAppel(source) {
  const appel = source.match(/metadonneesDePage\(\s*([^)]+?)\s*\)/);
  if (!appel) return null;

  const argument = appel[1];
  const litteral = argument.match(/^"([^"]+)"$/);
  if (litteral) return litteral[1];

  // Une constante : on la résout dans le même fichier.
  const constante = source.match(
    new RegExp(`const\\s+${argument}\\s*=\\s*"([^"]+)"`),
  );
  return constante ? constante[1] : null;
}

// 4. Chaque page passe-t-elle par le générateur, avec SON chemin ?
for (const page of pages) {
  const source = lire(page.fichier);
  const declare = cheminDeLAppel(source);

  if (!declare) {
    fautes.push(
      `${relative(RACINE, page.fichier)} n'appelle pas metadonneesDePage(). ` +
        `Elle hériterait alors du canonical de l'accueil et ne serait JAMAIS ` +
        `indexée, sans qu'aucune erreur ne le dise.`,
    );
  } else if (declare !== page.chemin) {
    fautes.push(
      `${relative(RACINE, page.fichier)} sert « ${page.chemin} » et déclare ` +
        `metadonneesDePage("${declare}") : son canonical désignerait une autre ` +
        `page, ce qui la retire de l'index aussi sûrement qu'un noindex.`,
    );
  }
}

// 5. Le contenu d'une page publique doit exister sans JavaScript.
for (const page of pages) {
  if (/^\s*["']use client["']/m.test(lire(page.fichier))) {
    fautes.push(
      `${relative(RACINE, page.fichier)} porte "use client". Le contenu d'une ` +
        `page indexable doit être rendu côté serveur ; les îles clientes se ` +
        `placent dans les composants, jamais sur la page.`,
    );
  }
}

if (fautes.length > 0) {
  console.error(`\n✗ Socle de référencement : ${fautes.length} faute(s).\n`);
  for (const faute of fautes) console.error(`  - ${faute}\n`);
  process.exit(1);
}

console.log(
  `✓ Socle de référencement : ${pages.length} page(s) publique(s), ` +
    `${registre.length} au registre, canonicals et middleware cohérents.`,
);
