"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Key,
  Check,
  X,
} from "lucide-react";
import { usePermissions } from "@/components/auth/permissions-provider";
import { formatDateTime, getMediaUrl } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import { PermissionGate } from "@/components/auth/permission-gate";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import {
  getMembers,
  createUser,
  updateMember,
  removeMember,
  getMemberPermissions,
  updateMemberPermissions,
  type OrganizationMember,
  type CreateUserData,
  type MemberFilters,
  type MemberPermissions,
} from "@/actions/users.actions";
import { getWarehouses, type Warehouse } from "@/actions/stock.actions";
import { DataPagination } from "@/components/shared/DataPagination";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  stock_keeper: "bg-green-100 text-green-800",
  cashier: "bg-orange-100 text-orange-800",
};

function roleNeedsWarehouses(role: string) {
  return (
    role === "manager" ||
    role === "cashier" ||
    role === "stock_keeper"
  );
}

function warehouseSelectionError(role: string, ids: string[]): string | null {
  if (!roleNeedsWarehouses(role)) return null;
  if (role === "manager") {
    return ids.length < 1
      ? "Sélectionnez au moins un entrepôt pour un gérant."
      : null;
  }
  return ids.length !== 1
    ? "Les rôles caissier et magasinier doivent avoir exactement un entrepôt assigné."
    : null;
}

export default function UsersPage() {
  const { data: session } = useSession();
  const { permissions, organizationId, hasPermission, canManageRole } =
    usePermissions();

  // State
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const pageSize = 20;

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

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
    warehouse_ids: [],
  });

  // Edit dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<OrganizationMember | null>(
    null
  );
  const [editRole, setEditRole] = useState("");
  const [editWarehouseIds, setEditWarehouseIds] = useState<string[]>([]);
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

  // Permissions dialog
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [permissionsMember, setPermissionsMember] = useState<OrganizationMember | null>(null);
  const [memberPerms, setMemberPerms] = useState<MemberPermissions | null>(null);
  const [selectedExtraPerms, setSelectedExtraPerms] = useState<string[]>([]);
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [permSearchQuery, setPermSearchQuery] = useState("");

  // Fetch members
  const fetchMembers = useCallback(async () => {
    if (!session?.accessToken || !organizationId) return;

    setIsLoading(true);
    const filters: MemberFilters = { page: currentPage, page_size: pageSize };
    if (roleFilter !== "all") filters.role = roleFilter;
    if (searchQuery) filters.search = searchQuery;

    const result = await getMembers(session.accessToken, organizationId, filters);
    if (result.success && result.data) {
      setMembers(result.data.results || []);
      setTotalCount(result.data.count || 0);
      setHasNext(result.data.next !== null);
      setHasPrevious(result.data.previous !== null);
    } else {
      toast.error(result.error || "Erreur lors du chargement");
    }
    setIsLoading(false);
  }, [session?.accessToken, organizationId, roleFilter, searchQuery, currentPage, pageSize]);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    async function loadWarehouses() {
      if (!session?.accessToken || !organizationId) return;
      const res = await getWarehouses(session.accessToken, organizationId, {
        is_active: true,
      });
      if (res.success && res.data) {
        setWarehouses(res.data);
      }
    }
    loadWarehouses();
  }, [session?.accessToken, organizationId]);

  // Create user
  const handleCreate = async () => {
    if (!session?.accessToken || !organizationId) return;

    if (!createForm.email || !createForm.first_name || !createForm.last_name || !createForm.password) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    const whErr = warehouseSelectionError(createForm.role, createForm.warehouse_ids);
    if (whErr) {
      toast.error(whErr);
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
        warehouse_ids: [],
      });
      fetchMembers();
    } else {
      toast.error(result.error || "Erreur lors de la création");
    }
    setIsCreating(false);
  };

  const editHasChanges = useMemo(() => {
    if (!editingMember) return false;
    const initialIds = [
      ...(editingMember.assigned_warehouses?.map((w) => w.id) ?? []),
    ]
      .sort()
      .join(",");
    const nextIds = [...editWarehouseIds].sort().join(",");
    return editRole !== editingMember.role || initialIds !== nextIds;
  }, [editingMember, editRole, editWarehouseIds]);

  // Edit member (rôle + entrepôts)
  const handleSaveMember = async () => {
    if (!session?.accessToken || !organizationId || !editingMember) return;

    const whErr = warehouseSelectionError(editRole, editWarehouseIds);
    if (whErr) {
      toast.error(whErr);
      return;
    }

    setIsUpdating(true);
    const result = await updateMember(
      session.accessToken,
      organizationId,
      editingMember.id,
      { role: editRole, warehouse_ids: editWarehouseIds }
    );

    if (result.success) {
      toast.success("Membre mis à jour avec succès");
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
    setEditWarehouseIds(
      member.assigned_warehouses?.map((w) => w.id) ?? []
    );
    setShowEditDialog(true);
  };

  // Open permissions dialog
  const openPermissionsDialog = async (member: OrganizationMember) => {
    if (!session?.accessToken || !organizationId) return;
    
    setPermissionsMember(member);
    setShowPermissionsDialog(true);
    setIsLoadingPerms(true);
    setPermSearchQuery("");
    
    const result = await getMemberPermissions(session.accessToken, organizationId, member.id);
    if (result.success && result.data) {
      setMemberPerms(result.data);
      setSelectedExtraPerms(result.data.extra_permissions || []);
    } else {
      toast.error(result.error || "Erreur lors du chargement des permissions");
      setShowPermissionsDialog(false);
    }
    setIsLoadingPerms(false);
  };

  // Save permissions
  const handleSavePermissions = async () => {
    if (!session?.accessToken || !organizationId || !permissionsMember) return;
    
    setIsSavingPerms(true);
    const result = await updateMemberPermissions(
      session.accessToken,
      organizationId,
      permissionsMember.id,
      selectedExtraPerms
    );
    
    if (result.success) {
      toast.success("Permissions mises à jour avec succès");
      setShowPermissionsDialog(false);
      setPermissionsMember(null);
      setMemberPerms(null);
      fetchMembers();
    } else {
      toast.error(result.error || "Erreur lors de la mise à jour des permissions");
    }
    setIsSavingPerms(false);
  };

  // Toggle a permission in extra_permissions
  const toggleExtraPerm = (perm: string) => {
    setSelectedExtraPerms((prev) =>
      prev.includes(perm)
        ? prev.filter((p) => p !== perm)
        : [...prev, perm]
    );
  };

  // Check if permissions have changed
  const permsHaveChanged = useMemo(() => {
    if (!memberPerms) return false;
    const original = [...(memberPerms.extra_permissions || [])].sort().join(",");
    const current = [...selectedExtraPerms].sort().join(",");
    return original !== current;
  }, [memberPerms, selectedExtraPerms]);

  // Filter available permissions (exclude those already in role)
  const availableExtraPerms = useMemo(() => {
    if (!memberPerms) return [];
    const rolePermsSet = new Set(memberPerms.role_permissions || []);
    return (memberPerms.all_permissions || []).filter(
      (p) => !rolePermsSet.has(p) && p.toLowerCase().includes(permSearchQuery.toLowerCase())
    );
  }, [memberPerms, permSearchQuery]);

  // Group permissions by module for better display
  const groupedPerms = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const perm of availableExtraPerms) {
      const [module] = perm.split(".");
      if (!groups[module]) groups[module] = [];
      groups[module].push(perm);
    }
    return groups;
  }, [availableExtraPerms]);

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
            <StatValue value={String(members.length)} />
            <p className="text-xs text-gray-500">Total membres</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="pt-4 pb-4">
            <StatValue value={String(members.filter((m) => m.is_active).length)} />
            <p className="text-xs text-gray-500">Actifs</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="pt-4 pb-4">
            <StatValue value={String(members.filter((m) => m.role === "owner" || m.role === "manager").length)} />
            <p className="text-xs text-gray-500">Admin / Gérants</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="pt-4 pb-4">
            <StatValue value={String(members.filter((m) => !m.is_active).length)} />
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
                  <TableHead className="hidden md:table-cell min-w-[140px]">
                    Entrepôts
                  </TableHead>
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
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={getMediaUrl(member.user_avatar)} />
                          <AvatarFallback className="bg-orange-500 text-white text-xs">
                            {(member.user_first_name?.[0] || "") + (member.user_last_name?.[0] || "") || member.user_email?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-gray-900">
                            {member.user_name || `${member.user_first_name} ${member.user_last_name}`}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.user_email}
                          </div>
                          <div className="md:hidden mt-2 flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">
                              Entrepôts
                            </span>
                            {member.role === "owner" ||
                            member.warehouse_access === "all" ? (
                              <span className="text-xs text-gray-600">
                                Tous
                              </span>
                            ) : member.assigned_warehouses &&
                              member.assigned_warehouses.length > 0 ? (
                              member.assigned_warehouses.map((w) => (
                                <Badge
                                  key={w.id}
                                  variant="outline"
                                  className="text-[10px] font-normal px-1.5 py-0"
                                >
                                  {w.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-amber-700">
                                Non défini
                              </span>
                            )}
                          </div>
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
                    <TableCell className="hidden md:table-cell align-top">
                      {member.role === "owner" ||
                      member.warehouse_access === "all" ? (
                        <span className="text-sm text-gray-600">
                          Tous les entrepôts
                        </span>
                      ) : member.assigned_warehouses &&
                        member.assigned_warehouses.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {member.assigned_warehouses.map((w) => (
                            <Badge
                              key={w.id}
                              variant="outline"
                              className="text-xs font-normal text-gray-700"
                            >
                              {w.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700">
                          Non défini
                        </span>
                      )}
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
                                Modifier le membre
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPermissionsDialog(member)}>
                                <Key className="h-4 w-4 mr-2" />
                                Gérer les permissions
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t">
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                hasNext={hasNext}
                hasPrevious={hasPrevious}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
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
                  setCreateForm((prev) => ({
                    ...prev,
                    role: value,
                    warehouse_ids:
                      value === "manager"
                        ? prev.warehouse_ids
                        : prev.warehouse_ids.slice(0, 1),
                  }))
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
            {roleNeedsWarehouses(createForm.role) ? (
              <div className="space-y-2">
                <Label>
                  {createForm.role === "manager"
                    ? "Entrepôts assignés *"
                    : "Entrepôt assigné *"}
                </Label>
                {warehouses.length === 0 ? (
                  <p className="text-sm text-amber-600 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    Aucun entrepôt actif. Créez un entrepôt dans Stock avant
                    d&apos;ajouter des utilisateurs avec un périmètre limité.
                  </p>
                ) : createForm.role === "manager" ? (
                  <>
                    <div className="max-h-44 overflow-y-auto rounded-md border border-gray-200 p-3 space-y-2">
                      {warehouses.map((w) => (
                        <label
                          key={w.id}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={createForm.warehouse_ids.includes(w.id)}
                            onChange={() =>
                              setCreateForm((f) => ({
                                ...f,
                                warehouse_ids: f.warehouse_ids.includes(w.id)
                                  ? f.warehouse_ids.filter((id) => id !== w.id)
                                  : [...f.warehouse_ids, w.id],
                              }))
                            }
                          />
                          <span>
                            {w.name}
                            {w.code ? (
                              <span className="text-gray-500 ml-1">
                                ({w.code})
                              </span>
                            ) : null}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Cochez tous les entrepôts que ce gérant pourra gérer.
                    </p>
                  </>
                ) : (
                  <>
                    <Select
                      value={createForm.warehouse_ids[0] ?? ""}
                      onValueChange={(v) =>
                        setCreateForm((f) => ({
                          ...f,
                          warehouse_ids: v ? [v] : [],
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choisir un entrepôt" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                            {w.code ? ` (${w.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Ce compte n&apos;aura accès qu&apos;à cet entrepôt.
                    </p>
                  </>
                )}
              </div>
            ) : null}
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
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le membre</DialogTitle>
            <DialogDescription>
              Rôle et entrepôts pour{" "}
              <strong>{editingMember?.user_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select
                value={editRole}
                onValueChange={(value) => {
                  setEditRole(value);
                  setEditWarehouseIds((prev) =>
                    value === "manager" ? prev : prev.slice(0, 1)
                  );
                }}
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
            {roleNeedsWarehouses(editRole) ? (
              <div className="space-y-2">
                <Label>
                  {editRole === "manager"
                    ? "Entrepôts assignés"
                    : "Entrepôt assigné"}
                </Label>
                {warehouses.length === 0 ? (
                  <p className="text-sm text-amber-600 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    Aucun entrepôt actif disponible.
                  </p>
                ) : editRole === "manager" ? (
                  <div className="max-h-44 overflow-y-auto rounded-md border border-gray-200 p-3 space-y-2">
                    {warehouses.map((w) => (
                      <label
                        key={w.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={editWarehouseIds.includes(w.id)}
                          onChange={() =>
                            setEditWarehouseIds((prev) =>
                              prev.includes(w.id)
                                ? prev.filter((id) => id !== w.id)
                                : [...prev, w.id]
                            )
                          }
                        />
                        <span>
                          {w.name}
                          {w.code ? (
                            <span className="text-gray-500 ml-1">
                              ({w.code})
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <Select
                    value={editWarehouseIds[0] ?? ""}
                    onValueChange={(v) =>
                      setEditWarehouseIds(v ? [v] : [])
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choisir un entrepôt" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                          {w.code ? ` (${w.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : null}
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
              onClick={handleSaveMember}
              disabled={isUpdating || !editHasChanges}
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

      {/* Permissions Management Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-orange-600" />
              Gérer les permissions
            </DialogTitle>
            <DialogDescription>
              Permissions pour <strong>{permissionsMember?.user_name}</strong> ({permissionsMember?.role_display})
            </DialogDescription>
          </DialogHeader>

          {isLoadingPerms ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
          ) : memberPerms ? (
            <div className="space-y-6 py-2">
              {/* Permissions du rôle (lecture seule) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  Permissions du rôle ({memberPerms.role_display})
                </Label>
                <p className="text-xs text-gray-500 mb-2">
                  Ces permissions sont héritées du rôle et ne peuvent pas être modifiées.
                </p>
                <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 rounded-lg border max-h-32 overflow-y-auto">
                  {memberPerms.role_permissions.length > 0 ? (
                    memberPerms.role_permissions.map((perm) => (
                      <Badge
                        key={perm}
                        variant="secondary"
                        className="text-xs bg-blue-100 text-blue-800"
                      >
                        {perm}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">Aucune permission de rôle</span>
                  )}
                </div>
              </div>

              {/* Permissions additionnelles */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4 text-green-600" />
                  Permissions additionnelles
                </Label>
                <p className="text-xs text-gray-500 mb-2">
                  Ajoutez des permissions supplémentaires à cet utilisateur.
                </p>
                
                {/* Permissions sélectionnées */}
                <div className="flex flex-wrap gap-1.5 p-3 bg-green-50 rounded-lg border border-green-200 min-h-[40px]">
                  {selectedExtraPerms.length > 0 ? (
                    selectedExtraPerms.map((perm) => (
                      <Badge
                        key={perm}
                        variant="secondary"
                        className="text-xs bg-green-100 text-green-800 cursor-pointer hover:bg-green-200 pr-1"
                        onClick={() => toggleExtraPerm(perm)}
                      >
                        {perm}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">Aucune permission additionnelle</span>
                  )}
                </div>
              </div>

              {/* Sélecteur de permissions disponibles */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ajouter une permission</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher une permission..."
                    value={permSearchQuery}
                    onChange={(e) => setPermSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <div className="max-h-48 overflow-y-auto rounded-lg border p-2 space-y-3">
                  {Object.keys(groupedPerms).length > 0 ? (
                    Object.entries(groupedPerms).map(([module, perms]) => (
                      <div key={module}>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 px-1">
                          {module}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {perms.map((perm) => {
                            const isSelected = selectedExtraPerms.includes(perm);
                            return (
                              <Badge
                                key={perm}
                                variant="outline"
                                className={`text-xs cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-green-100 text-green-800 border-green-300"
                                    : "hover:bg-gray-100"
                                }`}
                                onClick={() => toggleExtraPerm(perm)}
                              >
                                {isSelected && <Check className="h-3 w-3 mr-1" />}
                                {perm.split(".")[1]}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4">
                      {permSearchQuery
                        ? "Aucune permission trouvée"
                        : "Toutes les permissions sont déjà incluses dans le rôle"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPermissionsDialog(false);
                setPermissionsMember(null);
                setMemberPerms(null);
              }}
              disabled={isSavingPerms}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSavePermissions}
              disabled={isSavingPerms || !permsHaveChanged}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSavingPerms && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
