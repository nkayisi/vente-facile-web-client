"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  getAdminOrganizations,
  toggleOrganizationActive,
  activateOrganizationSubscription,
  AdminOrganization,
} from "@/actions/admin.actions";
import {
  Search,
  Eye,
  Power,
  CreditCard,
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

export default function AdminOrganizationsPage() {
  const { data: session } = useSession();
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>("all");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedOrg, setSelectedOrg] = useState<AdminOrganization | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, [session?.accessToken, searchQuery, statusFilter, businessTypeFilter, currentPage]);

  async function fetchOrganizations() {
    if (!session?.accessToken) return;

    setIsLoading(true);
    const filters: any = {
      page: currentPage,
      page_size: pageSize,
    };

    if (searchQuery) filters.search = searchQuery;
    if (statusFilter !== "all") filters.is_active = statusFilter === "active";
    if (businessTypeFilter !== "all") filters.business_type = businessTypeFilter;

    const result = await getAdminOrganizations(session.accessToken, filters);
    if (result.success && result.data) {
      setOrganizations(result.data.results);
      setTotalCount(result.data.count);
    } else {
      toast.error(result.message || "Erreur lors du chargement");
    }
    setIsLoading(false);
  }

  async function handleToggleActive(orgId: string) {
    if (!session?.accessToken) return;

    setIsActionLoading(true);
    const result = await toggleOrganizationActive(session.accessToken, orgId);
    if (result.success) {
      toast.success(result.message);
      fetchOrganizations();
    } else {
      toast.error(result.message || "Erreur lors de la modification");
    }
    setIsActionLoading(false);
  }

  async function handleActivateSubscription(orgId: string) {
    if (!session?.accessToken) return;

    setIsActionLoading(true);
    const result = await activateOrganizationSubscription(session.accessToken, orgId, {
      plan_id: "default-plan-id", // TODO: Get actual plan ID
      billing_cycle: "monthly",
      notes: "Activation par admin",
    });

    if (result.success) {
      toast.success(result.message);
      fetchOrganizations();
    } else {
      toast.error(result.message || "Erreur lors de l'activation");
    }
    setIsActionLoading(false);
  }

  const businessTypes = [
    { value: "boutique", label: "Boutique" },
    { value: "supermarket", label: "Supermarché" },
    { value: "pharmacy", label: "Pharmacie" },
    { value: "depot", label: "Dépôt" },
    { value: "restaurant", label: "Restaurant" },
    { value: "other", label: "Autre" },
  ];

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Établissements</h1>
        <p className="text-muted-foreground">{totalCount} commerce{totalCount > 1 ? "s" : ""} enregistré{totalCount > 1 ? "s" : ""}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>
        <Select value={businessTypeFilter} onValueChange={setBusinessTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {businessTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                  <TableHead>Établissement</TableHead>
                  <TableHead>Propriétaire</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Membres</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Abonnement</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div>
                        <Link href={`/admin/organizations/${org.id}`} className="font-medium hover:text-primary transition-colors">{org.name}</Link>
                        <p className="text-sm text-muted-foreground">{org.city}, {org.country}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{org.owner_name}</p>
                        <p className="text-sm text-muted-foreground">{org.owner_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {businessTypes.find(t => t.value === org.business_type)?.label || org.business_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{org.members_count}</TableCell>
                    <TableCell>
                      <Badge variant={org.is_active ? "default" : "secondary"} className={org.is_active ? "bg-green-100 text-green-700" : ""}>
                        {org.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{org.subscription_plan}</p>
                        <p className="text-xs text-muted-foreground">{org.subscription_status}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(org.created_at).toLocaleDateString()}
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
                            <Link href={`/admin/organizations/${org.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> Voir
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleActive(org.id)} disabled={isActionLoading}>
                            <Power className="mr-2 h-4 w-4" /> {org.is_active ? "Désactiver" : "Activer"}
                          </DropdownMenuItem>
                          {org.subscription_plan === "-" && (
                            <DropdownMenuItem onClick={() => handleActivateSubscription(org.id)} disabled={isActionLoading}>
                              <CreditCard className="mr-2 h-4 w-4" /> Activer abonnement
                            </DropdownMenuItem>
                          )}
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
