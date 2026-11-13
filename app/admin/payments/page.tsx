"use client";

/**
 * Les paiements d'abonnement de toute la plateforme.
 *
 * Ils ne se trouvaient jusqu'ici que sur la fiche d'un établissement, ou parmi
 * les incidents quand ils traînaient : personne ne pouvait répondre à « qu'a-t-on
 * encaissé ce mois-ci, et par quel moyen ». Lecture seule : un paiement ne se
 * corrige pas d'ici, il se réconcilie auprès de l'opérateur.
 *
 * ⚠ AUCUN TOTAL À L'ÉCRAN NE MÊLE DEUX DEVISES : le document exporté ventile, et
 *   la liste n'additionne rien.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import {
  getAdminSubscriptionPayments,
  reconcilePayments,
  type AdminSubscriptionPayment,
} from "@/actions/admin.actions";
import { AdminExportMenu } from "@/components/admin/admin-export-menu";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { compte, dateHeure, montant } from "@/lib/admin/format";
import { resumerReconciliation } from "@/lib/admin/reconciliation";

const TAILLE = 20;

const STATUTS: Array<[string, string]> = [
  ["all", "Tous les statuts"],
  ["completed", "Terminés"],
  ["pending", "En attente"],
  ["failed", "Échoués"],
  ["refunded", "Remboursés"],
];

const MOYENS: Array<[string, string]> = [
  ["all", "Tous les moyens"],
  ["mobile_money", "Mobile Money"],
  ["card", "Carte bancaire"],
  ["bank_transfer", "Virement bancaire"],
  ["manual", "Manuel"],
];

/** Le ton d'un statut : seul l'encaissé est vert, l'échec seul est rouge. */
function Statut({ p }: { p: AdminSubscriptionPayment }) {
  const variante =
    p.status === "completed" ? "default" : p.status === "failed" ? "destructive" : "secondary";
  return <Badge variant={variante}>{p.status_display}</Badge>;
}

export default function AdminPaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ListeSelonLAdresse />
    </Suspense>
  );
}

/**
 * ⚠ LA LISTE EST REMONTÉE QUAND L'ADRESSE CHANGE. La recherche globale ouvre
 *   cette page sur une référence (`?search=`) ; depuis la page elle-même,
 *   `router.push` ne remonte rien, et l'état initial lu de l'URL resterait celui
 *   d'avant : le champ vide, toute la liste affichée, et le paiement cherché noyé
 *   dedans.
 */
function ListeSelonLAdresse() {
  const searchParams = useSearchParams();
  const cle = `${searchParams.get("search") ?? ""}|${searchParams.get("organization") ?? ""}`;
  return <ListePaiements key={cle} />;
}

function ListePaiements() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const router = useRouter();
  const searchParams = useSearchParams();
  const organisationFiltre = searchParams.get("organization");
  const { hasPlatformPermission } = useAdminPermissions();
  const peutReconcilier = hasPlatformPermission("incidents.reconcile_payments");

  // La recherche globale ouvre cette page sur une référence (`?search=`).
  const [recherche, setRecherche] = useState(() => searchParams.get("search") ?? "");
  const terme = useDebouncedValue(recherche.trim());
  const [statut, setStatut] = useState("all");
  const [moyen, setMoyen] = useState("all");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [page, setPage] = useState(1);
  const [tour, setTour] = useState(0);
  const [lignes, setLignes] = useState<AdminSubscriptionPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [rapports, setRapports] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!jeton) return;
    let annule = false;
    (async () => {
      const r = await getAdminSubscriptionPayments(jeton, {
        page,
        page_size: TAILLE,
        search: terme || undefined,
        status: statut === "all" ? undefined : statut,
        payment_method: moyen === "all" ? undefined : moyen,
        organization: organisationFiltre || undefined,
        date_from: du || undefined,
        date_to: au || undefined,
      });
      if (annule) return;
      if (r.success && r.data) {
        setLignes(r.data.results);
        setTotal(r.data.count);
      } else {
        toast.error(r.message || "Les paiements n'ont pas pu être chargés");
      }
      setIsLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, page, terme, statut, moyen, organisationFiltre, du, au, tour]);

  // ⚠ Un filtre qui change ramène à la page 1, DANS le geste : la page 3 d'un
  //   résultat qui n'en a qu'une s'afficherait vide, et se lirait « rien ».
  const filtrer = <T,>(poser: (v: T) => void) => (v: T) => {
    poser(v);
    setPage(1);
  };

  const reconcilier = useCallback(
    async (reference: string) => {
      if (!jeton) return;
      setEnCours(reference);
      const r = await reconcilePayments(jeton, { reference });
      setEnCours(null);
      if (!r.success || !r.data) {
        toast.error(r.message || "Réconciliation impossible");
        return;
      }
      setRapports((prev) => ({ ...prev, [reference]: resumerReconciliation(r.data!) }));
      if (r.data.reconciled > 0) {
        toast.success("Paiement encaissé : l'abonnement est activé.");
        setTour((t) => t + 1);
      }
    },
    [jeton]
  );

  const nomFiltre = organisationFiltre
    ? lignes.find((l) => l.organization === organisationFiltre)?.organization_name
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Paiements</h1>
          <p className="text-muted-foreground">
            {compte(total, "paiement d'abonnement", "paiements d'abonnement")}. Lecture seule.
          </p>
        </div>
        <AdminExportMenu
          liste="subscription-payments"
          libelle="Paiements d'abonnement"
          vide={!isLoading && total === 0}
          filtres={{
            search: terme,
            status: statut === "all" ? undefined : statut,
            payment_method: moyen === "all" ? undefined : moyen,
            organization: organisationFiltre || undefined,
            date_from: du,
            date_to: au,
          }}
        />
      </div>

      <Card className="border">
        {/* Deux rangées : sur une seule, la recherche et les deux dates tronquaient leur gabarit à 1280 px. */}
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={recherche}
              onChange={(e) => filtrer(setRecherche)(e.target.value)}
              placeholder="Référence ou établissement"
              className="pl-9"
            />
          </div>
          <Select value={statut} onValueChange={filtrer(setStatut)}>
            <SelectTrigger className="w-full" aria-label="Statut"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={moyen} onValueChange={filtrer(setMoyen)}>
            <SelectTrigger className="w-full" aria-label="Moyen"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOYENS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Deux colonnes de la grille : un champ de date plus étroit coupe son propre gabarit (« dd/m… »). */}
          <div className="grid grid-cols-2 gap-2 md:col-span-2">
            <Input type="date" value={du} onChange={(e) => filtrer(setDu)(e.target.value)} aria-label="Du" />
            <Input type="date" value={au} onChange={(e) => filtrer(setAu)(e.target.value)} aria-label="Au" />
          </div>
        </CardContent>
      </Card>

      {organisationFiltre && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Filtré sur {nomFiltre ? <span className="font-medium text-foreground">{nomFiltre}</span> : "un établissement"}
          </span>
          <Button variant="outline" size="sm" onClick={() => router.push("/admin/payments")}>
            <X className="mr-1 h-3.5 w-3.5" /> Retirer le filtre
          </Button>
        </div>
      )}

      <Card className="border">
        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : lignes.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Aucun paiement ne correspond à ces filtres.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Moyen</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((p) => {
                  // ⚠ Seul un règlement Mobile Money EN ATTENTE s'interroge : un
                  //   paiement manuel n'a pas d'opérateur, un paiement terminé
                  //   n'a plus rien à dire.
                  const interrogeable =
                    peutReconcilier && p.status === "pending" && p.payment_method === "mobile_money" && p.reference;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {dateHeure(p.paid_at || p.created_at)}
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/organizations/${p.organization}`} className="font-medium hover:underline">
                          {p.organization_name}
                        </Link>
                        {p.plan_name ? <p className="text-xs text-muted-foreground">{p.plan_name}</p> : null}
                      </TableCell>
                      <TableCell className="text-sm">{p.payment_method_display}</TableCell>
                      <TableCell>
                        <p className="break-all font-mono text-xs">{p.reference || "-"}</p>
                        {interrogeable ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-1"
                            disabled={enCours !== null}
                            onClick={() => reconcilier(p.reference)}
                          >
                            {enCours === p.reference ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                            Interroger l&apos;opérateur
                          </Button>
                        ) : null}
                        {rapports[p.reference] ? (
                          <p className="mt-1 text-xs text-muted-foreground">{rapports[p.reference]}</p>
                        ) : null}
                      </TableCell>
                      <TableCell><Statut p={p} /></TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                        {montant(p.amount, p.currency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <AdminPagination page={page} total={total} taille={TAILLE} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
