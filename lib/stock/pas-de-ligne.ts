/**
 * De combien avance une ligne de panier quand on presse « + » ou « − ».
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN PAS PLUS GRAND QUE LA VALEUR NE PEUT QUE VIDER LA LIGNE.              │
 * │                                                                          │
 * │ Les deux boutons avançaient de 1, et ils ne sont rendus QUE pour les     │
 * │ produits sans conditionnement : c'est-à-dire exactement ceux qui se      │
 * │ pèsent. Sur une ligne de 0,5 kg, « − » donnait donc -0,5, le contrôle    │
 * │ `newQty <= 0` passait, et la ligne DISPARAISSAIT. Le caissier qui        │
 * │ voulait retirer un peu de farine perdait son article.                    │
 * │                                                                          │
 * │ Sous l'unité, le pas devient donc le demi : « − » sur 0,5 vide bien la   │
 * │ ligne, ce qui est le geste attendu, et « − » sur 1,5 rend 0,5 au lieu    │
 * │ de vider.                                                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Miroir du raccourci de `QuantityPicker` : le demi ouvre sa rangée de valeurs
 * rapides pour la même raison.
 */
export function pasDeLigne(quantite: number): number {
  if (!Number.isFinite(quantite) || quantite <= 0) return 1;
  return quantite < 1 ? 0.5 : 1;
}
