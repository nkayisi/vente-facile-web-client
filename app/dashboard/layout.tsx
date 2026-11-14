/**
 * Le layout du tableau de bord, côté SERVEUR.
 *
 * ⚠ Sa seule raison d'être serveur : lire les deux signaux qu'une server action
 * peut poser, la suspension (`lib/auth/suspension.ts`) et la session coupée
 * (`lib/auth/session-fermee.ts`). Quand une server action le pose, Next re-rend ce
 * layout dans le même aller-retour, et `OrganizationChecker` remplace tout le
 * tableau de bord par l'écran de suspension, au lieu que chaque écran reçoive
 * son propre refus. Le contenu client vit dans `DashboardShell`.
 */
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { lireSignalSessionFermee } from "@/lib/auth/session-fermee";
import { lireSignalSuspension } from "@/lib/auth/suspension";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      signalSuspension={await lireSignalSuspension()}
      signalSessionFermee={await lireSignalSessionFermee()}
    >
      {children}
    </DashboardShell>
  );
}
