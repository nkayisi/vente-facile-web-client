"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { OrganizationChecker } from "@/components/auth/organization-checker";

export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/dashboard/subscription");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <OrganizationChecker>
      <div className="min-h-screen bg-slate-50">
        {/* Header minimaliste */}
        <header className="py-6">
          <div className="max-w-md mx-auto px-4">
            <Link href="/dashboard" className="inline-flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Vente Facile"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="font-semibold text-slate-900">Vente Facile</span>
            </Link>
          </div>
        </header>

        {/* Contenu */}
        <main className="pb-16">
          {children}
        </main>

      </div>
    </OrganizationChecker>
  );
}
