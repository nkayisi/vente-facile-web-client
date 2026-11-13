"use client";

/**
 * Toutes les prises en main de la plateforme, et l'arrêt de celles qui durent.
 *
 * ⚠ « En cours » est le filtre par défaut : c'est la question qu'on vient poser
 * ici (qui regarde un marchand en ce moment ?), et une session qu'on voudrait
 * arrêter ne doit pas se perdre dans des mois d'historique.
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  endImpersonationSession,
  getImpersonationSessions,
  type ImpersonationSessionEntry,
} from "@/actions/admin.actions";
import { AdministrateurSelect, TOUS_LES_ADMINISTRATEURS } from "@/components/admin/administrateur-select";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ImpersonationSessionRow } from "@/components/admin/impersonation-session-row";
import { compte } from "@/lib/admin/format";

export default function ImpersonationsPage() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const { hasPlatformPermission } = useAdminPermissions();
  const peutArreter = hasPlatformPermission("impersonation.end");

  const [etat, setEtat] = useState<"en_cours" | "toutes">("en_cours");
  const [auteur, setAuteur] = useState(TOUS_LES_ADMINISTRATEURS);
  const [page, setPage] = useState(1);
  const [lignes, setLignes] = useState<ImpersonationSessionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [aArreter, setAArreter] = useState<ImpersonationSessionEntry | null>(null);
  const [tour, setTour] = useState(0);

  useEffect(() => {
    if (!jeton) return;
    let annule = false;
    (async () => {
      const r = await getImpersonationSessions(jeton, {
        page,
        en_cours: etat === "en_cours" || undefined,
        impersonator: auteur === TOUS_LES_ADMINISTRATEURS ? undefined : auteur,
      });
      if (annule) return;
      if (r.success && r.data) {
        setLignes(r.data.results);
        setTotal(r.data.count);
      } else {
        toast.error(r.message);
      }
      setIsLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, page, etat, auteur, tour]);

  // Un filtre qui change ramène à la page 1, DANS le geste.
  const filtrer = <T,>(poser: (v: T) => void) => (v: T) => {
    poser(v);
    setPage(1);
  };

  const arreter = async (motif: string) => {
    if (!jeton || !aArreter) return false;
    const r = await endImpersonationSession(jeton, aArreter.id, motif);
    if (!r.success) {
      toast.error(r.message);
      return false;
    }
    toast.success(r.message);
    setTour((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Prises en main</h1>
        <p className="text-muted-foreground">
          {etat === "en_cours"
            ? compte(total, "prise en main en cours", "prises en main en cours")
            : compte(total, "prise en main", "prises en main")}
          . Une session ouvre l&apos;application du marchand en lecture seule, vingt minutes au plus.
        </p>
      </div>

      <Card className="border">
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select value={etat} onValueChange={filtrer((v: string) => setEtat(v as "en_cours" | "toutes"))}>
            <SelectTrigger className="w-full" aria-label="État"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="toutes">Toutes, terminées comprises</SelectItem>
            </SelectContent>
          </Select>
          <AdministrateurSelect
            value={auteur}
            onChange={filtrer(setAuteur)}
            libelleTous="Tous les administrateurs"
            ariaLabel="Administrateur"
          />
        </CardContent>
      </Card>

      <Card className="border">
        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : lignes.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {etat === "en_cours" ? "Personne ne regarde un marchand en ce moment." : "Aucune prise en main ne correspond."}
          </p>
        ) : (
          <div className="divide-y px-4">
            {lignes.map((l) => (
              <ImpersonationSessionRow
                key={l.id}
                session={l}
                showOrganization
                onEnd={peutArreter ? setAArreter : undefined}
              />
            ))}
          </div>
        )}
        <AdminPagination page={page} total={total} onPage={setPage} />
      </Card>

      {aArreter && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAArreter(null)}
          title="Arrêter cette prise en main"
          description="L'administrateur perd l'accès à l'instant. L'arrêt est inscrit à votre nom au journal d'audit."
          entityName={`${aArreter.impersonator_email} → ${aArreter.target_name || aArreter.target_email}`}
          confirmLabel="Arrêter"
          destructive
          reason="required"
          onConfirm={arreter}
        />
      )}
    </div>
  );
}
