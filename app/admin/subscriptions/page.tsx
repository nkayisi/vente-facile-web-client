"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
  getAdminSubscriptions,
  getAdminOrganizations,
  getAdminPlans,
  extendSubscription,
  cancelSubscription,
  createAdminSubscription,
  AdminSubscription,
  AdminOrganization,
  AdminPlan,
  CreateSubscriptionData,
} from "@/actions/admin.actions";
import {
  Search,
  Eye,
  Calendar,
  X,
  Loader2,
  MoreHorizontal,
  Plus,
  ChevronsUpDown,
  Check,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

function generatePageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) pages.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push("ellipsis");

  pages.push(total);

  return pages;
}

const BILLING_CYCLES = [
  { value: "monthly", label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "yearly", label: "Annuel" },
];

export default function AdminSubscriptionsPage() {
  const { data: session } = useSession();
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [billingCycleFilter, setBillingCycleFilter] = useState<string>("all");
  const [planFilter] = useState<string>("all");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Extend dialog
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<AdminSubscription | null>(null);
  const [extendDays, setExtendDays] = useState(30);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [initialOrgs, setInitialOrgs] = useState<AdminOrganization[]>([]);
  const [orgSearchResults, setOrgSearchResults] = useState<AdminOrganization[]>([]);
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [isSearchingOrgs, setIsSearchingOrgs] = useState(false);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [orgPopoverOpen, setOrgPopoverOpen] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSubscriptionData>({
    organization: "",
    plan: "",
    billing_cycle: "monthly",
    start_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [selectedOrg, setSelectedOrg] = useState<AdminOrganization | null>(null);
  const orgSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const fetchSubscriptions = useCallback(() => {
    if (!session?.accessToken) return;

    setIsLoading(true);
    const filters: Record<string, string | number> = {
      page: currentPage,
      page_size: pageSize,
    };

    if (debouncedSearch) filters.search = debouncedSearch;
    if (statusFilter !== "all") filters.status = statusFilter;
    if (billingCycleFilter !== "all") filters.billing_cycle = billingCycleFilter;
    if (planFilter !== "all") filters.plan = planFilter;

    getAdminSubscriptions(session.accessToken, filters).then((result) => {
      if (result.success && result.data) {
        setSubscriptions(result.data.results);
        setTotalCount(result.data.count);
      } else {
        toast.error(result.message || "Erreur lors du chargement");
      }
      setIsLoading(false);
    });
  }, [session, debouncedSearch, statusFilter, billingCycleFilter, planFilter, currentPage, pageSize]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(fetchSubscriptions, [fetchSubscriptions]);

  
  async function handleExtend(subscriptionId: string) {
    if (!session?.accessToken) return;

    setIsActionLoading(true);
    const result = await extendSubscription(session.accessToken, subscriptionId, extendDays);
    if (result.success) {
      toast.success(result.message);
      setExtendDialogOpen(false);
      setSelectedSubscription(null);
      fetchSubscriptions();
    } else {
      toast.error(result.message || "Erreur lors de la prolongation");
    }
    setIsActionLoading(false);
  }

  async function handleCancel(subscriptionId: string) {
    if (!session?.accessToken) return;
    if (!confirm("Êtes-vous sûr de vouloir annuler cet abonnement ?")) return;

    setIsActionLoading(true);
    const result = await cancelSubscription(session.accessToken, subscriptionId);
    if (result.success) {
      toast.success(result.message);
      fetchSubscriptions();
    } else {
      toast.error(result.message || "Erreur lors de l'annulation");
    }
    setIsActionLoading(false);
  }

  function openExtendDialog(subscription: AdminSubscription) {
    setSelectedSubscription(subscription);
    setExtendDays(30);
    setExtendDialogOpen(true);
  }

  async function openCreateDialog() {
    setCreateForm({
      organization: "",
      plan: "",
      billing_cycle: "monthly",
      start_date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setSelectedOrg(null);
    setOrgSearchQuery("");
    setOrgSearchResults([]);
    setInitialOrgs([]);
    setOrgPopoverOpen(false);
    setCreateDialogOpen(true);

    if (!session?.accessToken) return;
    setIsLoadingOptions(true);
    const [orgsResult, plansResult] = await Promise.all([
      getAdminOrganizations(session.accessToken, { page_size: 5 }),
      getAdminPlans(session.accessToken),
    ]);
    if (orgsResult.success && orgsResult.data) setInitialOrgs(orgsResult.data.results);
    if (plansResult.success && plansResult.data) setPlans(plansResult.data);
    setIsLoadingOptions(false);
  }

  function handleOrgSearchChange(query: string) {
    setOrgSearchQuery(query);

    if (orgSearchTimer.current) clearTimeout(orgSearchTimer.current);

    if (!query.trim()) {
      setOrgSearchResults([]);
      setIsSearchingOrgs(false);
      return;
    }

    setIsSearchingOrgs(true);
    orgSearchTimer.current = setTimeout(async () => {
      if (!session?.accessToken) return;
      const result = await getAdminOrganizations(session.accessToken, {
        search: query.trim(),
        page_size: 10,
      });
      if (result.success && result.data) {
        setOrgSearchResults(result.data.results);
      }
      setIsSearchingOrgs(false);
    }, 300);
  }

  const displayedOrgs = orgSearchQuery.trim() ? orgSearchResults : initialOrgs;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    if (!createForm.organization || !createForm.plan) {
      toast.error("Veuillez sélectionner un établissement et un plan");
      return;
    }

    setIsActionLoading(true);
    const result = await createAdminSubscription(session.accessToken, createForm);
    if (result.success) {
      toast.success(result.message);
      setCreateDialogOpen(false);
      fetchSubscriptions();
    } else {
      toast.error(result.message || "Erreur lors de la création");
    }
    setIsActionLoading(false);
  }

  const getStatusBadge = (status: string, display: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-100 text-green-700",
      trial: "bg-blue-100 text-blue-700",
      past_due: "bg-amber-100 text-amber-700",
      expired: "bg-red-100 text-red-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return <Badge className={styles[status] || ""}>{display}</Badge>;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Abonnements</h1>
          <p className="text-muted-foreground">{totalCount} abonnement{totalCount > 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvel abonnement
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="trial">Essai</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="past_due">En retard</SelectItem>
            <SelectItem value="expired">Expiré</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
        <Select value={billingCycleFilter} onValueChange={setBillingCycleFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Cycle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="monthly">Mensuel</SelectItem>
            <SelectItem value="quarterly">Trimestriel</SelectItem>
            <SelectItem value="yearly">Annuel</SelectItem>
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
                  <TableHead>Organisation</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Jours restants</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <Link href={`/admin/subscriptions/${sub.id}`} className="font-medium hover:text-primary transition-colors">{sub.organization_name}</Link>
                    </TableCell>
                    <TableCell>{sub.plan_name}</TableCell>
                    <TableCell>{getStatusBadge(sub.status, sub.status_display)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{sub.billing_cycle_display}</Badge>
                    </TableCell>
                    <TableCell>{parseFloat(sub.price).toLocaleString()} {sub.currency}</TableCell>
                    <TableCell>
                      <span className={sub.days_remaining <= 5 ? "text-amber-600 font-medium" : sub.days_remaining <= 0 ? "text-red-600 font-medium" : ""}>
                        {sub.days_remaining > 0 ? `${sub.days_remaining} jours` : "Expiré"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(sub.current_period_start).toLocaleDateString()} - {new Date(sub.current_period_end).toLocaleDateString()}
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
                            <Link href={`/admin/subscriptions/${sub.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> Détails
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/organizations/${sub.organization}`}>
                              <Building2 className="mr-2 h-4 w-4" /> Établissement
                            </Link>
                          </DropdownMenuItem>
                          {sub.status === "active" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openExtendDialog(sub)}>
                                <Calendar className="mr-2 h-4 w-4" /> Prolonger
                              </DropdownMenuItem>
                            </>
                          )}
                          {["active", "trial", "past_due"].includes(sub.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleCancel(sub.id)} disabled={isActionLoading} className="text-destructive">
                                <X className="mr-2 h-4 w-4" /> Annuler
                              </DropdownMenuItem>
                            </>
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
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} sur {totalPages} · {totalCount} résultat{totalCount > 1 ? "s" : ""}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>

                    {generatePageNumbers(currentPage, totalPages).map((page, idx) =>
                      page === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={page}>
                          <PaginationLink
                            isActive={page === currentPage}
                            onClick={() => setCurrentPage(page as number)}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Extend Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prolonger l&apos;abonnement</DialogTitle>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedSubscription.organization_name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedSubscription.plan_name} — expire le {new Date(selectedSubscription.current_period_end).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="extendDays">Jours à ajouter</Label>
                <Input id="extendDays" type="number" min="1" max="365" value={extendDays} onChange={(e) => setExtendDays(parseInt(e.target.value))} />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>Annuler</Button>
                <Button onClick={() => handleExtend(selectedSubscription.id)} disabled={isActionLoading}>
                  {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Prolonger
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Subscription Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer un abonnement</DialogTitle>
          </DialogHeader>

          {isLoadingOptions ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-5 pt-2">

              {/* Établissement — combobox */}
              <div className="space-y-2">
                <Label>Établissement <span className="text-destructive">*</span></Label>
                <Popover open={orgPopoverOpen} onOpenChange={setOrgPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={orgPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedOrg ? (
                        <span className="flex items-center gap-2 truncate">
                          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{selectedOrg.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Rechercher un établissement...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Nom, email ou ville..."
                        value={orgSearchQuery}
                        onValueChange={handleOrgSearchChange}
                      />
                      <CommandList>
                        {isSearchingOrgs ? (
                          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Recherche...
                          </div>
                        ) : displayedOrgs.length === 0 ? (
                          <CommandEmpty>
                            {orgSearchQuery.trim() ? "Aucun établissement trouvé." : "Aucun établissement disponible."}
                          </CommandEmpty>
                        ) : (
                          <CommandGroup heading={orgSearchQuery.trim() ? "Résultats" : "Récents"}>
                            {displayedOrgs.map((org) => (
                              <CommandItem
                                key={org.id}
                                value={org.id}
                                onSelect={() => {
                                  setSelectedOrg(org);
                                  setCreateForm((f) => ({ ...f, organization: org.id }));
                                  setOrgPopoverOpen(false);
                                  setOrgSearchQuery("");
                                }}
                              >
                                <div className="flex flex-col flex-1 min-w-0">
                                  <span className="font-medium truncate">{org.name}</span>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {org.owner_email} · {org.city}
                                  </span>
                                </div>
                                <Check
                                  className={cn(
                                    "ml-2 h-4 w-4 shrink-0",
                                    createForm.organization === org.id ? "opacity-100 text-primary" : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {selectedOrg && (
                  <div className="space-y-2">
                    {/* Carte de confirmation */}
                    <div className="flex items-center justify-between px-3 py-2 bg-accent rounded-md border border-primary/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{selectedOrg.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{selectedOrg.owner_email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setCreateForm((f) => ({ ...f, organization: "" })); setSelectedOrg(null); }}
                        className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Avertissement si abonnement actif existant */}
                    {selectedOrg.subscription_plan && selectedOrg.subscription_plan !== "-" && (
                      <div className="flex gap-3 px-3 py-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-800">Abonnement existant</p>
                          <p className="text-amber-700 mt-0.5">
                            Cet établissement a un abonnement <strong>{selectedOrg.subscription_plan}</strong> ({selectedOrg.subscription_status}).
                            {selectedOrg.subscription_end && (
                              <> Expire le {new Date(selectedOrg.subscription_end).toLocaleDateString()}.</>
                            )}
                          </p>
                          <p className="text-amber-600 mt-1">
                            En créant un nouvel abonnement, l&apos;abonnement actuel sera automatiquement remplacé.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Plan */}
              <div className="space-y-2">
                <Label>Plan <span className="text-destructive">*</span></Label>
                <Select
                  value={createForm.plan}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, plan: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.filter((p) => p.is_active).map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        <div className="flex items-center justify-between gap-4">
                          <span>{plan.name}</span>
                          <span className="text-muted-foreground text-xs">{plan.price_monthly} {plan.currency}/mois</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cycle de facturation */}
              <div className="space-y-2">
                <Label>Cycle de facturation <span className="text-destructive">*</span></Label>
                <Select
                  value={createForm.billing_cycle}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, billing_cycle: v as CreateSubscriptionData["billing_cycle"] }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date de début */}
              <div className="space-y-2">
                <Label htmlFor="start_date">Date de début</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={createForm.start_date}
                  onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes internes</Label>
                <Textarea
                  id="notes"
                  placeholder="Remarques, contexte, conditions particulières..."
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isActionLoading || !createForm.organization || !createForm.plan}>
                  {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer l&apos;abonnement
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
