"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Receipt,
  ArrowRightLeft,
  Calendar,
  Search,
  MoreHorizontal,
  XCircle,
  Eye,
  Filter,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatDateTime } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  getUserOrganizations,
  Organization,
} from "@/actions/organization.actions";
import {
  getCashBalance,
  getCashMovements,
  createCashMovement,
  cancelCashMovement,
  getIncomeCategories,
  createIncomeCategory,
  CashBalance,
  CashMovement,
  CreateCashMovementData,
  IncomeCategory,
  CashMovementFilters,
} from "@/actions/cashbook.actions";
import { DataPagination } from "@/components/shared/DataPagination";
import { usePermissions } from "@/components/auth/permissions-provider";
import { PermissionGate } from "@/components/auth/permission-gate";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: "Vente",
  sale_return: "Remboursement client",
  expense: "Dépense",
  purchase: "Achat fournisseur",
  supplier_refund: "Remboursement fournisseur",
  debt_collection: "Recouvrement dette",
  fund_in: "Apport de fonds",
  fund_out: "Retrait de fonds",
  adjustment: "Ajustement",
  other_in: "Autre entrée",
  other_out: "Autre sortie",
};

export default function CashbookPage() {
  const { data: session } = useSession();
  const { hasPermission } = usePermissions();
  const { currency: defaultCurrency } = useCurrency();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [balance, setBalance] = useState<CashBalance | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const pageSize = 20;

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCashMovementData>({
    direction: "in",
    movement_type: "other_in",
    amount: "",
    description: "",
    movement_date: new Date().toISOString(),
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline type creation
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [isCreatingType, setIsCreatingType] = useState(false);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<CashMovement | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    async function fetchOrganization() {
      if (session?.accessToken) {
        const result = await getUserOrganizations(session.accessToken);
        if (result.success && result.data && result.data.length > 0) {
          setOrganization(result.data[0]);
        }
      }
    }
    fetchOrganization();
  }, [session]);

  useEffect(() => {
    if (organization && session?.accessToken) {
      fetchData();
      loadIncomeCategories();
    }
  }, [organization, session, directionFilter, typeFilter, dateFrom, dateTo, currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (organization && session?.accessToken) {
        fetchMovements();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function fetchData() {
    if (!session?.accessToken || !organization) return;
    setIsLoading(true);
    try {
      const filters: CashMovementFilters = {
        direction: directionFilter !== "all" ? directionFilter : undefined,
        movement_type: typeFilter !== "all" ? typeFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: searchQuery || undefined,
        is_cancelled: "false",
        page: currentPage,
        page_size: pageSize,
      };

      const [balanceRes, movementsRes] = await Promise.all([
        getCashBalance(session.accessToken, organization.id),
        getCashMovements(session.accessToken, organization.id, filters),
      ]);

      if (balanceRes.success && balanceRes.data) setBalance(balanceRes.data);
      if (movementsRes.success && movementsRes.data) {
        setMovements(movementsRes.data.results);
        setTotalCount(movementsRes.data.count);
        setHasNext(movementsRes.data.next !== null);
        setHasPrevious(movementsRes.data.previous !== null);
      }
    } catch {
      toast.error("Erreur lors du chargement des données");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchMovements() {
    if (!session?.accessToken || !organization) return;
    try {
      const filters: CashMovementFilters = {
        direction: directionFilter !== "all" ? directionFilter : undefined,
        movement_type: typeFilter !== "all" ? typeFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: searchQuery || undefined,
        is_cancelled: "false",
        page: currentPage,
        page_size: pageSize,
      };

      const res = await getCashMovements(session.accessToken, organization.id, filters);
      if (res.success && res.data) {
        setMovements(res.data.results);
        setTotalCount(res.data.count);
        setHasNext(res.data.next !== null);
        setHasPrevious(res.data.previous !== null);
      }
    } catch {
      // silent
    }
  }

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  async function loadIncomeCategories() {
    if (!session?.accessToken || !organization) return;
    const result = await getIncomeCategories(session.accessToken, organization.id, {
      is_active: "true",
    });
    if (result.success && result.data) {
      setIncomeCategories(result.data.results);
    }
  }

  function openCreateDialog() {
    setCreateForm({
      direction: "in",
      movement_type: "other_in",
      amount: "",
      description: "",
      movement_date: new Date().toISOString(),
      notes: "",
    });
    setShowNewTypeInput(false);
    setNewTypeName("");
    setShowCreateDialog(true);
  }

  async function handleCreateType() {
    if (!session?.accessToken || !organization) return;
    if (!newTypeName.trim()) {
      toast.error("Le nom du type est requis");
      return;
    }

    setIsCreatingType(true);
    const result = await createIncomeCategory(session.accessToken, organization.id, {
      name: newTypeName.trim(),
      is_active: true,
    });
    setIsCreatingType(false);

    if (result.success && result.data) {
      toast.success("Type créé");
      setNewTypeName("");
      setShowNewTypeInput(false);
      await loadIncomeCategories();
      setCreateForm({ ...createForm, income_category: result.data.id });
    } else {
      toast.error(result.error || "Erreur lors de la création du type");
    }
  }

  async function handleCreate() {
    if (!session?.accessToken || !organization) return;
    if (!createForm.amount || !createForm.description) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCashMovement(
        session.accessToken,
        organization.id,
        createForm
      );
      if (res.success) {
        toast.success("Entrée de caisse enregistrée");
        setShowCreateDialog(false);
        fetchData();
      } else {
        toast.error(res.error || "Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!session?.accessToken || !organization || !cancelTarget) return;
    setIsSubmitting(true);
    try {
      const res = await cancelCashMovement(
        session.accessToken,
        organization.id,
        cancelTarget.id,
        cancelReason
      );
      if (res.success) {
        toast.success("Mouvement annulé");
        setCancelTarget(null);
        setCancelReason("");
        fetchData();
      } else {
        toast.error(res.error || "Erreur lors de l'annulation");
      }
    } catch {
      toast.error("Erreur lors de l'annulation");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading && !movements.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Livre de caisse</h1>
          <p className="text-gray-500 text-sm mt-1">
            Suivi des entrées et sorties de caisse
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <PermissionGate permission="cashbook.create_expense">
            <Link href="/dashboard/cashbook/expenses">
              <Button variant="outline" size="sm">
                <Receipt className="h-4 w-4 mr-2" />
                Dépenses
              </Button>
            </Link>
          </PermissionGate>
          <PermissionGate permission="cashbook.view_reports">
            <Link href="/dashboard/cashbook/reports">
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Rapports de caisse
              </Button>
            </Link>
          </PermissionGate>
          <PermissionGate permission="cashbook.create_movement">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => openCreateDialog()}
            >
              <ArrowDownLeft className="h-4 w-4 mr-2" />
              Entrée
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="gap-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">
              Solde de caisse
            </CardTitle>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <StatValue value={balance ? formatPrice(balance.balance) : formatPrice(0)} />
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">
              Entrées du jour
            </CardTitle>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <StatValue value={`+${balance ? formatPrice(balance.today_in) : formatPrice(0)}`} color="text-green-600" />
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">
              Sorties du jour
            </CardTitle>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <StatValue value={`-${balance ? formatPrice(balance.today_out) : formatPrice(0)}`} color="text-red-600" />
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">
              Net du jour
            </CardTitle>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <ArrowRightLeft className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <StatValue
              value={balance ? formatPrice(balance.today_net) : formatPrice(0)}
              color={balance && parseFloat(balance.today_net) >= 0 ? "text-green-600" : "text-red-600"}
            />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="in">Entrées</SelectItem>
            <SelectItem value="out">Sorties</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="sale">Vente</SelectItem>
            <SelectItem value="expense">Dépense</SelectItem>
            <SelectItem value="fund_in">Apport de fonds</SelectItem>
            <SelectItem value="fund_out">Retrait de fonds</SelectItem>
            <SelectItem value="debt_collection">Recouvrement</SelectItem>
            <SelectItem value="purchase">Achat fournisseur</SelectItem>
            <SelectItem value="sale_return">Remb. client</SelectItem>
            <SelectItem value="supplier_refund">Remb. fournisseur</SelectItem>
            <SelectItem value="adjustment">Ajustement</SelectItem>
            <SelectItem value="other_in">Autre entrée</SelectItem>
            <SelectItem value="other_out">Autre sortie</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-full sm:w-[150px]"
          placeholder="Du"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-full sm:w-[150px]"
          placeholder="Au"
        />
      </div>

      {/* Movements Table */}
      <Card className="gap-2.5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Mouvements ({totalCount})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right hidden md:table-cell">
                  Solde après
                </TableHead>
                <TableHead className="hidden lg:table-cell">Par</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                    Aucun mouvement trouvé
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => (
                  <TableRow key={m.id} className={m.is_cancelled ? "opacity-50" : ""}>
                    <TableCell className="font-mono text-xs">
                      {m.reference}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDateTime(m.movement_date)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={m.direction === "in" ? "default" : "destructive"}
                        className={
                          m.direction === "in"
                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                            : "bg-red-100 text-red-700 hover:bg-red-100"
                        }
                      >
                        {m.direction === "in" ? "↓" : "↑"}{" "}
                        {MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type_display}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {m.description}
                      {m.sale_reference && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({m.sale_reference})
                        </span>
                      )}
                      {m.expense_reference && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({m.expense_reference})
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${m.direction === "in" ? "text-green-600" : "text-red-600"
                        }`}
                    >
                      {m.direction === "in" ? "+" : "-"}
                      {formatPrice(m.amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-600 hidden md:table-cell">
                      {formatPrice(m.balance_after)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 hidden lg:table-cell">
                      {m.created_by_name}
                    </TableCell>
                    <TableCell>
                      {!m.is_cancelled && (
                        <PermissionGate permission="cashbook.cancel_movement">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setCancelTarget(m);
                                  setCancelReason("");
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Annuler
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </PermissionGate>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

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

      {/* Create Movement Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle entrée de caisse</DialogTitle>
            <DialogDescription>
              Enregistrer une entrée de caisse manuelle
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type d&apos;entrée *</Label>
              {showNewTypeInput ? (
                <div className="flex gap-2">
                  <Input
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="Nom du nouveau type..."
                    onKeyDown={(e) => e.key === "Enter" && handleCreateType()}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateType}
                    disabled={isCreatingType || !newTypeName.trim()}
                  >
                    {isCreatingType ? <Loader2 className="h-4 w-4 animate-spin" /> : "OK"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowNewTypeInput(false);
                      setNewTypeName("");
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={createForm.income_category || ""}
                    onValueChange={(value) =>
                      setCreateForm({
                        ...createForm,
                        income_category: value,
                        movement_type: "other_in"
                      })
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {incomeCategories.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: type.color }}
                            />
                            {type.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setShowNewTypeInput(true)}
                    title="Créer un nouveau type"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Montant ({defaultCurrency.symbol}) *</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={createForm.amount}
                onChange={(e) =>
                  setCreateForm({ ...createForm, amount: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
                placeholder="Description du mouvement"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) =>
                  setCreateForm({ ...createForm, notes: e.target.value })
                }
                placeholder="Notes supplémentaires..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler le mouvement</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler le mouvement{" "}
              <strong>{cancelTarget?.reference}</strong> ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Raison (optionnel)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Raison de l'annulation..."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Non, garder
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Oui, annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
