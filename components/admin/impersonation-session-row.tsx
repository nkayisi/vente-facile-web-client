"use client";

/**
 * Une prise en main, sur une ligne : qui a regardé par les yeux de qui, pourquoi,
 * quand, et comment elle a cessé.
 *
 * Écrite une fois, lue à trois endroits (la page globale, la fiche d'un
 * établissement, la fiche d'un compte) : trois écritures finiraient par ne plus
 * dire la même chose de la même session.
 */
import { Power } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ImpersonationSessionEntry } from "@/actions/admin.actions";
import { dateHeure } from "@/lib/admin/format";

interface Props {
  session: ImpersonationSessionEntry;
  /** Sur la fiche d'un établissement, son nom serait répété à chaque ligne. */
  showOrganization?: boolean;
  /** Offert seulement à qui peut arrêter, et seulement sur une session en cours. */
  onEnd?: (session: ImpersonationSessionEntry) => void;
}

function fin(session: ImpersonationSessionEntry): string {
  if (session.is_live) return "";
  if (session.ended_at) return ` · ${session.ended_reason_display.toLowerCase()} ${dateHeure(session.ended_at)}`;
  // Échue sans fin écrite : l'accès a cessé à l'échéance, le balayage nocturne l'écrira.
  return ` · expirée ${dateHeure(session.expires_at)}`;
}

export function ImpersonationSessionRow({ session, showOrganization = false, onEnd }: Props) {
  return (
    <div className="flex flex-col gap-2 py-2 text-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="break-words">
          <span className="font-medium">{session.impersonator_email}</span> → {session.target_name || session.target_email}
          {showOrganization && <span className="text-muted-foreground"> · {session.organization_name}</span>}
          {session.is_live && <Badge className="ml-2" variant="default">En cours</Badge>}
        </p>
        <p className="text-muted-foreground">« {session.reason} »</p>
        <p className="text-xs text-muted-foreground">
          {dateHeure(session.started_at)}
          {fin(session)}
        </p>
      </div>
      {onEnd && session.is_live && (
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => onEnd(session)}>
          <Power className="mr-2 h-4 w-4" /> Arrêter
        </Button>
      )}
    </div>
  );
}
