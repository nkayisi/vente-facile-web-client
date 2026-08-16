"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart,
  Receipt,
  TrendingUp,
  ArrowRight,
  Search,
  DollarSign,
  Clock,
  CheckCircle,
  FileText,
  Calculator,
  CircleDashed,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import { getUserOrganizations } from "@/actions/organization.actions";
import {
  getSales,
  getSalesStats,
  getCurrentSession,
  Sale,
  SalesStats,
  RegisterSession,
} from "@/actions/sales.actions";

/** Raccourcis de la section vente. `badge` reçoit un compteur quand il y a lieu. */
const QUICK_LINKS = [
  {
    href: "/dashboard/sales/pending-payments",
    label: "Paiements en attente",
    icon: DollarSign,
    tint: "bg-amber-100 text-amber-600",
  },
  {
    href: "/dashboard/sales/history",
    label: "Historique",
    icon: Receipt,
    tint: "bg-blue-100 text-blue-600",
  },
  {
    href: "/dashboard/sales/registers",
    label: "Caisses",
    icon: Calculator,
    tint: "bg-green-100 text-green-600",
  },
  {
    href: "/dashboard/sales/quotations",
    label: "Devis",
    icon: FileText,
    tint: "bg-purple-100 text-purple-600",
  },
] as const;

/**
 * Retour tactile au clic, avec des transitions nommées.
 *
 * Le bouton shadcn porte `transition-all` : le remplacer par la liste exacte
 * des propriétés qui bougent évite d'animer au passage des grandeurs de
 * disposition. La classe est partagée pour que tous les boutons de la page
 * aient exactement le même rythme.
 */
const PRESSABLE =
  "transition-[color,background-color,box-shadow,transform] duration-200 active:scale-[0.96]";

/** « depuis 3 h 20 » : une heure brute obligerait à faire la soustraction. */
function formatOpenSince(openedAt?: string | null): string | null {
  if (!openedAt) return null;
  const opened = new Date(openedAt);
  if (Number.isNaN(opened.getTime())) return null;

  const minutes = Math.max(0, Math.round((Date.now() - opened.getTime()) / 60000));
  if (minutes < 60) return `depuis ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `depuis ${hours} h ${String(rest).padStart(2, "0")}` : `depuis ${hours} h`;
  }
  return `depuis ${Math.floor(hours / 24)} j`;
}

export default function SalesPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
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

          // Fetch in parallel. La liste des caisses n'est plus chargée ici :
          // le compteur « caisses actives » a cédé la place au reste à
          // encaisser, qui se déduit des ventes du jour.
          const [salesResult, statsResult, sessionResult] = await Promise.all([
            getSales(session.accessToken, org.id, {
              date_from: new Date().toISOString().split('T')[0],
              date_to: new Date().toISOString().split('T')[0]
            }),
            getSalesStats(session.accessToken, org.id, "today"),
            getCurrentSession(session.accessToken, org.id),
          ]);

          if (salesResult.success && salesResult.data) {
            setTodaySales(salesResult.data.results || []);
          }
          if (statsResult.success && statsResult.data) {
            setStats(statsResult.data);
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

  const todayLabel = new Date().toLocaleDateString("fr-CD", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      draft: { label: "Brouillon", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
      pending: { label: "En attente", className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" },
      completed: { label: "Terminée", className: "bg-green-100 text-green-700 hover:bg-green-100" },
      partially_paid: { label: "Partiel", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
      cancelled: { label: "Annulée", className: "bg-red-100 text-red-700 hover:bg-red-100" },
      refunded: { label: "Remboursée", className: "bg-purple-100 text-purple-700 hover:bg-purple-100" },
    };
    const { label, className } = config[status] || { label: status, className: "bg-gray-100" };
    return <Badge className={className}>{label}</Badge>;
  };

  const safeSales = useMemo(
    () => (Array.isArray(todaySales) ? todaySales : []),
    [todaySales]
  );

  /**
   * Reste à encaisser sur la journée.
   *
   * Remplace le compteur « caisses actives », qui répétait la page Caisses sans
   * rien appeler à l'action. Ici le gérant voit l'argent qui n'est pas encore
   * rentré, et le carreau mène droit aux paiements en attente.
   */
  const outstanding = useMemo(() => {
    return safeSales.reduce(
      (acc, sale) => {
        const due = parseFloat(sale.amount_due || "0");
        if (due > 0) {
          acc.total += due;
          acc.count += 1;
        }
        return acc;
      },
      { total: 0, count: 0 }
    );
  }, [safeSales]);

  // Filter sales
  const filteredSales = safeSales.filter(
    sale =>
      sale.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customer_name && sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const openSince = formatOpenSince(currentSession?.opened_at);

  if (isLoading) {
    // Squelettes plutôt qu'un spinner centré : la page garde sa forme, l'œil
    // sait déjà où le contenu va apparaître.
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-52" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[76px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[60px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-balance text-gray-900">Ventes</h1>
          <p className="mt-1 text-sm text-gray-500 first-letter:uppercase">{todayLabel}</p>
        </div>
        {/* Une seule action principale, dont la destination dépend de l'état :
            vendre si une session est ouverte, l'ouvrir sinon. */}
        {currentSession ? (
          <Button
            onClick={() => router.push("/dashboard/sales/pos")}
            className={`bg-orange-500 hover:bg-orange-600 ${PRESSABLE}`}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Ouvrir le point de vente
          </Button>
        ) : (
          <Button
            onClick={() => router.push("/dashboard/sales/registers")}
            className={`bg-orange-500 hover:bg-orange-600 ${PRESSABLE}`}
          >
            <Clock className="h-4 w-4 mr-2" />
            Ouvrir une session
          </Button>
        )}
      </div>

      {/* État de la session : présent dans les deux cas, pour que la page ne
          change pas de structure selon qu'une caisse est ouverte ou non. */}
      {currentSession ? (
        <Card className="gap-0 border-green-200 bg-green-50 py-0">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="shrink-0 rounded-lg bg-green-100 p-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-green-900">
                  Session ouverte · {currentSession.register_name}
                </p>
                <p className="truncate text-sm text-green-700">
                  {openSince ? `${openSince} · ` : ""}
                  <span className="tabular-nums">{currentSession.sales_count}</span> vente
                  {currentSession.sales_count > 1 ? "s" : ""} ·{" "}
                  <span className="tabular-nums">{formatPrice(currentSession.sales_total)}</span>{" "}
                  encaissés
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className={`shrink-0 border-green-600 text-green-700 hover:bg-green-100 hover:text-green-800 ${PRESSABLE}`}
              onClick={() => router.push("/dashboard/sales/pos")}
            >
              Continuer à vendre
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 border-dashed py-0">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="shrink-0 rounded-lg bg-gray-100 p-2">
                <CircleDashed className="h-5 w-5 text-gray-500" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900">Aucune session ouverte</p>
                <p className="text-sm text-gray-500">
                  Ouvrez une session de caisse pour encaisser des ventes.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className={`shrink-0 ${PRESSABLE}`}
              onClick={() => router.push("/dashboard/sales/registers")}
            >
              Voir les caisses
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Chiffres du jour */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="gap-0 py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="shrink-0 rounded-lg bg-green-100 p-2">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div className="min-w-0 flex-1">
              <StatValue value={formatPrice(stats?.summary.total_sales || 0)} />
              <p className="text-xs text-gray-500">Ventes du jour</p>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="shrink-0 rounded-lg bg-blue-100 p-2">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <StatValue value={String(stats?.summary.count || 0)} />
              <p className="text-xs text-gray-500">Transactions</p>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="shrink-0 rounded-lg bg-purple-100 p-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div className="min-w-0 flex-1">
              <StatValue value={formatPrice(stats?.summary.average || 0)} />
              <p className="text-xs text-gray-500">Panier moyen</p>
            </div>
          </CardContent>
        </Card>

        <Link
          href="/dashboard/sales/pending-payments"
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          aria-label={`À encaisser : ${formatPrice(outstanding.total)} sur ${outstanding.count} vente(s)`}
        >
          <Card className="h-full gap-0 py-0 transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="shrink-0 rounded-lg bg-amber-100 p-2">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue
                  value={formatPrice(outstanding.total)}
                  color={outstanding.total > 0 ? "text-amber-700" : undefined}
                />
                <p className="text-xs text-gray-500">
                  À encaisser
                  {outstanding.count > 0 ? ` · ${outstanding.count} vente${outstanding.count > 1 ? "s" : ""}` : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Raccourcis : rangée compacte, l'icône à gauche du libellé plutôt
          qu'empilée, pour rendre la hauteur à la liste des ventes. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_LINKS.map(link => {
          const Icon = link.icon;
          const badge =
            link.href === "/dashboard/sales/pending-payments" && outstanding.count > 0
              ? outstanding.count
              : null;

          return (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
            >
              {/* `transition-shadow` et `transition-transform` sont le même
                  groupe Tailwind : twMerge n'en garderait qu'un et la mise à
                  l'échelle serait sèche. D'où la valeur combinée. */}
              <Card className="h-full gap-0 py-0 transition-[box-shadow,transform] duration-200 hover:shadow-md active:scale-[0.96]">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className={`shrink-0 rounded-lg p-2 ${link.tint}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                    {link.label}
                  </span>
                  {badge !== null && (
                    <Badge className="shrink-0 bg-amber-100 tabular-nums text-amber-700 hover:bg-amber-100">
                      {badge}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Ventes du jour */}
      <Card className="gap-0 py-0">
        <CardHeader className="gap-3 border-b p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">
              Ventes du jour{" "}
              <span className="font-normal tabular-nums text-gray-500">
                ({filteredSales.length})
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Référence ou client..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Rechercher une vente du jour"
                />
              </div>
              <Link href="/dashboard/sales/history">
                <Button
                  variant="outline"
                  size="sm"
                  className={`shrink-0 ${PRESSABLE}`}
                >
                  Voir tout
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredSales.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Receipt className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <h3 className="mb-2 text-lg font-medium text-gray-900 text-balance">
                {searchQuery ? "Aucune vente ne correspond" : "Aucune vente aujourd'hui"}
              </h3>
              <p className="mx-auto mb-4 max-w-sm text-sm text-gray-500 text-pretty">
                {searchQuery
                  ? "Essayez une autre référence ou un autre nom de client."
                  : currentSession
                    ? "Ouvrez le point de vente pour enregistrer votre première vente."
                    : "Ouvrez d'abord une session de caisse pour commencer à vendre."}
              </p>
              {searchQuery ? (
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Effacer la recherche
                </Button>
              ) : (
                // La destination suit l'état réel : proposer le point de vente
                // sans session ouverte menait à une impasse.
                <Button
                  className={`bg-orange-500 hover:bg-orange-600 ${PRESSABLE}`}
                  onClick={() =>
                    router.push(
                      currentSession ? "/dashboard/sales/pos" : "/dashboard/sales/registers"
                    )
                  }
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {currentSession ? "Ouvrir le point de vente" : "Ouvrir une session"}
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredSales.slice(0, 10).map((sale, index) => (
                <motion.div
                  key={sale.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.03 }}
                >
                  <Link
                    href={`/dashboard/sales/${sale.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="shrink-0 rounded-lg bg-gray-100 p-2">
                        <Receipt className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{sale.reference}</p>
                        <p className="truncate text-xs text-gray-500">
                          {sale.customer_name || "Client anonyme"} ·{" "}
                          <span className="tabular-nums">{formatTime(sale.sale_date)}</span>
                          {sale.items_count ? ` · ${sale.items_count} article${sale.items_count > 1 ? "s" : ""}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {parseFloat(sale.amount_due || "0") > 0 && (
                        <span className="hidden text-xs tabular-nums text-amber-700 sm:inline">
                          Reste {formatPrice(sale.amount_due)}
                        </span>
                      )}
                      {getStatusBadge(sale.status)}
                      <span className="font-semibold tabular-nums text-gray-900">
                        {formatPrice(sale.total)}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
              {filteredSales.length > 10 && (
                <Link
                  href="/dashboard/sales/history"
                  className="block px-4 py-3 text-center text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50"
                >
                  Voir les {filteredSales.length - 10} autres ventes du jour
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
