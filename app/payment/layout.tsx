/**
 * Le layout des pages de paiement, côté SERVEUR : il lit les signaux de
 * suspension et de session coupée, comme celui du tableau de bord
 * (`app/dashboard/layout.tsx`).
 */
import { PaymentShell } from "@/components/layout/payment-shell";
import { lireSignalSessionFermee } from "@/lib/auth/session-fermee";
import { lireSignalSuspension } from "@/lib/auth/suspension";

export default async function PaymentLayout({ children }: { children: React.ReactNode }) {
  return (
    <PaymentShell
      signalSuspension={await lireSignalSuspension()}
      signalSessionFermee={await lireSignalSessionFermee()}
    >
      {children}
    </PaymentShell>
  );
}
