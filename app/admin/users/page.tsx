"use client";

/**
 * Tous les comptes de la plateforme.
 *
 * ⚠ Aucun compte ne se supprime : il porte des ventes, des clôtures de caisse et
 * des écritures comptables signées de son nom. On le désactive, avec un motif,
 * et le journal d'audit garde qui l'a fait.
 */
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Loader2, MoreHorizontal, Plus, Power, Search, Shield, ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAdminUsers, revokePlatformRole, toggleUserActive, type AdminUser } from "@/actions/admin.actions";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { AdminExportMenu } from "@/components/admin/admin-export-menu";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { RoleDialog } from "@/components/admin/role-dialog";
import { UserCreateDialog } from "@/components/admin/user-dialogs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { dateCourte } from "@/lib/admin/format";

const TAILLE = 20;

function initiales(nom?: string | null, email?: string) {
  if (nom) return nom.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return email?.charAt(0).toUpperCase() || "U";
}

type Geste = { type: "bascule" | "role" | "retrait"; user: AdminUser } | null;

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const { hasPlatformPermission, me } = useAdminPermissions();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("all");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [tour, setTour] = useState(0);
  const [geste, setGeste] = useState<Geste>(null);
  const [creation, setCreation] = useState(false);

  const terme = useDebouncedValue(recherche);
  const actualiser = useCallback(() => setTour((t) => t + 1), []);

  useEffect(() => {
    if (!jeton) return;
    let annule = false;
    (async () => {
      const filtres: Record<string, string | number | boolean> = { page, page_size: TAILLE };
      if (terme) filtres.search = terme;
      if (statut !== "all") filtres.is_active = statut === "active";
      if (role !== "all") filtres.is_staff = role === "staff";
      const r = await getAdminUsers(jeton, filtres);
      if (annule) return;
      if (r.success && r.data) {
        setUsers(r.data.results);
        setTotal(r.data.count);
      } else {
        toast.error(r.message || "Erreur lors du chargement");
      }
      setIsLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, terme, statut, role, page, tour]);

  // Un filtre change la liste : on repart de la première page, sinon la page 3
  // d'un résultat qui n'en a qu'une rendrait un tableau vide.
  const filtrer = <T,>(poser: (v: T) => void) => (v: T) => {
    poser(v);
    setPage(1);
  };

  const basculer = async (motif: string) => {
    if (!jeton || geste?.type !== "bascule") return false;
    const r = await toggleUserActive(jeton, geste.user.id, motif);
    if (!r.success) {
      toast.error(r.message);
      return false;
    }
    toast.success(r.message);
    actualiser();
  };

  const retirer = async (motif: string) => {
    if (!jeton || geste?.type !== "retrait") return false;
    const r = await revokePlatformRole(jeton, geste.user.id, motif);
    if (!r.success) {
      toast.error(r.message);
      return false;
    }
    toast.success("Rôle retiré.");
    actualiser();
  };

  const peutBasculer = hasPlatformPermission("users.toggle_active");
  const peutGererRoles = hasPlatformPermission("platform_admins.manage");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Utilisateurs</h1>
          <p className="text-muted-foreground">
            {total} compte{total > 1 ? "s" : ""} enregistré{total > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminExportMenu
            liste="users"
            libelle="Comptes"
            vide={!isLoading && total === 0}
            filtres={{
              search: terme,
              is_active: statut === "all" ? undefined : String(statut === "active"),
              is_staff: role === "all" ? undefined : String(role === "staff"),
            }}
          />
          {hasPlatformPermission("users.create") && (
            <Button onClick={() => setCreation(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau compte
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nom, e-mail, téléphone…"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select value={statut} onValueChange={filtrer(setStatut)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="inactive">Inactifs</SelectItem>
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={filtrer(setRole)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Rôle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les comptes</SelectItem>
              <SelectItem value="staff">Administrateurs</SelectItem>
              <SelectItem value="user">Marchands</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {terme || statut !== "all" || role !== "all"
              ? "Aucun compte pour ces filtres."
              : "Aucun compte."}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Établissements</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Rôle plateforme</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const soiMeme = u.id === me?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                              {initiales(u.full_name, u.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-primary">
                              {u.full_name || u.email.split("@")[0]}
                            </Link>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{u.organizations_count}</TableCell>
                      <TableCell>
                        <Badge variant={u.is_active ? "default" : "outline"}>{u.is_active ? "Actif" : "Inactif"}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.platform_role ? (
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            {u.platform_role_display}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.last_login ? dateCourte(u.last_login) : "Jamais"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{dateCourte(u.date_joined)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions pour ${u.email}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/users/${u.id}`}>
                                <Eye className="mr-2 h-4 w-4" /> Voir la fiche
                              </Link>
                            </DropdownMenuItem>
                            {(peutBasculer || peutGererRoles) && !soiMeme && <DropdownMenuSeparator />}
                            {peutBasculer && !soiMeme && (
                              <DropdownMenuItem onClick={() => setGeste({ type: "bascule", user: u })}>
                                <Power className="mr-2 h-4 w-4" /> {u.is_active ? "Désactiver" : "Réactiver"}
                              </DropdownMenuItem>
                            )}
                            {peutGererRoles && !soiMeme && (
                              <DropdownMenuItem onClick={() => setGeste({ type: "role", user: u })}>
                                <Shield className="mr-2 h-4 w-4" />
                                {u.platform_role ? "Changer le rôle" : "Nommer administrateur"}
                              </DropdownMenuItem>
                            )}
                            {peutGererRoles && !soiMeme && u.platform_role && (
                              <DropdownMenuItem onClick={() => setGeste({ type: "retrait", user: u })}>
                                <ShieldOff className="mr-2 h-4 w-4" /> Retirer le rôle
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {creation && (
        <UserCreateDialog open onOpenChange={(o) => !o && setCreation(false)} onCreated={actualiser} />
      )}
      {geste?.type === "role" && (
        <RoleDialog
          open
          onOpenChange={(o) => !o && setGeste(null)}
          userId={geste.user.id}
          userLabel={geste.user.full_name || geste.user.email}
          roleActuel={geste.user.platform_role}
          onDone={actualiser}
        />
      )}
      <ConfirmDialog
        open={geste?.type === "bascule"}
        onOpenChange={(o) => !o && setGeste(null)}
        title={geste?.user.is_active ? "Désactiver le compte" : "Réactiver le compte"}
        entityName={geste?.user.email}
        description={
          geste?.user.is_active
            ? "Le titulaire ne pourra plus se connecter, ni au back-office ni sur un terminal. Ses ventes et ses écritures restent."
            : "Le titulaire pourra de nouveau se connecter."
        }
        confirmLabel={geste?.user.is_active ? "Désactiver" : "Réactiver"}
        destructive={Boolean(geste?.user.is_active)}
        reason={geste?.user.is_active ? "required" : "optional"}
        onConfirm={basculer}
      />
      <ConfirmDialog
        open={geste?.type === "retrait"}
        onOpenChange={(o) => !o && setGeste(null)}
        title="Retirer le rôle plateforme"
        entityName={geste?.user.email}
        description="Le compte perd tout accès à l'administration. Son compte marchand, s'il en a un, n'est pas touché."
        confirmLabel="Retirer le rôle"
        destructive
        reason="required"
        onConfirm={retirer}
      />
    </div>
  );
}
