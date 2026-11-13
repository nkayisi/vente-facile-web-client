"use client";

/**
 * Le tableau de bord de la plateforme.
 *
 * ⚠ DEUX REVENUS, ET ILS NE DISENT PAS LA MÊME CHOSE. Le MRR est ce que la
 * plateforme gagne CHAQUE MOIS (un abonnement annuel compté au douzième) ;
 * l'encaissé est ce qui est entré sur le compte. Un abonnement annuel payé en
 * janvier fait de janvier un mois record d'encaissé, et ne change pas le MRR.
 *
 * ⚠ AUCUNE SOMME INTER-DEVISES : chaque montant porte sa devise, et un total en
 * plusieurs devises s'écrit en plusieurs lignes.
 */
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getAdminDashboardStats,
  getAdminIncidents,
  type AdminDashboardStats,
  type AdminIncidents,
} from "@/actions/admin.actions";
import {
  Building2,
  TrendingUp,
  Repeat,
  ArrowRight,
  Loader2,
  Siren,
  UserMinus,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { compte, dateCourte, montant, nombre, pourcentage } from "@/lib/admin/format";

const COULEURS_DEVISES = ["#ea580c", "#2563eb", "#16a34a", "#9333ea", "#0891b2"];

const LIBELLES_STATUT: Record<string, string> = {
  trial: "Essai",
  active: "Actif",
  past_due: "En retard",
  cancelled: "Annulé",
  expired: "Expiré",
  suspended: "Suspendu",
};

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const { hasPlatformPermission } = useAdminPermissions();
  const voitIncidents = hasPlatformPermission("incidents.view");
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [incidents, setIncidents] = useState<AdminIncidents | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!jeton) return;
    let annule = false;
    (async () => {
      const [r, i] = await Promise.all([
        getAdminDashboardStats(jeton),
        voitIncidents ? getAdminIncidents(jeton) : Promise.resolve(null),
      ]);
      if (annule) return;
      if (r.success && r.data) setStats(r.data);
      if (i && i.success && i.data) setIncidents(i.data);
      setIsLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, voitIncidents]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Impossible de charger les statistiques</p>
      </div>
    );
  }

  const devises = Array.from(
    new Set(stats.revenue_trend.flatMap((m) => Object.keys(m.by_currency)))
  ).sort();
  const revenuParMois = stats.revenue_trend.map((m) => {
    const ligne: Record<string, string | number> = { month: m.month };
    for (const d of devises) ligne[d] = parseFloat(m.by_currency[d] ?? "0");
    return ligne;
  });

  const subscriptionStatusData = Object.entries(stats.subscriptions_by_status).map(
    ([status, count]) => ({ status: LIBELLES_STATUT[status] ?? status, count })
  );
  const subscriptionPlanData = stats.subscriptions_by_plan.map((item) => ({
    plan: item.plan__name,
    count: item.count,
  }));

  const cartes = [
    {
      title: "MRR",
      value: montant(stats.mrr, stats.mrr_currency),
      sub: stats.mrr_by_currency.length > 1
        ? stats.mrr_by_currency.slice(1).map((d) => montant(d.mrr, d.currency)).join(" · ")
        : compte(stats.paying_organizations, "établissement payant", "établissements payants"),
      icon: Repeat,
      href: "/admin/statistiques",
    },
    {
      title: "Revenu moyen par établissement",
      value: montant(stats.arpu, stats.mrr_currency),
      sub: `${nombre(stats.trialing_organizations)} en essai`,
      icon: TrendingUp,
      href: "/admin/statistiques",
    },
    {
      title: "Attrition (30 jours)",
      value: pourcentage(stats.churn_rate_30d),
      sub: stats.churn_rate_30d === null ? "Pas encore d'historique payant" : "Établissements payants perdus",
      icon: UserMinus,
      href: "/admin/statistiques",
    },
    {
      title: "Établissements",
      value: nombre(stats.total_organizations),
      sub: `${nombre(stats.active_organizations)} actifs · ${nombre(stats.total_users)} utilisateurs (+${nombre(stats.new_users_this_month)} ce mois)`,
      icon: Building2,
      href: "/admin/organizations",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d&apos;ensemble de la plateforme</p>
      </div>

      {incidents && incidents.counts.critical + incidents.counts.subscriptions_at_risk + incidents.counts.payments_to_review > 0 && (
        <Link href="/admin/incidents" className="block">
          <Card className="border-destructive/40 bg-destructive/5 transition-colors hover:bg-destructive/10">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Siren className="mt-0.5 h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-foreground">
                    {incidents.counts.critical > 0
                      ? `${compte(incidents.counts.critical, "incident critique", "incidents critiques")} à traiter`
                      : "Des incidents attendent le support"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {compte(incidents.counts.subscriptions_at_risk, "abonnement", "abonnements")} à risque ·{" "}
                    {compte(incidents.counts.payments_to_review, "paiement", "paiements")} à vérifier ·{" "}
                    {nombre(incidents.counts.organizations_without_owner)} sans propriétaire
                  </p>
                </div>
              </div>
              <span className="flex items-center text-sm font-medium text-destructive">
                Ouvrir <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cartes.map((card) => (
          <Link key={card.title} href={card.href} className="block">
            <Card className="h-full border transition-colors hover:bg-muted/40">
              <CardContent>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-semibold mt-1 break-words">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                  </div>
                  <card.icon className="h-5 w-5 shrink-0 text-primary" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Encaissé par mois</CardTitle>
            <p className="text-xs text-muted-foreground">
              Les paiements reçus, par devise. À ne pas confondre avec le MRR.
            </p>
          </CardHeader>
          <CardContent>
            {devises.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Aucun paiement sur six mois.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={revenuParMois}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value, name) => [montant(value as number, String(name)), String(name)]}
                    contentStyle={{ border: "1px solid #e8eaed", borderRadius: "8px" }}
                  />
                  {devises.length > 1 && <Legend />}
                  {devises.map((d, i) => (
                    <Bar key={d} dataKey={d} fill={COULEURS_DEVISES[i % COULEURS_DEVISES.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Encaissé</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.revenue_by_currency.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun paiement reçu.</p>
            ) : (
              <div className="divide-y">
                {stats.revenue_by_currency.map((r) => (
                  <div key={r.currency} className="py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{r.currency}</p>
                    <p className="text-lg font-semibold">{montant(r.total, r.currency)}</p>
                    <p className="text-xs text-muted-foreground">Ce mois : {montant(r.this_month, r.currency)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Nouveaux établissements</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.growth_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [nombre(value as number), "Établissements"]}
                  contentStyle={{ border: "1px solid #e8eaed", borderRadius: "8px" }}
                />
                <Area type="monotone" dataKey="count" stroke="#ea580c" fill="#fff7ed" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Nouveaux utilisateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.users_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [nombre(value as number), "Utilisateurs"]}
                  contentStyle={{ border: "1px solid #e8eaed", borderRadius: "8px" }}
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Abonnements par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={subscriptionStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [nombre(value as number), "Abonnements"]}
                  contentStyle={{ border: "1px solid #e8eaed", borderRadius: "8px" }}
                />
                <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Abonnements en cours par plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={subscriptionPlanData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                <XAxis dataKey="plan" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [nombre(value as number), "Abonnements"]}
                  contentStyle={{ border: "1px solid #e8eaed", borderRadius: "8px" }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium">Établissements récents</CardTitle>
          <Button variant="ghost" size="sm" className="text-primary" asChild>
            <Link href="/admin/organizations">
              Voir tout <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {stats.recent_organizations.map((org) => (
              <Link
                key={org.id}
                href={`/admin/organizations/${org.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{org.name}</p>
                  <p className="text-sm text-muted-foreground">{org.business_type}</p>
                </div>
                <p className="text-sm text-muted-foreground shrink-0">{dateCourte(org.created_at)}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
