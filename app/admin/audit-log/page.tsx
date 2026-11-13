"use client";

/**
 * Le journal des actes d'administration.
 *
 * Lecture seule, et c'est sa nature : un journal qu'on peut corriger ne prouve
 * plus rien. Chaque ligne dit qui, quoi, sur quoi, pourquoi - et ce qui a
 * changé, champ par champ.
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdminAuditLog, type AdminActionLogEntry } from "@/actions/admin.actions";
import { AdministrateurSelect, TOUS_LES_ADMINISTRATEURS } from "@/components/admin/administrateur-select";
import { AdminExportMenu } from "@/components/admin/admin-export-menu";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { compte, dateHeure } from "@/lib/admin/format";

const CIBLES: Array<[string, string]> = [
  ["all", "Toutes les cibles"],
  ["organization", "Organisations"],
  ["user", "Utilisateurs"],
  ["platform_admin", "Administrateurs"],
  ["subscription", "Abonnements"],
  ["plan", "Plans"],
  ["payment", "Paiements"],
  ["app_release", "Porte de mise à jour"],
];

const ACTIONS: Array<[string, string]> = [
  ["all", "Toutes les actions"],
  ["toggle_active", "Activation / désactivation"],
  ["update", "Modification"],
  ["create", "Création"],
  ["grant_role", "Octroi de rôle"],
  ["change_role", "Changement de rôle"],
  ["revoke_role", "Retrait de rôle"],
  ["activate_subscription", "Activation d'abonnement"],
  ["extend_subscription", "Prolongation"],
  ["cancel_subscription", "Annulation"],
  ["reconcile_payments", "Réconciliation"],
  ["impersonate_start", "Prise en main"],
  ["impersonate_end", "Fin de prise en main"],
  ["update_app_release", "Porte de mise à jour"],
];

function Ecart({ avant, apres }: { avant: Record<string, unknown>; apres: Record<string, unknown> }) {
  const champs = Array.from(new Set([...Object.keys(avant), ...Object.keys(apres)]));
  if (champs.length === 0) return null;
  const lire = (v: unknown) => (v === null || v === undefined || v === "" ? "∅" : String(v));
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {champs.map((c) => (
        <li key={c} className="break-all">
          <span className="font-mono">{c}</span> : {c in avant ? <s>{lire(avant[c])}</s> : null}
          {c in avant && c in apres ? " → " : null}
          {c in apres ? <span className="text-foreground">{lire(apres[c])}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export default function AuditLogPage() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const [recherche, setRecherche] = useState("");
  const terme = useDebouncedValue(recherche);
  const [cible, setCible] = useState("all");
  const [action, setAction] = useState("all");
  const [auteur, setAuteur] = useState(TOUS_LES_ADMINISTRATEURS);
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [page, setPage] = useState(1);
  const [lignes, setLignes] = useState<AdminActionLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!jeton) return;
    let annule = false;
    (async () => {
      const r = await getAdminAuditLog(jeton, {
        page,
        search: terme || undefined,
        target_type: cible === "all" ? undefined : cible,
        action: action === "all" ? undefined : action,
        actor: auteur === TOUS_LES_ADMINISTRATEURS ? undefined : auteur,
        date_from: du || undefined,
        date_to: au || undefined,
      });
      if (annule) return;
      if (r.success && r.data) {
        setLignes(r.data.results);
        setTotal(r.data.count);
      }
      setIsLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, page, terme, cible, action, auteur, du, au]);

  // ⚠ Un filtre qui change ramène à la page 1, DANS le geste : une page 3 d'un
  // résultat qui n'en a qu'une s'afficherait vide, et se lirait « rien ».
  const filtrer = <T,>(poser: (v: T) => void) => (v: T) => {
    poser(v);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Journal d&apos;audit</h1>
          <p className="text-muted-foreground">
            {compte(total, "acte d'administration", "actes d'administration")}. Lecture seule.
          </p>
        </div>
        <AdminExportMenu
          liste="audit-log"
          libelle="Journal d'audit"
          vide={!isLoading && total === 0}
          filtres={{
            search: terme,
            target_type: cible === "all" ? undefined : cible,
            action: action === "all" ? undefined : action,
            actor: auteur === TOUS_LES_ADMINISTRATEURS ? undefined : auteur,
            date_from: du,
            date_to: au,
          }}
        />
      </div>

      <Card className="border">
        {/* Deux rangées de quatre colonnes : les six champs sur une ligne tronquaient leurs libellés à 1280 px. */}
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={recherche}
              onChange={(e) => filtrer(setRecherche)(e.target.value)}
              placeholder="Cible, auteur ou motif"
              className="pl-9"
            />
          </div>
          <Select value={cible} onValueChange={filtrer(setCible)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CIBLES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={filtrer(setAction)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="xl:col-span-2">
            <AdministrateurSelect
              value={auteur}
              onChange={filtrer(setAuteur)}
              libelleTous="Tous les auteurs"
              ariaLabel="Auteur"
            />
          </div>
          {/* Deux colonnes de la grille : un champ de date plus étroit coupe son propre gabarit (« dd/m… »). */}
          <div className="grid grid-cols-2 gap-2 xl:col-span-2">
            <Input type="date" value={du} onChange={(e) => filtrer(setDu)(e.target.value)} aria-label="Du" />
            <Input type="date" value={au} onChange={(e) => filtrer(setAu)(e.target.value)} aria-label="Au" />
          </div>
        </CardContent>
      </Card>

      <Card className="border">
        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : lignes.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Aucun acte ne correspond à ces filtres.</p>
        ) : (
          <div className="divide-y">
            {lignes.map((l) => (
              <div key={l.id} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[160px_1fr]">
                <p className="text-xs text-muted-foreground">{dateHeure(l.created_at)}</p>
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{l.actor_name || l.actor_email || "Système"}</span>{" "}
                    <span className="text-muted-foreground">·</span> {l.action_display}{" "}
                    <span className="text-muted-foreground">·</span>{" "}
                    <span className="text-muted-foreground">{l.target_type_display}</span>{" "}
                    <span className="font-medium">{l.target_repr}</span>
                  </p>
                  {l.reason && <p className="text-sm text-muted-foreground">« {l.reason} »</p>}
                  <Ecart avant={l.before} apres={l.after} />
                </div>
              </div>
            ))}
          </div>
        )}
        <AdminPagination page={page} total={total} onPage={setPage} />
      </Card>
    </div>
  );
}
