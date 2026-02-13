"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Edit,
  UserX,
  UserCheck,
  Trash2,
  Shield,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { usePermissions } from "@/components/auth/permissions-provider";
import { PermissionGate } from "@/components/auth/permission-gate";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import {
  getMembers,
  createUser,
  updateMember,
  removeMember,
  type OrganizationMember,
  type CreateUserData,
} from "@/actions/users.actions";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  stock_keeper: "bg-green-100 text-green-800",
  cashier: "bg-orange-100 text-orange-800",
};

export default function UsersPage() {
  const { data: session } = useSession();
  const { permissions, organizationId, hasPermission, canManageRole } =
    usePermissions();

  // State
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserData>({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    password: "",
    role: "cashier",
  });

  // Edit dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<OrganizationMember | null>(
    null
  );
  const [editRole, setEditRole] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete dialog
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(
    null
  );
  const [isRemoving, setIsRemoving] = useState(false);

  // Toggle active dialog
  const [memberToToggle, setMemberToToggle] = useState<OrganizationMember | null>(
    null
  );
  const [isToggling, setIsToggling] = useState(false);

  // Fetch members
  const fetchMembers = useCallback(async () => {
    if (!session?.accessToken || !organizationId) return;

    setIsLoading(true);
    const filters: { role?: string; search?: string } = {};
    if (roleFilter !== "all") filters.role = roleFilter;
    if (searchQuery) filters.search = searchQuery;

    const result = await getMembers(session.accessToken, organizationId, filters);
    if (result.success && result.data) {
      setMembers(result.data.results || []);
    } else {
      toast.error(result.error || "Erreur lors du chargement");
    }
    setIsLoading(false);
  }, [session, organizationId, roleFilter, searchQuery]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Create user
  const handleCreate = async () => {
    if (!session?.accessToken || !organizationId) return;

    if (!createForm.email || !createForm.first_name || !createForm.last_name || !createForm.password) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setIsCreating(true);
    const result = await createUser(session.accessToken, organizationId, createForm);

    if (result.success) {
      toast.success("Utilisateur créé avec succès");
      setShowCreateDialog(false);
      setCreateForm({
        email: "",
        first_name: "",
        last_name: "",
        phone: "",
        password: "",
        role: "cashier",
      });
      fetchMembers();
    } else {
      toast.error(result.error || "Erreur lors de la création");
    }
    setIsCreating(false);
  };

  // Edit role
  const handleEditRole = async () => {
    if (!session?.accessToken || !organizationId || !editingMember) return;

    setIsUpdating(true);
    const result = await updateMember(
      session.accessToken,
      organizationId,
      editingMember.id,
      { role: editRole }
    );

    if (result.success) {
      toast.success("Rôle mis à jour avec succès");
      setShowEditDialog(false);
      setEditingMember(null);
      fetchMembers();
    } else {
      toast.error(result.error || "Erreur lors de la mise à jour");
    }
    setIsUpdating(false);
  };

  // Toggle active
  const handleToggleActive = async () => {
    if (!session?.accessToken || !organizationId || !memberToToggle) return;

    setIsToggling(true);
    const result = await updateMember(
      session.accessToken,
      organizationId,
      memberToToggle.id,
      { is_active: !memberToToggle.is_active }
    );

    if (result.success) {
      toast.success(
        memberToToggle.is_active
          ? "Utilisateur désactivé"
          : "Utilisateur réactivé"
      );
      setMemberToToggle(null);
      fetchMembers();
    } else {
      toast.error(result.error || "Erreur");
    }
    setIsToggling(false);
  };

  // Remove member
  const handleRemove = async () => {
    if (!session?.accessToken || !organizationId || !memberToRemove) return;

    setIsRemoving(true);
    const result = await removeMember(
      session.accessToken,
      organizationId,
      memberToRemove.id
    );

    if (result.success) {
      toast.success("Membre retiré de l'organisation");
      setMemberToRemove(null);
      fetchMembers();
    } else {
      toast.error(result.error || "Erreur");
    }
    setIsRemoving(false);
  };

  // Open edit dialog
  const openEditDialog = (member: OrganizationMember) => {
    setEditingMember(member);
    setEditRole(member.role);
    setShowEditDialog(true);
  };

  if (!hasPermission("users.view")) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <ShieldAlert className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Accès restreint</h2>
        <p className="text-gray-500">
          Vous n&apos;avez pas la permission d&apos;accéder à la gestion des utilisateurs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-orange-600" />
            Gestion des utilisateurs
          </h1>
          <p className="text-gray-500 mt-1">
            Gérez les membres de votre organisation et leurs rôles
          </p>
        </div>
        <PermissionGate permission="users.create">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvel utilisateur
          </Button>
        </PermissionGate>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="py-0">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{members.length}</div>
            <p className="text-xs text-gray-500">Total membres</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">
              {members.filter((m) => m.is_active).length}
            </div>
            <p className="text-xs text-gray-500">Actifs</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">
              {members.filter((m) => m.role === "owner" || m.role === "manager").length}
            </div>
            <p className="text-xs text-gray-500">Admin / Gérants</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">
              {members.filter((m) => !m.is_active).length}
            </div>
            <p className="text-xs text-gray-500">Désactivés</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par nom ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tous les rôles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="owner">Administrateur</SelectItem>
            <SelectItem value="manager">Gérant</SelectItem>
            <SelectItem value="stock_keeper">Magasinier</SelectItem>
            <SelectItem value="cashier">Caissier</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Members Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Aucun membre trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                  <TableHead className="hidden md:table-cell">Statut</TableHead>
                  <TableHead className="hidden lg:table-cell">Dernière connexion</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">
                          {member.user_name || `${member.user_first_name} ${member.user_last_name}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.user_email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={ROLE_COLORS[member.role] || ""}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {member.role_display || ROLE_LABELS[member.role as Role] || member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-gray-500">
                      {member.user_phone || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {member.is_active ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-800">
                          Désactivé
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-gray-500 text-sm">
                      {member.user_last_login
                        ? new Date(member.user_last_login).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "Jamais"}
                    </TableCell>
                    <TableCell>
                      {member.role !== "owner" && canManageRole(member.role) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <PermissionGate permission="users.edit">
                              <DropdownMenuItem onClick={() => openEditDialog(member)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Modifier le rôle
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate permission="users.deactivate">
                              <DropdownMenuItem
                                onClick={() => setMemberToToggle(member)}
                              >
                                {member.is_active ? (
                                  <>
                                    <UserX className="h-4 w-4 mr-2" />
                                    Désactiver
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Réactiver
                                  </>
                                )}
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate permission="users.deactivate">
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setMemberToRemove(member)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Retirer
                              </DropdownMenuItem>
                            </PermissionGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Créer un utilisateur</DialogTitle>
            <DialogDescription>
              Créez un nouveau compte utilisateur et ajoutez-le à votre organisation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom *</Label>
                <Input
                  id="first_name"
                  value={createForm.first_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, first_name: e.target.value })
                  }
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom *</Label>
                <Input
                  id="last_name"
                  value={createForm.last_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, last_name: e.target.value })
                  }
                  placeholder="Dupont"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
                placeholder="jean@exemple.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={createForm.phone}
                onChange={(e) =>
                  setCreateForm({ ...createForm, phone: e.target.value })
                }
                placeholder="+243 ..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe *</Label>
              <Input
                id="password"
                type="password"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm({ ...createForm, password: e.target.value })
                }
                placeholder="Minimum 6 caractères"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rôle *</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) =>
                  setCreateForm({ ...createForm, role: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {permissions?.manageable_roles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Changer le rôle de{" "}
              <strong>{editingMember?.user_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nouveau rôle</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {permissions?.manageable_roles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isUpdating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleEditRole}
              disabled={isUpdating || editRole === editingMember?.role}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Active Confirmation */}
      <AlertDialog
        open={!!memberToToggle}
        onOpenChange={() => setMemberToToggle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {memberToToggle?.is_active ? "Désactiver" : "Réactiver"} l&apos;utilisateur ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {memberToToggle?.is_active
                ? `${memberToToggle?.user_name} ne pourra plus accéder à l'organisation.`
                : `${memberToToggle?.user_name} pourra à nouveau accéder à l'organisation.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isToggling}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleActive}
              disabled={isToggling}
              className={
                memberToToggle?.is_active
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {isToggling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {memberToToggle?.is_active ? "Désactiver" : "Réactiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Confirmation */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={() => setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{memberToRemove?.user_name}</strong> sera retiré de
              l&apos;organisation. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRemoving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
