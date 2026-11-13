"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
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
  AdminOrganization,
} from "@/actions/admin.actions";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ActivateSubscriptionDialog } from "@/components/admin/activate-subscription-dialog";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { AdminExportMenu } from "@/components/admin/admin-export-menu";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
import { dateCourte } from "@/lib/admin/format";
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
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { hasPlatformPermission } = useAdminPermissions();
  const [cibleToggle, setCibleToggle] = useState<AdminOrganization | null>(null);
  const [cibleAbonnement, setCibleAbonnement] = useState<AdminOrganization | null>(null);

  const jeton = session?.accessToken;
  const fetchOrganizations = useCallback(() => {
    if (!jeton) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const filters: Record<string, string | number | boolean> = {
      page: currentPage,
      page_size: pageSize,
    };

    if (debouncedSearch) filters.search = debouncedSearch;
    if (statusFilter !== "all") filters.is_active = statusFilter === "active";
    if (businessTypeFilter !== "all") filters.business_type = businessTypeFilter;

    getAdminOrganizations(jeton, filters).then((result) => {
      if (result.success && result.data) {
        setOrganizations(result.data.results);
        setTotalCount(result.data.count);
      } else {
        toast.error(result.message || "Erreur lors du chargement");
      }
      setIsLoading(false);
    });
  }, [jeton, debouncedSearch, statusFilter, businessTypeFilter, currentPage, pageSize]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(fetchOrganizations, [fetchOrganizations]);

  async function handleToggleActive(reason: string) {
    if (!session?.accessToken || !cibleToggle) return false;
    const result = await toggleOrganizationActive(session.accessToken, cibleToggle.id, reason);
    if (!result.success) {
      toast.error(result.message || "Erreur lors de la modification");
      return false;
    }
    toast.success(result.message);
    fetchOrganizations();
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Établissements</h1>
          <p className="text-muted-foreground">{totalCount} commerce{totalCount > 1 ? "s" : ""} enregistré{totalCount > 1 ? "s" : ""}</p>
        </div>
        <AdminExportMenu
          liste="organizations"
          libelle="Établissements"
          vide={!isLoading && totalCount === 0}
          filtres={{
            search: debouncedSearch,
            is_active: statusFilter === "all" ? undefined : String(statusFilter === "active"),
            business_type: businessTypeFilter === "all" ? undefined : businessTypeFilter,
          }}
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex-1 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={businessTypeFilter}
          onValueChange={(v) => {
            setBusinessTypeFilter(v);
            setCurrentPage(1);
          }}
        >
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
                        <p className="text-sm text-muted-foreground">{org.city} {org.city ? ", " : ""} {org.country}</p>
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
                      {dateCourte(org.created_at)}
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
                          {(hasPlatformPermission("organizations.toggle_active") ||
                            hasPlatformPermission("organizations.activate_subscription")) && <DropdownMenuSeparator />}
                          {hasPlatformPermission("organizations.toggle_active") && (
                            <DropdownMenuItem onClick={() => setCibleToggle(org)}>
                              <Power className="mr-2 h-4 w-4" /> {org.is_active ? "Désactiver" : "Réactiver"}
                            </DropdownMenuItem>
                          )}
                          {hasPlatformPermission("organizations.activate_subscription") && (
                            <DropdownMenuItem onClick={() => setCibleAbonnement(org)}>
                              <CreditCard className="mr-2 h-4 w-4" /> Activer un abonnement
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

      <ConfirmDialog
        open={cibleToggle !== null}
        onOpenChange={(o) => !o && setCibleToggle(null)}
        title={cibleToggle?.is_active ? "Désactiver l'établissement" : "Réactiver l'établissement"}
        entityName={cibleToggle?.name}
        description={
          cibleToggle?.is_active
            ? "L'établissement est suspendu : ses membres ne peuvent plus se connecter ni rien consulter, et les prises en main en cours sont fermées. Seuls ses terminaux déjà enrôlés peuvent encore envoyer les ventes déjà encaissées. Ses données ne sont pas touchées."
            : "L'établissement redevient actif."
        }
        confirmLabel={cibleToggle?.is_active ? "Désactiver" : "Réactiver"}
        destructive={Boolean(cibleToggle?.is_active)}
        reason={cibleToggle?.is_active ? "required" : "optional"}
        onConfirm={handleToggleActive}
      />

      {cibleAbonnement && (
        <ActivateSubscriptionDialog
          open
          onOpenChange={(o) => !o && setCibleAbonnement(null)}
          organizationId={cibleAbonnement.id}
          organizationName={cibleAbonnement.name}
          onDone={fetchOrganizations}
        />
      )}
    </div>
  );
}
