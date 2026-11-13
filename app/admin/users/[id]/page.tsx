"use client";

/**
 * La fiche d'un compte, vue par l'administration.
 *
 * Trois questions s'y posent, dans cet ordre : qui est-ce (et comment le
 * joindre), où travaille-t-il, et que lui a-t-on déjà fait. Les gestes - le
 * corriger, le désactiver, lui donner un rôle, prendre sa main - sont là où l'on
 * se pose la question, et chacun dit pourquoi il est fermé quand il l'est.
 */
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  Eye,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Power,
  ScrollText,
  Shield,
  ShieldOff,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getAdminAuditLog,
  getAdminUser,
  getImpersonationSessions,
  revokePlatformRole,
  toggleUserActive,
  type AdminActionLogEntry,
  type AdminUser,
  type ImpersonationSessionEntry,
} from "@/actions/admin.actions";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { RoleDialog } from "@/components/admin/role-dialog";
import { UserEditDialog } from "@/components/admin/user-dialogs";
import { ImpersonateDialog } from "@/components/admin/impersonate-dialog";
import { ImpersonationSessionRow } from "@/components/admin/impersonation-session-row";
import { dateCourte, dateHeure, raisonSansPriseEnMain } from "@/lib/admin/format";

function initiales(nom?: string | null, email?: string) {
  if (nom) return nom.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return email?.charAt(0).toUpperCase() || "U";
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

type Geste = "edition" | "bascule" | "role" | "retrait" | null;

export default function AdminUserDetailPage() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { hasPlatformPermission, me } = useAdminPermissions();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [journal, setJournal] = useState<AdminActionLogEntry[]>([]);
  const [prises, setPrises] = useState<ImpersonationSessionEntry[]>([]);
  const [tour, setTour] = useState(0);
  const [geste, setGeste] = useState<Geste>(null);
  const [priseDans, setPriseDans] = useState<{ id: string; name: string } | null>(null);

  const voitJournal = hasPlatformPermission("audit_log.view");
  const actualiser = useCallback(() => setTour((t) => t + 1), []);

  useEffect(() => {
    if (!jeton || !userId) return;
    let annule = false;
    (async () => {
      // Les prises en main SUR ce compte et PAR ce compte : un marchand n'a que
      // les premières, un administrateur surtout les secondes.
      const [r, j, sur, par] = await Promise.all([
        getAdminUser(jeton, userId),
        voitJournal ? getAdminAuditLog(jeton, { target_id: userId, page_size: 10 }) : Promise.resolve(null),
        voitJournal ? getImpersonationSessions(jeton, { target_user: userId, page_size: 10 }) : Promise.resolve(null),
        voitJournal ? getImpersonationSessions(jeton, { impersonator: userId, page_size: 10 }) : Promise.resolve(null),
      ]);
      if (annule) return;
      if (r.success && r.data) setUser(r.data);
      else toast.error(r.message || "Utilisateur introuvable");
      if (j?.success && j.data) setJournal(j.data.results);
      setPrises(
        [...(sur?.data?.results ?? []), ...(par?.data?.results ?? [])]
          .sort((a, b) => b.started_at.localeCompare(a.started_at))
          .slice(0, 10)
      );
      setIsLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, userId, tour, voitJournal]);

  const basculer = async (motif: string) => {
    if (!jeton || !user) return false;
    const r = await toggleUserActive(jeton, user.id, motif);
    if (!r.success) {
      toast.error(r.message);
      return false;
    }
    toast.success(r.message);
    actualiser();
  };

  const retirer = async (motif: string) => {
    if (!jeton || !user) return false;
    const r = await revokePlatformRole(jeton, user.id, motif);
    if (!r.success) {
      toast.error(r.message);
      return false;
    }
    toast.success("Rôle retiré.");
    actualiser();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <p className="py-12 text-center text-muted-foreground">Utilisateur introuvable.</p>
      </div>
    );
  }

  const soiMeme = user.id === me?.id;
  const peutEditer = hasPlatformPermission("users.edit");
  const peutBasculer = hasPlatformPermission("users.toggle_active") && !soiMeme;
  const peutGererRoles = hasPlatformPermission("platform_admins.manage") && !soiMeme;
  const peutPrendreLaMain = hasPlatformPermission("impersonation.start");

  const fermeturePrise = raisonSansPriseEnMain(user.is_active, Boolean(user.platform_role || user.is_superuser));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/users")} aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary text-primary-foreground">{initiales(user.full_name, user.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{user.full_name || user.email}</h1>
              <Badge variant={user.is_active ? "default" : "outline"}>{user.is_active ? "Actif" : "Inactif"}</Badge>
              {user.platform_role && (
                <Badge variant="outline" className="border-primary/40 text-primary">{user.platform_role_display}</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {peutEditer && (
            <Button variant="outline" onClick={() => setGeste("edition")}>
              <Pencil className="mr-2 h-4 w-4" /> Modifier
            </Button>
          )}
          {peutGererRoles && (
            <Button variant="outline" onClick={() => setGeste("role")}>
              <Shield className="mr-2 h-4 w-4" /> {user.platform_role ? "Changer le rôle" : "Nommer administrateur"}
            </Button>
          )}
          {peutGererRoles && user.platform_role && (
            <Button variant="outline" onClick={() => setGeste("retrait")}>
              <ShieldOff className="mr-2 h-4 w-4" /> Retirer le rôle
            </Button>
          )}
          {peutBasculer && (
            <Button variant={user.is_active ? "outline" : "default"} onClick={() => setGeste("bascule")}>
              <Power className="mr-2 h-4 w-4" /> {user.is_active ? "Désactiver" : "Réactiver"}
            </Button>
          )}
        </div>
      </div>
      {soiMeme && (
        <p className="text-sm text-muted-foreground">
          C&apos;est votre compte : un autre super-administrateur peut changer votre rôle ou le désactiver, pas vous.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Profil</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Ligne label="Prénom">{user.first_name || "-"}</Ligne>
            <Ligne label="Nom">{user.last_name || "-"}</Ligne>
            <Ligne label="E-mail">
              <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1.5 hover:underline">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {user.email}
              </a>
            </Ligne>
            <Ligne label="Téléphone">
              {user.phone ? (
                <a href={`tel:${user.phone}`} className="inline-flex items-center gap-1.5 hover:underline">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {user.phone}
                </a>
              ) : (
                "-"
              )}
            </Ligne>
            <Ligne label="E-mail vérifié">
              {user.is_email_verified ? (
                <span className="inline-flex items-center gap-1.5 text-success">
                  <CheckCircle className="h-3.5 w-3.5" /> Oui
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5" /> Non
                </span>
              )}
            </Ligne>
            <Ligne label="Inscrit le">{dateCourte(user.date_joined)}</Ligne>
            <Ligne label="Dernière connexion">{user.last_login ? dateHeure(user.last_login) : "Jamais"}</Ligne>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Établissements ({user.organizations_count})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {user.organizations.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Ce compte n&apos;appartient à aucun établissement.</p>
            ) : (
              user.organizations.map((org) => (
                <div key={org.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/organizations/${org.id}`} className="font-medium hover:text-primary">
                      {org.name}
                    </Link>
                    <Badge variant="outline">{org.role}</Badge>
                  </div>
                  {peutPrendreLaMain && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={fermeturePrise !== null}
                      title={fermeturePrise ?? undefined}
                      onClick={() => setPriseDans({ id: org.id, name: org.name })}
                    >
                      <Eye className="mr-2 h-4 w-4" /> Prendre la main
                    </Button>
                  )}
                </div>
              ))
            )}
            {peutPrendreLaMain && fermeturePrise && user.organizations.length > 0 && (
              <p className="pt-3 text-xs text-muted-foreground">{fermeturePrise}.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {user.platform_profile && (
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Shield className="h-4 w-4 text-muted-foreground" /> Accès à l&apos;administration
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Ligne label="Rôle">{user.platform_profile.role_display}</Ligne>
            <Ligne label="Nommé par">{user.platform_profile.granted_by_email || "Migration initiale"}</Ligne>
            <Ligne label="Le">{dateHeure(user.platform_profile.granted_at)}</Ligne>
            {user.platform_profile.extra_permissions.length > 0 && (
              <Ligne label="Permissions en plus">{user.platform_profile.extra_permissions.join(", ")}</Ligne>
            )}
            {user.platform_profile.notes && <Ligne label="Notes">{user.platform_profile.notes}</Ligne>}
          </CardContent>
        </Card>
      )}

      {voitJournal && (
        <Card className="border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <ScrollText className="h-4 w-4 text-muted-foreground" /> Actes d&apos;administration sur ce compte
            </CardTitle>
            <Link href="/admin/audit-log" className="text-sm text-primary hover:underline">Journal complet</Link>
          </CardHeader>
          <CardContent className="divide-y">
            {journal.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Aucun acte sur ce compte.</p>
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

      {voitJournal && prises.length > 0 && (
        <Card className="border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Eye className="h-4 w-4 text-muted-foreground" /> Prises en main
            </CardTitle>
            <Link href="/admin/impersonations" className="text-sm text-primary hover:underline">Toutes</Link>
          </CardHeader>
          <CardContent className="divide-y">
            {prises.map((p) => <ImpersonationSessionRow key={p.id} session={p} showOrganization />)}
          </CardContent>
        </Card>
      )}

      {geste === "edition" && (
        <UserEditDialog
          open
          onOpenChange={(o) => !o && setGeste(null)}
          user={user}
          onSaved={(u) => {
            setUser(u);
            actualiser();
          }}
        />
      )}
      {geste === "role" && (
        <RoleDialog
          open
          onOpenChange={(o) => !o && setGeste(null)}
          userId={user.id}
          userLabel={user.full_name || user.email}
          roleActuel={user.platform_role}
          onDone={actualiser}
        />
      )}
      {priseDans && (
        <ImpersonateDialog
          open
          onOpenChange={(o) => !o && setPriseDans(null)}
          userId={user.id}
          userLabel={user.full_name || user.email}
          organizationId={priseDans.id}
          organizationName={priseDans.name}
        />
      )}
      <ConfirmDialog
        open={geste === "bascule"}
        onOpenChange={(o) => !o && setGeste(null)}
        title={user.is_active ? "Désactiver le compte" : "Réactiver le compte"}
        entityName={user.email}
        description={
          user.is_active
            ? "Le titulaire ne pourra plus se connecter, ni au back-office ni sur un terminal. Ses ventes et ses écritures restent."
            : "Le titulaire pourra de nouveau se connecter."
        }
        confirmLabel={user.is_active ? "Désactiver" : "Réactiver"}
        destructive={user.is_active}
        reason={user.is_active ? "required" : "optional"}
        onConfirm={basculer}
      />
      <ConfirmDialog
        open={geste === "retrait"}
        onOpenChange={(o) => !o && setGeste(null)}
        title="Retirer le rôle plateforme"
        entityName={user.email}
        description="Le compte perd tout accès à l'administration. Son compte marchand, s'il en a un, n'est pas touché."
        confirmLabel="Retirer le rôle"
        destructive
        reason="required"
        onConfirm={retirer}
      />
    </div>
  );
}
