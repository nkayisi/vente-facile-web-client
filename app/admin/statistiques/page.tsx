"use client";

/**
 * Les chiffres récurrents de la plateforme, et leur évolution.
 *
 * ⚠ Le MRR se lit PAR DEVISE : une courbe par devise, jamais une courbe qui les
 * additionne. Un plan libellé en francs et un plan en dollars ne s'additionnent
 * pas plus ici que sur une facture.
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdminMetrics, type AdminMetrics } from "@/actions/admin.actions";
import { compte, montant, nombre, pourcentage } from "@/lib/admin/format";

const COULEURS = ["#ea580c", "#2563eb", "#16a34a", "#9333ea", "#0891b2"];

export default function StatistiquesPage() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const [mois, setMois] = useState("12");
  const [donnees, setDonnees] = useState<AdminMetrics | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!jeton) return;
    let annule = false;
    (async () => {
      setIsLoading(true);
      const r = await getAdminMetrics(jeton, Number(mois));
      if (annule) return;
      if (r.success && r.data) {
        setDonnees(r.data);
        setErreur(null);
      } else {
        setErreur(r.message || "Métriques indisponibles");
      }
      setIsLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, mois]);

  const devises = donnees
    ? Array.from(new Set(donnees.trend.flatMap((m) => Object.keys(m.mrr_by_currency)))).sort()
    : [];
  const serie = (donnees?.trend ?? []).map((m) => {
    const ligne: Record<string, string | number | null> = {
      month: m.month,
      payants: m.paying_organizations,
      nouveaux: m.new,
      perdus: m.churned === null ? null : -m.churned,
    };
    for (const d of devises) ligne[d] = parseFloat(m.mrr_by_currency[d] ?? "0");
    return ligne;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Statistiques</h1>
          <p className="text-muted-foreground">
            Ce que la plateforme gagne chaque mois, et qui part ou arrive.
          </p>
        </div>
        <Select value={mois} onValueChange={setMois}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6">6 derniers mois</SelectItem>
            <SelectItem value="12">12 derniers mois</SelectItem>
            <SelectItem value="24">24 derniers mois</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && !donnees ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : erreur && !donnees ? (
        <p className="py-12 text-center text-muted-foreground">{erreur}</p>
      ) : donnees ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="border">
              <CardContent>
                <p className="text-sm text-muted-foreground">MRR</p>
                {donnees.mrr_by_currency.length === 0 ? (
                  <p className="mt-1 text-2xl font-semibold">{montant(0, donnees.currency)}</p>
                ) : (
                  donnees.mrr_by_currency.map((d) => (
                    <p key={d.currency} className="mt-1 text-2xl font-semibold">
                      {montant(d.mrr, d.currency)}
                    </p>
                  ))
                )}
                <p className="mt-1 text-xs text-muted-foreground">Abonnements annuels comptés au douzième</p>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent>
                <p className="text-sm text-muted-foreground">Revenu moyen par établissement</p>
                <p className="mt-1 text-2xl font-semibold">{montant(donnees.arpu, donnees.currency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {compte(donnees.paying_organizations, "payant", "payants")} · {nombre(donnees.trialing_organizations)} en essai
                </p>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent>
                <p className="text-sm text-muted-foreground">Attrition sur 30 jours</p>
                <p className="mt-1 text-2xl font-semibold">{pourcentage(donnees.churn_rate_30d)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {donnees.churn_rate_30d === null
                    ? "Personne ne payait il y a 30 jours : rien à mesurer"
                    : compte(donnees.churned_30d, "établissement perdu", "établissements perdus")}
                </p>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent>
                <p className="text-sm text-muted-foreground">Nouveaux payants (30 jours)</p>
                <p className="mt-1 text-2xl font-semibold">{nombre(donnees.new_paying_30d)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Premier abonnement payant, ou retour</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">MRR à la fin de chaque mois</CardTitle>
              {donnees.multi_currency && (
                <p className="text-xs text-muted-foreground">Une courbe par devise : elles ne s&apos;additionnent pas.</p>
              )}
            </CardHeader>
            <CardContent>
              {devises.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Aucun abonnement payant sur la période.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value, name) => [montant(value as number, String(name)), `MRR ${String(name)}`]}
                      contentStyle={{ border: "1px solid #e8eaed", borderRadius: "8px" }}
                    />
                    {devises.length > 1 && <Legend />}
                    {devises.map((d, i) => (
                      <Line key={d} type="monotone" dataKey={d} stroke={COULEURS[i % COULEURS.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Arrivées et départs d&apos;établissements payants</CardTitle>
              <p className="text-xs text-muted-foreground">
                Le premier mois n&apos;a rien à quoi se comparer : il n&apos;est pas compté.
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={serie} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(value, name) => [nombre(Math.abs(value as number)), name === "nouveaux" ? "Arrivés" : "Partis"]}
                    contentStyle={{ border: "1px solid #e8eaed", borderRadius: "8px" }}
                  />
                  <Bar dataKey="nouveaux" stackId="flux" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="perdus" stackId="flux" fill="#dc2626" radius={[0, 0, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
