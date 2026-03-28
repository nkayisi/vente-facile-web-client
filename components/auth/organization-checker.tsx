"use client";

import { createContext, useContext, useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { Loader2 } from "lucide-react";

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

    (async () => {
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
          if (result.data.length === 0) {
            router.push("/auth/register");
          } else {
            setOrganization(result.data[0]);
          }
        } else {
          console.warn("Could not fetch organizations, allowing access");
          setOrganization(null);
        }
      } catch (error) {
        console.error("Error checking organizations:", error);
        if (accessTokenRef.current === tokenForThisFetch) {
          setOrganization(null);
        }
      } finally {
        if (accessTokenRef.current === tokenForThisFetch) {
          lastLoadedTokenRef.current = tokenForThisFetch;
        }
        orgFetchInFlightRef.current = false;
        setIsChecking(false);
      }
    })();

    return () => {
      orgFetchInFlightRef.current = false;
    };
  }, [status, accessToken, router, session?.error]);

  const contextValue = useMemo(() => ({
    organization,
    refreshOrganization: loadOrganization,
  }), [organization, loadOrganization]);

  if (status === "loading" || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!organization && !isChecking) {
    return null; // Redirection en cours vers onboarding
  }

  return (
    <OrganizationContext.Provider value={contextValue}>
      <CurrencyProvider currencyInfo={organization?.default_currency_info}>
        {children}
      </CurrencyProvider>
    </OrganizationContext.Provider>
  );
}
