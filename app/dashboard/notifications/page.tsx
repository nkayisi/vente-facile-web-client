"use client";

/**
 * Ce qu'on a reçu, et les alertes du périmètre.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ IL N'Y AVAIT RIEN À OUVRIR, SUR AUCUNE SURFACE.                        │
 * │                                                                          │
 * │ Six familles d'alertes se créaient sur le serveur sans prévenir          │
 * │ personne, et la cloche de l'en-tête était commentée faute de             │
 * │ destination. Un marchand n'apprenait une rupture qu'en ouvrant la liste  │
 * │ des stocks, c'est-à-dire en la cherchant déjà.                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ DEUX ONGLETS, PARCE QUE CE SONT DEUX CHOSES. Une NOTIFICATION m'est
 * adressée et se lit une fois ; une ALERTE est un fait de l'établissement, elle
 * reste tant que le fait dure et plusieurs personnes la voient. Les fondre
 * ferait disparaître une rupture de l'écran parce qu'un collègue l'a lue.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle, ArrowLeft, Bell, Check, CheckCheck, Eye, Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataPagination } from "@/components/shared/DataPagination";
import { useOrganization } from "@/components/auth/organization-checker";
import { formatDate } from "@/lib/format";
import {
  acknowledgeAlert, getAlerts, getNotifications, markAllNotificationsRead,
  markNotificationRead,
  type Alert as AlerteApi, type AppNotification,
} from "@/actions/notifications.actions";

const TON_NOTIFICATION: Record<AppNotification["notification_type"], string> = {
  info: "bg-muted text-muted-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-destructive/15 text-destructive",
  alert: "bg-warning/15 text-warning",
};

const TON_GRAVITE: Record<AlerteApi["severity"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/15 text-warning",
  high: "bg-warning/15 text-warning",
  critical: "bg-destructive/15 text-destructive",
};

export default function NotificationsPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const jeton = session?.accessToken;

  const [onglet, setOnglet] = useState("notifications");

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [chargementN, setChargementN] = useState(true);
  const [pageN, setPageN] = useState(1);
  const [totalN, setTotalN] = useState(0);
  const [suivanteN, setSuivanteN] = useState(false);
  const [precedenteN, setPrecedenteN] = useState(false);

  const [alertes, setAlertes] = useState<AlerteApi[]>([]);
  const [chargementA, setChargementA] = useState(true);
  const [statut, setStatut] = useState("active");
  const [pageA, setPageA] = useState(1);
  const [totalA, setTotalA] = useState(0);
  const [suivanteA, setSuivanteA] = useState(false);
  const [precedenteA, setPrecedenteA] = useState(false);

  const parPage = 20;

  const chargerNotifications = useCallback(async () => {
    if (!jeton || !organization) return;
    try {
      const r = await getNotifications(jeton, organization.id, {
        page: pageN,
        page_size: parPage,
      });
      if (r.success && r.data) {
        setNotifications(r.data.results);
        setTotalN(r.data.count);
        setSuivanteN(Boolean(r.data.next));
        setPrecedenteN(Boolean(r.data.previous));
      }
    } finally {
      setChargementN(false);
    }
  }, [jeton, organization, pageN]);

  const chargerAlertes = useCallback(async () => {
    if (!jeton || !organization) return;
    try {
      const r = await getAlerts(jeton, organization.id, {
        status: statut === "all" ? undefined : statut,
        page: pageA,
      });
      if (r.success && r.data) {
        setAlertes(r.data.results);
        setTotalA(r.data.count);
        setSuivanteA(Boolean(r.data.next));
        setPrecedenteA(Boolean(r.data.previous));
      }
    } finally {
      setChargementA(false);
    }
  }, [jeton, organization, statut, pageA]);

  useEffect(() => {
    if (organization) {
      chargerNotifications();
    }
  }, [organization, chargerNotifications]);

  useEffect(() => {
    if (organization) {
      chargerAlertes();
    }
  }, [organization, chargerAlertes]);

  const lire = async (n: AppNotification) => {
    if (!jeton || !organization || n.is_read) return;
    // ⚠ ON MARQUE LUE SANS ATTENDRE : le marchand a VU la notification, c'est
    // le fait qui compte. Un aller-retour avant d'ouvrir ferait d'un clic un
    // délai.
    setNotifications((avant) =>
      avant.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
    );
    void markNotificationRead(jeton, organization.id, n.id);
  };

  const toutLire = async () => {
    if (!jeton || !organization) return;
    const r = await markAllNotificationsRead(jeton, organization.id);
    if (r.success) {
      setNotifications((avant) => avant.map((x) => ({ ...x, is_read: true })));
      const n = r.data?.updated ?? 0;
      toast.success(
        n === 0
          ? "Tout était déjà lu."
          : `${n} notification${n > 1 ? "s" : ""} marquée${n > 1 ? "s" : ""} comme lue${n > 1 ? "s" : ""}.`
      );
    } else {
      toast.error(r.message ?? "Les notifications n'ont pas pu être marquées comme lues");
    }
  };

  const voir = async (a: AlerteApi) => {
    if (!jeton || !organization) return;
    const r = await acknowledgeAlert(jeton, organization.id, a.id);
    if (r.success) {
      toast.success("Alerte marquée comme vue");
      void chargerAlertes();
    } else {
      toast.error(r.message ?? "L'alerte n'a pas pu être marquée comme vue");
    }
  };

  const nonLues = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Notifications et alertes</h1>
            <p className="text-sm text-muted-foreground">
              Ruptures, créances et décisions attendues
            </p>
          </div>
        </div>
        {onglet === "notifications" && nonLues > 0 ? (
          <Button variant="outline" onClick={() => void toutLire()}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Tout marquer comme lu
          </Button>
        ) : null}
      </div>

      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Mes notifications
            {nonLues > 0 ? (
              <Badge className="ml-2 bg-destructive/15 text-destructive" variant="secondary">
                {nonLues}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="alertes">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Alertes de l&apos;établissement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-4 space-y-4">
          {chargementN ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <Bell className="h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Aucune notification</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Vous serez prévenu des ruptures, des créances et des décisions
                  qui attendent une réponse.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <Card
                  key={n.id}
                  // ⚠ LA LIGNE NON LUE SE DISTINGUE PAR UN FILET, pas par un
                  // fond coloré : dix fonds colorés d'affilée ne se lisent plus
                  // comme un signal, ils se lisent comme un décor.
                  className={n.is_read ? "" : "border-l-4 border-l-primary"}
                >
                  <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{n.title}</p>
                        <Badge className={TON_NOTIFICATION[n.notification_type]} variant="secondary">
                          {n.notification_type === "error"
                            ? "Critique"
                            : n.notification_type === "warning"
                              ? "Important"
                              : "Information"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(n.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {n.action_url ? (
                        <Button size="sm" variant="outline" asChild onClick={() => void lire(n)}>
                          <Link href={n.action_url}>{n.action_label || "Ouvrir"}</Link>
                        </Button>
                      ) : null}
                      {!n.is_read ? (
                        <Button size="sm" variant="ghost" onClick={() => void lire(n)}>
                          <Check className="mr-1 h-3 w-3" />
                          Lu
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {totalN > parPage ? (
            <DataPagination
              currentPage={pageN}
              totalPages={Math.ceil(totalN / parPage)}
              hasNext={suivanteN}
              hasPrevious={precedenteN}
              onPageChange={setPageN}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="alertes" className="mt-4 space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
              <Select
                value={statut}
                onValueChange={(v) => {
                  setStatut(v);
                  setPageA(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actives</SelectItem>
                  <SelectItem value="acknowledged">Vues</SelectItem>
                  <SelectItem value="resolved">Résolues</SelectItem>
                  <SelectItem value="all">Toutes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {/* ⚠ Le périmètre est celui de la LIVRAISON : un gérant ne voit
                    que les alertes de ses dépôts, et c'est la même règle qui
                    décide qui est prévenu. */}
                Les alertes de vos entrepôts.
              </p>
            </CardContent>
          </Card>

          {chargementA ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : alertes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <AlertTriangle className="h-10 w-10 text-muted-foreground" />
                <p className="font-medium">
                  {statut === "active" ? "Aucune alerte active" : "Aucune alerte"}
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {statut === "active"
                    ? "Rien ne demande votre attention en ce moment."
                    : "Aucune alerte ne correspond à ce filtre."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {alertes.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{a.title}</p>
                        <Badge className={TON_GRAVITE[a.severity]} variant="secondary">
                          {a.severity_display}
                        </Badge>
                        <Badge variant="outline">{a.alert_type_display}</Badge>
                        {a.status === "acknowledged" ? (
                          <Badge variant="outline">
                            Vue{a.acknowledged_by_name ? ` par ${a.acknowledged_by_name}` : ""}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{a.message}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.created_at)}</p>
                    </div>
                    {a.status === "active" ? (
                      /* ⚠ « VUE » N'EST PAS « RÉSOLUE » : le fait est toujours
                         là. Résoudre à la main n'existe pas - le serveur le
                         refuse - parce qu'un bouton « Résolu » ferait croire au
                         marchand qu'il a traité ce qu'il a seulement masqué. */
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => void voir(a)}>
                        <Eye className="mr-1 h-3 w-3" />
                        J&apos;ai vu
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {totalA > parPage ? (
            <DataPagination
              currentPage={pageA}
              totalPages={Math.ceil(totalA / parPage)}
              hasNext={suivanteA}
              hasPrevious={precedenteA}
              onPageChange={setPageA}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
