"use client";

/**
 * Les notes du support sur un établissement.
 *
 * Ce qu'un collègue a appris au téléphone (« a payé par virement, en attente de
 * rapprochement ») vivait dans sa tête ou dans un carnet : le suivant
 * redemandait tout au marchand. Une note se lit ici, sur la fiche, et jamais
 * par le marchand.
 *
 * ⚠ ELLE NE SE SUPPRIME PAS, et son TEXTE n'appartient qu'à son auteur : le
 *   serveur refuse le reste, et l'écran ne propose donc pas ce qui serait refusé.
 *   Épingler, en revanche, est ouvert à quiconque peut écrire une note : c'est
 *   dire « lisez celle-ci d'abord », pas réécrire ce qu'un autre a dit.
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, NotebookPen, Pencil, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";

import {
  createSupportNote,
  getSupportNotes,
  updateSupportNote,
  type SupportNote,
} from "@/actions/admin.actions";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { dateHeure } from "@/lib/admin/format";

export function SupportNotesCard({ organizationId }: { organizationId: string }) {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const { hasPlatformPermission } = useAdminPermissions();
  const peutLire = hasPlatformPermission("support_notes.view");
  const peutEcrire = hasPlatformPermission("support_notes.create");

  const [notes, setNotes] = useState<SupportNote[] | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [enEdition, setEnEdition] = useState<{ id: string; texte: string } | null>(null);
  const [geste, setGeste] = useState<string | null>(null);

  useEffect(() => {
    if (!jeton || !peutLire) return;
    let annule = false;
    getSupportNotes(jeton, organizationId).then((r) => {
      if (annule) return;
      if (r.success && r.data) {
        setNotes(r.data);
        setEchec(null);
      } else {
        // ⚠ Un échec n'est pas « aucune note » : le dire autrement ferait croire
        //   qu'il n'y a rien à savoir sur ce marchand.
        setEchec(r.message || "Les notes n'ont pas pu être chargées.");
      }
    });
    return () => {
      annule = true;
    };
  }, [jeton, organizationId, peutLire]);

  if (!peutLire) return null;

  /** L'épinglée en tête, puis la plus récente : l'ordre du serveur. */
  const ranger = (liste: SupportNote[]) =>
    [...liste].sort(
      (a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at)
    );

  const remplacer = (note: SupportNote) =>
    setNotes((prev) => ranger((prev ?? []).map((n) => (n.id === note.id ? note : n))));

  const ajouter = async () => {
    if (!jeton || !brouillon.trim()) return;
    setEnvoi(true);
    const r = await createSupportNote(jeton, organizationId, brouillon);
    setEnvoi(false);
    if (!r.success || !r.data) {
      toast.error(r.message || "La note n'a pas pu être enregistrée");
      return;
    }
    setNotes((prev) => ranger([r.data!, ...(prev ?? [])]));
    setBrouillon("");
  };

  const epingler = async (note: SupportNote) => {
    if (!jeton) return;
    setGeste(note.id);
    const r = await updateSupportNote(jeton, note.id, { is_pinned: !note.is_pinned });
    setGeste(null);
    if (!r.success || !r.data) {
      toast.error(r.message || "La note n'a pas pu être modifiée");
      return;
    }
    remplacer(r.data);
  };

  const corriger = async () => {
    if (!jeton || !enEdition || !enEdition.texte.trim()) return;
    setGeste(enEdition.id);
    const r = await updateSupportNote(jeton, enEdition.id, { body: enEdition.texte });
    setGeste(null);
    if (!r.success || !r.data) {
      toast.error(r.message || "La note n'a pas pu être modifiée");
      return;
    }
    remplacer(r.data);
    setEnEdition(null);
  };

  return (
    <Card className="border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <NotebookPen className="h-4 w-4 text-muted-foreground" /> Notes du support
          {notes && notes.length > 0 ? (
            <span className="text-sm font-normal text-muted-foreground">({notes.length})</span>
          ) : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Visibles de l&apos;administration seule, jamais du marchand.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {peutEcrire && (
          <div className="space-y-2">
            <Textarea
              value={brouillon}
              onChange={(e) => setBrouillon(e.target.value)}
              placeholder="Ce que le prochain collègue doit savoir avant d'appeler ce marchand"
              rows={3}
              aria-label="Nouvelle note"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={ajouter} disabled={envoi || !brouillon.trim()}>
                {envoi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Ajouter la note
              </Button>
            </div>
          </div>
        )}

        {echec ? (
          <p className="text-sm text-destructive">{echec}</p>
        ) : notes === null ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune note sur cet établissement.</p>
        ) : (
          <ul className="divide-y">
            {notes.map((n) => {
              const editee = enEdition?.id === n.id;
              return (
                <li key={n.id} className="py-3">
                  {editee ? (
                    <div className="space-y-2">
                      <Textarea
                        value={enEdition.texte}
                        onChange={(e) => setEnEdition({ id: n.id, texte: e.target.value })}
                        rows={3}
                        aria-label="Corriger la note"
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEnEdition(null)}>
                          Annuler
                        </Button>
                        <Button size="sm" onClick={corriger} disabled={geste === n.id || !enEdition.texte.trim()}>
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm">{n.body}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {n.is_pinned ? (
                      <Badge variant="secondary" className="gap-1">
                        <Pin className="h-3 w-3" /> Épinglée
                      </Badge>
                    ) : null}
                    <span>
                      {/* ⚠ Pas de « corrigée » d'après `updated_at` : épingler le fait bouger aussi. */}
                      {n.author_email || "Auteur inconnu"} · {dateHeure(n.created_at)}
                    </span>
                    {peutEcrire && !editee ? (
                      <span className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={geste === n.id}
                          onClick={() => epingler(n)}
                        >
                          {n.is_pinned ? <PinOff className="mr-1 h-3.5 w-3.5" /> : <Pin className="mr-1 h-3.5 w-3.5" />}
                          {n.is_pinned ? "Désépingler" : "Épingler"}
                        </Button>
                        {n.peut_corriger ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => setEnEdition({ id: n.id, texte: n.body })}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Corriger
                          </Button>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
