"use client";

/**
 * Identité imprimée de l'organisation, prête pour la fabrique de tickets.
 *
 * Chaque page qui imprime devait jusqu'ici rassembler elle-même le nom, les
 * coordonnées, l'en-tête, le pied et la largeur de papier. Les copies avaient
 * divergé : les deux pages qui imprimaient un reçu de règlement ne passaient que
 * le nom de la boutique, et aucune ne lisait la largeur de papier réglée par le
 * marchand. Le logo et les mentions légales, eux, n'étaient lus nulle part.
 */

import { useEffect, useMemo, useState } from "react";
import type { Organization } from "@/actions/organization.actions";
import {
  getOrganizationSettings,
  type OrganizationSettings,
} from "@/actions/settings.actions";
import { buildChrome, logoUrlOf, paperWidthOf } from "@/lib/receipt/chrome";
import { loadLogo, type LoadedLogo, type ReceiptChrome } from "@/lib/receipt/identity";
import type { PaperWidth } from "@/lib/receipt/tokens";

export interface ReceiptChromeState {
  /** Nul tant que l'organisation n'est pas chargée. */
  chrome: ReceiptChrome | null;
  paperWidth: PaperWidth;
  settings: OrganizationSettings | null;
}

export function useReceiptChrome(
  accessToken: string | undefined,
  organization: Organization | null,
  /** Caisse courante : son en-tête et son pied priment sur ceux de l'org. */
  register?: { receipt_header?: string | null; receipt_footer?: string | null } | null
): ReceiptChromeState {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  /**
   * Les réglages ont été DEMANDÉS et la réponse est retombée, réussite ou échec.
   *
   * ┌──────────────────────────────────────────────────────────────────────────┐
   * │ LE PREMIER TICKET SORTAIT AVANT LES RÉGLAGES.                           │
   * │                                                                          │
   * │ `chrome` ne dépendait que de l'organisation : il était donc prêt bien    │
   * │ avant la réponse de `getOrganizationSettings`, et les écrans qui gardent │
   * │ sur `if (!chrome) return` imprimaient volontiers. Chez un marchand réglé │
   * │ en 80 mm, le premier reçu du matin sortait en 58, sans son en-tête - et  │
   * │ le suivant, identique, sortait juste. Rien ne le signalait.              │
   * │                                                                          │
   * │ Le drapeau est posé sur les DEUX issues : un réglage indisponible ne     │
   * │ doit pas empêcher d'imprimer, il doit seulement cesser d'être attendu.   │
   * └──────────────────────────────────────────────────────────────────────────┘
   */
  const [settledFor, setSettledFor] = useState<string | null>(null);
  const [logo, setLogo] = useState<LoadedLogo | null>(null);

  /**
   * Ce qu'il y a à demander. `null` = rien, donc rien à attendre.
   *
   * On retient l'ORGANISATION plutôt qu'un booléen : un drapeau se remettrait
   * à faux par un `setState` posé dans le corps de l'effet - ce que React
   * déconseille et que le lint refuse - et, surtout, il resterait à vrai en
   * changeant d'établissement, donc le premier ticket du suivant sortirait
   * avec les réglages du précédent.
   */
  const aCharger = accessToken && organization?.id ? organization.id : null;
  const settingsSettled = aCharger === null || settledFor === aCharger;

  useEffect(() => {
    if (!accessToken || !aCharger) return;
    let cancelled = false;

    getOrganizationSettings(accessToken, aCharger)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) setSettings(result.data);
        setSettledFor(aCharger);
      })
      .catch(() => {
        // Un réglage indisponible ne doit pas empêcher d'imprimer : le ticket
        // sortira en 58 mm, sans en-tête personnalisé.
        if (!cancelled) setSettledFor(aCharger);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, aCharger]);

  const logoUrl = useMemo(() => logoUrlOf(organization), [organization]);

  useEffect(() => {
    let cancelled = false;
    // Toujours passer par le chargeur, y compris sans URL : il rend `null`, ce
    // qui efface un logo retiré sans appeler `setState` pendant l'effet.
    loadLogo(logoUrl).then((loaded) => {
      if (!cancelled) setLogo(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  return useMemo(
    () => ({
      chrome:
        organization && settingsSettled
          ? buildChrome({ organization, settings, register, logo })
          : null,
      paperWidth: paperWidthOf(settings),
      settings,
    }),
    [organization, settings, settingsSettled, register, logo]
  );
}
