"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CircleCheck, CloudUpload, Loader2, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DEMO } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";
import { LigneRendue, TICKET_DEMO } from "./thermal-receipt";

/* ─────────────────────────────────────────────────────────────
   LA SIGNATURE DE LA PAGE

   Une boucle scriptée de 12 s qui RACONTE la promesse du titre au lieu de
   l'affirmer : deux articles entrent, le réseau tombe, la vente est encaissée,
   le ticket sort quand même, et tout remonte au retour du réseau.

   Cinq règles d'exécution, chacune pour une raison nommée :

   1. `IntersectionObserver` : la boucle ne démarre qu'à l'entrée dans le
      viewport. Un minuteur qui tourne sous un écran qu'on ne regarde pas est
      du travail pur perdu, sur un téléphone d'entrée de gamme.
   2. `visibilitychange` : pause quand l'onglet passe en arrière-plan.
   3. `prefers-reduced-motion` : rend l'état FINAL directement. AUCUN minuteur
      n'est créé. Le repli n'est pas « pas d'animation puis un saut », c'est
      l'élément déjà en place.
   4. UNE chaîne de `setTimeout`, un seul `clearTimeout` au démontage. Une
      grappe de minuteurs imbriqués laisse toujours un orphelin.
   5. `transform` et `opacity` seulement. La seule hauteur qui change est celle
      du papier, enfermée dans une boîte de hauteur RÉSERVÉE : la page ne
      bouge pas d'un pixel pendant l'impression.
───────────────────────────────────────────────────────────── */

type Etat = {
  panier: number;
  enLigne: boolean;
  presse: boolean;
  lignes: number;
  attente: number;
  tuile: number | null;
};

const REPOS: Etat = {
  panier: 0,
  enLigne: true,
  presse: false,
  lignes: 0,
  attente: 0,
  tuile: null,
};

const FINAL: Etat = {
  panier: 2,
  enLigne: true,
  presse: false,
  lignes: TICKET_DEMO.length,
  attente: 0,
  tuile: null,
};

const DEBUT_IMPRESSION = 5400;
const PAS_LIGNE = 180;
const DUREE_BOUCLE = 12400;

const ETAPES: { at: number; patch: Partial<Etat> }[] = [
  { at: 0, patch: REPOS },
  { at: 900, patch: { tuile: 0 } },
  { at: 1200, patch: { panier: 1, tuile: null } },
  { at: 2100, patch: { tuile: 1 } },
  { at: 2400, patch: { panier: 2, tuile: null } },
  { at: 3600, patch: { enLigne: false } },
  { at: 4800, patch: { presse: true } },
  { at: 5100, patch: { presse: false } },
  // Le ticket sort ligne à ligne, comme un vrai rouleau.
  ...TICKET_DEMO.map((_, i) => ({
    at: DEBUT_IMPRESSION + i * PAS_LIGNE,
    patch: { lignes: i + 1 },
  })),
  { at: 9000, patch: { attente: 1 } },
  { at: 10200, patch: { enLigne: true } },
  { at: 10900, patch: { attente: 0 } },
];

/** Délais précalculés une fois, au chargement du module. Le premier délai est
 *  celui du bouclage : de la dernière étape jusqu'à la remise à zéro. */
const SCRIPT = ETAPES.map((e, i) => ({
  patch: e.patch,
  delai: i === 0 ? DUREE_BOUCLE - ETAPES[ETAPES.length - 1].at : e.at - ETAPES[i - 1].at,
}));

export function CounterDemo() {
  const reduit = useReducedMotion();
  const [brut, setEtat] = useState<Etat>(REPOS);
  const [actif, setActif] = useState(false);
  const hote = useRef<HTMLDivElement>(null);

  // (1) et (2) : on ne joue que sous les yeux de quelqu'un.
  useEffect(() => {
    const el = hote.current;
    if (!el || reduit) return;

    let visible = false;
    let ongletActif = !document.hidden;
    const majuscule = () => setActif(visible && ongletActif);

    const obs = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        majuscule();
      },
      { threshold: 0.25 }
    );
    obs.observe(el);

    const onVisibilite = () => {
      ongletActif = !document.hidden;
      majuscule();
    };
    document.addEventListener("visibilitychange", onVisibilite);

    return () => {
      obs.disconnect();
      document.removeEventListener("visibilitychange", onVisibilite);
    };
  }, [reduit]);

  // (4) : une seule chaîne.
  useEffect(() => {
    if (reduit || !actif) return;

    let index = 0;
    let minuteur: ReturnType<typeof setTimeout>;

    const jouer = () => {
      const etape = SCRIPT[index];
      setEtat((e) => ({ ...e, ...etape.patch }));
      index = (index + 1) % SCRIPT.length;
      minuteur = setTimeout(jouer, SCRIPT[index].delai);
    };

    jouer();
    return () => clearTimeout(minuteur);
  }, [reduit, actif]);

  // (3) : en mouvement réduit, l'état final est DÉRIVÉ et non posé dans un
  // effet. Aucun minuteur n'est créé, aucun rendu en cascade n'est déclenché,
  // et l'élément est déjà en place au premier rendu.
  const etat = reduit ? FINAL : brut;
  const pastille = pastilleDe(etat);

  return (
    <div ref={hote} className="relative">
      {/* L'animation est décorative : elle ne doit pas polluer un lecteur
          d'écran. Mais son MESSAGE doit exister en texte. */}
      <p className="sr-only">{DEMO.resume}</p>

      {/* Le ticket CHEVAUCHE le terminal, il n'est pas posé dessous.
          Première version : 300 px de hauteur réservée sous le panneau, donc
          un vide de 300 px pendant les cinq premières secondes de chaque
          boucle ET au premier rendu. Une page qui s'ouvre sur un trou se lit
          comme une page qui n'a pas fini de charger. La hauteur reste
          RÉSERVÉE (rien ne bouge pendant l'impression), elle est simplement
          absorbée par le chevauchement. */}
      <div
        aria-hidden
        className="relative mx-auto min-h-[566px] w-full max-w-[340px] sm:min-h-[356px] sm:max-w-[34rem]"
      >
        {/* ── Le terminal ─────────────────────────────────────── */}
        <div className="relative z-10 w-full max-w-[340px] sm:max-w-[300px] rounded-[20px] border border-trait bg-white p-2 shadow-[0_1px_2px_rgba(28,24,21,0.04),0_24px_56px_-20px_rgba(28,24,21,0.28)]">
          {/* Rayons concentriques : 20 px de rayon extérieur, 8 px de marge,
              donc 12 px à l'intérieur. Des rayons égaux sur deux surfaces
              emboîtées est ce qui fait « presque juste » sans qu'on sache. */}
          <div className="overflow-hidden rounded-[12px] bg-paper">
            {/* Barre d'état */}
            <div className="flex items-center justify-between gap-3 border-b border-trait px-3.5 py-2.5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={pastille.cle}
                  initial={{ opacity: 0, scale: 0.94, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.98, filter: "blur(2px)" }}
                  transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[0.6875rem] font-medium",
                    pastille.classe
                  )}
                  style={{ fontFamily: "var(--font-mono-stack)" }}
                >
                  <pastille.Icone
                    className={cn("size-3", pastille.cle === "envoi" && "animate-spin")}
                  />
                  {pastille.texte}
                </motion.span>
              </AnimatePresence>
              <span className="t-data text-[0.6875rem] text-encre-ombre">
                {DEMO.tauxLigne}
              </span>
            </div>

            {/* Grille produits */}
            <div className="grid grid-cols-3 gap-1.5 p-3">
              {TUILES.map((t, i) => (
                <motion.div
                  key={t.code}
                  animate={{ scale: etat.tuile === i ? 0.96 : 1 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className={cn(
                    "flex h-[60px] flex-col justify-between rounded-lg border p-2 text-left transition-[background-color,border-color] duration-200",
                    etat.tuile === i
                      ? "border-braise bg-braise-voile"
                      : "border-trait bg-white"
                  )}
                >
                  <span className="t-data text-[0.5625rem] uppercase leading-tight text-encre-ombre">
                    {t.code}
                  </span>
                  <span className="text-[0.6875rem] font-medium leading-tight text-encre">
                    {t.nom}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Panier. La hauteur est RÉSERVÉE : deux lignes de 34 px, même
                vides, pour que l'arrivée d'un article ne pousse pas le total. */}
            <div className="px-3">
              <div className="flex items-baseline justify-between border-b border-trait pb-1.5">
                <span className="t-eyebrow text-[0.625rem] text-encre-ombre">Panier</span>
                <span className="t-data text-[0.6875rem] text-encre-faible">
                  {etat.panier} article{etat.panier > 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-[68px] py-1">
                {DEMO.articles.map((a, i) => (
                  <motion.div
                    key={a.code}
                    initial={false}
                    animate={{
                      opacity: etat.panier > i ? 1 : 0,
                      y: etat.panier > i ? 0 : -6,
                    }}
                    transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                    className="flex h-[30px] items-center justify-between gap-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[0.75rem] text-encre">
                      {a.nom}
                    </span>
                    <span className="t-data shrink-0 text-[0.6875rem] text-encre-ombre">
                      {a.detail}
                    </span>
                    <span className="t-data w-[52px] shrink-0 text-right text-[0.75rem] font-medium text-encre">
                      {a.total}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Totaux + encaissement */}
            <div className="border-t border-trait bg-white px-3.5 py-3">
              <div className="mb-2.5 flex items-end justify-between">
                <span className="t-eyebrow text-[0.625rem] text-encre-ombre">Total</span>
                <div className="text-right">
                  <div className="t-data text-[1.0625rem] font-semibold leading-tight text-encre">
                    {etat.panier === 0 ? "0 FC" : DEMO.totalCdf}
                  </div>
                  {/* Le second montant est une CONVERSION, jamais une somme :
                      il est plus petit et porte son « ≈ ». */}
                  <div className="t-data text-[0.6875rem] leading-tight text-encre-ombre">
                    ≈ {etat.panier === 0 ? "0,00 $" : DEMO.totalUsd}
                  </div>
                </div>
              </div>
              <motion.div
                animate={{ scale: etat.presse ? 0.96 : 1 }}
                transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                className={cn(
                  "flex h-9 items-center justify-center rounded-lg text-[0.8125rem] font-medium transition-colors duration-200",
                  etat.panier > 0
                    ? "bg-braise text-white"
                    : "bg-paper-creux text-encre-ombre"
                )}
              >
                Encaisser
              </motion.div>
            </div>
          </div>
        </div>

        {/* ── Le ticket ──────────────────────────────────────── */}
        {/* ⚠ PAS de `contain: paint` ici : la rotation du papier et son ombre
            peignent HORS de la boite du conteneur, et la containment les
            coupait net. Le ticket sortait alors invisible, seule sa
            perforation depassant. La reserve de hauteur est portee par le
            parent, et un element en position absolue ne pousse rien. */}
        <div className="pointer-events-none absolute right-0 top-[286px] z-20 sm:top-[72px]">
          <AnimatePresence>
            {etat.lignes > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                // Le SEUL rebond de la page. Une feuille éjectée porte une
                // inertie ; un menu qui apparaît n'en porte aucune.
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                className="origin-top -rotate-[1.4deg]"
              >
                <div className="perforation bg-white px-3 pb-4 pt-2.5 shadow-[0_2px_4px_rgba(28,24,21,0.06),0_18px_40px_-12px_rgba(28,24,21,0.34)]">
                  {/* Pas de largeur déclarée : chaque ligne fait EXACTEMENT
                      32 caractères (le filet en est 32 aussi) et `pre` les
                      rend sans les replier. La largeur du papier EST donc
                      celle de 32 colonnes, par construction. Une valeur en
                      `ch` s'en écartait d'une quinzaine de pixels et le
                      montant cessait d'affleurer le bord droit. */}
                  <div className="t-data w-max text-[0.65rem] leading-[1.42]">
                    {TICKET_DEMO.slice(0, etat.lignes).map((ligne, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.22 }}
                      >
                        <LigneRendue ligne={ligne} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const TUILES = [
  { code: "CASIER 24×", nom: "Boisson 24 cl" },
  { code: "PIÈCE", nom: "Savon de ménage" },
  { code: "SAC 25 KG", nom: "Riz parfumé" },
] as const;

/** L'ordre des tests compte : une vente en attente prime sur l'état du réseau,
 *  parce que c'est elle qui appelle une action. */
function pastilleDe(e: Etat) {
  if (e.attente > 0 && e.enLigne)
    return {
      cle: "envoi",
      texte: "Envoi en cours",
      Icone: Loader2,
      classe: "bg-braise-voile text-braise-texte",
    };
  if (e.attente > 0)
    return {
      cle: "attente",
      texte: DEMO.etats.enAttente,
      Icone: CloudUpload,
      classe: "bg-[#fdf3e7] text-ambre",
    };
  if (!e.enLigne)
    return {
      cle: "horsligne",
      texte: DEMO.etats.horsLigne,
      Icone: WifiOff,
      classe: "bg-[#fdf3e7] text-ambre",
    };
  return {
    cle: "synchro",
    texte: DEMO.etats.synchro,
    Icone: CircleCheck,
    classe: "bg-[#eaf6ee] text-vert",
  };
}
