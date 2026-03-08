"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useOrganization } from "@/components/auth/organization-checker";
import {
  getSubscriptionStatus,
  SubscriptionStatus,
} from "@/actions/subscription.actions";
import {
  Loader2,
  ShieldAlert,
  Crown,
  Clock,
  Lock,
  Sparkles,
  AlertTriangle,
  LogOut,
  CreditCard,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

interface SubscriptionContextValue {
  subscriptionStatus: SubscriptionStatus | null;
  isBlocked: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscriptionStatus: null,
  isBlocked: false,
  refreshSubscription: async () => { },
});

export function useSubscription() {
  return useContext(SubscriptionContext);
}

// Pages autorisées même sans abonnement
const ALLOWED_PATHS = ["/dashboard/subscription"];

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const pathname = usePathname();
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSubscriptionStatus = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;

    try {
      const result = await getSubscriptionStatus(
        session.accessToken,
        organization.id
      );
      if (result.success && result.data) {
        setSubscriptionStatus(result.data);
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken, organization?.id]);

  useEffect(() => {
    loadSubscriptionStatus();
  }, [loadSubscriptionStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const isBlocked = subscriptionStatus?.is_blocked ?? false;

  // Vérifier si la page actuelle est autorisée
  const isAllowedPath = ALLOWED_PATHS.some((path) =>
    pathname?.startsWith(path)
  );

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptionStatus,
        isBlocked,
        refreshSubscription: loadSubscriptionStatus,
      }}
    >
      {/* Si bloqué et pas sur une page autorisée → Overlay de blocage total */}
      {isBlocked && !isAllowedPath ? (
        <SubscriptionBlockedOverlay
          status={subscriptionStatus}
          onRefresh={loadSubscriptionStatus}
          organizationName={organization?.name}
        />
      ) : (
        <>
          {/* Bannière d'avertissement si abonnement bientôt expiré */}
          {subscriptionStatus && !isBlocked && (
            <SubscriptionWarningBanner status={subscriptionStatus} />
          )}
          {children}
        </>
      )}
    </SubscriptionContext.Provider>
  );
}

function SubscriptionBlockedOverlay({
  status,
  onRefresh,
  organizationName,
}: {
  status: SubscriptionStatus | null;
  onRefresh: () => Promise<void>;
  organizationName?: string;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/auth/login" });
  };

  if (!status) return null;

  const isExpired = status.status === "expired";
  const isSuspended = status.status === "suspended";
  const isNone = status.status === "none";

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative max-w-lg w-full">
        {/* Logo */}


        {/* Card principale */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header avec icône */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full mb-4">
              {isExpired || isNone ? (
                <Clock className="h-8 w-8 text-white" />
              ) : isSuspended ? (
                <Lock className="h-8 w-8 text-white" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-white" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-white">
              {isNone
                ? "Aucun abonnement actif"
                : isExpired
                  ? "Votre abonnement a expiré"
                  : isSuspended
                    ? "Compte suspendu"
                    : "Renouvellement requis"}
            </h2>
            {status.subscription?.plan_name && (
              <p className="text-white/80 mt-2">
                Plan : {status.subscription.plan_name}
              </p>
            )}
          </div>

          {/* Contenu */}
          <div className="p-6">
            <p className="text-gray-600 text-center mb-6">
              {status.message ||
                "Pour continuer à utiliser Vente Facile, veuillez renouveler votre abonnement."}
            </p>

            {/* Ce qui est bloqué */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
              <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Accès bloqué
              </h3>
              <ul className="space-y-2 text-sm text-red-700">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                  Toutes les fonctionnalités de l&apos;application
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                  Création de ventes et gestion des produits
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                  Gestion du stock et de l&apos;inventaire
                </li>
              </ul>
            </div>

            {/* Ce qui reste accessible */}
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Toujours accessible
              </h3>
              <ul className="space-y-2 text-sm text-green-700">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  Page de gestion de l&apos;abonnement
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Link href="/dashboard/subscription" className="block">
                <Button className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-base font-semibold shadow-lg shadow-orange-500/25">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Gérer mon abonnement
                </Button>
              </Link>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  {isRefreshing && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Actualiser
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 text-gray-500 hover:text-red-600"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center mt-6">
              Besoin d&apos;aide ?{" "}
              <a
                href="mailto:support@ventefacile.cd"
                className="text-orange-600 hover:underline"
              >
                Contactez le support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubscriptionWarningBanner({
  status,
}: {
  status: SubscriptionStatus;
}) {
  // Bannière orange si bientôt expiré (≤5 jours) ou en période de grâce
  const showWarning =
    status.status === "past_due" ||
    (status.is_active && (status.days_remaining ?? 999) <= 5);

  if (!showWarning) return null;

  const isPastDue = status.status === "past_due";

  return (
    <div
      className={`px-4 py-2 text-sm flex items-center justify-center gap-2 ${isPastDue
          ? "bg-orange-500 text-white"
          : "bg-orange-100 text-orange-800 border-b border-orange-200"
        }`}
    >
      <Clock className="h-4 w-4 flex-shrink-0" />
      <span>
        {isPastDue ? (
          <>
            Période de grâce :{" "}
            <strong>{status.days_remaining_grace ?? 0} jour(s)</strong>{" "}
            restant(s)
          </>
        ) : status.subscription?.is_trial ? (
          <>
            Essai gratuit : <strong>{status.days_remaining} jour(s)</strong>{" "}
            restant(s)
          </>
        ) : (
          <>
            Abonnement expire dans{" "}
            <strong>{status.days_remaining} jour(s)</strong>
          </>
        )}
      </span>
      <Link
        href="/dashboard/subscription"
        className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${isPastDue
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-orange-600 hover:bg-orange-700 text-white"
          }`}
      >
        {status.subscription?.is_trial ? "Passer au payant" : "Renouveler"}
      </Link>
    </div>
  );
}
