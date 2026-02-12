"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Loader2, 
  Package, 
  Users, 
  Truck, 
  Settings, 
  UserPlus,
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles
} from "lucide-react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  completed: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: "product",
      title: "Ajouter un produit",
      description: "Créez votre premier produit à vendre",
      icon: Package,
      href: "/dashboard/products/new",
      completed: false,
    },
    {
      id: "supplier",
      title: "Ajouter un fournisseur",
      description: "Enregistrez vos fournisseurs pour les achats",
      icon: Truck,
      href: "/dashboard/contacts?type=supplier&action=new",
      completed: false,
    },
    {
      id: "customer",
      title: "Ajouter un client",
      description: "Enregistrez vos clients fidèles",
      icon: Users,
      href: "/dashboard/contacts?type=customer&action=new",
      completed: false,
    },
    {
      id: "settings",
      title: "Configurer la boutique",
      description: "Personnalisez les paramètres de votre établissement",
      icon: Settings,
      href: "/dashboard/organizations",
      completed: false,
    },
    {
      id: "user",
      title: "Inviter un utilisateur",
      description: "Ajoutez un vendeur ou un gestionnaire",
      icon: UserPlus,
      href: "/dashboard/users",
      completed: false,
    },
  ]);

  useEffect(() => {
    if (status === "loading") return;
    
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    // TODO: Charger l'état réel des étapes depuis l'API
    setIsLoading(false);
  }, [status, router]);

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  const handleSkip = () => {
    router.push("/dashboard");
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-full mb-4">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bienvenue sur Vente Facile ! 🎉
          </h1>
          <p className="text-gray-600 max-w-md mx-auto">
            Configurez votre boutique en quelques étapes simples pour commencer à vendre.
          </p>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Progression de la configuration
              </span>
              <span className="text-sm text-gray-500">
                {completedCount}/{steps.length} étapes
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Checklist de démarrage</CardTitle>
            <CardDescription>
              Complétez ces étapes pour tirer le meilleur parti de Vente Facile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.id}
                  href={step.href}
                  className={`flex items-center p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                    step.completed
                      ? "border-green-200 bg-green-50"
                      : "border-gray-200 hover:border-orange-300 bg-white"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${
                      step.completed
                        ? "bg-green-500 text-white"
                        : "bg-orange-100 text-orange-600"
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-medium ${step.completed ? "text-green-700" : "text-gray-900"}`}>
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-500">{step.description}</p>
                  </div>
                  <div className="ml-4">
                    {step.completed ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <Button variant="ghost" onClick={handleSkip}>
            Passer pour l'instant
          </Button>
          <Button onClick={() => router.push("/dashboard")} className="bg-orange-500 hover:bg-orange-600">
            Aller au tableau de bord
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
