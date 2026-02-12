"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getUserOrganizations } from "@/actions/organization.actions";
import { Loader2 } from "lucide-react";

export function OrganizationChecker({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isChecking, setIsChecking] = useState(true);
  const [hasOrganization, setHasOrganization] = useState(false);

  useEffect(() => {
    async function checkOrganizations() {
      if (status === "loading") {
        return;
      }

      if (status === "unauthenticated") {
        router.push("/auth/login");
        return;
      }

      if (status === "authenticated" && session?.accessToken) {
        try {
          const result = await getUserOrganizations(session.accessToken);

          if (result.success && result.data) {
            if (result.data.length === 0) {
              // Aucune organisation, rediriger vers la page d'inscription
              // (l'utilisateur doit créer sa boutique à l'inscription)
              router.push("/auth/register");
            } else {
              setHasOrganization(true);
            }
          } else {
            // Erreur lors de la récupération des organisations
            // Peut-être un token expiré, permettre l'accès quand même
            console.warn("Could not fetch organizations, allowing access");
            setHasOrganization(true);
          }
        } catch (error) {
          console.error("Error checking organizations:", error);
          // En cas d'erreur, permettre l'accès
          setHasOrganization(true);
        } finally {
          setIsChecking(false);
        }
      }
    }

    checkOrganizations();
  }, [status, session, router]);

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

  if (!hasOrganization) {
    return null; // Redirection en cours vers onboarding
  }

  return <>{children}</>;
}
