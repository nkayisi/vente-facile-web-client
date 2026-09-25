"use client";

import { messageDeRefus } from "@/lib/perimeter-refusal";
import { useEffect, useMemo, useState } from "react";
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
  ArrowRightLeft,
  ClipboardList,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/format";
import { createMoneyHelpers } from "@/lib/currency";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  } from "@/actions/organization.actions";
import {
  getOrganizationCurrencies,
  OrganizationCurrency,
} from "@/actions/settings.actions";
import {
  getExpenses,
  createExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  payExpense,
  cancelExpense,
  getExpenseCategories,
  getExpenseStats,
  Expense,
  ExpenseCategory,
  ExpenseStats,
  CreateExpenseData,
} from "@/actions/cashbook.actions";
import { buildExpenseReceipt, type ExpenseReceiptData } from "@/lib/receipt";
import { StatStrip, StatStripItem } from "@/components/shared/StatStrip";
import { MultiCurrencyTotal } from "@/components/shared/MultiCurrencyTotal";
import { useReceiptChrome } from "@/hooks/use-receipt-chrome";
import { useReceiptPrinter } from "@/hooks/use-receipt-printer";
import { usePermissions } from "@/components/auth/permissions-provider";
import { PermissionGate } from "@/components/auth/permission-gate";
import { CurrencyAmountInput } from "@/components/shared/CurrencyAmountInput";

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
import { useOrganization } from "@/components/auth/organization-checker";
import { PerimeterFilters, type PerimeterValue } from "@/components/filters/perimeter-filters";
import { usePerimeter } from "@/hooks/use-perimeter";

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
  const { currency: defaultCurrency } = useCurrency();
  const { organization } = useOrganization();
  const { chrome, paperWidth } = useReceiptChrome(session?.accessToken, organization);
  const printer = useReceiptPrinter();
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);

  // Chaque dépense est affichée dans SA devise (symbole + décimales propres).
  // Les totaux sont ventilés par devise, jamais additionnés entre elles.
  const moneyHelpers = useMemo(
    () => createMoneyHelpers(orgCurrencies, defaultCurrency),
    [orgCurrencies, defaultCurrency]
  );
  const { money, primaryCode } = moneyHelpers;

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const pageSize = 20;

  // Filters
  const [searchQuery, setSearchQueryRaw] = useState("");
  const [statusFilter, setStatusFilterRaw] = useState("all");
  const [categoryFilter, setCategoryFilterRaw] = useState("all");
  const [currencyFilter, setCurrencyFilterRaw] = useState("all");
  const [dateFrom, setDateFromRaw] = useState("");
  const [dateTo, setDateToRaw] = useState("");

  /**
   * ┌──────────────────────────────────────────────────────────────────────┐
   * │ CHANGER UN FILTRE REMET À LA PAGE 1.                                 │
   * │                                                                      │
   * │ `handleFilterChange` était écrit pour cela et n'avait AUCUN appelant :│
   * │ les six filtres posaient leur `setState` en direct. Depuis la page 3, │
   * │ filtrer sur « Payée » demandait donc la page 3 d'un résultat qui n'en │
   * │ a qu'une, et la page rendait « Aucune dépense trouvée » - un vide qui │
   * │ se lit comme une absence de données, sur un écran qui en a.           │
   * │                                                                      │
   * │ Les six setters passent par ici : câbler la fonction plutôt que de la │
   * │ supprimer, c'est traiter le défaut qu'elle signalait.                 │
   * └──────────────────────────────────────────────────────────────────────┘
   */
  const filtrer =
    <T,>(setter: (v: T) => void) =>
    (valeur: T) => {
      setter(valeur);
      setCurrentPage(1);
    };
  const setSearchQuery = filtrer(setSearchQueryRaw);
  const setStatusFilter = filtrer(setStatusFilterRaw);
  const setCategoryFilter = filtrer(setCategoryFilterRaw);
  const setCurrencyFilter = filtrer(setCurrencyFilterRaw);
  const setDateFrom = filtrer(setDateFromRaw);
  const setDateTo = filtrer(setDateToRaw);

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

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<Expense | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<Expense | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Devise de la dépense en cours de saisie (repli : devise principale).
  const expenseCurrency = createForm.currency || primaryCode;

  // Les devises de l'organisation, elle-même fournie par le contexte
  // d'`OrganizationChecker` : la redemander ici retardait cet appel
  // d'un aller-retour complet.
  useEffect(() => {
    async function fetchCurrencies() {
      if (!session?.accessToken || !organization?.id) return;
      const ccyRes = await getOrganizationCurrencies(session.accessToken, organization.id);
      if (ccyRes.success && ccyRes.data) {
        setOrgCurrencies(Array.isArray(ccyRes.data) ? ccyRes.data : []);
      }
    }
    fetchCurrencies();
  }, [session?.accessToken, organization?.id]);

  const perimetre = usePerimeter();
  const [perimeterValue, setPerimeterValueRaw] = useState<PerimeterValue>({
    warehouse: null,
    user: null,
  });
  // Le périmètre est un filtre comme les autres : il repasse par `filtrer`.
  // C'était le SEUL de la page à recevoir le setter brut, si bien que changer
  // d'entrepôt depuis la page 3 redemandait la page 3 d'un résultat qui n'en a
  // qu'une - le vide que l'encadré ci-dessus dit avoir corrigé.
  const setPerimeter = filtrer(setPerimeterValueRaw);

  /**
   * ┌──────────────────────────────────────────────────────────────────────┐
   * │ UN SEUL CHARGEUR, ET LA RECHERCHE PASSE PAR LUI.                     │
   * │                                                                      │
   * │ Il y en avait deux : `fetchData` appliquait le périmètre, et          │
   * │ `fetchExpenses` - le chemin de la recherche différée - ne l'appliquait │
   * │ PAS. Taper un terme élargissait donc la liste pendant que les puces    │
   * │ continuaient d'annoncer l'entrepôt : « Entrepôt B » au-dessus des      │
   * │ chiffres de A, le défaut que ce lot existe pour fermer.                │
   * │                                                                      │
   * │ Réparer le doublon l'aurait laissé rediverger. On le SUPPRIME, et la   │
   * │ recherche entre dans les dépendances de l'unique chargeur, différée.  │
   * │                                                                      │
   * │ `currentPage` en dépendance : il n'y était pas, si bien que cliquer    │
   * │ « page 2 » mettait à jour le pagineur et réaffichait les mêmes lignes. │
   * └──────────────────────────────────────────────────────────────────────┘
   */
  useEffect(() => {
    if (!organization || !session?.accessToken) return;
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [organization, session?.accessToken, searchQuery, statusFilter, categoryFilter, currencyFilter, dateFrom, dateTo, currentPage, perimeterValue]);


  async function fetchData() {
    if (!session?.accessToken || !organization) return;
    setIsLoading(true);
    try {
      const [expensesRes, categoriesRes, statsRes] = await Promise.all([
        getExpenses(session.accessToken, organization.id, {
          status: statusFilter !== "all" ? statusFilter : undefined,
          ...perimetre.effective({
            warehouse: perimeterValue.warehouse ?? undefined,
            user: perimeterValue.user ?? undefined,
          }),
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          currency: currencyFilter !== "all" ? currencyFilter : undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          search: searchQuery || undefined,
          page: currentPage,
          page_size: pageSize,
        }),
        getExpenseCategories(session.accessToken, organization.id),
        getExpenseStats(session.accessToken, organization.id, {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
      ]);

      const refus = messageDeRefus(expensesRes);
      if (refus) toast.error(refus);
      if (expensesRes.success && expensesRes.data) {
        setExpenses(expensesRes.data.results);
        setTotalCount(expensesRes.data.count);
        setHasNext(expensesRes.data.next !== null);
        setHasPrevious(expensesRes.data.previous !== null);
      }
      if (categoriesRes.success && categoriesRes.data) {
        setCategories(categoriesRes.data.results);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch {
      toast.error("Erreur lors du chargement");
    } finally {
      setIsLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  async function handleCreateExpense() {
    if (!session?.accessToken || !organization) return;
    if (!createForm.category || !createForm.description || !createForm.amount) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setIsSubmitting(true);
    // Ouvert sur le geste, avant l'appel réseau : sinon le navigateur bloque
    // la fenêtre.
    const job = printer.begin();
    try {
      const res = await createExpense(
        session.accessToken,
        organization.id,
        createForm
      );
      if (res.success) {
        // Une sortie de caisse sans pièce justificative n'était opposable à
        // personne : le bénéficiaire repart désormais avec un reçu signable.
        const created = res.data;
        if (chrome && created) {
          const receipt: ExpenseReceiptData = {
            kind: "expense",
            chrome,
            number: created.reference,
            date: new Date(created.expense_date).toLocaleDateString("fr-CD"),
            cashierName: session.user?.name || undefined,
            category: created.category_name || undefined,
            payee: created.beneficiary || undefined,
            paymentMethod: created.payment_method_name || undefined,
            amount: parseFloat(created.amount) || 0,
            currency: created.currency,
            description: created.description || undefined,
          };
          job.present(buildExpenseReceipt(receipt), {
            filename: `depense-${created.reference}.pdf`,
            paperWidth,
            successMessage: "Dépense enregistrée",
          });
        } else {
          job.abort();
          toast.success("Dépense créée avec succès");
        }
        setShowCreateDialog(false);
        setCreateForm({
          category: "",
          description: "",
          amount: "",
          currency: primaryCode,
          beneficiary: "",
          expense_date: new Date().toISOString().split("T")[0],
          notes: "",
        });
        fetchData();
      } else {
        job.abort();
        toast.error(res.error || "Erreur lors de la création");
      }
    } catch {
      job.abort();
      toast.error("Erreur lors de la création");
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
        <div className="flex flex-wrap items-center gap-2">
          <PermissionGate permission="cashbook.manage_categories">
            {/* Il ouvrait un dialogue qui ne savait que CRÉER : une rubrique
                mal orthographiée y restait fausse pour toujours. Il mène
                désormais à la page qui sait aussi renommer et désactiver. */}
            <Link href="/dashboard/cashbook/categories">
              <Button variant="outline" size="sm">
                <Tag className="h-4 w-4 mr-2" />
                Catégories
              </Button>
            </Link>
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

      {/* ┌──────────────────────────────────────────────────────────────────┐
          │ LES TROIS RELEVÉS SONT UN CADRAN, PAS TROIS CARTES.              │
          │                                                                  │
          │ Même défaut que sur le livre de caisse : trois `Card` de même    │
          │ forme que les tuiles cliquables, avec leurs couleurs en dur      │
          │ (`text-orange-600`, `text-gray-400`) et un `text-lg` figé qui ne │
          │ passait pas par `statValueSize` - un montant en CDF à sept       │
          │ chiffres y restait à taille fixe au lieu de céder sur la taille  │
          │ du texte.                                                        │
          │                                                                  │
          │ ⚠ Le cadran ne compte QUE les dépenses approuvées ou payées :    │
          │ `stats` filtre `status__in=['approved', 'paid']` sans jamais le  │
          │ dire à l'écran. Un brouillon n'a pas encore fait sortir de       │
          │ billet, et l'inclure donnerait un total supérieur à ce qui       │
          │ manque dans le tiroir. La règle est désormais écrite sous le     │
          │ cadran, parce qu'elle change le sens des trois chiffres.         │
          └──────────────────────────────────────────────────────────────────┘ */}
      {stats && stats.by_currency?.length > 0 && (
        <div className="space-y-2">
          <StatStrip className="lg:grid-cols-3 2xl:grid-cols-3">
            <StatStripItem label="Total dépensé" icon={Receipt}>
              <MultiCurrencyTotal
                rows={stats.by_currency.map((row) => ({
                  currency: row.currency,
                  amount: row.total,
                }))}
                money={moneyHelpers}
                color="text-destructive"
              />
            </StatStripItem>
            <StatStripItem
              label={`Équivalent en ${stats.currency}`}
              icon={ArrowRightLeft}
              value={money(stats.total_primary, stats.currency)}
            />
            <StatStripItem
              label="Dépenses engagées"
              icon={ClipboardList}
              value={formatNumber(stats.count)}
            />
          </StatStrip>
          <p className="text-xs text-muted-foreground">
            Le cadran ne compte que les dépenses approuvées ou payées : un
            brouillon n&apos;a pas encore fait sortir de billet.
          </p>
        </div>
      )}

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
        <PerimeterFilters value={perimeterValue} onChange={setPerimeter} />

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
        {orgCurrencies.length > 1 && (
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Devise" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes devises</SelectItem>
              {orgCurrencies.map((c) => (
                <SelectItem key={c.currency_code} value={c.currency_code}>
                  {c.currency_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
                        {expense.beneficiary || "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {money(expense.amount, expense.currency)}
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
                            {expense.status !== "cancelled" && expense.status !== "rejected" &&
                              hasPermission("cashbook.approve_expense") && (
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
              <CurrencyAmountInput
                id="expense-amount"
                label="Montant"
                amount={createForm.amount}
                currency={expenseCurrency}
                currencies={orgCurrencies}
                money={moneyHelpers}
                onAmountChange={(amount) =>
                  setCreateForm({ ...createForm, amount })
                }
                onCurrencyChange={(currency, amount) =>
                  setCreateForm({ ...createForm, currency, amount })
                }
              />
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
