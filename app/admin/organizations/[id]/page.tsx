"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAdminOrganization,
  toggleOrganizationActive,
  AdminOrganization,
} from "@/actions/admin.actions";
import {
  ArrowLeft,
  Building2,
  Users,
  Mail,
  Phone,
  MapPin,
  Power,
  Loader2,
  Calendar,
  CreditCard,
  FileText,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminOrganizationDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [org, setOrg] = useState<AdminOrganization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const orgId = params.id as string;

  useEffect(() => {
    fetchOrganization();
  }, [session?.accessToken, orgId]);

  async function fetchOrganization() {
    if (!session?.accessToken || !orgId) return;
    setIsLoading(true);
    const result = await getAdminOrganization(session.accessToken, orgId);
    if (result.success && result.data) {
      setOrg(result.data);
    } else {
      toast.error(result.message || "Établissement introuvable");
    }
    setIsLoading(false);
  }

  async function handleToggleActive() {
    if (!session?.accessToken || !orgId) return;
    setIsActionLoading(true);
    const result = await toggleOrganizationActive(session.accessToken, orgId);
    if (result.success) {
      toast.success(result.message);
      fetchOrganization();
    } else {
      toast.error(result.message || "Erreur");
    }
    setIsActionLoading(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <p className="text-muted-foreground text-center py-12">Établissement introuvable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{org.name}</h1>
            <p className="text-muted-foreground">
              Créé le {new Date(org.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={org.is_active ? "default" : "secondary"} className={org.is_active ? "bg-green-100 text-green-700" : ""}>
            {org.is_active ? "Actif" : "Inactif"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleActive}
            disabled={isActionLoading}
          >
            <Power className="mr-2 h-4 w-4" />
            {org.is_active ? "Désactiver" : "Activer"}
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* General info */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="secondary">{org.business_type}</Badge>
            </div>
            {org.email && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Email</span>
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {org.email}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Téléphone (contact)</span>
              <span className="flex items-center gap-1.5 text-right">
                <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {org.phone?.trim() ? org.phone : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Localisation</span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {org.city}, {org.country}
              </span>
            </div>
            {org.address && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adresse</span>
                <span className="text-right max-w-[200px]">{org.address}</span>
              </div>
            )}
            {org.tax_id && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">NIF</span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {org.tax_id}
                </span>
              </div>
            )}
            {org.currency && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Devise</span>
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  {org.currency}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Owner */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Propriétaire & Équipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Propriétaire</span>
              <span className="font-medium">{org.owner_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{org.owner_email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Membres</span>
              <span className="font-medium">{org.members_count}</span>
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Abonnement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{org.subscription_plan || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Statut</span>
              <Badge variant="secondary">{org.subscription_status || "Aucun"}</Badge>
            </div>
            {org.subscription_end && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Expiration</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {new Date(org.subscription_end).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      {org.recent_activity && org.recent_activity.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {org.recent_activity.map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <span className="font-medium">{activity.user}</span>
                    <span className="text-muted-foreground"> — {activity.action}</span>
                    {activity.resource_type && (
                      <Badge variant="outline" className="ml-2 text-xs">{activity.resource_type}</Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(activity.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dates */}
      <Card className="border">
        <CardContent className="py-4">
          <div className="flex gap-8 text-sm text-muted-foreground">
            <span>Créé le {new Date(org.created_at).toLocaleString()}</span>
            {org.updated_at && <span>Modifié le {new Date(org.updated_at).toLocaleString()}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
