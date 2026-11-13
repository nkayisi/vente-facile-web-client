/**
 * L'adresse du navigateur, attestée auprès de l'API.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ SANS CET EN-TÊTE, TOUT LE BACK-OFFICE A UNE SEULE ADRESSE : CELLE DE NEXT│
 * │                                                                          │
 * │ La connexion et les server actions appellent l'API depuis le serveur de │
 * │ Next. Le backend voyait donc la même adresse pour chaque marchand et     │
 * │ chaque administrateur : le journal d'audit ne disait rien, et la limite  │
 * │ de débit par adresse s'appliquait à toute la plateforme réunie.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Next transmet l'adresse dans `X-VF-Client-IP`, signée du secret partagé
 * `VF_EDGE_KEY` : le backend ne la croit que si la clé correspond
 * (`backend/apps/core/adresse.py`). Sans secret configuré, rien n'est envoyé et
 * le backend retombe sur ses propres règles.
 *
 * ⚠ Serveur seulement : `VF_EDGE_KEY` n'est PAS une variable `NEXT_PUBLIC_*`, et
 * ce module ne doit jamais être importé par un composant client.
 */
import { headers } from "next/headers";

type SourceDEnTetes = { get(nom: string): string | null };

/**
 * L'adresse du navigateur dans `x-forwarded-for`, lue depuis la DROITE.
 *
 * Next ajoute lui-même l'adresse de la socket quand l'en-tête manque ; derrière
 * N proxys de confiance, c'est l'entrée au rang -N. Les entrées plus à gauche,
 * le navigateur peut les écrire lui-même.
 */
export function adresseDuNavigateur(xff: string | null, proxys: number): string | null {
  if (!xff) return null;
  const chaine = xff.split(",").map((e) => e.trim()).filter(Boolean);
  if (chaine.length === 0) return null;
  const rang = Math.min(Math.max(1, proxys), chaine.length);
  return chaine[chaine.length - rang] ?? null;
}

function proxysDeConfiance(): number {
  const brut = process.env.VF_TRUSTED_PROXY_COUNT;
  const n = brut === undefined ? (process.env.NODE_ENV === "production" ? 1 : 0) : Number(brut);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Les en-têtes à joindre à un appel serveur vers l'API, ou `{}`.
 *
 * `source` : les en-têtes de la requête entrante quand on les a déjà (le
 * `request` d'`authorize`) ; sinon ceux de la requête en cours (`headers()`).
 * Hors d'une requête, `headers()` lève : on n'envoie alors rien plutôt que de
 * faire échouer l'appel.
 */
export async function enTetesDeBordure(source?: SourceDEnTetes): Promise<Record<string, string>> {
  const cle = process.env.VF_EDGE_KEY;
  if (!cle) return {};
  let entrants: SourceDEnTetes;
  try {
    entrants = source ?? (await headers());
  } catch {
    return {};
  }
  const ip = adresseDuNavigateur(entrants.get("x-forwarded-for"), proxysDeConfiance());
  if (!ip) return {};
  return { "X-VF-Client-IP": ip, "X-VF-Edge-Key": cle };
}
