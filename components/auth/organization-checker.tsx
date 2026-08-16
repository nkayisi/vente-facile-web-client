"use client";

import { createContext, useContext, useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { reportClientError } from "@/lib/observability/report-error";
import { Loader2, WifiOff } from "lucide-react";

interface OrganizationContextValue {
  organization: Organization | null;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organization: null,
  refreshOrganization: async () => { },
});

export function useOrganization() {
  return useContext(OrganizationContext);
}

export function OrganizationChecker({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isChecking, setIsChecking] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  /** Erreur de chargement des organisations (réseau / backend). Affichée avec un bouton « Réessayer » plutôt qu'une page blanche. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Incrémenté pour forcer un nouveau chargement (bouton Réessayer). */
  const [reloadNonce, setReloadNonce] = useState(0);
  /** Dernier accessToken pour lequel le chargement des orgs est terminé (permet refetch après refresh JWT). */
  const lastLoadedTokenRef = useRef<string | null>(null);
  const orgFetchInFlightRef = useRef(false);
  const accessTokenRef = useRef<string | undefined>(undefined);

  const accessToken = session?.accessToken;
  accessTokenRef.current = accessToken;

  const loadOrganization = useCallback(async () => {
    if (!accessToken) return;
    try {
      const result = await getUserOrganizations(accessToken);

      // Si l'utilisateur n'existe pas, déconnecter automatiquement
      if (!result.success && result.errorCode === 'user_not_found') {
        console.warn("User not found, signing out...");
        await signOut({ callbackUrl: '/auth/login' });
        return;
      }

      if (result.success && result.data && result.data.length > 0) {
        setOrganization(result.data[0]);
      }
    } catch (error) {
      console.error("Error refreshing organization:", error);
    }
  }, [accessToken]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated") {
      lastLoadedTokenRef.current = null;
      router.push("/auth/login");
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    // Authentifié mais pas encore de jeton dans la session client : ne pas bloquer indéfiniment
    if (!accessToken) {
      setIsChecking(false);
      return;
    }

    // Même jeton déjà chargé : pas de refetch (nouveau jeton après refresh → refetch)
    if (lastLoadedTokenRef.current === accessToken) {
      setIsChecking(false);
      return;
    }

    if (orgFetchInFlightRef.current) {
      return;
    }

    const tokenForThisFetch = accessToken;
    orgFetchInFlightRef.current = true;
    setIsChecking(true);
    setLoadError(null);

    (async () => {
      let fetchSucceeded = false;
      try {
        const result = await getUserOrganizations(tokenForThisFetch);

        if (accessTokenRef.current !== tokenForThisFetch) {
          return;
        }

        if (!result.success && result.errorCode === 'user_not_found') {
          console.warn("User not found, signing out...");
          lastLoadedTokenRef.current = null;
          await signOut({ callbackUrl: '/auth/login' });
          return;
        }

        if (result.success && result.data) {
          fetchSucceeded = true;
          if (result.data.length === 0) {
            // Aucune organisation : on redirige vers l'inscription.
            router.push("/auth/register");
          } else {
            setOrganization(result.data[0]);
          }
        } else {
          // Échec backend (401 après retry, 5xx, etc.). NE PAS renvoyer une page
          // blanche : afficher une erreur récupérable. On conserve l'org déjà
          // chargée si on en avait une (refetch échoué après refresh JWT).
          reportClientError(new Error("Échec du chargement des organisations"), {
            boundary: "organization-checker",
            errorCode: result.errorCode,
          });
          setLoadError(
            "Impossible de charger votre espace de travail. Vérifiez votre connexion et réessayez."
          );
        }
      } catch (error) {
        reportClientError(error, { boundary: "organization-checker" });
        if (accessTokenRef.current === tokenForThisFetch) {
          setLoadError(
            "Impossible de charger votre espace de travail. Vérifiez votre connexion et réessayez."
          );
        }
      } finally {
        if (accessTokenRef.current === tokenForThisFetch) {
          // On ne marque le token comme « chargé » que si le fetch a réussi,
          // pour qu'un simple Réessayer relance réellement l'appel.
          if (fetchSucceeded) {
            lastLoadedTokenRef.current = tokenForThisFetch;
          }
          setIsChecking(false);
        }
        orgFetchInFlightRef.current = false;
      }
    })();

    return () => {
      orgFetchInFlightRef.current = false;
    };
  }, [status, accessToken, router, session?.error, reloadNonce]);

  const retry = useCallback(() => {
    lastLoadedTokenRef.current = null;
    orgFetchInFlightRef.current = false;
    setLoadError(null);
    setIsChecking(true);
    setReloadNonce((n) => n + 1);
  }, []);

  const contextValue = useMemo(() => ({
    organization,
    refreshOrganization: loadOrganization,
  }), [organization, loadOrganization]);

  // Loader plein écran UNIQUEMENT tant qu'aucune organisation n'a encore été
  // chargée. Une fois l'espace de travail monté, un état transitoire
  // (`status === "loading"` pendant un refetch de session déclenché par
  // `update()`, ou `isChecking` pendant un refetch d'orgs après rotation du
  // JWT) ne doit PLUS démonter l'arbre : chaque démontage relançait le fetch
  // des permissions, de l'abonnement et du profil, réarmait le refresh
  // proactif de SessionMonitor et repartait en boucle - d'où le « chargement
  // infini » visible dans les logs.
  if (!organization && (status === "loading" || isChecking)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Erreur de chargement sans org disponible : écran récupérable, JAMAIS de page
  // blanche. Si une org est déjà chargée (refetch échoué), on laisse l'app tourner.
  if (loadError && !organization) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
            <WifiOff className="h-7 w-7 text-orange-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Connexion à votre espace impossible
          </h2>
          <p className="text-sm text-gray-500 mb-6">{loadError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={retry}
              className="inline-flex h-10 items-center justify-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700"
            >
              Réessayer
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Se reconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pas d'org et pas d'erreur : une redirection (register / login) est en cours.
  // On affiche un loader plutôt qu'un écran vide, le temps que la navigation opère.
  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Redirection...</p>
        </div>
      </div>
    );
  }

  return (
    <OrganizationContext.Provider value={contextValue}>
      <CurrencyProvider currencyInfo={organization?.default_currency_info}>
        {children}
      </CurrencyProvider>
    </OrganizationContext.Provider>
  );
}
