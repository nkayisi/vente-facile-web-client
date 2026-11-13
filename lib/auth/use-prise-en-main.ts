"use client";

/**
 * Entrer dans un compte marchand en lecture seule, et en sortir.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA SESSION EST UNE : ON NE PEUT PAS ÊTRE À LA FOIS ADMINISTRATEUR ET     │
 * │ MARCHAND DANS CE NAVIGATEUR.                                             │
 * │                                                                          │
 * │ Le cookie de session est partagé par tous les onglets. Pendant la prise  │
 * │ en main, l'administration est fermée - c'est voulu : deux identités dans │
 * │ deux onglets du même navigateur finissent toujours par se confondre.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ La navigation est COMPLÈTE (`window.location`), pas un `router.push` :
 * les contextes du back-office (organisation, permissions, devises) gardent
 * sinon des valeurs de l'autre identité.
 */
import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { endImpersonation, startImpersonation } from "@/actions/admin.actions";

export function usePriseEnMain() {
  const { data: session, update } = useSession();
  const [enCours, setEnCours] = useState(false);

  const entrer = useCallback(
    async (userId: string, organizationId: string, motif: string): Promise<string | null> => {
      const jeton = session?.accessToken;
      if (!jeton) return "Session introuvable.";
      setEnCours(true);
      try {
        const r = await startImpersonation(jeton, userId, organizationId, motif);
        if (!r.success || !r.data) return r.message || "Impossible de prendre la main.";
        const nouvelle = await update({ impersonation: r.data });
        if (!nouvelle?.impersonation) {
          // Le serveur a ouvert la session, le navigateur ne l'a pas rangée :
          // on la referme plutôt que de laisser un jeton vivant sans porteur.
          await endImpersonation(r.data.access);
          return "La prise en main n'a pas pu s'ouvrir dans ce navigateur.";
        }
        window.location.assign("/dashboard");
        return null;
      } finally {
        setEnCours(false);
      }
    },
    [session?.accessToken, update]
  );

  const sortir = useCallback(async () => {
    const orgId = session?.impersonation?.organizationId;
    setEnCours(true);
    try {
      if (session?.accessToken) await endImpersonation(session.accessToken);
      await update({ endImpersonation: true });
    } finally {
      setEnCours(false);
    }
    window.location.assign(orgId ? `/admin/organizations/${orgId}` : "/admin");
  }, [session?.accessToken, session?.impersonation?.organizationId, update]);

  return { entrer, sortir, enCours, impersonation: session?.impersonation };
}
