/**
 * Ce que l'écran Équipe montre et propose, selon QUI le regarde.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN GÉRANT GÈRE SES ENTREPÔTS, PAS L'ÉTABLISSEMENT.                      │
 * │                                                                          │
 * │ Il ne voit que les membres qui partagent un de ses entrepôts (plus le    │
 * │ propriétaire), n'affecte que dans ses entrepôts ACTIFS, et n'accorde que │
 * │ les permissions qu'il possède lui-même - jamais celles réservées au      │
 * │ propriétaire (créer, supprimer un entrepôt). Le serveur refuse le reste ; │
 * │ l'écran ne le propose donc pas, plutôt que de laisser cocher puis        │
 * │ refuser.                                                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ Ce module n'est PAS l'autorité : le serveur refuse ce qui dépasse
 * (`refuser_permissions_hors_portee`, l'affectation bornée). Il évite seulement
 * de proposer un geste qu'on sait refusé.
 */
import {
  entrepotsActionnables,
  PERMISSION_VOIR_TOUT,
  type MembrePerimetre,
} from "@vente-facile/core";

import { estActif } from "@/lib/stock/entrepots";

/** Miroir de `PERMISSIONS_RESERVEES_PROPRIETAIRE` (`apps/core/services.py`). */
export const PERMISSIONS_RESERVEES_PROPRIETAIRE: ReadonlySet<string> = new Set([
  "warehouses.create",
  "warehouses.delete",
]);

interface MembreListe {
  role: string;
  assigned_warehouses?: { id: string }[];
}

/**
 * Les membres que le demandeur voit et gère.
 *
 * Le propriétaire voit tout le monde. Un gérant voit le propriétaire et ceux
 * qui partagent au moins un de ses entrepôts (lui compris). Un membre sans
 * entrepôt n'est visible que du propriétaire : c'est lui qui doit l'affecter.
 */
export function membresVisibles<M extends MembreListe>(demandeur: MembrePerimetre, membres: readonly M[]): M[] {
  if (demandeur.role !== "manager") return [...membres];
  const siens = new Set(demandeur.affectes.map((e) => e.id));
  return membres.filter(
    (m) => m.role === "owner" || (m.assigned_warehouses ?? []).some((e) => siens.has(e.id)),
  );
}

/**
 * Les permissions additionnelles que le demandeur peut COCHER sur un membre.
 *
 * ⚠ Une permission déjà accordée à la cible (par le propriétaire) reste
 * proposée : le gérant doit pouvoir la décocher, et le serveur ne contrôle que
 * les AJOUTS.
 */
export function permissionsAccordables(
  demandeur: { role: string | null; permissions: readonly string[] },
  candidates: readonly string[],
  dejaAccordees: readonly string[],
): string[] {
  const deja = new Set(dejaAccordees);
  const possedees = new Set(demandeur.permissions);
  return candidates.filter((p) => {
    if (deja.has(p)) return true;
    if (PERMISSIONS_RESERVEES_PROPRIETAIRE.has(p)) return false;
    return demandeur.role === "owner" || possedees.has(p);
  });
}

/**
 * La case « Voir tout » d'un caissier : voir le travail de ses collègues
 * (ventes, dépenses, caisse, retours, devis), dans SES entrepôts.
 *
 * Le gérant et le magasinier l'ont par leur rôle ; seul le caissier en a
 * l'usage. C'est `sales.view_all`, et rien d'autre.
 */
export function caseVoirToutUtile(role: string): boolean {
  return role === "cashier";
}

export function voitLeTravailDesCollegues(effectives: readonly string[] | undefined): boolean {
  return (effectives ?? []).includes(PERMISSION_VOIR_TOUT);
}

/** Les permissions additionnelles, avec ou sans « Voir tout ». */
export function basculerVoirTout(extras: readonly string[], actif: boolean): string[] {
  const sans = extras.filter((p) => p !== PERMISSION_VOIR_TOUT);
  return actif ? [...sans, PERMISSION_VOIR_TOUT] : sans;
}

/** Une case de la liste d'affectation. */
export interface CaseAffectation {
  id: string;
  name: string;
  code?: string;
  actif: boolean;
  coche: boolean;
  desactivee: boolean;
  /** Pourquoi la case est fermée, `null` quand elle est ouverte. */
  motif: string | null;
}

interface EntrepotAffectable {
  id: string;
  name: string;
  code?: string;
  is_active?: boolean;
}

/**
 * Les entrepôts à proposer pour l'affectation d'un membre.
 *
 * - On COCHE un entrepôt où le demandeur agit (actif, et le sien s'il est
 *   gérant) : un entrepôt inactif ne s'affecte pas.
 * - On DÉCOCHE ce qu'on pourrait cocher, plus un entrepôt inactif de son propre
 *   périmètre : retirer une affectation morte est sain.
 * - Une affectation hors du périmètre du demandeur reste AFFICHÉE et fermée :
 *   la cacher la ferait disparaître à l'enregistrement, et le serveur la
 *   refuserait.
 *
 * @param lisibles La liste de lecture du demandeur (inactifs compris).
 * @param actuels  Les affectations actuelles du membre (vides à la création).
 * @param selection Ce qui est coché à l'écran.
 */
export function casesAffectation(
  demandeur: MembrePerimetre,
  lisibles: readonly EntrepotAffectable[],
  actuels: readonly EntrepotAffectable[],
  selection: readonly string[],
): CaseAffectation[] {
  const coches = new Set(selection);
  const affectables = new Set(entrepotsActionnables(demandeur, lisibles).map((e) => e.id));
  const siens = new Set(demandeur.affectes.map((e) => e.id));
  const proprietaire = demandeur.role === "owner";
  const dansSonPerimetre = (id: string) => proprietaire || siens.has(id);

  const parId = new Map<string, EntrepotAffectable>();
  for (const e of lisibles) parId.set(e.id, e);
  for (const e of actuels) if (!parId.has(e.id)) parId.set(e.id, e);

  const cases: CaseAffectation[] = [];
  for (const e of parId.values()) {
    const actif = estActif(e);
    const coche = coches.has(e.id);
    const affectable = affectables.has(e.id);
    const montre = affectable || coche || (!actif && dansSonPerimetre(e.id));
    if (!montre) continue;

    let motif: string | null = null;
    if (!affectable) {
      if (!dansSonPerimetre(e.id)) motif = "Hors de votre périmètre";
      else if (!actif) motif = "Inactif : ne s'affecte pas";
    }
    // Retirer reste permis dans son propre périmètre, même sur un inactif.
    const desactivee = !affectable && !(coche && dansSonPerimetre(e.id));
    cases.push({ id: e.id, name: e.name, code: e.code, actif, coche, desactivee, motif });
  }
  return cases.sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}
