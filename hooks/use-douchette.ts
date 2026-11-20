"use client";

/**
 * Écouter une douchette sur toute la page du point de vente.
 *
 * La règle (qu'est-ce qu'un scan ?) vit dans `lib/pos/douchette.ts`, pure et
 * éprouvée ; ce hook ne fait que la brancher sur le clavier.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ON N'ÉCOUTE PAS DANS LES AUTRES CHAMPS.                                  │
 * │                                                                          │
 * │ Un scan pendant qu'on tape une quantité, un montant reçu ou un nom de    │
 * │ client y écrirait le code ; l'intercepter là volerait la saisie. On     │
 * │ écoute le reste de la page et le champ de recherche, où un code tapé    │
 * │ par la douchette est précisément ce qu'on cherche.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { useEffect, useRef } from "react";
import { DOUCHETTE_AU_REPOS, frapper } from "@/lib/pos/douchette";

function estUnChampDeSaisie(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false;
  if (cible.isContentEditable) return true;
  return cible.tagName === "INPUT" || cible.tagName === "TEXTAREA" || cible.tagName === "SELECT";
}

export function useDouchette({
  actif,
  champRecherche,
  onCode,
}: {
  /** Faux quand une boîte est ouverte (quantité, encaissement) : on n'y lit rien. */
  actif: boolean;
  /** Le champ de recherche du point de vente : le seul champ où l'on écoute. */
  champRecherche: React.RefObject<HTMLInputElement | null>;
  /**
   * `valeurDuChamp` : le code a été tapé DANS la recherche (il faut l'en
   * retirer), et voici ce que le champ portait à l'Entrée. `null` hors du
   * champ. Il sert de second candidat quand la rafale a perdu sa tête.
   */
  onCode: (code: string, valeurDuChamp: string | null) => void;
}) {
  const etat = useRef(DOUCHETTE_AU_REPOS);
  const actifRef = useRef(actif);
  const rappel = useRef(onCode);
  useEffect(() => {
    actifRef.current = actif;
    rappel.current = onCode;
  }, [actif, onCode]);

  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (!actifRef.current || evenement.ctrlKey || evenement.metaKey || evenement.altKey) {
        etat.current = DOUCHETTE_AU_REPOS;
        return;
      }
      const dansLaRecherche = evenement.target === champRecherche.current;
      if (estUnChampDeSaisie(evenement.target) && !dansLaRecherche) {
        etat.current = DOUCHETTE_AU_REPOS;
        return;
      }
      const r = frapper(etat.current, evenement.key, evenement.timeStamp);
      etat.current = r.etat;
      if (r.code) {
        // L'Entrée de la douchette ne doit rien valider d'autre.
        evenement.preventDefault();
        evenement.stopPropagation();
        rappel.current(r.code, dansLaRecherche ? (champRecherche.current?.value ?? "") : null);
      }
    };
    window.addEventListener("keydown", surTouche, true);
    return () => window.removeEventListener("keydown", surTouche, true);
  }, [champRecherche]);
}
