/**
 * Assemblage de l'identité imprimée à partir des données de l'API.
 *
 * Deux sources distinctes que le reçu doit croiser : `Organization` porte le
 * logo, l'adresse et les mentions légales ; `OrganizationSettings` porte
 * l'en-tête, le pied et la largeur de papier. À quoi s'ajoute la caisse, qui
 * peut surcharger en-tête et pied : ces deux champs étaient réglables depuis la
 * page des caisses mais aucun générateur ne les lisait.
 */

import type { Organization } from "@/actions/organization.actions";
import type { OrganizationSettings } from "@/actions/settings.actions";
import { getMediaUrl } from "@/lib/format";
import type { LoadedLogo, OrgIdentity, ReceiptChrome } from "./identity";
import type { PaperWidth } from "./tokens";

export interface ChromeSources {
  organization: Pick<
    Organization,
    "name" | "logo" | "email" | "phone" | "address" | "city" | "country"
  > &
    Partial<Pick<Organization, "tax_id" | "rccm" | "id_nat">>;
  settings?: OrganizationSettings | null;
  /** En-tête et pied propres à la caisse, prioritaires sur ceux de l'org. */
  register?: { receipt_header?: string | null; receipt_footer?: string | null } | null;
  logo?: LoadedLogo | null;
}

export function buildOrgIdentity(sources: ChromeSources): OrgIdentity {
  const org = sources.organization;
  return {
    name: org.name || "Vente Facile",
    address: org.address || undefined,
    city: org.city || undefined,
    country: org.country || undefined,
    phone: org.phone || undefined,
    email: org.email || undefined,
    rccm: org.rccm || undefined,
    idNat: org.id_nat || undefined,
    taxId: org.tax_id || undefined,
    logo: sources.logo || undefined,
  };
}

export function buildChrome(sources: ChromeSources): ReceiptChrome {
  return {
    org: buildOrgIdentity(sources),
    header:
      sources.register?.receipt_header?.trim() ||
      sources.settings?.receipt_header ||
      undefined,
    footer:
      sources.register?.receipt_footer?.trim() ||
      sources.settings?.receipt_footer ||
      undefined,
  };
}

/** Largeur de papier réglée par l'organisation. Repli : 58 mm. */
export function paperWidthOf(settings?: OrganizationSettings | null): PaperWidth {
  return settings?.receipt_paper_width === 80 ? 80 : 58;
}

/** URL absolue du logo de l'organisation, prête pour `loadLogo`. */
export function logoUrlOf(
  organization: Pick<Organization, "logo"> | null | undefined
): string | undefined {
  return getMediaUrl(organization?.logo);
}
