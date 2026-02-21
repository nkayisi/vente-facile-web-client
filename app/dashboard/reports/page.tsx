"use client";

import { useState, useEffect, useCallback } from "react";
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
import { formatPrice } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
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
} from "@/actions/reports.actions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, FileSpreadsheet, Printer, ArrowDown, ArrowUp, Minus } from "lucide-react";

const PERIOD_OPTIONS = [
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
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [period, setPeriod] = useState<string>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  // Data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [salesByPeriod, setSalesByPeriod] = useState<SalesByPeriod[]>([]);
  const [salesByCategory, setSalesByCategory] = useState<SalesByCategory[]>([]);
  const [salesByPaymentMethod, setSalesByPaymentMethod] = useState<SalesByPaymentMethod[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowByPeriod[]>([]);

  // Nouveaux états
  const [dailyCashReport, setDailyCashReport] = useState<DailyCashReportResponse | null>(null);
  const [isLoadingDailyReport, setIsLoadingDailyReport] = useState(false);
  const [profitMargins, setProfitMargins] = useState<ProfitMargins | null>(null);
  const [productProfits, setProductProfits] = useState<ProductProfit[]>([]);
  const [stockDetails, setStockDetails] = useState<StockDetail[]>([]);
  const [stockMovementsSummary, setStockMovementsSummary] = useState<StockMovementSummary | null>(null);
  const [selectedReportDate, setSelectedReportDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState("overview");

  // Build filters
  const getFilters = useCallback((): ReportFilters => {
    if (period === "custom" && dateFrom && dateTo) {
      return { date_from: dateFrom, date_to: dateTo, group_by: groupBy };
    }
    return { period: period as ReportFilters["period"], group_by: groupBy };
  }, [period, dateFrom, dateTo, groupBy]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;

    setIsLoading(true);
    const filters = getFilters();

    try {
      const [
        summaryResult,
        salesPeriodResult,
        salesCategoryResult,
        salesPaymentResult,
        topProductsResult,
        topCustomersResult,
        cashFlowResult,
        profitResult,
        productProfitsResult,
        stockDetailsResult,
        stockMovementsResult,
      ] = await Promise.all([
        getDashboardSummary(session.accessToken, organization.id, filters),
        getSalesByPeriod(session.accessToken, organization.id, filters),
        getSalesByCategory(session.accessToken, organization.id, filters),
        getSalesByPaymentMethod(session.accessToken, organization.id, filters),
        getTopProducts(session.accessToken, organization.id, { ...filters, limit: 10 }),
        getTopCustomers(session.accessToken, organization.id, { ...filters, limit: 10 }),
        getCashFlow(session.accessToken, organization.id, filters),
        getProfitMargins(session.accessToken, organization.id, filters),
        getProductProfits(session.accessToken, organization.id, { ...filters, limit: 20 }),
        getStockDetails(session.accessToken, organization.id),
        getStockMovementsSummary(session.accessToken, organization.id, filters),
      ]);

      if (summaryResult.success && summaryResult.data) setSummary(summaryResult.data);
      if (salesPeriodResult.success && salesPeriodResult.data) setSalesByPeriod(salesPeriodResult.data);
      if (salesCategoryResult.success && salesCategoryResult.data) {
        console.log('[Reports] Sales by category data:', salesCategoryResult.data);
        setSalesByCategory(salesCategoryResult.data);
      } else {
        console.error('[Reports] Sales by category failed:', salesCategoryResult.message);
      }
      if (salesPaymentResult.success && salesPaymentResult.data) setSalesByPaymentMethod(salesPaymentResult.data);
      if (topProductsResult.success && topProductsResult.data) setTopProducts(topProductsResult.data);
      if (topCustomersResult.success && topCustomersResult.data) setTopCustomers(topCustomersResult.data);
      if (cashFlowResult.success && cashFlowResult.data) setCashFlow(cashFlowResult.data);
      if (profitResult.success && profitResult.data) setProfitMargins(profitResult.data);
      if (productProfitsResult.success && productProfitsResult.data) setProductProfits(productProfitsResult.data);
      if (stockDetailsResult.success && stockDetailsResult.data) setStockDetails(stockDetailsResult.data);
      if (stockMovementsResult.success && stockMovementsResult.data) setStockMovementsSummary(stockMovementsResult.data);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Erreur lors du chargement des rapports");
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken, organization?.id, getFilters]);

  // Fetch daily cash report
  const fetchDailyCashReport = useCallback(async (date: string) => {
    if (!session?.accessToken || !organization?.id) return;
    setIsLoadingDailyReport(true);
    try {
      const result = await getDailyCashReport(session.accessToken, organization.id, date);
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
      fetchDailyCashReport(selectedReportDate);
    }
  }, [organization, activeTab, selectedReportDate, fetchDailyCashReport]);

  // Fetch organization
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

  // Fetch data when organization or filters change
  useEffect(() => {
    if (organization) {
      fetchData();
    }
  }, [organization, fetchData]);

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

  // Export PDF - Rapport journalier de caisse
  const exportDailyCashPDF = () => {
    if (!dailyCashReport) return;

    const doc = new jsPDF();
    const report = dailyCashReport.report;
    const reportDate = new Date(report.date).toLocaleDateString("fr-FR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    doc.setFontSize(18);
    doc.text("RAPPORT JOURNALIER DE CAISSE", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(reportDate, 105, 30, { align: "center" });
    doc.text(organization?.name || "", 105, 38, { align: "center" });

    // Résumé
    const summaryData = [
      ["Solde d'ouverture", formatPrice(parseFloat(report.opening_balance))],
      ["Solde de clôture", formatPrice(parseFloat(report.closing_balance))],
      ["", ""],
      ["Ventes totales", `${formatPrice(parseFloat(report.total_sales))} (${report.total_sales_count} ventes)`],
      ["- Espèces", formatPrice(parseFloat(report.cash_sales))],
      ["- Mobile Money", formatPrice(parseFloat(report.mobile_money_sales))],
      ["- Carte", formatPrice(parseFloat(report.card_sales))],
      ["- Crédit", formatPrice(parseFloat(report.credit_sales))],
      ["", ""],
      ["Recouvrements", formatPrice(parseFloat(report.debt_collections))],
      ["Dépenses", `${formatPrice(parseFloat(report.expenses))} (${report.expenses_count})`],
      ["", ""],
      ["Flux net", formatPrice(parseFloat(report.net_cash_flow))],
    ];

    autoTable(doc, {
      startY: 50,
      head: [["Description", "Montant"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [249, 115, 22] },
    });

    // Mouvements
    if (dailyCashReport.movements.length > 0) {
      const movementsData = dailyCashReport.movements.map(m => [
        m.time,
        m.type_display,
        m.description || "-",
        m.direction === "in" ? formatPrice(parseFloat(m.amount)) : "",
        m.direction === "out" ? formatPrice(parseFloat(m.amount)) : "",
        formatPrice(parseFloat(m.balance_after)),
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [["Heure", "Type", "Description", "Entrée", "Sortie", "Solde"]],
        body: movementsData,
        theme: "striped",
        headStyles: { fillColor: [249, 115, 22] },
      });
    }

    doc.save(`rapport-caisse-${report.date}.pdf`);
    toast.success("Rapport PDF exporté");
  };

  // Export PDF - Bénéfices par produit
  const exportProfitsPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("RAPPORT DES BÉNÉFICES PAR PRODUIT", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(organization?.name || "", 105, 30, { align: "center" });

    if (profitMargins) {
      const summaryData = [
        ["Chiffre d'affaires", formatPrice(parseFloat(profitMargins.total_revenue))],
        ["Coût des marchandises", formatPrice(parseFloat(profitMargins.total_cost))],
        ["Bénéfice brut", formatPrice(parseFloat(profitMargins.gross_profit))],
        ["Marge brute", `${profitMargins.gross_margin_percentage}%`],
        ["Dépenses", formatPrice(parseFloat(profitMargins.total_expenses))],
        ["Bénéfice net", formatPrice(parseFloat(profitMargins.net_profit))],
        ["Marge nette", `${profitMargins.net_margin_percentage}%`],
      ];

      autoTable(doc, {
        startY: 40,
        head: [["Indicateur", "Valeur"]],
        body: summaryData,
        theme: "grid",
        headStyles: { fillColor: [34, 197, 94] },
      });
    }

    if (productProfits.length > 0) {
      const productsData = productProfits.map(p => [
        p.product_name,
        p.product_sku,
        p.quantity_sold,
        formatPrice(parseFloat(p.total_revenue)),
        formatPrice(parseFloat(p.total_cost)),
        formatPrice(parseFloat(p.profit)),
        `${p.margin_percentage}%`,
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [["Produit", "SKU", "Qté", "CA", "Coût", "Bénéfice", "Marge"]],
        body: productsData,
        theme: "striped",
        headStyles: { fillColor: [34, 197, 94] },
      });
    }

    doc.save(`rapport-benefices-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Rapport PDF exporté");
  };

  // Export PDF - Stock
  const exportStockPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("RAPPORT DE STOCK", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(organization?.name || "", 105, 30, { align: "center" });
    doc.text(new Date().toLocaleDateString("fr-FR"), 105, 38, { align: "center" });

    const stockData = stockDetails.map(s => [
      s.product_name,
      s.product_sku,
      s.category_name || "-",
      parseFloat(s.current_stock).toFixed(0),
      parseFloat(s.available_stock).toFixed(0),
      formatPrice(parseFloat(s.stock_value)),
      s.status === "out_of_stock" ? "Rupture" : s.status === "low_stock" ? "Bas" : "OK",
    ]);

    autoTable(doc, {
      startY: 50,
      head: [["Produit", "SKU", "Catégorie", "Stock", "Dispo", "Valeur", "Statut"]],
      body: stockData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      didParseCell: (data) => {
        if (data.column.index === 6 && data.section === "body") {
          const status = data.cell.raw;
          if (status === "Rupture") data.cell.styles.textColor = [239, 68, 68];
          else if (status === "Bas") data.cell.styles.textColor = [234, 179, 8];
          else data.cell.styles.textColor = [34, 197, 94];
        }
      },
    });

    doc.save(`rapport-stock-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Rapport PDF exporté");
  };

  // Export Excel (CSV)
  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(";"),
      ...data.map(row => headers.map(h => row[h] ?? "").join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    toast.success("Fichier Excel/CSV exporté");
  };

  const exportSalesCSV = () => {
    const data = topProducts.map(p => ({
      Produit: p.product_name,
      SKU: p.product_sku,
      "Quantité vendue": p.quantity_sold,
      "Chiffre d'affaires": parseFloat(p.total_revenue),
    }));
    exportToCSV(data, `ventes-produits-${new Date().toISOString().split("T")[0]}`,
      ["Produit", "SKU", "Quantité vendue", "Chiffre d'affaires"]);
  };

  const exportStockCSV = () => {
    const data = stockDetails.map(s => ({
      Produit: s.product_name,
      SKU: s.product_sku,
      Catégorie: s.category_name || "",
      "Stock actuel": parseFloat(s.current_stock),
      "Stock disponible": parseFloat(s.available_stock),
      "Valeur stock": parseFloat(s.stock_value),
      Statut: s.status === "out_of_stock" ? "Rupture" : s.status === "low_stock" ? "Bas" : "OK",
    }));
    exportToCSV(data, `stock-${new Date().toISOString().split("T")[0]}`,
      ["Produit", "SKU", "Catégorie", "Stock actuel", "Stock disponible", "Valeur stock", "Statut"]);
  };

  const exportProfitsCSV = () => {
    const data = productProfits.map(p => ({
      Produit: p.product_name,
      SKU: p.product_sku,
      "Quantité vendue": p.quantity_sold,
      "Chiffre d'affaires": parseFloat(p.total_revenue),
      "Coût": parseFloat(p.total_cost),
      "Bénéfice": parseFloat(p.profit),
      "Marge %": parseFloat(p.margin_percentage),
    }));
    exportToCSV(data, `benefices-${new Date().toISOString().split("T")[0]}`,
      ["Produit", "SKU", "Quantité vendue", "Chiffre d'affaires", "Coût", "Bénéfice", "Marge %"]);
  };

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
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Période</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
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
                className="w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Au</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
              />
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Grouper par</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-[130px]">
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

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ventes */}
          <Card className="border-l-4 border-l-orange-500">
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Chiffre d'affaires</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPrice(parseFloat(summary.sales.total_sales))}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">
                      {summary.sales.total_orders} ventes
                    </span>
                    {renderGrowth(summary.sales.sales_growth)}
                  </div>
                </div>
                <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Panier moyen */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Panier moyen</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPrice(parseFloat(summary.sales.average_order_value))}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {summary.sales.total_items_sold} articles vendus
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Solde caisse */}
          <Card className="border-l-4 border-l-green-500">
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Solde caisse</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPrice(parseFloat(summary.cashbook.current_balance))}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Flux net: {formatPrice(parseFloat(summary.cashbook.net_flow))}
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Créances clients */}
          <Card className="border-l-4 border-l-red-500">
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Créances clients</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPrice(parseFloat(summary.customers.total_receivables))}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {summary.customers.customers_with_debt} clients avec dette
                  </p>
                </div>
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Secondary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-xs text-gray-500">Produits actifs</p>
              <p className="text-xl font-semibold">{summary.stock.total_products}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-xs text-gray-500">Valeur stock</p>
              <p className="text-xl font-semibold">
                {formatPrice(parseFloat(summary.stock.total_stock_value))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-xs text-gray-500">Stock bas</p>
              <p className="text-xl font-semibold text-yellow-600">
                {summary.stock.low_stock_count}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-xs text-gray-500">Ruptures</p>
              <p className="text-xl font-semibold text-red-600">
                {summary.stock.out_of_stock_count}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-xs text-gray-500">Clients</p>
              <p className="text-xl font-semibold">{summary.customers.total_customers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-xs text-gray-500">Nouveaux clients</p>
              <p className="text-xl font-semibold text-green-600">
                +{summary.customers.new_customers_period}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 mt-3">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="daily-cash">Rapport journalier</TabsTrigger>
          <TabsTrigger value="sales">Ventes</TabsTrigger>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="customers">Clients</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="profits">Bénéfices</TabsTrigger>
        </TabsList>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => {
              const doc = new jsPDF();
              doc.setFontSize(18);
              doc.text("Rapport des Ventes", 14, 20);
              doc.setFontSize(10);
              doc.text(`Période: ${period === 'custom' ? `${dateFrom} - ${dateTo}` : PERIOD_OPTIONS.find(p => p.value === period)?.label}`, 14, 28);

              autoTable(doc, {
                startY: 35,
                head: [['Période', 'Montant', 'Nb Ventes']],
                body: salesByPeriod.map(s => [
                  formatChartDate(s.period),
                  formatPrice(parseFloat(s.total)),
                  s.count.toString()
                ]),
              });

              doc.save(`ventes-${new Date().toISOString().split('T')[0]}.pdf`);
              toast.success("PDF exporté avec succès");
            }}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportSalesCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
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
                <div className="h-[300px]">
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

            {/* Sales by Category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-blue-500" />
                  Ventes par catégorie ({salesByCategory.length} catégories)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {(() => {
                    console.log('[Reports] Rendering sales by category, length:', salesByCategory.length, 'data:', salesByCategory);
                    return salesByCategory.length === 0;
                  })() ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <PieChart className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>Aucune donnée disponible</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={salesByCategory.map(item => ({
                            ...item,
                            total_revenue: Number(item.total_revenue)
                          }))}
                          dataKey="total_revenue"
                          nameKey="category_name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {salesByCategory.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatPrice(Number(value))}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  )}
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
                <div className="h-[300px]">
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

            {/* Orders Count */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-purple-500" />
                  Nombre de commandes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesByPeriod}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="period"
                        tickFormatter={formatChartDate}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [Number(value), "Commandes"]}
                        labelFormatter={(label) => formatChartDate(String(label))}
                      />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Products Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                Ventes par article (Top 20)
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
                            {index + 1}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell className="text-gray-500">{product.product_sku}</TableCell>
                        <TableCell className="text-right font-semibold">{product.quantity_sold} unités</TableCell>
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
            </CardContent>
          </Card>

          {/* Sales by Category Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-500" />
                Ventes par catégorie (Détails)
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
                    salesByCategory.map((cat) => {
                      const totalRevenue = salesByCategory.reduce((sum, c) => sum + parseFloat(c.total_revenue), 0);
                      const percentage = totalRevenue > 0 ? (parseFloat(cat.total_revenue) / totalRevenue * 100).toFixed(1) : '0';
                      return (
                        <TableRow key={cat.category_id || 'uncategorized'}>
                          <TableCell className="font-medium">{cat.category_name || 'Sans catégorie'}</TableCell>
                          <TableCell className="text-right">{cat.quantity_sold} unités</TableCell>
                          <TableCell className="text-right font-semibold text-blue-600">
                            {formatPrice(parseFloat(cat.total_revenue))}
                          </TableCell>
                          <TableCell className="text-right text-gray-600">{percentage}%</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                        Aucune donnée pour cette période
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => {
              const doc = new jsPDF();
              doc.setFontSize(18);
              doc.text("Top Produits", 14, 20);
              doc.setFontSize(10);
              doc.text(`Période: ${period === 'custom' ? `${dateFrom} - ${dateTo}` : PERIOD_OPTIONS.find(p => p.value === period)?.label}`, 14, 28);

              autoTable(doc, {
                startY: 35,
                head: [['#', 'Produit', 'SKU', 'Quantité', 'Revenus']],
                body: topProducts.map((p, i) => [
                  (i + 1).toString(),
                  p.product_name,
                  p.product_sku,
                  p.quantity_sold.toString(),
                  formatPrice(parseFloat(p.total_revenue))
                ]),
              });

              doc.save(`produits-${new Date().toISOString().split('T')[0]}.pdf`);
              toast.success("PDF exporté avec succès");
            }}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const data = topProducts.map((p, i) => ({
                '#': (i + 1).toString(),
                'Produit': p.product_name,
                'SKU': p.product_sku,
                'Quantité': p.quantity_sold.toString(),
                'Revenus': parseFloat(p.total_revenue).toFixed(2)
              }));
              exportToCSV(data, `produits-${new Date().toISOString().split('T')[0]}`, ['#', 'Produit', 'SKU', 'Quantité', 'Revenus']);
            }}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>

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
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Products by Quantity Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-5 w-5 text-orange-500" />
                      Top 10 produits (quantité)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topProducts.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis
                            type="category"
                            dataKey="product_name"
                            width={100}
                            tick={{ fontSize: 10 }}
                          />
                          <Tooltip formatter={(value) => [Number(value), "Unités"]} />
                          <Bar dataKey="quantity_sold" fill="#f97316" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Products by Revenue Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-500" />
                      Top 10 produits (revenus)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topProducts.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => formatPrice(v)} />
                          <YAxis
                            type="category"
                            dataKey="product_name"
                            width={100}
                            tick={{ fontSize: 10 }}
                          />
                          <Tooltip formatter={(value) => formatPrice(Number(value))} />
                          <Bar dataKey="total_revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Products Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-500" />
                    Détails des produits vendus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Produit</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead className="text-right">Revenus</TableHead>
                        <TableHead className="text-right">Prix moyen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((product, index) => {
                        const avgPrice = product.quantity_sold > 0
                          ? parseFloat(product.total_revenue) / product.quantity_sold
                          : 0;
                        return (
                          <TableRow key={product.product_id}>
                            <TableCell>
                              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">{product.product_name}</TableCell>
                            <TableCell className="text-gray-500">{product.product_sku}</TableCell>
                            <TableCell className="text-right font-semibold">{product.quantity_sold} unités</TableCell>
                            <TableCell className="text-right font-semibold text-blue-600">
                              {formatPrice(parseFloat(product.total_revenue))}
                            </TableCell>
                            <TableCell className="text-right text-gray-600">
                              {formatPrice(avgPrice)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
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
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Date du rapport</Label>
                <Input
                  type="date"
                  value={selectedReportDate}
                  onChange={(e) => setSelectedReportDate(e.target.value)}
                  className="w-[180px]"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchDailyCashReport(selectedReportDate)} className="mt-5" disabled={isLoadingDailyReport}>
                {isLoadingDailyReport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {isLoadingDailyReport ? "Chargement..." : "Charger"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportDailyCashPDF} disabled={!dailyCashReport}>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
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
                <Card>
                  <CardContent>
                    <p className="text-xs text-gray-500">Solde d'ouverture</p>
                    <p className="text-xl font-bold">{formatPrice(parseFloat(dailyCashReport.report.opening_balance))}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs text-gray-500">Solde de clôture</p>
                    <p className="text-xl font-bold">{formatPrice(parseFloat(dailyCashReport.report.closing_balance))}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                  <CardContent>
                    <p className="text-xs text-gray-500">Ventes du jour</p>
                    <p className="text-xl font-bold text-green-600">{formatPrice(parseFloat(dailyCashReport.report.total_sales))}</p>
                    <p className="text-xs text-gray-500">{dailyCashReport.report.total_sales_count} ventes</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                  <CardContent>
                    <p className="text-xs text-gray-500">Dépenses</p>
                    <p className="text-xl font-bold text-red-600">{formatPrice(parseFloat(dailyCashReport.report.expenses))}</p>
                    <p className="text-xs text-gray-500">{dailyCashReport.report.expenses_count} dépenses</p>
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
                      {dailyCashReport.movements.map((m) => (
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
                      {dailyCashReport.movements.length === 0 && (
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
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={exportStockPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportStockCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>

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
              <div className="max-h-[400px] overflow-y-auto">
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
                        <TableCell className="text-right font-medium">{parseFloat(s.current_stock).toFixed(0)}</TableCell>
                        <TableCell className="text-right">{parseFloat(s.available_stock).toFixed(0)}</TableCell>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profits Tab */}
        <TabsContent value="profits" className="space-y-4">
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={exportProfitsPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportProfitsCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>

          {/* Profit Summary */}
          {profitMargins && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent>
                  <p className="text-xs text-gray-500">Chiffre d'affaires</p>
                  <p className="text-xl font-bold">{formatPrice(parseFloat(profitMargins.total_revenue))}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-orange-500">
                <CardContent>
                  <p className="text-xs text-gray-500">Coût des marchandises</p>
                  <p className="text-xl font-bold">{formatPrice(parseFloat(profitMargins.total_cost))}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-500">
                <CardContent>
                  <p className="text-xs text-gray-500">Bénéfice brut</p>
                  <p className="text-xl font-bold text-green-600">{formatPrice(parseFloat(profitMargins.gross_profit))}</p>
                  <p className="text-xs text-green-600">Marge: {profitMargins.gross_margin_percentage}%</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-purple-500">
                <CardContent>
                  <p className="text-xs text-gray-500">Bénéfice net</p>
                  <p className="text-xl font-bold text-purple-600">{formatPrice(parseFloat(profitMargins.net_profit))}</p>
                  <p className="text-xs text-purple-600">Marge: {profitMargins.net_margin_percentage}%</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Product Profits Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Bénéfices par produit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Qté vendue</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                      <TableHead className="text-right">Coût</TableHead>
                      <TableHead className="text-right">Bénéfice</TableHead>
                      <TableHead className="text-right">Marge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productProfits.map((p) => (
                      <TableRow key={p.product_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{p.product_name}</p>
                            <p className="text-xs text-gray-500">{p.product_sku}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{p.quantity_sold}</TableCell>
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
                    ))}
                    {productProfits.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          Aucune donnée pour cette période
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
