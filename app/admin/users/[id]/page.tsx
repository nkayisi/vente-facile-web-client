"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getAdminUser,
  toggleUserActive,
  toggleUserStaff,
  AdminUser,
} from "@/actions/admin.actions";
import {
  ArrowLeft,
  Mail,
  Phone,
  Power,
  Shield,
  Loader2,
  Calendar,
  Building2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminUserDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const userId = params.id as string;

  useEffect(() => {
    fetchUser();
  }, [session?.accessToken, userId]);

  async function fetchUser() {
    if (!session?.accessToken || !userId) return;
    setIsLoading(true);
    const result = await getAdminUser(session.accessToken, userId);
    if (result.success && result.data) {
      setUser(result.data);
    } else {
      toast.error(result.message || "Utilisateur introuvable");
    }
    setIsLoading(false);
  }

  async function handleToggleActive() {
    if (!session?.accessToken || !userId) return;
    setIsActionLoading(true);
    const result = await toggleUserActive(session.accessToken, userId);
    if (result.success) {
      toast.success(result.message);
      fetchUser();
    } else {
      toast.error(result.message || "Erreur");
    }
    setIsActionLoading(false);
  }

  async function handleToggleStaff() {
    if (!session?.accessToken || !userId) return;
    setIsActionLoading(true);
    const result = await toggleUserStaff(session.accessToken, userId);
    if (result.success) {
      toast.success(result.message);
      fetchUser();
    } else {
      toast.error(result.message || "Erreur");
    }
    setIsActionLoading(false);
  }

  const getInitials = (name?: string | null, email?: string) => {
    if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    return email?.charAt(0).toUpperCase() || "U";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <p className="text-muted-foreground text-center py-12">Utilisateur introuvable.</p>
      </div>
    );
  }

  const isSelf = user.id === session?.user?.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(user.full_name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold">{user.full_name || user.email}</h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={user.is_active ? "default" : "secondary"} className={user.is_active ? "bg-green-100 text-green-700" : ""}>
            {user.is_active ? "Actif" : "Inactif"}
          </Badge>
          {user.is_staff && (
            <Badge className="bg-primary text-primary-foreground">Admin</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Profile */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prénom</span>
              <span>{user.first_name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nom</span>
              <span>{user.last_name || "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Email</span>
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {user.email}
              </span>
            </div>
            {user.phone && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Téléphone</span>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {user.phone}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Email vérifié</span>
              {user.is_email_verified ? (
                <span className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle className="h-3.5 w-3.5" /> Oui
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5" /> Non
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inscrit le</span>
              <span>{new Date(user.date_joined).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dernière connexion</span>
              <span>{user.last_login ? new Date(user.last_login).toLocaleString() : "Jamais"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleToggleActive}
              disabled={isActionLoading || isSelf}
            >
              <Power className="mr-2 h-4 w-4" />
              {user.is_active ? "Désactiver le compte" : "Activer le compte"}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleToggleStaff}
              disabled={isActionLoading || isSelf}
            >
              <Shield className="mr-2 h-4 w-4" />
              {user.is_staff ? "Retirer le rôle admin" : "Promouvoir en admin"}
            </Button>
            {isSelf && (
              <p className="text-xs text-muted-foreground">Vous ne pouvez pas modifier votre propre compte.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Organizations */}
      {user.organizations.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Organisations ({user.organizations_count})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {user.organizations.map((org) => (
                <div key={org.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {org.name}
                    </Link>
                  </div>
                  <Badge variant="outline">{org.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
