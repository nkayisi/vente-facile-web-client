/**
 * Échéances de crédit.
 *
 * `Sale.due_date` existait depuis l'origine côté backend, exposé par l'API et
 * typé côté client, mais aucune surface ne le renseignait ni ne l'affichait :
 * il n'y avait aucune notion de retard dans l'application. Ces helpers donnent
 * une seule définition du « retard », partagée par toutes les surfaces.
 */

/** Date du jour, à minuit, pour comparer des jours et non des instants. */
function today(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function parseDueDate(dueDate: string): Date | null {
  // L'API renvoie une date nue (« 2026-09-30 »). L'interpréter en UTC puis
  // l'afficher en local décalerait d'un jour à l'ouest de Greenwich : on
  // construit donc la date en heure locale.
  const [year, month, day] = dueDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** Une facture est en retard le lendemain de son échéance, pas le jour même. */
export function isOverdue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  const due = parseDueDate(dueDate);
  return due !== null && due < today();
}

/** Jours de retard (négatif si l'échéance est encore devant). */
export function daysLate(dueDate?: string | null): number {
  if (!dueDate) return 0;
  const due = parseDueDate(dueDate);
  if (due === null) return 0;
  return Math.round((today().getTime() - due.getTime()) / 86_400_000);
}

/** Libellé court : « En retard de 5 j », « Échoit dans 3 j », « Échoit aujourd'hui ». */
export function dueDateLabel(dueDate?: string | null): string | null {
  if (!dueDate) return null;
  const late = daysLate(dueDate);
  if (late > 0) return `En retard de ${late} j`;
  if (late === 0) return "Échoit aujourd'hui";
  return `Échoit dans ${-late} j`;
}
