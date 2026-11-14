"use client";

/**
 * La fiche d'un établissement, vue par le support.
 *
 * Elle réunit ce qu'on cherche avant d'agir : qui contacter, où en est
 * l'abonnement, qui est dans l'équipe, et ce que l'administration a déjà fait
 * pour cet établissement. La prise en main se fait d'ici, membre par membre.
 */
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Eye,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Power,
  ScrollText,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAdminAuditLog,
  getAdminOrganization,
  getImpersonationSessions,
  toggleOrganizationActive,
  type AdminActionLogEntry,
  type AdminOrganization,
  type AdminOrganizationMember,
  type ImpersonationSessionEntry,
} from "@/actions/admin.actions";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ActivateSubscriptionDialog } from "@/components/admin/activate-subscription-dialog";
import { OrganizationEditDialog, TYPES_ETABLISSEMENT } from "@/components/admin/organization-edit-dialog";
import { ImpersonateDialog } from "@/components/admin/impersonate-dialog";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import { ImpersonationSessionRow } from "@/components/admin/impersonation-session-row";
import { SupportNotesCard } from "@/components/admin/support-notes-card";
import { dateCourte, dateHeure, montant, raisonSansPriseEnMain, raisonSansReinitialisation } from "@/lib/admin/format";

function Ligne({ label, valeur }: { label: string; valeur?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium break-words">{valeur || "-"}</span>
    </div>
  );
}

export default function AdminOrganizationDetailPage() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;
  const { hasPlatformPermission, me } = useAdminPermissions();

  const [org, setOrg] = useState<AdminOrganization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [journal, setJournal] = useState<AdminActionLogEntry[]>([]);
  const [prises, setPrises] = useState<ImpersonationSessionEntry[]>([]);
  const [tour, setTour] = useState(0);

  const [edition, setEdition] = useState(false);
  const [bascule, setBascule] = useState(false);
  const [activation, setActivation] = useState(false);
  const [priseSur, setPriseSur] = useState<AdminOrganizationMember | null>(null);
  const [motDePassePour, setMotDePassePour] = useState<AdminOrganizationMember | null>(null);

  const voitJournal = hasPlatformPermission("audit_log.view");
  const actualiser = useCallback(() => setTour((t) => t + 1), []);

  useEffect(() => {
    if (!jeton || !orgId) return;
    let annule = false;
    (async () => {
      const [r, j, p] = await Promise.all([
        getAdminOrganization(jeton, orgId),
        voitJournal ? getAdminAuditLog(jeton, { target_id: orgId, page_size: 10 }) : Promise.resolve(null),
        voitJournal ? getImpersonationSessions(jeton, { organization: orgId }) : Promise.resolve(null),
      ]);
      if (annule) return;
      if (r.success && r.data) setOrg(r.data);
      else toast.error(r.message || "Établissement introuvable");
      if (j?.success && j.data) setJournal(j.data.results);
      if (p?.success && p.data) setPrises(p.data.results.slice(0, 10));
      setIsLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, orgId, tour, voitJournal]);

  const basculer = async (motif: string) => {
    if (!jeton || !org) return false;
    const r = await toggleOrganizationActive(jeton, org.id, motif);
    if (!r.success) {
      toast.error(r.message);
      return false;
    }
    toast.success(r.message);
    actualiser();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <p className="text-muted-foreground text-center py-12">Établissement introuvable.</p>
      </div>
    );
  }

  const sub = org.subscription;
  const type = TYPES_ETABLISSEMENT.find((t) => t.value === org.business_type)?.label ?? org.business_type;
  const peutPrendreLaMain = hasPlatformPermission("impersonation.start");
  const peutReinitialiser = hasPlatformPermission("users.reset_password");
  const peutGererAdministrateurs = hasPlatformPermission("platform_admins.manage");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/organizations")} aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{org.name}</h1>
              <Badge variant={org.is_active ? "default" : "outline"}>{org.is_active ? "Actif" : "Inactif"}</Badge>
            </div>
            <p className="text-muted-foreground">
              {type} · {[org.city, org.country].filter(Boolean).join(", ")} · créé le {dateCourte(org.created_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPlatformPermission("organizations.edit") && (
            <Button variant="outline" onClick={() => setEdition(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Modifier
            </Button>
          )}
          {hasPlatformPermission("organizations.activate_subscription") && (
            <Button variant="outline" onClick={() => setActivation(true)}>
              <CreditCard className="mr-2 h-4 w-4" /> Activer un abonnement
            </Button>
          )}
          {hasPlatformPermission("organizations.toggle_active") && (
            <Button variant={org.is_active ? "outline" : "default"} onClick={() => setBascule(true)}>
              <Power className="mr-2 h-4 w-4" /> {org.is_active ? "Désactiver" : "Réactiver"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Fiche
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Ligne label="E-mail" valeur={org.email && <a href={`mailto:${org.email}`} className="hover:underline">{org.email}</a>} />
            <Ligne label="Téléphone" valeur={org.phone && <a href={`tel:${org.phone}`} className="hover:underline">{org.phone}</a>} />
            <Ligne label="Adresse" valeur={org.address} />
            <Ligne label="NIF" valeur={org.tax_id} />
            <Ligne label="RCCM" valeur={org.rccm} />
            <Ligne label="ID Nat" valeur={org.id_nat} />
            <Ligne label="Devise principale" valeur={org.currency} />
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <CreditCard className="h-4 w-4 text-muted-foreground" /> Abonnement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sub ? (
              <div className="divide-y">
                <Ligne label="Plan" valeur={sub.plan_name} />
                <Ligne label="Statut" valeur={<Badge variant="outline">{sub.status_display}</Badge>} />
                <Ligne label="Prix" valeur={montant(sub.price, sub.currency)} />
                <Ligne label="Échéance" valeur={`${dateCourte(sub.current_period_end)} (${sub.days_remaining} j)`} />
                <div className="pt-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/subscriptions/${sub.id}`}>Ouvrir l&apos;abonnement</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">
                Aucun abonnement en cours : l&apos;établissement est bloqué en écriture.
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3">
              <Link href={`/admin/subscriptions?organization=${org.id}`} className="text-sm text-primary hover:underline">
                Historique des abonnements
              </Link>
              <Link href={`/admin/payments?organization=${org.id}`} className="text-sm text-primary hover:underline">
                Paiements
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Phone className="h-4 w-4 text-muted-foreground" /> Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{org.owner_name}</p>
            {org.owner_email !== "-" && (
              <a href={`mailto:${org.owner_email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Mail className="h-4 w-4" /> {org.owner_email}
              </a>
            )}
            {org.city && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {org.city}
              </p>
            )}
            {org.owner_name === "-" && (
              <p className="text-destructive">Aucun propriétaire actif : personne ne peut régler l&apos;abonnement.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Avant l'équipe : c'est ce qu'on lit avant d'appeler qui que ce soit. */}
      <SupportNotesCard organizationId={org.id} />

      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Users className="h-4 w-4 text-muted-foreground" /> Équipe ({org.members?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {(org.members ?? []).map((m) => {
            const fermeture = raisonSansPriseEnMain(m.is_active, m.is_platform_admin, "Compte ou adhésion inactif");
            // ⚠ Le COMPTE seul, pas l'adhésion : un membre parti d'ici peut encore
            // travailler ailleurs, et y avoir oublié son mot de passe.
            const fermetureMotDePasse = raisonSansReinitialisation({
              soiMeme: m.user_id === me?.id,
              compteActif: m.user_is_active,
              administrateur: m.is_platform_admin,
              peutGererAdministrateurs,
            });
            return (
              <div key={m.user_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/users/${m.user_id}`} className="font-medium hover:underline">{m.name || m.email}</Link>
                    <Badge variant="outline">{m.role_display}</Badge>
                    {!m.is_active && <Badge variant="outline">Inactif</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
                {(peutPrendreLaMain || peutReinitialiser) && (
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <div className="flex flex-wrap gap-2">
                      {peutReinitialiser && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={fermetureMotDePasse !== null}
                          onClick={() => setMotDePassePour(m)}
                        >
                          <KeyRound className="mr-2 h-4 w-4" /> Mot de passe
                        </Button>
                      )}
                      {peutPrendreLaMain && (
                        <Button size="sm" variant="outline" disabled={fermeture !== null} onClick={() => setPriseSur(m)}>
                          <Eye className="mr-2 h-4 w-4" /> Prendre la main
                        </Button>
                      )}
                    </div>
                    {/* Un seul motif par ligne : celui du geste qui le porte, sinon
                        celui de la prise en main. Deux phrases empilées sous deux
                        boutons ne disent plus lequel est fermé. */}
                    {peutPrendreLaMain && fermeture ? (
                      <p className="text-xs text-muted-foreground">{fermeture}</p>
                    ) : (
                      peutReinitialiser &&
                      fermetureMotDePasse && <p className="text-xs text-muted-foreground">{fermetureMotDePasse}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {voitJournal && (
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <ScrollText className="h-4 w-4 text-muted-foreground" /> Actes d&apos;administration
              </CardTitle>
              <Link href="/admin/audit-log" className="text-sm text-primary hover:underline">Journal complet</Link>
            </CardHeader>
            <CardContent className="divide-y">
              {journal.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Aucun acte sur cette fiche.</p>
              ) : (
                journal.map((l) => (
                  <div key={l.id} className="py-2 text-sm">
                    <p>
                      <span className="font-medium">{l.actor_name || l.actor_email || "Système"}</span> · {l.action_display}
                    </p>
                    {l.reason && <p className="text-muted-foreground">« {l.reason} »</p>}
                    <p className="text-xs text-muted-foreground">{dateHeure(l.created_at)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {voitJournal && (
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Eye className="h-4 w-4 text-muted-foreground" /> Prises en main
              </CardTitle>
              <Link href="/admin/impersonations" className="text-sm text-primary hover:underline">Toutes</Link>
            </CardHeader>
            <CardContent className="divide-y">
              {prises.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Aucune prise en main sur cet établissement.</p>
              ) : (
                prises.map((p) => <ImpersonationSessionRow key={p.id} session={p} />)
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {org.recent_activity && org.recent_activity.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Activité récente dans l&apos;établissement</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {org.recent_activity.map((a, i) => (
              <div key={i} className="flex justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{a.user}</span> · {a.action}
                  {a.resource_type ? ` · ${a.resource_type}` : ""}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{dateHeure(a.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {edition && (
        <OrganizationEditDialog
          open
          onOpenChange={(o) => !o && setEdition(false)}
          organization={org}
          onSaved={(o) => {
            setOrg(o);
            actualiser();
          }}
        />
      )}
      {activation && (
        <ActivateSubscriptionDialog
          open
          onOpenChange={(o) => !o && setActivation(false)}
          organizationId={org.id}
          organizationName={org.name}
          onDone={actualiser}
        />
      )}
      {motDePassePour && (
        <ResetPasswordDialog
          open
          onOpenChange={(o) => !o && setMotDePassePour(null)}
          userId={motDePassePour.user_id}
          userLabel={motDePassePour.name || motDePassePour.email}
          onDone={actualiser}
        />
      )}
      {priseSur && (
        <ImpersonateDialog
          open
          onOpenChange={(o) => !o && setPriseSur(null)}
          userId={priseSur.user_id}
          userLabel={priseSur.name || priseSur.email}
          organizationId={org.id}
          organizationName={org.name}
        />
      )}
      <ConfirmDialog
        open={bascule}
        onOpenChange={setBascule}
        title={org.is_active ? "Désactiver l'établissement" : "Réactiver l'établissement"}
        entityName={org.name}
        description={
          org.is_active
            ? "L'établissement est suspendu : ses membres ne peuvent plus se connecter ni rien consulter, et les prises en main en cours sont fermées. Seuls ses terminaux déjà enrôlés peuvent encore envoyer les ventes déjà encaissées. Ses données ne sont pas touchées."
            : "L'établissement redevient actif."
        }
        confirmLabel={org.is_active ? "Désactiver" : "Réactiver"}
        destructive={org.is_active}
        reason={org.is_active ? "required" : "optional"}
        onConfirm={basculer}
      />
    </div>
  );
}
