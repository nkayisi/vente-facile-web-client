"use client";

import { Component, ReactNode } from "react";
import { reportClientError } from "@/lib/observability/report-error";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Nom de la zone protégée, remonté à l'observabilité (ex: "dashboard"). */
  name?: string;
  /** UI de repli personnalisée. Reçoit l'erreur et une fonction de reset. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Error boundary générique côté client.
 *
 * Les error boundaries sont le SEUL mécanisme React capable d'attraper un
 * `throw` pendant le rendu. Sans une frontière autour d'une zone, un crash
 * de rendu (ex: `paymentMethods[0].id` sur un tableau vide, `new Date(null)`)
 * démonte tout l'arbre parent → page blanche.
 *
 * On enveloppe le contenu du dashboard avec ce composant pour qu'un crash
 * localisé affiche un message + bouton « Réessayer » au lieu de blanchir.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportClientError(error, {
      boundary: this.props.name ?? "error-boundary",
      componentStack: info?.componentStack,
    });
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset);
      }
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
            ⚠️
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Cette section n&apos;a pas pu s&apos;afficher
          </h2>
          <p className="max-w-md text-sm text-gray-500">
            Une erreur est survenue lors de l&apos;affichage de cette page. Vous
            pouvez réessayer ; si le problème persiste, contactez le support.
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.reset}
              className="inline-flex h-10 items-center justify-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700"
            >
              Réessayer
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
