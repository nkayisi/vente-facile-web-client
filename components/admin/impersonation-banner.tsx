"use client";

/**
 * Le bandeau d'une prise en main : qui l'on voit, combien de temps il reste, et
 * la sortie.
 *
 * Toujours visible, et rouge : un administrateur qui oublie qu'il regarde par
 * les yeux d'un marchand finit par croire que ses chiffres sont les siens.
 */
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Eye, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isImpersonationLive } from "@/actions/admin.actions";
import { usePriseEnMain } from "@/lib/auth/use-prise-en-main";

/**
 * ⚠ Un arrêt décidé AILLEURS (un super-administrateur, un rôle retiré, un compte
 * désactivé) ne se voit pas d'ici : sans cette question posée à intervalle,
 * l'administrateur garderait un bandeau qui annonce encore des minutes, devant
 * des écrans qui ne répondent plus.
 */
const VERIFICATION_MS = 30_000;

function restant(echeance: number, maintenant: number): string {
  const secondes = Math.max(0, Math.round((echeance - maintenant) / 1000));
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m} min ${s.toString().padStart(2, "0")} s`;
}

export function ImpersonationBanner() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const { impersonation, sortir, enCours } = usePriseEnMain();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const enVerification = useRef(false);

  useEffect(() => {
    if (!impersonation) return;
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(minuteur);
  }, [impersonation]);

  // L'échéance passée, on rend la main d'office : le jeton ne s'ouvre plus
  // rien, et rester sur l'écran donnerait des pages vides.
  useEffect(() => {
    if (impersonation && maintenant >= impersonation.expiresAt && !enCours) {
      void sortir();
    }
  }, [impersonation, maintenant, enCours, sortir]);

  useEffect(() => {
    if (!impersonation || !jeton) return;
    let annule = false;
    const minuteur = setInterval(async () => {
      if (enVerification.current) return;
      enVerification.current = true;
      try {
        // `null` n'est pas « coupé » : un réseau qui flanche ne rend pas la main.
        if ((await isImpersonationLive(jeton)) === false && !annule) {
          toast.error("La prise en main a été arrêtée.");
          void sortir();
        }
      } finally {
        enVerification.current = false;
      }
    }, VERIFICATION_MS);
    return () => {
      annule = true;
      clearInterval(minuteur);
    };
  }, [impersonation, jeton, sortir]);

  if (!impersonation) return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-2 bg-destructive px-4 py-2 text-sm text-white sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2">
        <Eye className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Prise en main <strong>en lecture seule</strong> : vous voyez l&apos;application comme{" "}
          <strong>{impersonation.targetName || impersonation.targetEmail}</strong>
          {impersonation.organizationName ? ` (${impersonation.organizationName})` : ""}. Reste{" "}
          {restant(impersonation.expiresAt, maintenant)}.
        </span>
      </p>
      <Button size="sm" variant="secondary" onClick={() => void sortir()} disabled={enCours} className="shrink-0">
        {enCours ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
        Revenir à l&apos;administration
      </Button>
    </div>
  );
}
