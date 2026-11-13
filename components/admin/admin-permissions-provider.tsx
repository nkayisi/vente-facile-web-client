"use client";

/**
 * Le rôle de l'administrateur connecté, et ce qu'il peut faire.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ `hasPlatformPermission` N'EST PAS `hasPermission`, ET LES DEUX NE SE     │
 * │ MÊLENT JAMAIS.                                                           │
 * │                                                                          │
 * │ Le second dit ce qu'un membre fait DANS son organisation ; celui-ci, ce  │
 * │ qu'un administrateur de l'éditeur fait SUR toutes. Un même mot y désigne │
 * │ deux choses : `users.view` du marchand lit son équipe, celui de la       │
 * │ plateforme lit tous les comptes. `pnpm check:permissions` vérifie chaque │
 * │ fonction contre SON catalogue.                                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ Le rôle vient de `/platform-admin/me/`, jamais du jeton : un rôle figé dans
 * le JWT survivrait sept jours à une rétrogradation.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { getAdminMe, type AdminMe } from "@/actions/admin.actions";

type Etat =
  | { kind: "chargement" }
  | { kind: "pret"; me: AdminMe }
  /** 403 : le compte n'a pas de rôle (un `is_staff` posé à la main, ou révoqué). */
  | { kind: "sans_role" }
  | { kind: "erreur"; message: string };

interface ContexteAdmin {
  etat: Etat;
  me: AdminMe | null;
  hasPlatformPermission: (code: string) => boolean;
  isSuperAdmin: boolean;
  recharger: () => void;
}

const Contexte = createContext<ContexteAdmin>({
  etat: { kind: "chargement" },
  me: null,
  hasPlatformPermission: () => false,
  isSuperAdmin: false,
  recharger: () => {},
});

export function AdminPermissionsProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const [etat, setEtat] = useState<Etat>({ kind: "chargement" });
  const [tour, setTour] = useState(0);

  useEffect(() => {
    if (!jeton) return;
    let annule = false;
    (async () => {
      const r = await getAdminMe(jeton);
      if (annule) return;
      if (r.success && r.data) setEtat({ kind: "pret", me: r.data });
      else if (r.status === 403) setEtat({ kind: "sans_role" });
      else setEtat({ kind: "erreur", message: r.message || "Profil indisponible" });
    })();
    return () => {
      annule = true;
    };
  }, [jeton, tour]);

  const recharger = useCallback(() => setTour((t) => t + 1), []);

  const valeur = useMemo<ContexteAdmin>(() => {
    const me = etat.kind === "pret" ? etat.me : null;
    const codes = new Set(me?.permissions ?? []);
    return {
      etat,
      me,
      hasPlatformPermission: (code: string) => codes.has(code),
      isSuperAdmin: Boolean(me?.is_super_admin),
      recharger,
    };
  }, [etat, recharger]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useAdminPermissions() {
  return useContext(Contexte);
}
