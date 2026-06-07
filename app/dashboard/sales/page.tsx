"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ShoppingCart,
  Receipt,
  CreditCard,
  TrendingUp,
  Users,
  Package,
  ArrowRight,
  Plus,
  Search,
  Loader2,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  RotateCcw,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getSales,
  getSalesStats,
  getRegisters,
  getCurrentSession,
  Sale,
  SalesStats,
  Register,
  RegisterSession,
} from "@/actions/sales.actions";

export default function SalesPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [currentSession, setCurrentSession] = useState<RegisterSession | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          // Fetch in parallel
          const [salesResult, statsResult, registersResult, sessionResult] = await Promise.all([
            getSales(session.accessToken, org.id, {
              date_from: new Date().toISOString().split('T')[0],
              date_to: new Date().toISOString().split('T')[0]
            }),
            getSalesStats(session.accessToken, org.id, "today"),
            getRegisters(session.accessToken, org.id, { is_active: true }),
            getCurrentSession(session.accessToken, org.id),
          ]);

          if (salesResult.success && salesResult.data) {
            setTodaySales(salesResult.data.results || []);
          }
          if (statsResult.success && statsResult.data) {
            setStats(statsResult.data);
          }
          if (registersResult.success && registersResult.data) {
            setRegisters(registersResult.data);
          }
          if (sessionResult.success && sessionResult.data) {
            setCurrentSession(sessionResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching sales data:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken]);


  // Format time
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      draft: { label: "Brouillon", className: "bg-gray-100 text-gray-700" },
      pending: { label: "En attente", className: "bg-yellow-100 text-yellow-700" },
      completed: { label: "Terminée", className: "bg-green-100 text-green-700" },
      partially_paid: { label: "Partiel", className: "bg-blue-100 text-blue-700" },
      cancelled: { label: "Annulée", className: "bg-red-100 text-red-700" },
      refunded: { label: "Remboursée", className: "bg-purple-100 text-purple-700" },
    };
    const { label, className } = config[status] || { label: status, className: "bg-gray-100" };
    return <Badge className={className}>{label}</Badge>;
  };

  // Filter sales
  const filteredSales = (Array.isArray(todaySales) ? todaySales : []).filter(
    sale =>
      sale.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customer_name && sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
          <h1 className="text-2xl font-bold text-gray-900">Ventes</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez vos ventes et votre point de vente</p>
        </div>
        <div className="flex items-center gap-2">
          {currentSession ? (
            <Button onClick={() => router.push("/dashboard/sales/pos")} className="bg-orange-500 hover:bg-orange-600">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Ouvrir le point de vente
            </Button>
          ) : (
            <Button onClick={() => router.push("/dashboard/sales/registers")} variant="outline">
              <Clock className="h-4 w-4 mr-2" />
              Ouvrir une session
            </Button>
          )}
        </div>
      </div>

      {/* Current Session Alert */}
      {currentSession && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-900">Session active</p>
                  <p className="text-sm text-green-700">
                    {currentSession.register_name} • Ouvert à {formatTime(currentSession.opened_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-100"
                  onClick={() => router.push("/dashboard/sales/pos")}
                >
                  Continuer a vendre
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={formatPrice(stats?.summary.total_sales || 0)} />
                <p className="text-xs text-gray-500">Ventes du jour</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Receipt className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={String(stats?.summary.count || 0)} />
                <p className="text-xs text-gray-500">Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={formatPrice(stats?.summary.average || 0)} />
                <p className="text-xs text-gray-500">Panier moyen</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calculator className="h-5 w-5 text-orange-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={String(registers.length)} />
                <p className="text-xs text-gray-500">Caisses actives</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {currentSession && (
          <Link href="/dashboard/sales/pos">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full p-0">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="p-3 bg-orange-100 rounded-lg mb-2">
                  <ShoppingCart className="h-6 w-6 text-orange-600" />
                </div>
                <span className="text-sm font-medium">Point de vente</span>
              </CardContent>
            </Card>
          </Link>
        )}

        <Link href="/dashboard/sales/pending-payments">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full p-0">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="p-3 bg-yellow-100 rounded-lg mb-2">
                <DollarSign className="h-6 w-6 text-yellow-600" />
              </div>
              <span className="text-sm font-medium">Paiements en attente</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/sales/history">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full p-0">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="p-3 bg-blue-100 rounded-lg mb-2">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium">Historique de vente</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/sales/registers">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full p-0">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="p-3 bg-green-100 rounded-lg mb-2">
                <Calculator className="h-6 w-6 text-green-600" />
              </div>
              <span className="text-sm font-medium">Caisses</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/sales/quotations">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full p-0">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="p-3 bg-purple-100 rounded-lg mb-2">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium">Devis</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Today's Sales */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">Ventes du jour</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Link href="/dashboard/sales/history">
                <Button variant="outline" size="sm">
                  Voir tout
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune vente aujourd'hui</h3>
              <p className="text-sm text-gray-500 mb-4">
                Commencez à vendre en ouvrant le point de vente
              </p>
              <Button onClick={() => router.push("/dashboard/sales/pos")}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Ouvrir le point de vente
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSales.slice(0, 10).map(sale => (
                <Link
                  key={sale.id}
                  href={`/dashboard/sales/${sale.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Receipt className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{sale.reference}</p>
                        <p className="text-xs text-gray-500">
                          {sale.customer_name || "Client anonyme"} • {formatTime(sale.sale_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(sale.status)}
                      <span className="font-semibold text-gray-900">
                        {formatPrice(sale.total)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods Summary */}
      {stats && stats.by_payment_method && stats.by_payment_method.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Répartition par mode de paiement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {stats.by_payment_method.map((method, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 rounded-lg"
                >
                  <p className="text-sm text-gray-500 mb-1">
                    {method.payment_method__name || "Non défini"}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatPrice(method.total)}
                  </p>
                  <p className="text-xs text-gray-500">{method.count} transactions</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
