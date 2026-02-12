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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Search,
  Loader2,
  Receipt,
  Filter,
  Calendar,
  Eye,
  Download,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatDateTime } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getSales,
  Sale,
  SaleStatus,
} from "@/actions/sales.actions";

const STATUS_CONFIG: Record<SaleStatus, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700" },
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Terminée", color: "bg-green-100 text-green-700" },
  partially_paid: { label: "Partiel", color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Annulée", color: "bg-red-100 text-red-700" },
  refunded: { label: "Remboursée", color: "bg-purple-100 text-purple-700" },
};

export default function SalesHistoryPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          const salesResult = await getSales(session.accessToken, org.id);
          if (salesResult.success && salesResult.data) {
            setSales(salesResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching sales:", error);
        toast.error("Erreur lors du chargement des ventes");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session]);

  // Apply filters
  const applyFilters = async () => {
    if (!session?.accessToken || !organization?.id) return;

    setIsLoading(true);
    try {
      const salesResult = await getSales(session.accessToken, organization.id, {
        status: selectedStatus !== "all" ? (selectedStatus as SaleStatus) : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: searchQuery || undefined,
      });

      if (salesResult.success && salesResult.data) {
        setSales(salesResult.data);
      }
    } catch (error) {
      toast.error("Erreur lors du filtrage");
    } finally {
      setIsLoading(false);
    }
  };


  // Filter sales locally
  const filteredSales = (Array.isArray(sales) ? sales : []).filter(sale => {
    const matchesSearch =
      sale.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customer_name && sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = selectedStatus === "all" || sale.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

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
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sales">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Historique des ventes</h1>
            <p className="text-sm text-gray-500 mt-1">{filteredSales.length} ventes</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par référence ou client..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="pl-9"
              placeholder="Date début"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="pl-9"
              placeholder="Date fin"
            />
          </div>
          <Button onClick={applyFilters} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Appliquer les filtres
          </Button>
        </div>
      </div>

      {/* Sales List */}
      {filteredSales.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune vente</h3>
            <p className="text-sm text-gray-500">
              Aucune vente ne correspond à vos critères de recherche.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Référence
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Client
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Date
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Articles
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Statut
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Total
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSales.map(sale => {
                  const statusConfig = STATUS_CONFIG[sale.status];
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{sale.reference}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-900">
                          {sale.customer_name || "Client anonyme"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">{formatDateTime(sale.sale_date)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary">{sale.items_count}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900">
                          {formatPrice(sale.total)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => router.push(`/dashboard/sales/${sale.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
