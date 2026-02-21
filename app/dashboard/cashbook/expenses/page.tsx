"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Send,
  CreditCard,
  Loader2,
  Receipt,
  Tag,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatDate } from "@/lib/format";
import {
  getUserOrganizations,
  Organization,
} from "@/actions/organization.actions";
import {
  getExpenses,
  createExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  payExpense,
  cancelExpense,
  getExpenseCategories,
  createExpenseCategory,
  Expense,
  ExpenseCategory,
  CreateExpenseData,
} from "@/actions/cashbook.actions";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataPagination } from "@/components/shared/DataPagination";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700" },
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Approuvée", color: "bg-blue-100 text-blue-700" },
  paid: { label: "Payée", color: "bg-green-100 text-green-700" },
  rejected: { label: "Rejetée", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Annulée", color: "bg-gray-100 text-gray-500" },
};

export default function ExpensesPage() {
  const { data: session } = useSession();
  const { hasPermission } = usePermissions();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const pageSize = 20;

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Create expense dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<CreateExpenseData>({
    category: "",
    description: "",
    amount: "",
    beneficiary: "",
    expense_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create category dialog
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    color: "#6B7280",
  });

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<Expense | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<Expense | null>(null);
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
    }
  }, [organization, session, statusFilter, categoryFilter, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (organization && session?.accessToken) fetchExpenses();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function fetchData() {
    if (!session?.accessToken || !organization) return;
    setIsLoading(true);
    try {
      const [expensesRes, categoriesRes] = await Promise.all([
        getExpenses(session.accessToken, organization.id, {
          status: statusFilter !== "all" ? statusFilter : undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          search: searchQuery || undefined,
          page: currentPage,
          page_size: pageSize,
        }),
        getExpenseCategories(session.accessToken, organization.id),
      ]);

      if (expensesRes.success && expensesRes.data) {
        setExpenses(expensesRes.data.results);
        setTotalCount(expensesRes.data.count);
        setHasNext(expensesRes.data.next !== null);
        setHasPrevious(expensesRes.data.previous !== null);
      }
      if (categoriesRes.success && categoriesRes.data) {
        setCategories(categoriesRes.data.results);
      }
    } catch {
      toast.error("Erreur lors du chargement");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchExpenses() {
    if (!session?.accessToken || !organization) return;
    try {
      const res = await getExpenses(session.accessToken, organization.id, {
        status: statusFilter !== "all" ? statusFilter : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: searchQuery || undefined,
        page: currentPage,
        page_size: pageSize,
      });
      if (res.success && res.data) {
        setExpenses(res.data.results);
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

  async function handleCreateExpense() {
    if (!session?.accessToken || !organization) return;
    if (!createForm.category || !createForm.description || !createForm.amount) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createExpense(
        session.accessToken,
        organization.id,
        createForm
      );
      if (res.success) {
        toast.success("Dépense créée avec succès");
        setShowCreateDialog(false);
        setCreateForm({
          category: "",
          description: "",
          amount: "",
          beneficiary: "",
          expense_date: new Date().toISOString().split("T")[0],
          notes: "",
        });
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

  async function handleCreateCategory() {
    if (!session?.accessToken || !organization) return;
    if (!categoryForm.name) {
      toast.error("Le nom est obligatoire");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createExpenseCategory(
        session.accessToken,
        organization.id,
        categoryForm
      );
      if (res.success) {
        toast.success("Catégorie créée");
        setShowCategoryDialog(false);
        setCategoryForm({ name: "", description: "", color: "#6B7280" });
        // Refresh categories
        const catRes = await getExpenseCategories(
          session.accessToken,
          organization.id
        );
        if (catRes.success && catRes.data) setCategories(catRes.data.results);
      } else {
        toast.error(res.error || "Erreur");
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAction(
    action: "submit" | "approve" | "pay",
    expense: Expense
  ) {
    if (!session?.accessToken || !organization) return;
    const token = session.accessToken;
    const orgId = organization.id;
    const actions = {
      submit: () => submitExpense(token, orgId, expense.id),
      approve: () => approveExpense(token, orgId, expense.id),
      pay: () => payExpense(token, orgId, expense.id),
    };
    const labels = {
      submit: "Dépense soumise",
      approve: "Dépense approuvée",
      pay: "Dépense marquée comme payée",
    };

    try {
      const res = await actions[action]();
      if (res.success) {
        toast.success(labels[action]);
        fetchData();
      } else {
        toast.error(res.error || "Erreur");
      }
    } catch {
      toast.error("Erreur");
    }
  }

  async function handleReject() {
    if (!session?.accessToken || !organization || !rejectTarget) return;
    setIsSubmitting(true);
    try {
      const res = await rejectExpense(
        session.accessToken,
        organization.id,
        rejectTarget.id,
        rejectReason
      );
      if (res.success) {
        toast.success("Dépense rejetée");
        setRejectTarget(null);
        setRejectReason("");
        fetchData();
      } else {
        toast.error(res.error || "Erreur");
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!session?.accessToken || !organization || !cancelTarget) return;
    setIsSubmitting(true);
    try {
      const res = await cancelExpense(
        session.accessToken,
        organization.id,
        cancelTarget.id,
        cancelReason
      );
      if (res.success) {
        toast.success("Dépense annulée");
        setCancelTarget(null);
        setCancelReason("");
        fetchData();
      } else {
        toast.error(res.error || "Erreur");
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading && !expenses.length) {
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
        <div className="flex items-center gap-3">
          <Link href="/dashboard/cashbook">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dépenses</h1>
            <p className="text-gray-500 text-sm mt-1">
              Gestion des dépenses de l&apos;établissement
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate permission="cashbook.manage_categories">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCategoryDialog(true)}
            >
              <Tag className="h-4 w-4 mr-2" />
              Catégorie
            </Button>
          </PermissionGate>
          <PermissionGate permission="cashbook.create_expense">
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle dépense
            </Button>
          </PermissionGate>
        </div>
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="approved">Approuvée</SelectItem>
            <SelectItem value="paid">Payée</SelectItem>
            <SelectItem value="rejected">Rejetée</SelectItem>
            <SelectItem value="cancelled">Annulée</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-full sm:w-[150px]"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-full sm:w-[150px]"
        />
      </div>

      {/* Expenses Table */}
      <Card className="gap-2">
        <CardHeader>
          <CardTitle className="text-base">Dépenses ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Bénéficiaire</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Créé par</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                    Aucune dépense trouvée
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense) => {
                  const statusCfg = STATUS_CONFIG[expense.status] || STATUS_CONFIG.draft;
                  return (
                    <TableRow key={expense.id}>
                      <TableCell className="font-mono text-xs">
                        {expense.reference}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(expense.expense_date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: expense.category_color }}
                          />
                          <span className="text-sm">{expense.category_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {expense.description}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {expense.beneficiary || "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatPrice(expense.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusCfg.color} hover:${statusCfg.color}`}>
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 hidden lg:table-cell">
                        {expense.created_by_name}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {expense.status === "draft" && (
                              <DropdownMenuItem onClick={() => handleAction("submit", expense)}>
                                <Send className="h-4 w-4 mr-2" />
                                Soumettre
                              </DropdownMenuItem>
                            )}
                            {expense.status === "pending" && hasPermission("cashbook.approve_expense") && (
                              <>
                                <DropdownMenuItem onClick={() => handleAction("approve", expense)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approuver
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRejectTarget(expense);
                                    setRejectReason("");
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Rejeter
                                </DropdownMenuItem>
                              </>
                            )}
                            {(expense.status === "draft" || expense.status === "pending" || expense.status === "approved") &&
                              hasPermission("cashbook.approve_expense") && (
                                <DropdownMenuItem onClick={() => handleAction("pay", expense)}>
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Payer directement
                                </DropdownMenuItem>
                              )}
                            {expense.status !== "cancelled" && expense.status !== "rejected" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setCancelTarget(expense);
                                    setCancelReason("");
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Annuler
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
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

      {/* Create Expense Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle dépense</DialogTitle>
            <DialogDescription>
              Enregistrer une nouvelle dépense
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catégorie *</Label>
                <Select
                  value={createForm.category}
                  onValueChange={(value) =>
                    setCreateForm({ ...createForm, category: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Montant (CDF) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.amount}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, amount: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
                placeholder="Description de la dépense"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bénéficiaire</Label>
                <Input
                  value={createForm.beneficiary}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, beneficiary: e.target.value })
                  }
                  placeholder="Nom du bénéficiaire"
                />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={createForm.expense_date}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, expense_date: e.target.value })
                  }
                />
              </div>
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
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateExpense}
              disabled={isSubmitting}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer la dépense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle catégorie de dépense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
                placeholder="Ex: Loyer, Transport, Salaires..."
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, description: e.target.value })
                }
                placeholder="Description optionnelle"
              />
            </div>
            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, color: e.target.value })
                  }
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <span className="text-sm text-gray-500">{categoryForm.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={isSubmitting}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la dépense</DialogTitle>
            <DialogDescription>
              Rejeter la dépense <strong>{rejectTarget?.reference}</strong> ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Raison du rejet</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Raison du rejet..."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la dépense</DialogTitle>
            <DialogDescription>
              Annuler la dépense <strong>{cancelTarget?.reference}</strong> ?
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
            <Button variant="destructive" onClick={handleCancel} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Oui, annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
