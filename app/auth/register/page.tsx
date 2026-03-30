"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Store, Building2, Pill, Package, UtensilsCrossed, MoreHorizontal, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { registerWithOrganization } from "@/actions/auth.actions";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";

const businessTypes = [
  { value: "boutique", label: "Boutique", description: "Magasin de détail, commerce de proximité", icon: Store },
  { value: "supermarket", label: "Supermarché", description: "Grande surface, superette", icon: Building2 },
  { value: "pharmacy", label: "Pharmacie", description: "Pharmacie, parapharmacie", icon: Pill },
  { value: "depot", label: "Dépôt", description: "Dépôt de boissons, grossiste", icon: Package },
  { value: "restaurant", label: "Restaurant", description: "Restaurant, snack, café", icon: UtensilsCrossed },
  { value: "other", label: "Autre", description: "Autre type d'établissement", icon: MoreHorizontal },
];


interface FormData {
  // Étape 1: Informations personnelles
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  // Étape 2: Informations boutique
  organizationName: string;
  organizationPhone: string;
  businessType: string;
  currency: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    organizationName: "",
    organizationPhone: "",
    businessType: "boutique",
    currency: "CDF",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName || formData.firstName.length < 2) {
      newErrors.firstName = "Le prénom doit contenir au moins 2 caractères";
    }
    if (!formData.lastName || formData.lastName.length < 2) {
      newErrors.lastName = "Le nom doit contenir au moins 2 caractères";
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Veuillez entrer une adresse email valide";
    }
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = "Le mot de passe doit contenir au moins 8 caractères";
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.organizationName || formData.organizationName.length < 2) {
      newErrors.organizationName = "Le nom de l'établissement est requis";
    }
    const orgPhone = formData.organizationPhone.trim();
    if (!orgPhone) {
      newErrors.organizationPhone = "Le téléphone de contact de l'établissement est requis";
    } else if (orgPhone.length > 20) {
      newErrors.organizationPhone = "Le numéro ne peut pas dépasser 20 caractères";
    }
    if (!formData.businessType) {
      newErrors.businessType = "Veuillez sélectionner un type d'établissement";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep2()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await registerWithOrganization({
        email: formData.email,
        password: formData.password,
        password_confirm: formData.confirmPassword,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        organization_name: formData.organizationName,
        organization_phone: formData.organizationPhone.trim(),
        business_type: formData.businessType,
        currency: formData.currency,
        country: "RDC",
      });

      if (!result.success) {
        if (result.errors) {
          const errorMessages = Object.entries(result.errors)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value[0] : value}`)
            .join(", ");
          toast.error(errorMessages || result.message || "Erreur lors de l'inscription");
        } else {
          toast.error(result.message || "Erreur lors de l'inscription");
        }
        return;
      }

      toast.success("Compte et établissement créés avec succès !");

      // Connexion automatique après inscription
      const signInResult = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        router.push("/auth/login");
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error("Une erreur est survenue lors de la création du compte");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl border-0 shadow-none">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Créer ma boutique</CardTitle>
        <CardDescription>
          Rejoignez Vente Facile et gérez votre commerce simplement
        </CardDescription>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mt-6 space-x-2">
          {[1, 2].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${currentStep >= step
                  ? "bg-orange-500 text-white"
                  : "bg-gray-200 text-gray-600"
                  }`}
              >
                {currentStep > step ? <Check className="h-5 w-5" /> : step}
              </div>
              {step < 2 && (
                <div
                  className={`w-16 h-1 mx-2 ${currentStep > step ? "bg-orange-500" : "bg-gray-200"
                    }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-2 space-x-12">
          <span className={`text-sm ${currentStep >= 1 ? "text-orange-600 font-medium" : "text-gray-500"}`}>
            Vos informations
          </span>
          <span className={`text-sm ${currentStep >= 2 ? "text-orange-600 font-medium" : "text-gray-500"}`}>
            Votre établissement
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Étape 1: Informations personnelles */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Jean"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    className={errors.firstName ? "border-red-500" : ""}
                    disabled={isLoading}
                  />
                  {errors.firstName && <p className="text-sm text-red-500">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Dupont"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    className={errors.lastName ? "border-red-500" : ""}
                    disabled={isLoading}
                  />
                  {errors.lastName && <p className="text-sm text-red-500">{errors.lastName}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="exemple@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={errors.email ? "border-red-500" : ""}
                  disabled={isLoading}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+243 XXX XXX XXX"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={errors.password ? "border-red-500 pr-10" : "pr-10"}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className={errors.confirmPassword ? "border-red-500 pr-10" : "pr-10"}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword}</p>}
              </div>

              <Button type="button" onClick={handleNext} className="w-full bg-orange-500 hover:bg-orange-600">
                Continuer
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Étape 2: Informations boutique */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="organizationName">Nom de l'établissement *</Label>
                <Input
                  id="organizationName"
                  type="text"
                  placeholder="Ma Boutique"
                  value={formData.organizationName}
                  onChange={(e) => handleInputChange("organizationName", e.target.value)}
                  className={errors.organizationName ? "border-red-500" : ""}
                  disabled={isLoading}
                />
                {errors.organizationName && <p className="text-sm text-red-500">{errors.organizationName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="organizationPhone">Téléphone de contact de l&apos;établissement *</Label>
                <Input
                  id="organizationPhone"
                  type="tel"
                  placeholder="+243 XXX XXX XXX"
                  value={formData.organizationPhone}
                  onChange={(e) => handleInputChange("organizationPhone", e.target.value)}
                  className={errors.organizationPhone ? "border-red-500" : ""}
                  disabled={isLoading}
                />
                {errors.organizationPhone && (
                  <p className="text-sm text-red-500">{errors.organizationPhone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Type d'établissement *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {businessTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = formData.businessType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => handleInputChange("businessType", type.value)}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${isSelected
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 hover:border-gray-300"
                          }`}
                        disabled={isLoading}
                      >
                        <Icon className={`h-6 w-6 mb-2 ${isSelected ? "text-orange-500" : "text-gray-500"}`} />
                        <p className={`font-medium text-sm ${isSelected ? "text-orange-700" : "text-gray-700"}`}>
                          {type.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                      </button>
                    );
                  })}
                </div>
                {errors.businessType && <p className="text-sm text-red-500">{errors.businessType}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Devise par défaut *</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => handleInputChange("currency", value)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionnez une devise" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{c.symbol}</span>
                          <span>{c.name}</span>
                          <span className="text-gray-500">({c.code})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Cette devise sera utilisée par défaut dans votre établissement et ne pourra plus être modifiée après la création.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input id="terms" type="checkbox" required className="rounded border-gray-300" />
                <Label htmlFor="terms" className="text-sm">
                  J'accepte les{" "}
                  <Link href="/terms" className="text-orange-600 hover:underline">conditions d'utilisation</Link>
                  {" "}et la{" "}
                  <Link href="/privacy" className="text-orange-600 hover:underline">politique de confidentialité</Link>
                </Label>
              </div>

              <div className="flex space-x-3">
                <Button type="button" variant="outline" onClick={handleBack} className="flex-1" disabled={isLoading}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>
                <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Créer ma boutique
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Déjà un compte ?{" "}
            <Link href="/auth/login" className="text-orange-600 hover:underline">Se connecter</Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
