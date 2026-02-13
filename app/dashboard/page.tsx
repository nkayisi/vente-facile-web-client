"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Users,
  Package,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertTriangle,
  ShoppingCart,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatNumber } from "@/lib/format";
import {
  getUserOrganizations,
  getDashboardStats,
  Organization,
  DashboardStats,
  DashboardPeriod,
} from "@/actions/organization.actions";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  day: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
};

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6"];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("month");

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      setIsLoading(true);
      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          const statsResult = await getDashboardStats(session.accessToken, org.id, period);
          if (statsResult.success && statsResult.data) {
            setStats(statsResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session, period]);


  // Format date for chart
  const formatChartDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (period === "year") {
      return date.toLocaleDateString("fr-FR", { month: "short" });
    }
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  // Prepare chart data
  const salesChartData = stats?.charts.sales_evolution.map(item => ({
    date: formatChartDate(item.date),
    ventes: parseFloat(item.total),
    transactions: item.count,
  })) || [];

  const paymentChartData = stats?.charts.by_payment_method.map(item => ({
    name: item.name,
    value: parseFloat(item.value),
    count: item.count,
  })) || [];

  if (isLoading) {
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
          <h2 className="text-2xl font-bold text-gray-900">Tableau de bord</h2>
          <p className="text-sm text-gray-500 mt-1">
            {organization?.name} • {PERIOD_LABELS[period]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["day", "week", "month", "year"] as DashboardPeriod[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
              className={period === p ? "bg-orange-500 hover:bg-orange-600" : ""}
            >
              {p === "day" ? "Jour" : p === "week" ? "Semaine" : p === "month" ? "Mois" : "Année"}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Sales */}
        <Card className="gap-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">Ventes totales</CardTitle>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">
              {stats ? formatPrice(stats.cards.total_sales.value) : "0 CDF"}
            </div>
            <div className="flex items-center mt-2 text-sm">
              {stats && stats.cards.total_sales.variation >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-600 mr-1" />
              )}
              <span className={stats && stats.cards.total_sales.variation >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                {stats ? Math.abs(stats.cards.total_sales.variation) : 0}%
              </span>
              <span className="text-gray-500 ml-2">vs période précédente</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Customers */}
        <Card className="gap-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">Total clients</CardTitle>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">
              {stats ? formatNumber(stats.cards.total_customers.value as number) : "0"}
            </div>
            <div className="flex items-center mt-2 text-sm">
              <span className="text-green-600 font-medium">
                +{stats?.cards.total_customers.new_count || 0}
              </span>
              <span className="text-gray-500 ml-2">nouveaux cette période</span>
            </div>
          </CardContent>
        </Card>

        {/* Units Sold */}
        <Card className="gap-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">Unités vendues</CardTitle>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatNumber(stats.cards.units_sold.value as number) : "0"}
            </div>
            <div className="flex items-center mt-2 text-sm">
              {stats && stats.cards.units_sold.variation >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-600 mr-1" />
              )}
              <span className={stats && stats.cards.units_sold.variation >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                {stats ? Math.abs(stats.cards.units_sold.variation) : 0}%
              </span>
              <span className="text-gray-500 ml-2">vs période précédente</span>
            </div>
          </CardContent>
        </Card>

        {/* Gross Profit */}
        <Card className="gap-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">Bénéfice brut</CardTitle>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatPrice(stats.cards.gross_profit.value) : "0 CDF"}
            </div>
            <div className="flex items-center mt-2 text-sm">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                Marge: {stats?.cards.gross_profit.margin || 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Evolution Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Évolution des ventes</CardTitle>
                <CardDescription>
                  {stats?.date_range.start && stats?.date_range.end
                    ? `Du ${new Date(stats.date_range.start).toLocaleDateString("fr-FR")} au ${new Date(stats.date_range.end).toLocaleDateString("fr-FR")}`
                    : "Période sélectionnée"}
                </CardDescription>
              </div>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            {salesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={salesChartData}>
                  <defs>
                    <linearGradient id="colorVentes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <Tooltip
                    formatter={(value) => [formatPrice(value as number), "Ventes"]}
                    labelStyle={{ color: "#374151" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ventes"
                    stroke="#f97316"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorVentes)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                <ShoppingCart className="h-12 w-12 text-gray-300 mb-4" />
                <p>Aucune vente pour cette période</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Modes de paiement</CardTitle>
            <CardDescription>Répartition des ventes</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {paymentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatPrice(value as number)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                <DollarSign className="h-12 w-12 text-gray-300 mb-4" />
                <p>Aucune donnée</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Produits les plus vendus</CardTitle>
            <CardDescription>Top 10 de la période</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.charts.top_products && stats.charts.top_products.length > 0 ? (
              <div className="space-y-4">
                {stats.charts.top_products.slice(0, 5).map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{product.quantity} unités</p>
                      <p className="text-xs text-gray-500">{formatPrice(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Package className="h-12 w-12 text-gray-300 mb-4" />
                <p>Aucun produit vendu</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Alertes inventaire</CardTitle>
            <CardDescription>État du stock</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Low Stock Alert */}
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-yellow-900">Stock bas</p>
                    <p className="text-sm text-yellow-700">Produits à réapprovisionner</p>
                  </div>
                </div>
                <Badge className="bg-yellow-100 text-yellow-700 text-lg px-3 py-1">
                  {stats?.inventory?.low_stock_count || 0}
                </Badge>
              </div>

              {/* Stock Value */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Valeur du stock</p>
                    <p className="text-sm text-blue-700">Total en inventaire</p>
                  </div>
                </div>
                <span className="font-bold text-blue-900">
                  {stats ? formatPrice(stats.inventory?.stock_value || "0") : "0 CDF"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
