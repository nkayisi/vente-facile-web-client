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
  const [logo, setLogo] = useState<LoadedLogo | null>(null);

  useEffect(() => {
    if (!accessToken || !organization?.id) return;
    let cancelled = false;

    getOrganizationSettings(accessToken, organization.id)
      .then((result) => {
        if (!cancelled && result.success && result.data) setSettings(result.data);
      })
      .catch(() => {
        // Un réglage indisponible ne doit pas empêcher d'imprimer : le ticket
        // sortira en 58 mm, sans en-tête personnalisé.
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, organization?.id]);

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
      chrome: organization
        ? buildChrome({ organization, settings, register, logo })
        : null,
      paperWidth: paperWidthOf(settings),
      settings,
    }),
    [organization, settings, register, logo]
  );
}
