"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserPlus,
  Truck,
  TrendingUp,
  CreditCard,
  Loader2,
  ArrowRight,
  Building2,
  User,
  Phone,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getCustomers,
  getSuppliers,
  getCustomerStats,
  Customer,
  Supplier,
  CustomerStats,
} from "@/actions/contacts.actions";

export default function ContactsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          const [customersResult, suppliersResult, statsResult] = await Promise.all([
            getCustomers(session.accessToken, org.id, { is_active: true }),
            getSuppliers(session.accessToken, org.id, { is_active: true }),
            getCustomerStats(session.accessToken, org.id),
          ]);

          if (customersResult.success && customersResult.data) {
            setCustomers(customersResult.data.results || []);
          }
          if (suppliersResult.success && suppliersResult.data) {
            setSuppliers(suppliersResult.data.results || []);
          }
          if (statsResult.success && statsResult.data) {
            setStats(statsResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching contacts data:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const individualsCount = stats?.by_type?.find(t => t.customer_type === "individual")?.count || 0;
  const businessCount = stats?.by_type?.find(t => t.customer_type === "business")?.count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients & Fournisseurs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez vos clients, fournisseurs et leurs informations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/contacts/suppliers")}
          >
            <Truck className="h-4 w-4 mr-2" />
            Fournisseurs
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => router.push("/dashboard/contacts/customers")}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Clients
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={String(stats?.total || customers.length)} />
                <p className="text-xs text-gray-500">Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Truck className="h-5 w-5 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={String(suppliers.length)} />
                <p className="text-xs text-gray-500">Fournisseurs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-orange-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={String(stats?.with_balance || 0)} color="text-orange-600" />
                <p className="text-xs text-gray-500">Avec solde</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={formatPrice(stats?.total_balance || "0")} />
                <p className="text-xs text-gray-500">Solde total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/dashboard/contacts/customers">
          <Card className="p-0 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Gestion des clients</h3>
                  <p className="text-sm text-gray-500">
                    {individualsCount} particulier{individualsCount > 1 ? "s" : ""} · {businessCount} entreprise{businessCount > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/contacts/suppliers">
          <Card className="p-0 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Truck className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Gestion des fournisseurs</h3>
                  <p className="text-sm text-gray-500">
                    {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""} actif{suppliers.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Contacts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Customers */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Derniers clients
              </CardTitle>
              <Link
                href="/dashboard/contacts/customers"
                className="text-xs text-orange-600 hover:underline"
              >
                Voir tout →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {customers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Aucun client</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customers.slice(0, 5).map(customer => (
                  <Link
                    key={customer.id}
                    href={`/dashboard/contacts/customers/${customer.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${customer.customer_type === "business" ? "bg-purple-100" : "bg-blue-100"}`}>
                      {customer.customer_type === "business" ? (
                        <Building2 className={`h-4 w-4 text-purple-600`} />
                      ) : (
                        <User className={`h-4 w-4 text-blue-600`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{customer.name} <span className="text-xs text-gray-400 font-normal">{customer.code}</span></p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    {parseFloat(customer.current_balance) > 0 && (
                      <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                        {formatPrice(customer.current_balance)}
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Suppliers */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="h-4 w-4 text-purple-500" />
                Derniers fournisseurs
              </CardTitle>
              <Link
                href="/dashboard/contacts/suppliers"
                className="text-xs text-orange-600 hover:underline"
              >
                Voir tout →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {suppliers.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Aucun fournisseur</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suppliers.slice(0, 5).map(supplier => (
                  <Link
                    key={supplier.id}
                    href={`/dashboard/contacts/suppliers/${supplier.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Truck className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{supplier.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {supplier.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {supplier.phone}
                          </span>
                        )}
                        {supplier.contact_person && <span>· {supplier.contact_person}</span>}
                      </div>
                    </div>
                    {supplier.currency && (
                      <Badge variant="secondary" className="text-xs">
                        {supplier.currency}
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
