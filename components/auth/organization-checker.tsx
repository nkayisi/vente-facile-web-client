"use client";

import { createContext, useContext, useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { getUserOrganizations, Organization, CurrencyInfo } from "@/actions/organization.actions";
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
  const hasFetched = useRef(false);

  const accessToken = session?.accessToken;

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
    if (hasFetched.current) return;

    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "authenticated" && accessToken) {
      hasFetched.current = true;

      (async () => {
        try {
          const result = await getUserOrganizations(accessToken);

          // Si l'utilisateur n'existe pas, déconnecter automatiquement
          if (!result.success && result.errorCode === 'user_not_found') {
            console.warn("User not found, signing out...");
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
          setOrganization(null);
        } finally {
          setIsChecking(false);
        }
      })();
    }
  }, [status, accessToken, router]);

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
