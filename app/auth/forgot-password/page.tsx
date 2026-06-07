"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Mail, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { requestPasswordReset } from "@/actions/auth.actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("L'email est requis");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Veuillez entrer une adresse email valide");
      return;
    }

    setIsLoading(true);
    const result = await requestPasswordReset(email);

    if (result.success) {
      setIsSent(true);
    } else {
      toast.error(result.message);
    }
    setIsLoading(false);
  };

  if (isSent) {
    return (
      <Card className="w-full max-w-md shadow-lg mx-auto border-0">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Email envoyé !</h2>
          <p className="text-sm text-gray-600">
            Si un compte existe avec l&apos;adresse <strong>{email}</strong>, vous recevrez
            un email avec un lien pour réinitialiser votre mot de passe.
          </p>
          <p className="text-xs text-gray-500">
            Vérifiez également votre dossier spam. Le lien est valide pendant une heure.
          </p>
          <div className="pt-2 space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setIsSent(false);
                setEmail("");
              }}
            >
              Renvoyer un email
            </Button>
            <Link href="/auth/login" className="block">
              <Button variant="ghost" className="w-full text-orange-600 hover:text-orange-700">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour à la connexion
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg mx-auto border-0">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-2">
          <Mail className="h-6 w-6 text-orange-600" />
        </div>
        <CardTitle className="text-2xl">Mot de passe oublié ?</CardTitle>
        <CardDescription>
          Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              placeholder="exemple@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              className={error ? "border-red-500" : ""}
              disabled={isLoading}
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              "Envoyer le lien de réinitialisation"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/auth/login"
            className="text-sm text-orange-600 hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à la connexion
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
