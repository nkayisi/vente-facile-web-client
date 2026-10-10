"use client";

/**
 * La cloche de l'en-tête, et son décompte.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ELLE ÉTAIT ÉCRITE, PUIS COMMENTÉE.                                      │
 * │                                                                          │
 * │ Parce qu'il n'y avait rien à montrer : `apps/notifications` portait cinq │
 * │ modèles et aucune vue, et six familles d'alertes se créaient sur le      │
 * │ serveur sans prévenir personne.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ ELLE RESTE VISIBLE QUAND IL N'Y A RIEN : un bouton qui disparaît est un
 * bouton qu'on ne retrouve plus quand il le faut. C'est la PASTILLE qui
 * apparaît, pas la cloche.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOrganization } from "@/components/auth/organization-checker";
import { getUnreadCount } from "@/actions/notifications.actions";

export function NotificationBell() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const chemin = usePathname();
  const jeton = session?.accessToken;

  const [nombre, setNombre] = useState(0);
  const vivant = useRef(true);

  useEffect(() => {
    vivant.current = true;
    return () => {
      vivant.current = false;
    };
  }, []);

  const relire = useCallback(async () => {
    if (!jeton || !organization) return;
    const n = await getUnreadCount(jeton, organization.id);
    // ⚠ `null` SIGNIFIE « JE N'AI PAS PU REGARDER », pas « rien à lire » : on
    // garde le dernier chiffre connu plutôt que d'afficher zéro sur une panne.
    if (vivant.current && n !== null) setNombre(n);
  }, [jeton, organization]);

  /**
   * ⚠ ON NE SONDE PAS EN BOUCLE. Le décompte se relit au changement de page et
   * au retour sur l'onglet, jamais à intervalle : un minuteur ferait une
   * requête par minute pour un chiffre qui change quelques fois par jour.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- faux positif : `relire` n'écrit RIEN avant son premier `await`, et l'analyseur perd la trace des `await` en traversant un bloc gardé.
    void relire();
  }, [relire, chemin]);

  useEffect(() => {
    const surRetour = () => {
      if (document.visibilityState === "visible") void relire();
    };
    document.addEventListener("visibilitychange", surRetour);
    return () => document.removeEventListener("visibilitychange", surRetour);
  }, [relire]);

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative text-muted-foreground"
      aria-label={
        nombre > 0
          ? `Notifications, ${nombre} non lue${nombre > 1 ? "s" : ""}`
          : "Notifications"
      }
    >
      <Link href="/dashboard/notifications">
        <Bell className="h-5 w-5" />
        {nombre > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground">
            {/* Au-delà de neuf on écrit « 9+ » : trois chiffres déborderaient
                de la pastille, et le nombre exact n'apprend rien de plus. */}
            {nombre > 9 ? "9+" : nombre}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
