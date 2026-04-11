"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAdminUsers,
  toggleUserActive,
  toggleUserStaff,
  AdminUser,
} from "@/actions/admin.actions";
import {
  Search,
  Eye,
  Power,
  Shield,
  Loader2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const fetchUsers = useCallback(() => {
    if (!session?.accessToken) return;

    setIsLoading(true);
    const filters: Record<string, string | number | boolean> = {
      page: currentPage,
      page_size: pageSize,
    };

    if (debouncedSearch) filters.search = debouncedSearch;
    if (statusFilter !== "all") filters.is_active = statusFilter === "active";
    if (roleFilter !== "all") filters.is_staff = roleFilter === "staff";

    getAdminUsers(session.accessToken, filters).then((result) => {
      if (result.success && result.data) {
        setUsers(result.data.results);
        setTotalCount(result.data.count);
      } else {
        toast.error(result.message || "Erreur lors du chargement");
      }
      setIsLoading(false);
    });
  }, [session, debouncedSearch, statusFilter, roleFilter, currentPage, pageSize]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(fetchUsers, [fetchUsers]);

  async function handleToggleActive(userId: string) {
    if (!session?.accessToken) return;

    setIsActionLoading(true);
    const result = await toggleUserActive(session.accessToken, userId);
    if (result.success) {
      toast.success(result.message);
      fetchUsers();
    } else {
      toast.error(result.message || "Erreur lors de la modification");
    }
    setIsActionLoading(false);
  }

  async function handleToggleStaff(userId: string) {
    if (!session?.accessToken) return;

    setIsActionLoading(true);
    const result = await toggleUserStaff(session.accessToken, userId);
    if (result.success) {
      toast.success(result.message);
      fetchUsers();
    } else {
      toast.error(result.message || "Erreur lors de la modification");
    }
    setIsActionLoading(false);
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  const getInitials = (name?: string | null, email?: string) => {
    if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    return email?.charAt(0).toUpperCase() || "U";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Utilisateurs</h1>
        <p className="text-muted-foreground">{totalCount} compte{totalCount > 1 ? "s" : ""} enregistré{totalCount > 1 ? "s" : ""}</p>
      </div>

      <div className="flex flex-col justify-between sm:flex-row gap-3">
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="grid grid-cols-2 gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Rôle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="staff">Admins</SelectItem>
            <SelectItem value="user">Utilisateurs</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      <Card className="border">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Organisations</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Email vérifié</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {getInitials(user.full_name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Link href={`/admin/users/${user.id}`} className="font-medium hover:text-primary transition-colors">{user.full_name || user.email.split("@")[0]}</Link>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p>{user.organizations_count} org{user.organizations_count > 1 ? "s" : ""}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"} className={user.is_active ? "bg-green-100 text-green-700" : ""}>
                        {user.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.is_staff ? (
                        <Badge className="bg-primary text-primary-foreground">Admin</Badge>
                      ) : (
                        <Badge variant="outline">Utilisateur</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={user.is_email_verified ? "text-green-600" : "text-muted-foreground"}>
                        {user.is_email_verified ? "Oui" : "Non"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : "Jamais"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.date_joined).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/users/${user.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> Voir
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleActive(user.id)} disabled={isActionLoading || user.id === session?.user?.id}>
                            <Power className="mr-2 h-4 w-4" /> {user.is_active ? "Désactiver" : "Activer"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStaff(user.id)} disabled={isActionLoading || user.id === session?.user?.id}>
                            <Shield className="mr-2 h-4 w-4" /> {user.is_staff ? "Retirer admin" : "Promouvoir"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">Page {currentPage} sur {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
