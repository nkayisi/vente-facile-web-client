"use client";

/**
 * Qui administre la plateforme, et qui l'a administrée.
 *
 * Les rôles RETIRÉS restent visibles : la question « qui avait ce pouvoir au
 * moment de l'incident » ne se pose qu'après coup.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getAdminUsers,
  getPlatformAdmins,
  revokePlatformRole,
  type AdminUser,
  type PlatformAdminProfile,
} from "@/actions/admin.actions";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { RoleDialog } from "@/components/admin/role-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { dateCourte } from "@/lib/admin/format";

export default function AdministratorsPage() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const { hasPlatformPermission, me } = useAdminPermissions();
  const peutGerer = hasPlatformPermission("platform_admins.manage");
  const [voirRevoques, setVoirRevoques] = useState(false);
  const [profils, setProfils] = useState<PlatformAdminProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tour, setTour] = useState(0);

  const [cibleRole, setCibleRole] = useState<{ id: string; label: string; role: PlatformAdminProfile["role"] | null } | null>(null);
  const [cibleRetrait, setCibleRetrait] = useState<PlatformAdminProfile | null>(null);

  const [recherche, setRecherche] = useState("");
  const terme = useDebouncedValue(recherche);
  const [candidats, setCandidats] = useState<AdminUser[]>([]);

  const actualiser = useCallback(() => setTour((t) => t + 1), []);

  useEffect(() => {
    if (!jeton) return;
    let annule = false;
    (async () => {
      const r = await getPlatformAdmins(jeton, voirRevoques ? {} : { is_active: true });
      if (annule) return;
      if (r.success && r.data) setProfils(r.data.results);
      else toast.error(r.message);
      setIsLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, voirRevoques, tour]);

  useEffect(() => {
    if (!jeton || !peutGerer || terme.trim().length < 2) return;
    let annule = false;
    (async () => {
      const r = await getAdminUsers(jeton, { search: terme.trim(), is_active: true, page_size: 8 });
      if (!annule && r.success && r.data) setCandidats(r.data.results.filter((u) => !u.platform_role));
    })();
    return () => {
      annule = true;
    };
  }, [jeton, terme, peutGerer]);

  const retirer = async (motif: string) => {
    if (!jeton || !cibleRetrait) return false;
    const r = await revokePlatformRole(jeton, cibleRetrait.user_id, motif);
    if (!r.success) {
      toast.error(r.message);
      return false;
    }
    toast.success("Rôle retiré.");
    actualiser();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Administrateurs</h1>
        <p className="text-muted-foreground">Les comptes de l&apos;équipe qui administrent la plateforme.</p>
      </div>

      {peutGerer && (
        <Card className="border">
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <p className="font-medium">Nommer un administrateur</p>
            </div>
            <Input
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value);
                if (e.target.value.trim().length < 2) setCandidats([]);
              }}
              placeholder="Rechercher un compte par adresse ou par nom"
            />
            {terme.trim().length >= 2 && (
              <div className="divide-y rounded-lg border">
                {candidats.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Aucun compte sans rôle ne correspond.</p>
                ) : (
                  candidats.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{u.full_name || u.email}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <Button size="sm" onClick={() => setCibleRole({ id: u.id, label: u.email, role: null })}>
                        Attribuer un rôle
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Le compte doit exister. Pour un nouveau membre de l&apos;équipe, créez-le d&apos;abord depuis « Utilisateurs ».
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">{voirRevoques ? "Tous les rôles, y compris retirés" : "Rôles actifs"}</p>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={voirRevoques} onCheckedChange={setVoirRevoques} />
            Voir les rôles retirés
          </label>
        </div>
        {isLoading ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : profils.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun administrateur.</p>
        ) : (
          <div className="divide-y">
            {profils.map((p) => {
              const soiMeme = p.user_id === me?.id;
              return (
                <div key={p.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ShieldCheck className={p.is_active ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"} />
                      <Link href={`/admin/users/${p.user_id}`} className="font-medium hover:underline">
                        {p.full_name || p.email}
                      </Link>
                      <Badge variant={p.is_active ? "default" : "outline"}>{p.role_display}</Badge>
                      {!p.is_active && <Badge variant="outline">Retiré</Badge>}
                      {!p.user_is_active && <Badge variant="outline">Compte désactivé</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.email} · accordé le {dateCourte(p.granted_at)}
                      {p.granted_by_email ? ` par ${p.granted_by_email}` : " (migration)"}
                      {p.revoked_at && ` · retiré le ${dateCourte(p.revoked_at)}${p.revoked_by_email ? ` par ${p.revoked_by_email}` : ""}`}
                    </p>
                  </div>
                  {peutGerer && p.is_active && !soiMeme && (
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCibleRole({ id: p.user_id, label: p.email, role: p.role })}>
                        Changer le rôle
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setCibleRetrait(p)}>
                        Retirer
                      </Button>
                    </div>
                  )}
                  {soiMeme && <p className="text-xs text-muted-foreground">C&apos;est vous : votre rôle se change par un autre administrateur.</p>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {cibleRole && (
        <RoleDialog
          open
          onOpenChange={(o) => !o && setCibleRole(null)}
          userId={cibleRole.id}
          userLabel={cibleRole.label}
          roleActuel={cibleRole.role}
          onDone={() => {
            setRecherche("");
            setCandidats([]);
            actualiser();
          }}
        />
      )}

      <ConfirmDialog
        open={cibleRetrait !== null}
        onOpenChange={(o) => !o && setCibleRetrait(null)}
        title="Retirer le rôle"
        entityName={cibleRetrait?.email}
        description="Le compte perd immédiatement l'accès à l'administration. Il reste utilisable comme compte marchand, et son historique de rôle est conservé."
        confirmLabel="Retirer le rôle"
        destructive
        onConfirm={retirer}
      />
    </div>
  );
}
