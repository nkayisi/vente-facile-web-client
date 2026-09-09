/**
 * Les tranches d'ancienneté du rapport de créances.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE MODULE EXISTE PARCE QU'UN FICHIER `"use server"` N'EXPORTE QUE DES    │
 * │ FONCTIONS ASYNCHRONES.                                                   │
 * │                                                                          │
 * │ `AGING_BUCKET_LABELS` vivait dans `actions/reports.actions.ts`, dont la  │
 * │ première ligne est `"use server"`. Next y interdit tout export qui n'est │
 * │ pas une fonction async - chaque export d'un tel fichier devient un point │
 * │ d'entrée RPC, et un objet n'en est pas un. D'où, au chargement du        │
 * │ tableau de bord :                                                        │
 * │                                                                          │
 * │   A "use server" file can only export async functions, found object.     │
 * │                                                                          │
 * │ L'erreur remonte dans `organization-checker`, c'est-à-dire à la GARDE    │
 * │ qui enveloppe tout `/dashboard` : le module fautif est tiré par le       │
 * │ graphe d'imports bien avant qu'on ouvre la page des créances, si bien    │
 * │ que le message ne désigne ni le fichier ni la page en cause.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les libellés sont ceux du serveur (`StatisticsViewSet.receivables`), et le
 * terminal en tient une copie (`LIBELLES_TRANCHES`) : les trois surfaces
 * doivent nommer une créance de quarante jours de la même façon.
 */

/** Dans l'ordre d'affichage, celui que le serveur annonce dans `buckets`. */
export type AgingBucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Pas encore échu",
  d1_30: "1 à 30 j",
  d31_60: "31 à 60 j",
  d61_90: "61 à 90 j",
  d90_plus: "Plus de 90 j",
};
