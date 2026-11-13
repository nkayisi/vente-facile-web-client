/**
 * Le layout des pages de paiement, côté SERVEUR : il lit le signal de
 * suspension, comme celui du tableau de bord (`app/dashboard/layout.tsx`).
 */
import { PaymentShell } from "@/components/layout/payment-shell";
import { lireSignalSuspension } from "@/lib/auth/suspension";

export default async function PaymentLayout({ children }: { children: React.ReactNode }) {
  return <PaymentShell signalSuspension={await lireSignalSuspension()}>{children}</PaymentShell>;
}
