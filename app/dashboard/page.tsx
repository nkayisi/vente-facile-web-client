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
import { formatPrice, formatNumber, formatDecimal } from "@/lib/format";
import { useOrganization } from "@/components/auth/organization-checker";
import { StatValue } from "@/components/shared/StatValue";
import {
  getDashboardStats,
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

/**
 * Les libellés NOMMENT la fenêtre glissante.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ « CE MOIS » POUVAIT ANNONCER MOINS QUE « CETTE SEMAINE ».                │
 * │                                                                          │
 * │ Le serveur mêlait deux sémantiques : `week` glissante (`today - 6`),     │
 * │ `month` et `year` calendaires. Le 1er septembre, « Ce mois » couvrait    │
 * │ UNE SEULE JOURNÉE quand « Cette semaine » remontait au 26 août, et une   │
 * │ vente du 28 août disparaissait du mois. Tout est désormais glissant, et  │
 * │ chaque période contient strictement la précédente. Voir                  │
 * │ `apps/organizations/views.py::_periode_glissante`.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  day: "Aujourd'hui",
  week: "Les 7 derniers jours",
  month: "Les 30 derniers jours",
  year: "Les 12 derniers mois",
};

const PERIOD_BUTTONS: Record<DashboardPeriod, string> = {
  day: "Jour",
  week: "7 jours",
  month: "30 jours",
  year: "12 mois",
};

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6"];

/**
 * Variation d'un relevé, face à la période précédente.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ « ↗ 0 % » EN VERT DISAIT UNE HAUSSE LÀ OÙ IL NE S'ÉTAIT RIEN PASSÉ.      │
 * │                                                                          │
 * │ Le test était `variation >= 0`, qui range le zéro du côté positif : une  │
 * │ journée sans la moindre vente s'annonçait donc par une flèche montante   │
 * │ verte. À force de voir du vert qui ne dit rien, on ne voit plus le vrai. │
 * │ Un relevé à zéro reste NEUTRE, sans flèche et sans couleur - même règle  │
 * │ que `StatStripItem` et que le terminal.                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
function Variation({ valeur }: { valeur: number | null | undefined }) {
  if (valeur === null || valeur === undefined) return null;
  const arrondie = Math.round(valeur);
  const nul = arrondie === 0;
  const positif = valeur >= 0;
  const ton = nul ? "text-gray-500" : positif ? "text-green-600" : "text-red-600";

  return (
    <div className="flex items-center mt-2 text-sm">
      {nul ? null : positif ? (
        <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
      ) : (
        <ArrowDownRight className="h-4 w-4 text-red-600 mr-1" />
      )}
      <span className={`font-medium tabular-nums ${ton}`}>{Math.abs(arrondie)}%</span>
      <span className="text-gray-500 ml-2">vs période précédente</span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  // L'organisation vient du contexte rempli par `OrganizationChecker`, qui
  // enveloppe déjà tout le tableau de bord. La recharger ici ajoutait un
  // `GET /organizations/` en TÊTE d'attente : la page ne demandait ses vraies
  // données qu'une fois cette première réponse revenue.
  const { organization } = useOrganization();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("month");

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken || !organization?.id) return;

      setIsLoading(true);
      try {
        const statsResult = await getDashboardStats(
          session.accessToken,
          organization.id,
          period,
        );
        if (statsResult.success && statsResult.data) {
          setStats(statsResult.data);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken, organization?.id, period]);


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

  // ┌──────────────────────────────────────────────────────────────────────┐
  // │ L'ANNEAU VENTILE PAR DEVISE, PAS PAR MOYEN DE PAIEMENT.              │
  // │                                                                      │
  // │ Le tableau de bord est tout entier converti en devise principale : la │
  // │ question qui reste est « en quelle monnaie l'argent est entré », et   │
  // │ elle ne se lit nulle part ailleurs. La PART se calcule sur le montant │
  // │ converti - sans quoi 7 728 FC et 132 775 $ ne seraient pas            │
  // │ comparables - mais la légende porte AUSSI le montant natif, celui que │
  // │ le caissier a compté dans son tiroir.                                 │
  // │                                                                      │
  // │ Les moyens de paiement passent dessous, en liste : même contenu,      │
  // │ rangé au rang qui est désormais le sien.                              │
  // └──────────────────────────────────────────────────────────────────────┘
  const currencyChartData = stats?.charts.by_currency?.map(item => ({
    name: item.code,
    value: parseFloat(item.primary_total),
    native: parseFloat(item.native_total),
    count: item.count,
  })) || [];

  const paymentMethodData = stats?.charts.by_payment_method.map(item => ({
    name: item.name,
    value: parseFloat(item.value),
    count: item.count,
  })) || [];
  const paymentMethodTotal = paymentMethodData.reduce((sum, m) => sum + m.value, 0);

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
            {stats?.currency ? ` • en ${stats.currency}` : ""}
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
              {PERIOD_BUTTONS[p]}
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
            <StatValue value={formatPrice(stats ? stats.cards.total_sales.value : 0)} />
            <Variation valeur={stats?.cards.total_sales.variation} />
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
            <StatValue value={stats ? formatNumber(stats.cards.total_customers.value as number) : "0"} />
            <div className="flex items-center mt-2 text-sm">
              <span className="text-green-600 font-medium tabular-nums">
                +{stats?.cards.total_customers.new_count || 0}
              </span>
              {/* « +1 nouveaux » ne s'accorde pas. Le terminal accordait déjà. */}
              <span className="text-gray-500 ml-2">
                {(stats?.cards.total_customers.new_count || 0) > 1 ? "nouveaux" : "nouveau"}{" "}
                cette période
              </span>
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
            <StatValue value={stats ? formatNumber(stats.cards.units_sold.value as number) : "0"} />
            <Variation valeur={stats?.cards.units_sold.variation} />
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
            <StatValue value={formatPrice(stats ? stats.cards.gross_profit.value : 0)} />
            {/* La marge est un RAPPORT : sans chiffre d'affaires elle ne se
                rattache à rien, et un « Marge : 0 % » se lirait comme une vente
                à perte. Le serveur rend 0 dans les deux cas, d'où le contrôle
                sur les ventes. La virgule est française, comme le montant juste
                au-dessus, qui s'écrit déjà « 33 620,02 $ ». */}
            {stats && Number(stats.cards.total_sales.value) > 0 ? (
              <div className="flex items-center mt-2 text-sm">
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  Marge : {formatDecimal(stats.cards.gross_profit.margin ?? 0, 1)} %
                </Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ┌──────────────────────────────────────────────────────────────────┐
            │ LA COURBE PREND TOUTE LA HAUTEUR DE SA CARTE.                    │
            │                                                                  │
            │ Elle était figée à 300 points pendant que sa voisine grandissait │
            │ avec ses devises et ses moyens de paiement : la grille du CSS    │
            │ étirait la carte, et la courbe laissait un blanc en dessous qui  │
            │ se lit comme un bloc manquant.                                    │
            │                                                                  │
            │ `Card` est DÉJÀ une colonne flex : il ne manquait que `flex-1`   │
            │ sur son corps, pour qu'il prenne ce que l'en-tête laisse.        │
            │                                                                  │
            │ `min-h-0` N'EST PAS FACULTATIF - un élément flex a               │
            │ `min-height: auto` par défaut, donc il refuse de se rétrécir     │
            │ sous la taille de son contenu, et `ResponsiveContainer`, qui     │
            │ mesure son parent, gonflerait alors à chaque rendu. Le plancher  │
            │ à 300 garde la courbe lisible quand c'est ELLE la plus haute.    │
            └──────────────────────────────────────────────────────────────────┘ */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Évolution des ventes</CardTitle>
                {/* « Facturé » plutôt que rien : la carte voisine dit
                    « Encaissé », et les deux ne parlent pas de la même chose.
                    Une vente libellée en dollars peut être réglée en francs, et
                    les deux lectures sont justes. Le terminal écrit pareil. */}
                <CardDescription>
                  {stats?.currency ? `Facturé, en ${stats.currency} • ` : ""}
                  {stats?.date_range.start && stats?.date_range.end
                    ? `du ${new Date(stats.date_range.start).toLocaleDateString("fr-FR")} au ${new Date(stats.date_range.end).toLocaleDateString("fr-FR")}`
                    : "période sélectionnée"}
                </CardDescription>
              </div>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            {salesChartData.length > 0 ? (
              <div className="min-h-[300px] w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
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
              </div>
            ) : (
              // L'état vide s'étire lui aussi : une carte à moitié remplie se
              // lit comme un chargement qui n'a pas fini, pas comme une absence.
              <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center text-gray-500">
                <ShoppingCart className="h-12 w-12 text-gray-300 mb-4" />
                <p>Aucune vente pour cette période</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Encaissements par devise, et les moyens de paiement en second plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Encaissements par devise</CardTitle>
            <CardDescription>
              {stats?.currency ? `Converti en ${stats.currency}` : "Répartition des règlements"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currencyChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={currencyChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {currencyChartData.map((entry, index) => (
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

                {/* Le montant NATIF est celui que le caissier a compté : le taire
                    ferait de cet anneau une conversion de plus au lieu d'une
                    lecture de ce qui est réellement entré au tiroir. */}
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  {currencyChartData.map((c, index) => (
                    <div key={c.name} className="flex items-center gap-3 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium text-gray-700">{c.name}</span>
                      <span className="ml-auto text-gray-900 tabular-nums">
                        {formatPrice(c.value)}
                      </span>
                      {c.name !== stats?.currency ? (
                        <span className="text-xs text-gray-500 tabular-nums">
                          ({c.native.toLocaleString("fr-CD")} {c.name})
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>

                {paymentMethodData.length > 0 ? (
                  <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Par moyen de paiement
                    </p>
                    {paymentMethodData.map((m) => (
                      <div key={m.name} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-gray-700">{m.name}</span>
                          <span className="font-medium text-gray-900 tabular-nums">
                            {formatPrice(m.value)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-orange-400"
                            style={{
                              width: `${paymentMethodTotal > 0 ? (m.value / paymentMethodTotal) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                <DollarSign className="h-12 w-12 text-gray-300 mb-4" />
                <p>Aucun encaissement sur cette période</p>
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
                      <p className="font-semibold text-gray-900">
                        {product.quantity_display?.trim() || `${product.quantity} unités`}
                      </p>
                      {product.packaging_factor != null && (
                        <p className="text-xs text-gray-500 tabular-nums">
                          {/* `formatNumber` ARRONDIT (8,5 rend « 9 ») et une
                              quantité vendue porte trois décimales. Rendre le
                              nombre brut écrirait « 378.5 », point anglais
                              compris, sous un montant déjà en « 33 620,02 $ ». */}
                          {formatDecimal(product.quantity, 3)} au total
                        </p>
                      )}
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
                  {stats ? formatPrice(stats.inventory?.stock_value || "0") : formatPrice(0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
