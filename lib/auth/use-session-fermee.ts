"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";

import { ERREUR_SESSION_FERMEE, signalDeCetteSession } from "./signal-session-fermee";

/**
 * Déconnecte la page dès que le serveur a signalé SA session comme coupée.
 *
 * ⚠ Au niveau MODULE, et non `useRef` : les coquilles se démontent derrière
 * leurs gardes de chargement, et une ref repartirait à zéro à chaque remontage.
 */
let deconnexionDemandee: string | null = null;

export function useSessionFermee(signal: string | null | undefined): void {
  const { data: session } = useSession();
  const visee = signalDeCetteSession(signal, session?.accessToken);

  useEffect(() => {
    if (!visee || !signal || deconnexionDemandee === signal) return;
    deconnexionDemandee = signal;
    void signOut({ redirect: true, callbackUrl: `/auth/login?error=${ERREUR_SESSION_FERMEE}` });
  }, [visee, signal]);
}
