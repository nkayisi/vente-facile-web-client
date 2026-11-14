/**
 * Le layout de l'administration, côté SERVEUR.
 *
 * ⚠ Sa seule raison d'être serveur : lire le signal d'une session coupée
 * (`lib/auth/session-fermee.ts`), comme ceux du tableau de bord et du paiement.
 * Le contenu client vit dans `AdminShell`.
 */
import { AdminShell } from "@/components/layout/admin-shell";
import { lireSignalSessionFermee } from "@/lib/auth/session-fermee";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell signalSessionFermee={await lireSignalSessionFermee()}>{children}</AdminShell>;
}
