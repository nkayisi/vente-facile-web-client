"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  AlertTriangle,
  Calendar,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  PieChart,
  Activity,
  CreditCard,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { toast } from "sonner";
import { formatPrice, formatNumber, formatDate, formatDateTime } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import {
  getDashboardSummary,
  getSalesByPeriod,
  getSalesByCategory,
  getSalesByPaymentMethod,
  getTopProducts,
  getTopCustomers,
  getCashFlow,
  getDailyCashReport,
  getProfitMargins,
  getProductProfits,
  getStockDetails,
  getStockMovementsSummary,
  getProductSupplies,
  DashboardSummary,
  SalesByPeriod,
  SalesByCategory,
  SalesByPaymentMethod,
  TopProduct,
  TopCustomer,
  CashFlowByPeriod,
  ReportFilters,
  DailyCashReportResponse,
  ProfitMargins,
  ProductProfit,
  StockDetail,
  StockMovementSummary,
  ProductSupplies,
  PaginatedResponse,
  getUserActivityReport,
  UserActivityReport,
  UserActivityFilters,
} from "@/actions/reports.actions";
import { getMembers, type OrganizationMember } from "@/actions/users.actions";
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ LE BACK-OFFICE NE FABRIQUE PLUS SES DOCUMENTS.                          │
// │                                                                          │
// │ Il les traçait en jsPDF, puis a décrit un `RapportSpec` rendu en HTML    │
// │ qu'un onglet imprimait par `window.print()` : le marchand tombait sur la │
// │ boîte d'impression du navigateur, et RIEN ne se téléchargeait. Le        │
// │ terminal, lui, produisait un vrai fichier. Un même rapport donnait donc  │
// │ deux documents, dont un qui n'existait pas tant qu'on ne l'avait pas     │
// │ enregistré à la main.                                                    │
// │                                                                          │
// │ Le serveur les rend désormais tous les trois (PDF, classeur, CSV), avec  │
// │ le moteur qui produit déjà les exports Stock et Ventes : même marque     │
// │ partout, et le PÉRIMÈTRE ENTIER au lieu des vingt lignes affichées.      │
// └──────────────────────────────────────────────────────────────────────────┘
import { ExportMenu, type ExportTarget } from "@/components/shared/ExportMenu";
import { exportStatistics, type ReportTab } from "@/actions/reports.actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataPagination } from "@/components/shared/DataPagination";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useOrganization } from "@/components/auth/organization-checker";

/**
 * Les huit onglets, dans leur ordre d'affichage.
 *
 * Une SEULE table : la barre d'onglets et le nom que porte le fichier exporté
 * s'y branchent tous les deux. Deux listes finiraient par diverger, et le
 * marchand recevrait « Rapport » là où l'écran dit « Bénéfices ».
 * Les clés sont celles de `TAB_BUILDERS` (`backend/apps/reports/exports.py`).
 */
const ONGLETS: { valeur: ReportTab; label: string }[] = [
  { valeur: "overview", label: "Vue d'ensemble" },
  { valeur: "daily-cash", label: "Rapport journalier" },
  { valeur: "sales", label: "Ventes" },
  { valeur: "products", label: "Produits" },
  { valeur: "customers", label: "Clients" },
  { valeur: "stock", label: "Stock" },
  { valeur: "profits", label: "Bénéfices" },
  { valeur: "user-activity", label: "Par utilisateur" },
];

const ONGLET_LABELS = Object.fromEntries(
  ONGLETS.map((o) => [o.valeur, o.label])
) as Record<ReportTab, string>;

/**
 * Deux familles, et le libellé dit laquelle.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA PAGE S'OUVRAIT SUR UNE FENÊTRE PRESQUE TOUJOURS VIDE.                 │
 * │                                                                          │
 * │ Le défaut était « Ce mois », qui est CALENDAIRE. Relevé le 2 septembre   │
 * │ 2026 sur les vraies données : la fenêtre couvrait deux jours, la         │
 * │ dernière vente datait du 31 août, et la page entière annonçait « Aucune  │
 * │ donnée ». Le chiffre n'était pas faux - il n'y a rien eu en septembre -  │
 * │ mais on ouvre un écran de rapports pour voir son activité, pas pour      │
 * │ apprendre que le mois vient de commencer. Le défaut revenait les         │
 * │ premiers jours de CHAQUE mois, et il se lit comme une panne.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les périodes calendaires RESTENT, et gardent leur sens : « Ce mois » doit
 * suivre le calendrier, sinon le libellé ment. Ce qui change est le défaut, et
 * l'ajout des fenêtres glissantes - les seules qui s'emboîtent quel que soit
 * le quantième, comme au tableau de bord.
 */
const PERIOD_OPTIONS = [
  { value: "last_7_days", label: "7 derniers jours" },
  { value: "last_30_days", label: "30 derniers jours" },
  { value: "last_12_months", label: "12 derniers mois" },
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "quarter", label: "Ce trimestre" },
  { value: "year", label: "Cette année" },
  { value: "custom", label: "Personnalisé" },
];

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e"];

export default function ReportsPage() {
  const { data: session } = useSession();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const { organization } = useOrganization();
  // L'identité de l'établissement n'est plus lue ici : c'est le SERVEUR qui la
  // pose sur le document, depuis l'organisation authentifiée. Elle ne peut donc
  // plus manquer sur un fichier, ni différer de celle du terminal.

  const [period, setPeriod] = useState<string>("last_30_days");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  // Data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [salesByPeriod, setSalesByPeriod] = useState<SalesByPeriod[]>([]);
  const [salesByPeriodTotal, setSalesByPeriodTotal] = useState(0);
  const [salesByCategory, setSalesByCategory] = useState<SalesByCategory[]>([]);
  const [salesByCategoryTotal, setSalesByCategoryTotal] = useState(0);
  const [salesByPaymentMethod, setSalesByPaymentMethod] = useState<SalesByPaymentMethod[]>([]);
  const [salesByPaymentMethodTotal, setSalesByPaymentMethodTotal] = useState(0);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topProductsTotal, setTopProductsTotal] = useState(0);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [topCustomersTotal, setTopCustomersTotal] = useState(0);
  const [cashFlow, setCashFlow] = useState<CashFlowByPeriod[]>([]);
  const [cashFlowTotal, setCashFlowTotal] = useState(0);

  // Nouveaux états
  const [dailyCashReport, setDailyCashReport] = useState<DailyCashReportResponse | null>(null);
  const [isLoadingDailyReport, setIsLoadingDailyReport] = useState(false);
  const [profitMargins, setProfitMargins] = useState<ProfitMargins | null>(null);
  const [productProfits, setProductProfits] = useState<ProductProfit[]>([]);
  const [productProfitsTotal, setProductProfitsTotal] = useState(0);
  const [stockDetails, setStockDetails] = useState<StockDetail[]>([]);
  const [stockDetailsTotal, setStockDetailsTotal] = useState(0);
  const [stockMovementsSummary, setStockMovementsSummary] = useState<StockMovementSummary | null>(null);
  const [productSupplies, setProductSupplies] = useState<ProductSupplies>({});
  const [selectedReportDate, setSelectedReportDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState("overview");

  // Rapport par utilisateur (admin/gérant)
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userActivityGroupBy, setUserActivityGroupBy] = useState<"day" | "hour">("day");
  const [userActivity, setUserActivity] = useState<UserActivityReport | null>(null);
  const [isLoadingUserActivity, setIsLoadingUserActivity] = useState(false);
  const [productsPage, setProductsPage] = useState(1);
  const [salesByArticlePage, setSalesByArticlePage] = useState(1);
  const [salesByCategoryPage, setSalesByCategoryPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const [profitsPage, setProfitsPage] = useState(1);
  const [customersPage, setCustomersPage] = useState(1);
  const [dailyReportMovementsPage, setDailyReportMovementsPage] = useState(1);

  // Build filters
  const getFilters = useCallback((): ReportFilters => {
    if (period === "custom" && dateFrom && dateTo) {
      return { date_from: dateFrom, date_to: dateTo, group_by: groupBy };
    }
    return { period: period as ReportFilters["period"], group_by: groupBy };
  }, [period, dateFrom, dateTo, groupBy]);

  // Chargement de l'écran, découpé selon ce qui le fait bouger.
  //
  // Un seul `fetchData` tirait les DOUZE rapports et dépendait des quatre
  // numéros de page. Cliquer « page suivante » sur un seul tableau relançait
  // donc les douze requêtes, et changer de période en déclenchait jusqu'à
  // vingt-quatre (l'effet de remise à zéro des pages produisant un second
  // cycle). Séparer rend aussi la pagination réactive : elle ne repeint plus
  // l'écran entier.

  // Les blocs qui ne dépendent que des filtres de période.
  const fetchOverview = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;

    setIsLoading(true);
    const filters = getFilters();

    try {
      const [
        summaryResult,
        salesPeriodResult,
        salesPaymentResult,
        topCustomersResult,
        cashFlowResult,
        profitResult,
        stockMovementsResult,
        productSuppliesResult,
      ] = await Promise.all([
        getDashboardSummary(session.accessToken, organization.id, filters),
        getSalesByPeriod(session.accessToken, organization.id, filters),
        getSalesByPaymentMethod(session.accessToken, organization.id, filters),
        getTopCustomers(session.accessToken, organization.id, { ...filters, limit: 10 }),
        getCashFlow(session.accessToken, organization.id, filters),
        getProfitMargins(session.accessToken, organization.id, filters),
        getStockMovementsSummary(session.accessToken, organization.id, filters),
        getProductSupplies(session.accessToken, organization.id, filters),
      ]);

      if (summaryResult.success && summaryResult.data) setSummary(summaryResult.data);
      if (salesPeriodResult.success && salesPeriodResult.data) {
        setSalesByPeriod(salesPeriodResult.data.results);
        setSalesByPeriodTotal(salesPeriodResult.data.count);
      }
      if (salesPaymentResult.success && salesPaymentResult.data) {
        setSalesByPaymentMethod(salesPaymentResult.data.results);
        setSalesByPaymentMethodTotal(salesPaymentResult.data.count);
      }
      if (topCustomersResult.success && topCustomersResult.data) {
        setTopCustomers(topCustomersResult.data.results);
        setTopCustomersTotal(topCustomersResult.data.count);
      }
      if (cashFlowResult.success && cashFlowResult.data) {
        setCashFlow(cashFlowResult.data.results);
        setCashFlowTotal(cashFlowResult.data.count);
      }
      if (profitResult.success && profitResult.data) setProfitMargins(profitResult.data);
      if (stockMovementsResult.success && stockMovementsResult.data) setStockMovementsSummary(stockMovementsResult.data);
      if (productSuppliesResult.success && productSuppliesResult.data) setProductSupplies(productSuppliesResult.data);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Erreur lors du chargement des rapports");
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken, organization?.id, getFilters]);

  // Un tableau paginé, un chargeur. Chacun ne dépend que de SA page : c'est
  // toute la correction. `setIsLoading` n'est volontairement pas touché ici,
  // pour qu'une pagination ne fasse pas disparaître le reste de l'écran.
  const fetchSalesByCategory = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;
    const result = await getSalesByCategory(session.accessToken, organization.id, {
      ...getFilters(), page: salesByCategoryPage, page_size: 20,
    });
    if (result.success && result.data) {
      setSalesByCategory(result.data.results);
      setSalesByCategoryTotal(result.data.count);
    }
  }, [session?.accessToken, organization?.id, getFilters, salesByCategoryPage]);

  const fetchTopProducts = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;
    const result = await getTopProducts(session.accessToken, organization.id, {
      ...getFilters(), page: salesByArticlePage, page_size: 20,
    });
    if (result.success && result.data) {
      setTopProducts(result.data.results);
      setTopProductsTotal(result.data.count);
    }
  }, [session?.accessToken, organization?.id, getFilters, salesByArticlePage]);

  const fetchProductProfits = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;
    const result = await getProductProfits(session.accessToken, organization.id, {
      ...getFilters(), page: profitsPage, page_size: 20,
    });
    if (result.success && result.data) {
      setProductProfits(result.data.results);
      setProductProfitsTotal(result.data.count);
    }
  }, [session?.accessToken, organization?.id, getFilters, profitsPage]);

  // L'état du stock ne dépend pas de la période : il décrit ce qui est en
  // rayon maintenant. Il ne doit donc rien recharger quand la période change.
  const fetchStockDetails = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;
    const result = await getStockDetails(session.accessToken, organization.id, {
      page: stockPage, page_size: 20,
    });
    if (result.success && result.data) {
      setStockDetails(result.data.results);
      setStockDetailsTotal(result.data.count);
    }
  }, [session?.accessToken, organization?.id, stockPage]);

  // Fetch daily cash report
  const fetchDailyCashReport = useCallback(async (date: string, page: number = 1) => {
    if (!session?.accessToken || !organization?.id) return;
    setIsLoadingDailyReport(true);
    try {
      const result = await getDailyCashReport(session.accessToken, organization.id, date, page);
      if (result.success && result.data) {
        setDailyCashReport(result.data);
      } else {
        toast.error(result.message || "Erreur lors du chargement du rapport");
      }
    } finally {
      setIsLoadingDailyReport(false);
    }
  }, [session?.accessToken, organization?.id]);

  useEffect(() => {
    if (organization && activeTab === "daily-cash" && selectedReportDate) {
      fetchDailyCashReport(selectedReportDate, dailyReportMovementsPage);
    }
  }, [organization, activeTab, selectedReportDate, dailyReportMovementsPage, fetchDailyCashReport]);

  // Charge la liste des membres pour le rapport par utilisateur
  useEffect(() => {
    async function loadMembers() {
      if (!session?.accessToken || !organization?.id || activeTab !== "user-activity") return;
      if (members.length > 0) return;
      const result = await getMembers(session.accessToken, organization.id, { page_size: 100 });
      if (result.success && result.data) {
        setMembers(result.data.results || []);
      }
    }
    loadMembers();
  }, [session?.accessToken, organization?.id, activeTab, members.length]);

  const fetchUserActivity = useCallback(async () => {
    // Aucun message d'erreur ici : l'appel est désormais déclenché par un
    // effet, pas par un bouton. Crier « Sélectionnez un utilisateur » à
    // l'ouverture de l'onglet reprocherait au marchand de ne pas avoir encore
    // choisi. L'écran le lui DIT, en état vide.
    if (!session?.accessToken || !organization?.id || !selectedUserId) return;
    setIsLoadingUserActivity(true);
    try {
      const filters: UserActivityFilters = {
        group_by: userActivityGroupBy,
      };
      if (dateFrom && dateTo) {
        filters.date_from = dateFrom;
        filters.date_to = dateTo;
      } else {
        filters.period = period as ReportFilters["period"];
      }
      const result = await getUserActivityReport(
        session.accessToken,
        organization.id,
        selectedUserId,
        filters
      );
      if (result.success && result.data) {
        setUserActivity(result.data);
      } else {
        toast.error(result.message || "Erreur lors du chargement du rapport utilisateur");
      }
    } finally {
      setIsLoadingUserActivity(false);
    }
  }, [session?.accessToken, organization?.id, selectedUserId, userActivityGroupBy, dateFrom, dateTo, period]);

  /**
   * L'activité se recharge dès qu'un de ses paramètres bouge.
   *
   * ┌──────────────────────────────────────────────────────────────────────┐
   * │ LES DÉPENDANCES SONT PRIMITIVES, ET C'EST OBLIGATOIRE.               │
   * │                                                                      │
   * │ `fetchUserActivity` est un `useCallback` dont toutes les dépendances  │
   * │ sont des chaînes : son identité ne change donc que lorsque l'une      │
   * │ d'elles change réellement. Le faire dépendre d'un objet reconstruit à │
   * │ chaque rendu relancerait l'effet sans fin, sans erreur, sans journal  │
   * │ et sans rien à l'écran - seulement une machine qui chauffe. C'est le  │
   * │ défaut qui a fait tourner l'écran d'encaissement du terminal en       │
   * │ boucle, et il ne se voit pas.                                         │
   * └──────────────────────────────────────────────────────────────────────┘
   */
  useEffect(() => {
    if (!selectedUserId) {
      setUserActivity(null);
      return;
    }
    fetchUserActivity();
  }, [selectedUserId, fetchUserActivity]);


  // Reset pages when filters change
  useEffect(() => {
    setSalesByArticlePage(1);
    setSalesByCategoryPage(1);
    setStockPage(1);
    setProfitsPage(1);
    setProductsPage(1);
    setCustomersPage(1);
  }, [period, dateFrom, dateTo]);

  // Le bouton « Actualiser » vise l'écran entier, lui : c'est le seul endroit
  // où recharger les douze rapports d'un coup a du sens.
  const refreshAll = useCallback(() => {
    fetchOverview();
    fetchSalesByCategory();
    fetchTopProducts();
    fetchProductProfits();
    fetchStockDetails();
  }, [
    fetchOverview,
    fetchSalesByCategory,
    fetchTopProducts,
    fetchProductProfits,
    fetchStockDetails,
  ]);

  // Un effet par chargeur. Chacun se réveille pour sa propre raison : les
  // blocs de synthèse quand la période bouge, chaque tableau quand SA page
  // bouge. C'est ce qui évite de relancer douze rapports pour une pagination.
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchSalesByCategory();
  }, [fetchSalesByCategory]);

  useEffect(() => {
    fetchTopProducts();
  }, [fetchTopProducts]);

  useEffect(() => {
    fetchProductProfits();
  }, [fetchProductProfits]);

  useEffect(() => {
    fetchStockDetails();
  }, [fetchStockDetails]);

  // Format date for chart
  const formatChartDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (groupBy === "month") {
      return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    }
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  // Render growth indicator
  const renderGrowth = (value: string | null) => {
    if (!value) return null;
    const num = parseFloat(value);
    if (num > 0) {
      return (
        <span className="flex items-center text-green-600 text-sm">
          <ArrowUpRight className="h-4 w-4" />
          +{num.toFixed(1)}%
        </span>
      );
    } else if (num < 0) {
      return (
        <span className="flex items-center text-red-600 text-sm">
          <ArrowDownRight className="h-4 w-4" />
          {num.toFixed(1)}%
        </span>
      );
    }
    return <span className="text-gray-500 text-sm">0%</span>;
  };

  // ┌──────────────────────────────────────────────────────────────────────┐
  // │ LE DOCUMENT NE SE FABRIQUE PLUS ICI, ET IL NE LE DOIT PLUS.          │
  // │                                                                      │
  // │ Trois générations se sont succédé à cet endroit : dix fonctions       │
  // │ jsPDF (428 lignes), puis un `RapportSpec` décrit ici et rendu en HTML │
  // │ qu'un onglet imprimait. Aucune des trois ne TÉLÉCHARGEAIT quoi que ce │
  // │ soit, et toutes trois ne portaient que les vingt lignes affichées,    │
  // │ sous un en-tête qui annonçait « 347 articles ».                       │
  // │                                                                      │
  // │ Le serveur rend le document sur le PÉRIMÈTRE ENTIER : la page ne lui  │
  // │ passe donc que son onglet et ses filtres.                             │
  // └──────────────────────────────────────────────────────────────────────┘

  /**
   * Les filtres du document, ceux-là mêmes que la page applique à l'écran.
   *
   * ⚠ NI `page` NI `page_size` : l'export porte le périmètre filtré, jamais la
   * page. C'est le défaut que ce lot referme.
   */
  const filtresExport = useCallback(() => {
    const commun =
      period === "custom" && dateFrom && dateTo
        ? { date_from: dateFrom, date_to: dateTo }
        : { period: period as ReportFilters["period"] };
    return {
      ...commun,
      group_by: groupBy,
      // Chaque onglet ajoute ce qui n'appartient qu'à lui : le serveur ignore
      // ce qui ne le concerne pas, et les passer tous évite huit branches.
      user: selectedUserId || undefined,
      date: selectedReportDate || undefined,
    };
  }, [period, dateFrom, dateTo, groupBy, selectedUserId, selectedReportDate]);

  /**
   * Ce que le menu d'export propose sur l'onglet ouvert.
   *
   * Un onglet qui n'a rien à dire ferme son menu AVEC SA RAISON : un bouton
   * grisé sans motif est un cul-de-sac, et le marchand conclut que la fonction
   * n'existe pas.
   */
  const cibleExport: ExportTarget[] = useMemo(
    () => [
      {
        key: `rapport-${activeTab}`,
        label: ONGLET_LABELS[activeTab as ReportTab] ?? "Rapport",
        run: (format) =>
          exportStatistics(
            session!.accessToken!,
            organization!.id,
            format,
            activeTab as ReportTab,
            filtresExport()
          ),
      },
    ],
    [activeTab, session, organization, filtresExport]
  );

  const exportIndisponible =
    activeTab === "user-activity" && !selectedUserId
      ? "Choisissez un utilisateur pour exporter son activité."
      : null;

  /**
   * Le menu d'export, identique sur les huit onglets.
   *
   * ┌──────────────────────────────────────────────────────────────────────────┐
   * │ UN ÉLÉMENT, ET SURTOUT PAS UN COMPOSANT DÉCLARÉ ICI.                     │
   * │                                                                          │
   * │ `const MenuExport = () => …` dans le corps du rendu fabrique un TYPE     │
   * │ neuf à chaque passage : React ne peut pas réconcilier et DÉMONTE le      │
   * │ sous-arbre. Partait avec lui l'état d'`ExportMenu` - son garde `pending` │
   * │ contre le double clic, le témoin de progression qu'il alimente, et       │
   * │ l'ouverture du menu Radix.                                               │
   * │                                                                          │
   * │ `ExportMenu` se défend pourtant de ce cas (son `event.preventDefault()`  │
   * │ empêche Radix de le démonter en plein vol) : la défense était annulée    │
   * │ depuis le parent. Tout rendu pendant un export en cours - fin d'un       │
   * │ chargement, arrivée d'une synthèse - remettait `pending` à `null`.       │
   * │                                                                          │
   * │ Un élément est un descripteur immuable : le type rendu reste             │
   * │ `ExportMenu`, la réconciliation opère, l'état survit.                    │
   * └──────────────────────────────────────────────────────────────────────────┘
   */
  const menuExport = (
    <div className="flex justify-end mb-4">
      <ExportMenu
        targets={cibleExport}
        disabled={Boolean(exportIndisponible)}
        disabledReason={exportIndisponible ?? undefined}
      />
    </div>
  );


  if (isLoading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports & Statistiques</h1>
          <p className="text-sm text-gray-500 mt-1">
            Analysez les performances de votre entreprise
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Période</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {period === "custom" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Du</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full sm:w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Au</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full sm:w-[150px]"
              />
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Grouper par</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Jour</SelectItem>
              <SelectItem value="week">Semaine</SelectItem>
              <SelectItem value="month">Mois</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ┌──────────────────────────────────────────────────────────────┐
          │ DEUX CARTES PAR RANGÉE AU TÉLÉPHONE, comme le terminal.       │
          │                                                              │
          │ `grid-cols-1` les empilait une par une : les quatre relevés   │
          │ prenaient plus d'un écran, et les onglets passaient sous la   │
          │ ligne de flottaison - on ouvrait la rubrique sans voir        │
          │ qu'elle en avait huit. L'icône monte en outre dans la ligne   │
          │ du libellé : dans une cellule de moitié, un rond de           │
          │ quarante-huit points retire un quart de la place au MONTANT,  │
          │ et un montant en CDF à sept chiffres est ce que cet écran     │
          │ doit rendre en entier.                                        │
          └──────────────────────────────────────────────────────────────┘ */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Ventes */}
          <Card className="py-1">
            <CardContent className="p-4">
              <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 shrink-0 text-orange-600" />
                    <p className="text-xs sm:text-sm text-gray-500 truncate">Chiffre d'affaires</p>
                  </div>
                  <StatValue value={formatPrice(summary.sales.total_sales)} />
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">
                      {summary.sales.total_orders} ventes
                    </span>
                    {renderGrowth(summary.sales.sales_growth)}
                  </div>
                </div>
            </CardContent>
          </Card>

          {/* Panier moyen */}
          <Card className="py-1">
            <CardContent className="p-4">
              <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <ShoppingCart className="h-4 w-4 shrink-0 text-blue-600" />
                    <p className="text-xs sm:text-sm text-gray-500 truncate">Panier moyen</p>
                  </div>
                  <StatValue value={formatPrice(summary.sales.average_order_value)} />
                  <p className="text-sm text-gray-500 mt-1">
                    {summary.sales.total_items_sold} articles vendus
                  </p>
                </div>
            </CardContent>
          </Card>

          {/* Solde caisse - le chiffre principal est l'équivalent converti en
              devise principale ; le détail par devise montre le tiroir réel
              (40 USD et 46 000 CDF coexistent, ils ne s'additionnent pas). */}
          <Card className="py-1">
            <CardContent className="p-4">
              <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 shrink-0 text-green-600" />
                    <p className="text-xs sm:text-sm text-gray-500 truncate">Solde caisse</p>
                  </div>
                  <StatValue value={formatPrice(summary.cashbook.current_balance)} />
                  {(summary.cashbook.balance_by_currency?.length ?? 0) > 1 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {summary.cashbook.balance_by_currency!
                        .map((b) => `${formatNumber(parseFloat(b.balance))} ${b.currency}`)
                        .join(" · ")}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Flux net: {formatPrice(parseFloat(summary.cashbook.net_flow))}
                  </p>
                </div>
            </CardContent>
          </Card>

          {/* Créances clients. Le carreau mène à la balance âgée : ce total
              unique, converti en devise principale, ne dit ni depuis quand la
              créance court, ni dans quelle devise elle est due. */}
          <Link
            href="/dashboard/reports/receivables"
            className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            <Card className="h-full py-1 transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 shrink-0 text-red-600" />
                    <p className="text-xs sm:text-sm text-gray-500 truncate">Créances clients</p>
                  </div>
                    <StatValue value={formatPrice(summary.customers.total_receivables)} />
                    <p className="text-sm text-gray-500 mt-1">
                      {summary.customers.customers_with_debt} client
                      {summary.customers.customers_with_debt > 1 ? "s" : ""} avec une dette
                    </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* Secondary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="px-4">
              <p className="text-xs text-gray-500">Produits actifs</p>
              <StatValue value={String(summary.stock.total_products)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4">
              <p className="text-xs text-gray-500">Valeur stock</p>
              <StatValue value={String(formatPrice(parseFloat(summary.stock.total_stock_value)))} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4">
              <p className="text-xs text-gray-500">Stock bas</p>
              <StatValue value={String(summary.stock.low_stock_count)} color="text-yellow-600" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4">
              <p className="text-xs text-gray-500">Ruptures</p>
              <StatValue value={String(summary.stock.out_of_stock_count)} color="text-red-600" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4">
              <p className="text-xs text-gray-500">Clients</p>
              <StatValue value={String(summary.customers.total_customers)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4">
              <p className="text-xs text-gray-500">Nouveaux clients</p>
              <StatValue
                value={`+${summary.customers.new_customers_period}`}
                color="text-green-600"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* ┌──────────────────────────────────────────────────────────────┐
            │ LES ONGLETS DÉFILENT, ILS NE SE REPLIENT PAS.                │
            │                                                              │
            │ `flex-wrap` les rangeait sur QUATRE lignes à 390 points, ce   │
            │ qui mange la moitié de l'écran avant le premier chiffre. Le   │
            │ terminal a tranché la même question par un défilement         │
            │ horizontal, en laissant le dernier onglet à demi visible pour │
            │ que la coupe se voie.                                         │
            │                                                              │
            │ `w-max` est ce qui compte : sans lui, la liste se contraint à │
            │ la largeur du conteneur et le défilement n'a rien à faire     │
            │ défiler.                                                      │
            └──────────────────────────────────────────────────────────────┘ */}
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="mt-3 flex w-max gap-1">
          {ONGLETS.map((onglet) => (
            <TabsTrigger key={onglet.valeur} value={onglet.valeur}>
              {onglet.label}
            </TabsTrigger>
          ))}
          </TabsList>
        </div>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-4">
          {menuExport}

          {/* Tableau 1: Ventes par article (en premier, avec pagination) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                Ventes par article ({topProducts.length} articles)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Revenus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.length > 0 ? (
                    topProducts.map((product, index) => (
                      <TableRow key={product.product_id}>
                        <TableCell>
                          <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-medium">
                            {(salesByArticlePage - 1) * 20 + index + 1}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell className="text-gray-500">{product.product_sku}</TableCell>
                        <TableCell className="text-right font-semibold">
                          <span className="block">
                            {product.quantity_display?.trim() ||
                              `${product.quantity_sold} unités`}
                          </span>
                          {product.packaging_factor != null && (
                            <span className="text-xs font-normal text-gray-500">
                              {product.quantity_sold} au total
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-orange-600">
                          {formatPrice(parseFloat(product.total_revenue))}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        Aucune donnée pour cette période
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {/* Pagination */}
              {topProductsTotal > 20 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Affichage {((salesByArticlePage - 1) * 20) + 1} - {Math.min(salesByArticlePage * 20, topProductsTotal)} sur {topProductsTotal}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSalesByArticlePage(p => Math.max(1, p - 1))}
                      disabled={salesByArticlePage === 1}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSalesByArticlePage(p => p + 1)}
                      disabled={salesByArticlePage * 20 >= topProductsTotal}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tableau 2: Ventes par catégorie (avec pagination) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-500" />
                Ventes par catégorie ({salesByCategory.length} catégories)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Revenus</TableHead>
                    <TableHead className="text-right">% du total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesByCategory.length > 0 ? (
                    salesByCategory.map((cat) => (
                      <TableRow key={cat.category_id || 'uncategorized'}>
                        <TableCell className="font-medium">{cat.category_name || 'Sans catégorie'}</TableCell>
                        <TableCell className="text-right">{cat.quantity_sold} unités</TableCell>
                        <TableCell className="text-right font-semibold text-blue-600">
                          {formatPrice(parseFloat(cat.total_revenue))}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">{cat.percentage}%</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                        Aucune donnée pour cette période
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {/* Pagination */}
              {salesByCategoryTotal > 20 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Affichage {((salesByCategoryPage - 1) * 20) + 1} - {Math.min(salesByCategoryPage * 20, salesByCategoryTotal)} sur {salesByCategoryTotal}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSalesByCategoryPage(p => Math.max(1, p - 1))}
                      disabled={salesByCategoryPage === 1}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSalesByCategoryPage(p => p + 1)}
                      disabled={salesByCategoryPage * 20 >= salesByCategoryTotal}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Graphiques (en dessous des tableaux) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sales Evolution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-5 w-5 text-orange-500" />
                  Évolution des ventes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesByPeriod}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="period"
                        tickFormatter={formatChartDate}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        tickFormatter={(v) => formatPrice(v).replace(/\s/g, "")}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value) => [formatPrice(Number(value)), "Ventes"]}
                        labelFormatter={(label) => formatChartDate(String(label))}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#f97316"
                        fill="#fed7aa"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Sales by Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-green-500" />
                  Ventes par mode de paiement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesByPaymentMethod} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => formatPrice(v)} />
                      <YAxis
                        type="category"
                        dataKey="payment_method_name"
                        width={100}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip formatter={(value) => formatPrice(Number(value))} />
                      <Bar dataKey="total" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          {menuExport}

          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-orange-500" />
                <p className="text-gray-500">Chargement des données...</p>
              </CardContent>
            </Card>
          ) : topProducts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Aucun produit vendu pour cette période</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-5 w-5 text-orange-500" />
                  Détails des produits vendus ({topProducts.length} produits)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      {/* Le stock de départ se déduit (restant + vendu) : son
                          partage scellé/vrac d'alors n'est enregistré nulle
                          part, il se compte donc en unités de détail. */}
                      <TableHead
                        className="text-right"
                        title="Reconstitué (restant + vendu), en unités de détail"
                      >
                        Stock départ
                      </TableHead>
                      <TableHead className="text-right">Approv.</TableHead>
                      <TableHead className="text-right">Qté vendue</TableHead>
                      <TableHead className="text-right">Valeur vendue</TableHead>
                      <TableHead className="text-right">Qté restante</TableHead>
                      <TableHead className="text-right">Valeur restante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.map((product) => {
                      const stockInfo = stockDetails.find(s => s.product_id === product.product_id);
                      const currentStock = stockInfo ? parseFloat(stockInfo.current_stock) : 0;
                      const startingStock = currentStock + product.quantity_sold;
                      const stockValue = stockInfo ? parseFloat(stockInfo.stock_value) : 0;
                      const supply = productSupplies[product.product_id];
                      const isPackaged = stockInfo?.packaging_factor != null;
                      return (
                        <TableRow key={product.product_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{product.product_name}</p>
                              <p className="text-xs text-gray-500">{product.product_sku}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{startingStock.toFixed(0)}</TableCell>
                          <TableCell className="text-right text-purple-600">
                            {supply && supply.quantity > 0
                              ? supply.display?.trim() || supply.quantity.toFixed(0)
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-orange-600">
                            <span className="block">
                              {product.quantity_display?.trim() || product.quantity_sold}
                            </span>
                            {product.packaging_factor != null && (
                              <span className="text-xs font-normal text-gray-500">
                                {product.quantity_sold} au total
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {formatPrice(parseFloat(product.total_revenue))}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="block">
                              {stockInfo?.stock_display?.trim() || currentStock.toFixed(0)}
                            </span>
                            {isPackaged && (
                              <span className="text-xs font-normal text-gray-500">
                                {currentStock.toFixed(0)} au total
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-blue-600">
                            {formatPrice(stockValue)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {/* Pagination */}
                {topProductsTotal > 20 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Affichage {((productsPage - 1) * 20) + 1} - {Math.min(productsPage * 20, topProductsTotal)} sur {topProductsTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProductsPage(p => Math.max(1, p - 1))}
                        disabled={productsPage === 1}
                      >
                        Précédent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProductsPage(p => p + 1)}
                        disabled={productsPage * 20 >= topProductsTotal}
                      >
                        Suivant
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          {menuExport}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-500" />
                  Meilleurs clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topCustomers.map((customer, index) => (
                    <div key={customer.customer_id} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{customer.customer_name}</p>
                        <p className="text-xs text-gray-500">{customer.order_count} commandes</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatPrice(parseFloat(customer.total_purchases))}
                        </p>
                        {parseFloat(customer.current_balance) > 0 && (
                          <p className="text-xs text-red-500">
                            Doit: {formatPrice(parseFloat(customer.current_balance))}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {topCustomers.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-8">
                      Aucune donnée pour cette période
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Customer Purchases Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  Achats par client
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCustomers.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => formatPrice(v)} />
                      <YAxis
                        type="category"
                        dataKey="customer_name"
                        width={120}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={(value) => formatPrice(Number(value))} />
                      <Bar dataKey="total_purchases" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {menuExport}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cash Flow Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-green-500" />
                  Flux de trésorerie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashFlow}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tickFormatter={formatChartDate} tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => formatPrice(v)} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value, name) => [
                          formatPrice(Number(value)),
                          name === "income" ? "Entrées" : name === "expenses" ? "Sorties" : "Net",
                        ]}
                        labelFormatter={(label) => formatChartDate(String(label))}
                      />
                      <Bar dataKey="income" fill="#22c55e" name="income" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" fill="#ef4444" name="expenses" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* ┌────────────────────────────────────────────────────────┐
                    │ LES CHIFFRES SOUS LE GRAPHIQUE, PARCE QU'UN SURVOL NE  │
                    │ SE LIT PAS.                                            │
                    │                                                        │
                    │ Le back-office cachait ses valeurs dans l'infobulle :   │
                    │ il fallait promener la souris barre par barre pour      │
                    │ savoir ce qu'une journée avait rapporté, et rien ne     │
                    │ restait à l'écran. Le terminal les rend en clair depuis │
                    │ le début - il n'a pas de survol - et c'est la lecture   │
                    │ qui manquait ici. Elles vivent DANS la section du flux, │
                    │ comme là-bas : un chiffre séparé de son graphique se    │
                    │ lit comme une seconde mesure.                           │
                    └────────────────────────────────────────────────────────┘ */}
                <div className="mt-4 space-y-1 max-h-[220px] overflow-y-auto border-t pt-3">
                  {cashFlow.length > 0 ? (
                    cashFlow.map((flux) => {
                      const net = parseFloat(flux.net);
                      return (
                        <div
                          key={flux.period}
                          className="flex items-center justify-between gap-3 py-1"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {formatChartDate(flux.period)}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              Entrées {formatPrice(parseFloat(flux.income))} · Sorties{" "}
                              {formatPrice(parseFloat(flux.expenses))}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {/* Un net négatif est la seule chose qu'on vient
                                chercher ici : il porte sa couleur, le reste
                                reste neutre pour qu'elle se voie. */}
                            <p
                              className={`text-sm font-semibold ${
                                net < 0 ? "text-red-600" : ""
                              }`}
                            >
                              {formatPrice(net)}
                            </p>
                            <p className="text-xs text-gray-500">Net</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Aucun mouvement de caisse sur cette période.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  Meilleurs clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {topCustomers.slice(0, 5).map((customer, index) => (
                    <div key={customer.customer_id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{customer.customer_name}</p>
                        <p className="text-xs text-gray-500">{customer.order_count} commandes</p>
                      </div>
                      <p className="text-sm font-semibold">{formatPrice(parseFloat(customer.total_purchases))}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        {/* Daily Cash Report Tab */}
        <TabsContent value="daily-cash" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            {/* ┌────────────────────────────────────────────────────────┐
                │ LE LIBELLÉ SORT DE LA RANGÉE, SINON RIEN NE S'ALIGNE.  │
                │                                                        │
                │ Il vivait DANS la colonne de gauche : la rangée devait  │
                │ alors aligner un bloc « libellé + champ » contre un     │
                │ bouton seul, et le `mt-5` posé sur le bouton était un   │
                │ rattrapage à la main - juste tant que le libellé fait   │
                │ une ligne, faux dès qu'il en fait deux. Le libellé      │
                │ au-dessus, les deux commandes ont la même hauteur.      │
                │ Défaut identique corrigé sur le terminal.               │
                └────────────────────────────────────────────────────────┘ */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Date du rapport</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={selectedReportDate}
                  onChange={(e) => setSelectedReportDate(e.target.value)}
                  className="w-full sm:w-[180px]"
                />
                <Button variant="outline" size="sm" onClick={() => fetchDailyCashReport(selectedReportDate, dailyReportMovementsPage)} disabled={isLoadingDailyReport} className="shrink-0">
                  {isLoadingDailyReport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  {isLoadingDailyReport ? "Chargement..." : "Charger"}
                </Button>
              </div>
            </div>
            {/* Le menu reste ouvert même si l'écran n'a rien chargé : le
                serveur rend le rapport de la date demandée, vide ou non. */}
            <ExportMenu
              targets={cibleExport}
              disabled={Boolean(exportIndisponible)}
              disabledReason={exportIndisponible ?? undefined}
            />
          </div>

          {isLoadingDailyReport ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-orange-500" />
                <p className="text-gray-500">Chargement du rapport...</p>
              </CardContent>
            </Card>
          ) : dailyCashReport ? (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Solde d'ouverture</p>
                    <p className="text-xl mt-1 font-bold">{formatPrice(parseFloat(dailyCashReport.report.opening_balance))}</p>
                  </CardContent>
                </Card>
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Solde de clôture</p>
                    <p className="text-xl mt-1 font-bold">{formatPrice(parseFloat(dailyCashReport.report.closing_balance))}</p>
                  </CardContent>
                </Card>
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Ventes du jour</p>
                    <p className="text-xl mt-1 font-bold text-green-600">{formatPrice(parseFloat(dailyCashReport.report.total_sales))}</p>
                    <p className="text-xs float-right text-gray-500">{dailyCashReport.report.total_sales_count} ventes</p>
                  </CardContent>
                </Card>
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Dépenses</p>
                    <p className="text-xl mt-1 font-bold text-red-600">{formatPrice(parseFloat(dailyCashReport.report.expenses))}</p>
                    <p className="text-xs float-right text-gray-500">{dailyCashReport.report.expenses_count} dépenses</p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Répartition des paiements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-500">Espèces</p>
                      <p className="text-lg font-semibold text-green-600">{formatPrice(parseFloat(dailyCashReport.report.cash_sales))}</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-500">Mobile Money</p>
                      <p className="text-lg font-semibold text-blue-600">{formatPrice(parseFloat(dailyCashReport.report.mobile_money_sales))}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-gray-500">Carte</p>
                      <p className="text-lg font-semibold text-purple-600">{formatPrice(parseFloat(dailyCashReport.report.card_sales))}</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-xs text-gray-500">Crédit</p>
                      <p className="text-lg font-semibold text-orange-600">{formatPrice(parseFloat(dailyCashReport.report.credit_sales))}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Movements Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Mouvements du jour</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Heure</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Entrée</TableHead>
                        <TableHead className="text-right">Sortie</TableHead>
                        <TableHead className="text-right">Solde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyCashReport.movements.results && dailyCashReport.movements.results.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm">{m.time}</TableCell>
                          <TableCell>
                            <Badge variant={m.direction === "in" ? "default" : "destructive"} className="text-xs">
                              {m.type_display}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{m.description || "-"}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {m.direction === "in" ? formatPrice(parseFloat(m.amount)) : ""}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {m.direction === "out" ? formatPrice(parseFloat(m.amount)) : ""}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatPrice(parseFloat(m.balance_after))}</TableCell>
                        </TableRow>
                      ))}
                      {(!dailyCashReport.movements.results || dailyCashReport.movements.results.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                            Aucun mouvement pour cette date
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Pagination des mouvements */}
              {dailyCashReport.movements.results && dailyCashReport.movements.results.length > 0 && (
                <div className="mt-4">
                  <DataPagination
                    currentPage={dailyReportMovementsPage}
                    totalPages={dailyCashReport.movements.total_pages || 1}
                    onPageChange={setDailyReportMovementsPage}
                    hasNext={dailyCashReport.movements.page < (dailyCashReport.movements.total_pages || 1)}
                    hasPrevious={dailyCashReport.movements.page > 1}
                  />
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Sélectionnez une date et cliquez sur "Charger" pour voir le rapport</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Stock Tab */}
        <TabsContent value="stock" className="space-y-4">
          {menuExport}

          {/* Stock Movement Summary */}
          {stockMovementsSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Résumé des mouvements de stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <ArrowDown className="h-5 w-5 mx-auto text-green-600 mb-1" />
                    <p className="text-xs text-gray-500">Entrées totales</p>
                    <p className="text-lg font-semibold text-green-600">{parseFloat(stockMovementsSummary.total_in).toFixed(0)}</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <ArrowUp className="h-5 w-5 mx-auto text-red-600 mb-1" />
                    <p className="text-xs text-gray-500">Sorties totales</p>
                    <p className="text-lg font-semibold text-red-600">{parseFloat(stockMovementsSummary.total_out).toFixed(0)}</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <ShoppingCart className="h-5 w-5 mx-auto text-orange-600 mb-1" />
                    <p className="text-xs text-gray-500">Ventes</p>
                    <p className="text-lg font-semibold text-orange-600">{parseFloat(stockMovementsSummary.sales_out).toFixed(0)}</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <Minus className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                    <p className="text-xs text-gray-500">Retours</p>
                    <p className="text-lg font-semibold text-blue-600">{parseFloat(stockMovementsSummary.returns_in).toFixed(0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stock Details Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-500" />
                  État du stock ({stockDetails.length} produits)
                </span>
                <div className="flex gap-2 text-xs">
                  <Badge variant="destructive">{stockDetails.filter(s => s.status === "out_of_stock").length} ruptures</Badge>
                  <Badge className="bg-yellow-500">{stockDetails.filter(s => s.status === "low_stock").length} bas</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead className="text-right">Valeur</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockDetails.map((s) => (
                    <TableRow key={s.product_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{s.product_name}</p>
                          <p className="text-xs text-gray-500">{s.product_sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.category_name || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        <span className="block">
                          {s.stock_display?.trim() || parseFloat(s.current_stock).toFixed(0)}
                        </span>
                        {/* Le total en unités n'a de sens à rappeler que pour un
                            produit vendu par contenant. Il se lisait auparavant
                            à la présence d'un « + » dans le libellé, donc jamais
                            pour « 3 casiers » tout ronds. */}
                        {s.packaging_factor != null && (
                          <span className="text-xs font-normal text-gray-500">
                            {parseFloat(s.current_stock).toFixed(0)} au total
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.available_display?.trim() || parseFloat(s.available_stock).toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">{formatPrice(parseFloat(s.stock_value))}</TableCell>
                      <TableCell>
                        <Badge
                          variant={s.status === "out_of_stock" ? "destructive" : s.status === "low_stock" ? "outline" : "default"}
                          className={s.status === "low_stock" ? "border-yellow-500 text-yellow-600" : s.status === "available" ? "bg-green-500" : ""}
                        >
                          {s.status === "out_of_stock" ? "Rupture" : s.status === "low_stock" ? "Bas" : "OK"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Pagination */}
              {stockDetailsTotal > 20 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Affichage {((stockPage - 1) * 20) + 1} - {Math.min(stockPage * 20, stockDetailsTotal)} sur {stockDetailsTotal}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStockPage(p => Math.max(1, p - 1))}
                      disabled={stockPage === 1}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStockPage(p => p + 1)}
                      disabled={stockPage * 20 >= stockDetailsTotal}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profits Tab */}
        <TabsContent value="profits" className="space-y-4">
          {menuExport}

          {/* Profit Summary */}
          {profitMargins && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Marges calculées sur le CA hors TVA, après remises (lignes et globale). Le bénéfice net déduit les dépenses enregistrées comme payées sur la période.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">CA (HT net)</p>
                    <p className="text-xl mt-1 font-bold">{formatPrice(parseFloat(profitMargins.total_revenue))}</p>
                  </CardContent>
                </Card>
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Coût des marchandises</p>
                    <p className="text-xl mt-1 font-bold">{formatPrice(parseFloat(profitMargins.total_cost))}</p>
                  </CardContent>
                </Card>
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Bénéfice brut</p>
                    <p className="text-xl mt-1 font-bold text-green-600">{formatPrice(parseFloat(profitMargins.gross_profit))}</p>
                    <p className="text-xs float-right text-green-600">Marge: {profitMargins.gross_margin_percentage}%</p>
                  </CardContent>
                </Card>
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Bénéfice net</p>
                    <p className="text-xl mt-1 font-bold text-purple-600">{formatPrice(parseFloat(profitMargins.net_profit))}</p>
                    <p className="text-xs float-right text-purple-600">Marge: {profitMargins.net_margin_percentage}%</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Product Profits Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Bénéfices par produit ({productProfits.length} produits)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté vendue</TableHead>
                    <TableHead className="text-right">CA (HT)</TableHead>
                    <TableHead className="text-right">Coût</TableHead>
                    <TableHead className="text-right">Bénéfice</TableHead>
                    <TableHead className="text-right">Marge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productProfits.length > 0 ? (
                    productProfits.map((p) => (
                      <TableRow key={p.product_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{p.product_name}</p>
                            <p className="text-xs text-gray-500">{p.product_sku}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="block">
                            {p.quantity_display?.trim() || p.quantity_sold}
                          </span>
                          {p.packaging_factor != null && (
                            <span className="text-xs text-gray-500">
                              {p.quantity_sold} au total
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatPrice(parseFloat(p.total_revenue))}</TableCell>
                        <TableCell className="text-right text-gray-500">{formatPrice(parseFloat(p.total_cost))}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">{formatPrice(parseFloat(p.profit))}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={parseFloat(p.margin_percentage) >= 30 ? "default" : parseFloat(p.margin_percentage) >= 15 ? "outline" : "destructive"}
                            className={parseFloat(p.margin_percentage) >= 30 ? "bg-green-500" : parseFloat(p.margin_percentage) >= 15 ? "border-yellow-500 text-yellow-600" : ""}>
                            {p.margin_percentage}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        Aucune donnée pour cette période
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {/* Pagination */}
              {productProfitsTotal > 20 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Affichage {((profitsPage - 1) * 20) + 1} - {Math.min(profitsPage * 20, productProfitsTotal)} sur {productProfitsTotal}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProfitsPage(p => Math.max(1, p - 1))}
                      disabled={profitsPage === 1}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProfitsPage(p => p + 1)}
                      disabled={profitsPage * 20 >= productProfitsTotal}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ RAPPORT PAR UTILISATEUR ============ */}
        <TabsContent value="user-activity" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-4">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Utilisateur</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Choisir un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.user_name} - {m.role_display}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Granularité</Label>
              <Select
                value={userActivityGroupBy}
                onValueChange={(v) => setUserActivityGroupBy(v as "day" | "hour")}
              >
                <SelectTrigger className="w-full sm:w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Par jour</SelectItem>
                  <SelectItem value="hour">Par heure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* ┌──────────────────────────────────────────────────────┐
                │ PAS DE BOUTON « GÉNÉRER ».                           │
                │                                                      │
                │ Il fallait le presser après CHAQUE changement         │
                │ d'utilisateur, de granularité ou de période, sans     │
                │ que rien ne dise que l'écran affichait encore les     │
                │ chiffres du précédent. Le terminal recharge tout      │
                │ seul depuis toujours ; c'est la parité, et c'est      │
                │ aussi la seule lecture honnête.                       │
                └──────────────────────────────────────────────────────┘ */}
            <ExportMenu
              targets={cibleExport}
              disabled={Boolean(exportIndisponible)}
              disabledReason={exportIndisponible ?? undefined}
            />
          </div>
          <p className="text-xs text-gray-500 -mt-2 mb-2">
            Période : utilise les filtres de date/période en haut de page.
          </p>

          {isLoadingUserActivity ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-orange-500" />
                <p className="text-gray-500">Chargement du rapport...</p>
              </CardContent>
            </Card>
          ) : userActivity ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Ventes</p>
                    <p className="text-xl mt-1 font-bold text-green-600">
                      {formatPrice(parseFloat(String(userActivity.sales.total)))}
                    </p>
                    <p className="text-xs float-right text-gray-500">
                      {userActivity.sales.count} ventes
                    </p>
                  </CardContent>
                </Card>
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Dépenses créées</p>
                    <p className="text-xl mt-1 font-bold text-red-600">
                      {formatPrice(parseFloat(String(userActivity.expenses.total)))}
                    </p>
                    <p className="text-xs float-right text-gray-500">
                      {userActivity.expenses.count} dépenses
                    </p>
                  </CardContent>
                </Card>
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Entrées / Sorties caisse</p>
                    <p className="text-sm mt-1 font-semibold">
                      <span className="text-green-600">
                        +{formatPrice(parseFloat(String(userActivity.cash.cash_in)))}
                      </span>{" "}
                      /{" "}
                      <span className="text-red-600">
                        -{formatPrice(parseFloat(String(userActivity.cash.cash_out)))}
                      </span>
                    </p>
                  </CardContent>
                </Card>
                <Card className="p-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Caisse nette</p>
                    <p className="text-xl mt-1 font-bold">
                      {formatPrice(parseFloat(String(userActivity.cash.net)))}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Détail des ventes ({userActivity.period.group_by === "hour" ? "par heure" : "par jour"})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userActivity.breakdown.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">
                      Aucune vente sur la période.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{userActivity.period.group_by === "hour" ? "Heure" : "Jour"}</TableHead>
                          <TableHead className="text-right">Ventes</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userActivity.breakdown.map((row) => (
                          <TableRow key={row.bucket}>
                            <TableCell>{row.bucket}</TableCell>
                            <TableCell className="text-right">{row.count}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatPrice(parseFloat(String(row.total)))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                {/* Le bouton « Générer » n'existe plus : l'état vide ne peut
                    donc plus y renvoyer. Il ne reste qu'un geste à faire. */}
                <Users className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                <p>Choisissez un utilisateur pour voir son activité.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
