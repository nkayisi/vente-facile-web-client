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
} from "@/actions/reports.actions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  createPDFDocument,
  addTable,
  addSummarySection,
  addSignatureSection,
  formatNumberForPDF,
  formatCurrencyForPDF,
} from "@/lib/pdf-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataPagination } from "@/components/shared/DataPagination";
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
        productSuppliesResult,
      ] = await Promise.all([
        getDashboardSummary(session.accessToken, organization.id, filters),
        getSalesByPeriod(session.accessToken, organization.id, filters),
        getSalesByCategory(session.accessToken, organization.id, { ...filters, page: salesByCategoryPage, page_size: 20 }),
        getSalesByPaymentMethod(session.accessToken, organization.id, filters),
        getTopProducts(session.accessToken, organization.id, { ...filters, page: salesByArticlePage, page_size: 20 }),
        getTopCustomers(session.accessToken, organization.id, { ...filters, limit: 10 }),
        getCashFlow(session.accessToken, organization.id, filters),
        getProfitMargins(session.accessToken, organization.id, filters),
        getProductProfits(session.accessToken, organization.id, { ...filters, page: profitsPage, page_size: 20 }),
        getStockDetails(session.accessToken, organization.id, { page: stockPage, page_size: 20 }),
        getStockMovementsSummary(session.accessToken, organization.id, filters),
        getProductSupplies(session.accessToken, organization.id, filters),
      ]);

      if (summaryResult.success && summaryResult.data) setSummary(summaryResult.data);
      if (salesPeriodResult.success && salesPeriodResult.data) {
        setSalesByPeriod(salesPeriodResult.data.results);
        setSalesByPeriodTotal(salesPeriodResult.data.count);
      }
      if (salesCategoryResult.success && salesCategoryResult.data) {
        setSalesByCategory(salesCategoryResult.data.results);
        setSalesByCategoryTotal(salesCategoryResult.data.count);
      }
      if (salesPaymentResult.success && salesPaymentResult.data) {
        setSalesByPaymentMethod(salesPaymentResult.data.results);
        setSalesByPaymentMethodTotal(salesPaymentResult.data.count);
      }
      if (topProductsResult.success && topProductsResult.data) {
        setTopProducts(topProductsResult.data.results);
        setTopProductsTotal(topProductsResult.data.count);
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
      if (productProfitsResult.success && productProfitsResult.data) {
        setProductProfits(productProfitsResult.data.results);
        setProductProfitsTotal(productProfitsResult.data.count);
      }
      if (stockDetailsResult.success && stockDetailsResult.data) {
        setStockDetails(stockDetailsResult.data.results);
        setStockDetailsTotal(stockDetailsResult.data.count);
      }
      if (stockMovementsResult.success && stockMovementsResult.data) setStockMovementsSummary(stockMovementsResult.data);
      if (productSuppliesResult.success && productSuppliesResult.data) setProductSupplies(productSuppliesResult.data);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Erreur lors du chargement des rapports");
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken, organization?.id, getFilters, salesByCategoryPage, salesByArticlePage, profitsPage, stockPage]);

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

  // Reset pages when filters change
  useEffect(() => {
    setSalesByArticlePage(1);
    setSalesByCategoryPage(1);
    setStockPage(1);
    setProfitsPage(1);
    setProductsPage(1);
    setCustomersPage(1);
  }, [period, dateFrom, dateTo]);

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

  // Export PDF - Rapport journalier de caisse (style uniforme)
  const exportDailyCashPDF = () => {
    if (!dailyCashReport) return;

    const report = dailyCashReport.report;
    const reportDate = new Date(report.date).toLocaleDateString("fr-CD", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    const { doc, y, pageWidth } = createPDFDocument({
      title: "RAPPORT JOURNALIER DE CAISSE",
      subtitle: reportDate,
      organizationName: organization?.name || "",
    });

    let currentY = y;

    // Résumé des soldes
    currentY = addSummarySection(doc, currentY, pageWidth, [
      { label: "Solde d'ouverture", value: formatCurrencyForPDF(report.opening_balance) },
      { label: "Ventes du jour", value: formatCurrencyForPDF(report.total_sales), color: "green" },
      { label: "Dépenses", value: formatCurrencyForPDF(report.expenses), color: "red" },
      { label: "Solde de clôture", value: formatCurrencyForPDF(report.closing_balance), color: "blue" },
    ]);

    // Détail des paiements
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DÉTAIL DES PAIEMENTS", 14, currentY);
    currentY += 5;

    const paymentData = [
      ["Espèces", formatCurrencyForPDF(report.cash_sales)],
      ["Mobile Money", formatCurrencyForPDF(report.mobile_money_sales)],
      ["Carte", formatCurrencyForPDF(report.card_sales)],
      ["Crédit", formatCurrencyForPDF(report.credit_sales)],
      ["Recouvrements", formatCurrencyForPDF(report.debt_collections)],
    ];

    currentY = addTable(doc, currentY,
      [["Mode de paiement", "Montant"]],
      paymentData,
      {
        columnStyles: {
          0: { cellWidth: 80 },
          1: { halign: 'right', cellWidth: 50 },
        },
      }
    );
    currentY += 10;

    // Mouvements du jour
    if (dailyCashReport.movements.results && dailyCashReport.movements.results.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("MOUVEMENTS DU JOUR", 14, currentY);
      currentY += 5;

      const movementsData = dailyCashReport.movements.results.map(m => [
        m.time,
        m.type_display,
        m.description || "-",
        m.direction === "in" ? formatCurrencyForPDF(m.amount) : "",
        m.direction === "out" ? formatCurrencyForPDF(m.amount) : "",
        formatCurrencyForPDF(m.balance_after),
      ]);

      currentY = addTable(doc, currentY,
        [["Heure", "Type", "Description", "Entrée", "Sortie", "Solde"]],
        movementsData,
        {
          columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 28 },
            2: { cellWidth: 45 },
            3: { halign: 'right', cellWidth: 28 },
            4: { halign: 'right', cellWidth: 28 },
            5: { halign: 'right', cellWidth: 28 },
          },
          useAlternateRowColors: true,
          highlightColumn: 5,
        }
      );
    }

    // Signatures
    addSignatureSection(doc, currentY + 10, pageWidth, ["Caissier", "Superviseur"]);

    doc.save(`rapport-caisse-${report.date}.pdf`);
    toast.success("Rapport PDF exporté");
  };

  // Export PDF - Ventes (style uniforme avec tableaux complets)
  const exportSalesPDF = () => {
    const { doc, y, pageWidth } = createPDFDocument({
      title: "RAPPORT DES VENTES",
      subtitle: `Période: ${period === 'custom' ? `${dateFrom} - ${dateTo}` : PERIOD_OPTIONS.find(p => p.value === period)?.label}`,
      organizationName: organization?.name || "",
    });

    let currentY = y;

    // Résumé des ventes
    if (summary) {
      currentY = addSummarySection(doc, currentY, pageWidth, [
        { label: "Chiffre d'affaires", value: formatCurrencyForPDF(summary.sales.total_sales), color: "green" },
        { label: "Nombre de ventes", value: summary.sales.total_orders.toString() },
        { label: "Panier moyen", value: formatCurrencyForPDF(summary.sales.average_order_value) },
        { label: "Articles vendus", value: summary.sales.total_items_sold.toString() },
      ]);
    }

    // Tableau 1: Ventes par article (complet)
    if (topProducts.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("VENTES PAR ARTICLE", 14, currentY);
      currentY += 5;

      const articlesData = topProducts.map((p, i) => [
        (i + 1).toString(),
        p.product_name,
        p.product_sku,
        formatNumberForPDF(p.quantity_sold, 0),
        formatCurrencyForPDF(p.total_revenue),
      ]);

      currentY = addTable(doc, currentY,
        [['#', 'Article', 'SKU', 'Quantité', 'Revenus']],
        articlesData,
        {
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 60 },
            2: { cellWidth: 30 },
            3: { halign: 'right', cellWidth: 25 },
            4: { halign: 'right', cellWidth: 35 },
          },
          useAlternateRowColors: true,
        }
      );
      currentY += 10;
    }

    // Tableau 2: Ventes par catégorie (complet)
    if (salesByCategory.length > 0) {
      // Vérifier si on a besoin d'une nouvelle page
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("VENTES PAR CATÉGORIE", 14, currentY);
      currentY += 5;

      const totalRevenue = salesByCategory.reduce((sum, c) => sum + parseFloat(c.total_revenue), 0);
      const categoriesData = salesByCategory.map(cat => {
        const percentage = totalRevenue > 0 ? (parseFloat(cat.total_revenue) / totalRevenue * 100).toFixed(1) : '0';
        return [
          cat.category_name || 'Sans catégorie',
          formatNumberForPDF(cat.quantity_sold, 0),
          formatCurrencyForPDF(cat.total_revenue),
          `${percentage}%`,
        ];
      });

      currentY = addTable(doc, currentY,
        [['Catégorie', 'Quantité', 'Revenus', '% du total']],
        categoriesData,
        {
          columnStyles: {
            0: { cellWidth: 60 },
            1: { halign: 'right', cellWidth: 30 },
            2: { halign: 'right', cellWidth: 40 },
            3: { halign: 'right', cellWidth: 30 },
          },
          useAlternateRowColors: true,
        }
      );
    }

    // Signatures
    addSignatureSection(doc, currentY + 10, pageWidth, ["Établi par", "Vérifié par"]);

    doc.save(`rapport-ventes-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Rapport PDF exporté");
  };

  // Export PDF - Produits vendus (style uniforme)
  const exportProductsPDF = () => {
    const { doc, y, pageWidth } = createPDFDocument({
      title: "RAPPORT DES PRODUITS VENDUS",
      subtitle: `Période: ${period === 'custom' ? `${dateFrom} - ${dateTo}` : PERIOD_OPTIONS.find(p => p.value === period)?.label}`,
      organizationName: organization?.name || "",
    });

    // Préparer les données avec stock de départ, approvisionnement et restant
    const productsData = topProducts.map(p => {
      const stockInfo = stockDetails.find(s => s.product_id === p.product_id);
      const currentStock = stockInfo ? parseFloat(stockInfo.current_stock) : 0;
      const startingStock = currentStock + p.quantity_sold;
      const stockValue = stockInfo ? parseFloat(stockInfo.stock_value) : 0;
      const supply = productSupplies[p.product_id] || 0;
      return [
        p.product_name,
        formatNumberForPDF(startingStock, 0),
        supply > 0 ? formatNumberForPDF(supply, 0) : '-',
        formatNumberForPDF(p.quantity_sold, 0),
        formatCurrencyForPDF(p.total_revenue),
        formatNumberForPDF(currentStock, 0),
        formatCurrencyForPDF(stockValue),
      ];
    });

    // Tableau des produits (pleine largeur)
    addTable(doc, y,
      [['Produit', 'Stock départ', 'Approv.', 'Qté vendue', 'Valeur vendue', 'Qté restante', 'Valeur restante']],
      productsData,
      {
        useAlternateRowColors: true,
      }
    );

    // Signatures
    addSignatureSection(doc, (doc as any).lastAutoTable.finalY + 10, pageWidth, ["Établi par", "Vérifié par"]);

    doc.save(`rapport-produits-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Rapport PDF exporté");
  };

  // Export PDF - Bénéfices par produit (style uniforme)
  const exportProfitsPDF = () => {
    const { doc, y, pageWidth } = createPDFDocument({
      title: "RAPPORT DES BÉNÉFICES PAR PRODUIT",
      subtitle: `Période: ${period === 'custom' ? `${dateFrom} - ${dateTo}` : PERIOD_OPTIONS.find(p => p.value === period)?.label}`,
      organizationName: organization?.name || "",
    });

    let currentY = y;

    // Résumé des marges
    if (profitMargins) {
      currentY = addSummarySection(doc, currentY, pageWidth, [
        { label: "Chiffre d'affaires", value: formatCurrencyForPDF(profitMargins.total_revenue), color: "blue" },
        { label: "Bénéfice brut", value: formatCurrencyForPDF(profitMargins.gross_profit), color: "green" },
        { label: "Marge brute", value: `${profitMargins.gross_margin_percentage}%` },
        { label: "Bénéfice net", value: formatCurrencyForPDF(profitMargins.net_profit), color: "green" },
      ]);
    }

    // Tableau des bénéfices par produit (complet)
    if (productProfits.length > 0) {
      const productsData = productProfits.map(p => [
        p.product_name,
        p.product_sku,
        formatNumberForPDF(p.quantity_sold, 0),
        formatCurrencyForPDF(p.total_revenue),
        formatCurrencyForPDF(p.total_cost),
        formatCurrencyForPDF(p.profit),
        `${p.margin_percentage}%`,
      ]);

      currentY = addTable(doc, currentY,
        [["Produit", "SKU", "Qté", "CA", "Coût", "Bénéfice", "Marge"]],
        productsData,
        {
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 22 },
            2: { halign: 'right', cellWidth: 15 },
            3: { halign: 'right', cellWidth: 28 },
            4: { halign: 'right', cellWidth: 28 },
            5: { halign: 'right', cellWidth: 28 },
            6: { halign: 'right', cellWidth: 18 },
          },
          useAlternateRowColors: true,
        }
      );
    }

    // Signatures
    addSignatureSection(doc, currentY + 10, pageWidth, ["Établi par", "Vérifié par"]);

    doc.save(`rapport-benefices-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Rapport PDF exporté");
  };

  // Export PDF - Stock (style uniforme)
  const exportStockPDF = () => {
    const { doc, y, pageWidth } = createPDFDocument({
      title: "RAPPORT DE STOCK",
      subtitle: new Date().toLocaleDateString("fr-CD"),
      organizationName: organization?.name || "",
    });

    // Résumé du stock
    const totalValue = stockDetails.reduce((sum, s) => sum + parseFloat(s.stock_value), 0);
    const outOfStock = stockDetails.filter(s => s.status === "out_of_stock").length;
    const lowStock = stockDetails.filter(s => s.status === "low_stock").length;

    let currentY = addSummarySection(doc, y, pageWidth, [
      { label: "Total produits", value: stockDetails.length.toString() },
      { label: "Valeur totale", value: formatCurrencyForPDF(totalValue), color: "blue" },
      { label: "Ruptures", value: outOfStock.toString(), color: "red" },
      { label: "Stock bas", value: lowStock.toString() },
    ]);

    // Tableau des stocks (complet)
    const stockData = stockDetails.map(s => [
      s.product_name,
      s.product_sku,
      s.category_name || "-",
      formatNumberForPDF(s.current_stock, 0),
      formatNumberForPDF(s.available_stock, 0),
      formatCurrencyForPDF(s.stock_value),
      s.status === "out_of_stock" ? "Rupture" : s.status === "low_stock" ? "Bas" : "OK",
    ]);

    addTable(doc, currentY,
      [["Produit", "SKU", "Catégorie", "Stock", "Dispo", "Valeur", "Statut"]],
      stockData,
      {
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 25 },
          2: { cellWidth: 30 },
          3: { halign: 'right', cellWidth: 18 },
          4: { halign: 'right', cellWidth: 18 },
          5: { halign: 'right', cellWidth: 28 },
          6: { halign: 'center', cellWidth: 18 },
        },
        useAlternateRowColors: true,
      }
    );

    // Signatures
    addSignatureSection(doc, (doc as any).lastAutoTable.finalY + 10, pageWidth, ["Établi par", "Vérifié par"]);

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
          <Card className="py-1">
            <CardContent className="p-4">
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
          <Card className="py-1">
            <CardContent className="p-4">
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
          <Card className="py-1">
            <CardContent className="p-4">
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
          <Card className="py-1">
            <CardContent className="p-4">
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
            <CardContent className="px-4">
              <p className="text-xs text-gray-500">Produits actifs</p>
              <p className="text-xl font-semibold">{summary.stock.total_products}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4">
              <p className="text-xs text-gray-500">Valeur stock</p>
              <p className="text-xl font-semibold">
                {formatPrice(parseFloat(summary.stock.total_stock_value))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4">
              <p className="text-xs text-gray-500">Stock bas</p>
              <p className="text-xl font-semibold text-yellow-600">
                {summary.stock.low_stock_count}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4">
              <p className="text-xs text-gray-500">Ruptures</p>
              <p className="text-xl font-semibold text-red-600">
                {summary.stock.out_of_stock_count}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4">
              <p className="text-xs text-gray-500">Clients</p>
              <p className="text-xl font-semibold">{summary.customers.total_customers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4">
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
            <Button variant="outline" size="sm" onClick={exportSalesPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportSalesCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>

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
                <div className="h-[250px]">
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
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={exportProductsPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              // Combiner les données de vente avec les données de stock et approvisionnements
              const productsWithStock = topProducts.map(p => {
                const stockInfo = stockDetails.find(s => s.product_id === p.product_id);
                const currentStock = stockInfo ? parseFloat(stockInfo.current_stock) : 0;
                const startingStock = currentStock + p.quantity_sold;
                const stockValue = stockInfo ? parseFloat(stockInfo.stock_value) : 0;
                const supply = productSupplies[p.product_id] || 0;
                return {
                  'Produit': p.product_name,
                  'SKU': p.product_sku,
                  'Stock départ': startingStock.toFixed(0),
                  'Approv.': supply > 0 ? supply.toFixed(0) : '',
                  'Qté vendue': p.quantity_sold.toString(),
                  'Valeur vendue': parseFloat(p.total_revenue).toFixed(2),
                  'Qté restante': currentStock.toFixed(0),
                  'Valeur restante': stockValue.toFixed(2),
                };
              });
              exportToCSV(productsWithStock, `produits-vendus-${new Date().toISOString().split('T')[0]}`,
                ['Produit', 'SKU', 'Stock départ', 'Approv.', 'Qté vendue', 'Valeur vendue', 'Qté restante', 'Valeur restante']);
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
                      <TableHead className="text-right">Stock départ</TableHead>
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
                      const supply = productSupplies[product.product_id] || 0;
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
                            {supply > 0 ? supply.toFixed(0) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-orange-600">{product.quantity_sold}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {formatPrice(parseFloat(product.total_revenue))}
                          </TableCell>
                          <TableCell className="text-right">{currentStock.toFixed(0)}</TableCell>
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
              <Button variant="outline" size="sm" onClick={() => fetchDailyCashReport(selectedReportDate, dailyReportMovementsPage)} className="mt-5" disabled={isLoadingDailyReport}>
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
              <Card className="p-0">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">Chiffre d'affaires</p>
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
                    <TableHead className="text-right">CA</TableHead>
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
      </Tabs>
    </div>
  );
}
