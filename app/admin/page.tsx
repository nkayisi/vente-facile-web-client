"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAdminDashboardStats, AdminDashboardStats } from "@/actions/admin.actions";
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Loader2,
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
} from "recharts";
import { formatPrice, formatNumber } from "@/lib/format";

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!session?.accessToken) return;
      const result = await getAdminDashboardStats(session.accessToken);
      if (result.success && result.data) {
        setStats(result.data);
      }
      setIsLoading(false);
    }
    fetchStats();
  }, [session?.accessToken]);

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

  const statCards = [
    { title: "Établissements", value: formatNumber(stats.total_organizations), sub: `${stats.active_organizations} actifs`, icon: Building2, color: "text-primary" },
    { title: "Utilisateurs", value: formatNumber(stats.total_users), sub: `+${stats.new_users_this_month} ce mois`, icon: Users, color: "text-blue-600" },
    { title: "Revenu total", value: formatPrice(parseFloat(stats.total_revenue)), icon: DollarSign, color: "text-green-600" },
    { title: "Revenu mensuel", value: formatPrice(parseFloat(stats.revenue_this_month)), icon: TrendingUp, color: "text-violet-600" },
  ];

  const subscriptionStatusData = Object.entries(stats.subscriptions_by_status).map(
    ([status, count]) => ({ status: status.charAt(0).toUpperCase() + status.slice(1), count })
  );

  const subscriptionPlanData = stats.subscriptions_by_plan.map((item) => ({
    plan: item.plan__name,
    count: item.count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Vue d&apos;ensemble de la plateforme</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="border">
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-semibold mt-1">{card.value}</p>
                  {card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}
                </div>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base font-medium">Croissance établissements</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.growth_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value) => [formatNumber(value as number), "Établissements"]}
                  contentStyle={{ border: "1px solid #e8eaed", borderRadius: "8px" }}
                />
                <Area type="monotone" dataKey="count" stroke="#ea580c" fill="#fff7ed" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Croissance utilisateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.users_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value) => [formatNumber(value as number), "Utilisateurs"]}
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
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subscriptionStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value) => [formatNumber(value as number), "Abonnements"]}
                  contentStyle={{ border: "1px solid #e8eaed", borderRadius: "8px" }}
                />
                <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Abonnements par plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subscriptionPlanData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                <XAxis dataKey="plan" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value) => [formatNumber(value as number), "Abonnements"]}
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
          <Link href="/admin/organizations">
            <Button variant="ghost" size="sm" className="text-primary">
              Voir tout <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {stats.recent_organizations.map((org) => (
              <div key={org.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{org.name}</p>
                  <p className="text-sm text-muted-foreground">{org.business_type}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(org.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
