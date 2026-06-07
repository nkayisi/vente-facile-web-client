"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, getSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { getUserOrganizations } from "@/actions/organization.actions";
import { getDefaultRedirectPath } from "@/lib/auth/redirect";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrlParam = searchParams.get("callbackUrl");
  const sessionError = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaningSession, setIsCleaningSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Déconnecter automatiquement si la session est expirée
  useEffect(() => {
    if (sessionError === "SessionExpired") {
      setIsCleaningSession(true);
      toast.error("Votre session a expiré. Veuillez vous reconnecter.");

      // Attendre que signOut finisse avant de permettre une nouvelle connexion
      signOut({ redirect: false }).finally(() => {
        setIsCleaningSession(false);
        // Nettoyer le paramètre error de l'URL pour éviter les interférences
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        router.replace(url.pathname + url.search, { scroll: false });
      });
    }
  }, [sessionError, router]);

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = (): boolean => {
    // Validation manuelle pour des messages plus clairs
    const newErrors: Record<string, string> = {};

    // Validation de l'email
    if (!formData.email) {
      newErrors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Veuillez entrer une adresse email valide";
    }

    // Validation du mot de passe
    if (!formData.password) {
      newErrors.password = "Le mot de passe est requis";
    }
    // else if (formData.password.length < 6) {
    //   newErrors.password = "Le mot de passe doit contenir au moins 6 caractères";
    // }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || isCleaningSession) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        // Vérifier que c'est bien une erreur de credentials et non un résidu d'URL
        if (result.error === "CredentialsSignin" || result.status === 401) {
          toast.error("Email ou mot de passe incorrect");
        } else {
          console.warn("[Login] signIn error:", result.error);
          toast.error("Erreur de connexion. Veuillez réessayer.");
        }
        return;
      }

      if (result?.ok) {
        toast.success("Connexion réussie !");
        const updatedSession = await getSession();

        // Déterminer la redirection :
        // - Si callbackUrl spécifique (autre que /dashboard), l'utiliser
        // - Sinon, rediriger selon le type d'utilisateur (admin -> /admin, user -> /dashboard)
        const defaultPath = getDefaultRedirectPath(updatedSession?.isStaff);
        const shouldUseCallback = callbackUrlParam &&
          callbackUrlParam !== "/dashboard" &&
          !callbackUrlParam.startsWith("/dashboard");

        router.push(shouldUseCallback ? callbackUrlParam : defaultPath);
        router.refresh();
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Une erreur est survenue lors de la connexion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg mx-auto border-0">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Connexion</CardTitle>
        <CardDescription>
          Entrez vos identifiants pour accéder à votre compte
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="exemple@email.com"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className={errors.email ? "border-red-500" : ""}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
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
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password}</p>
            )}
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-orange-600 hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>

          <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={isLoading || isCleaningSession}>
            {isLoading || isCleaningSession ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isCleaningSession ? "Préparation..." : "Connexion en cours..."}
              </>
            ) : (
              "Se connecter"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Pas encore de compte ?{" "}
            <Link href="/auth/register" className="text-orange-600 hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-orange-600 inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            <Link href="/" className="text-orange-600 hover:underline">
              Retour à la page d&apos;accueil
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Card className="w-full border-0 shadow-none">
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </CardContent>
      </Card>
    }>
      <LoginForm />
    </Suspense>
  );
}
