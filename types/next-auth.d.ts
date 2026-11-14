import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

/** Ce que la page sait d'une prise en main : jamais les jetons de l'administrateur. */
export interface ImpersonationInfo {
  sessionId: string;
  /** Échéance (ms epoch). */
  expiresAt: number;
  targetEmail: string;
  targetName: string;
  organizationId: string;
  organizationName: string;
}

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    refreshToken?: string;
    /** Échéance (ms epoch) de l'access token, propagée depuis le JWT. */
    accessTokenExpires?: number;
    error?: string;
    isStaff?: boolean;
    /**
     * Mot de passe posé par l'administration, pas encore remplacé. Le middleware
     * y conduit d'office ; le serveur, lui, refuse tout le reste quoi qu'il arrive.
     */
    mustChangePassword?: boolean;
    /** Présent pendant une prise en main par le support. */
    impersonation?: ImpersonationInfo;
    user: {
      id?: string;
      email?: string;
      name?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    refreshTokenExpires?: number;
    isStaff?: boolean;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    refreshTokenExpires?: number;
    error?: string;
    isStaff?: boolean;
    mustChangePassword?: boolean;
    impersonation?: ImpersonationInfo;
    /**
     * Les jetons de l'administrateur, mis de côté pendant une prise en main.
     * ⚠ Ne sortent JAMAIS du cookie chiffré : le callback `session` ne les copie pas.
     */
    adminStash?: {
      accessToken?: string;
      refreshToken?: string;
      accessTokenExpires?: number;
      refreshTokenExpires?: number;
      /** Le nom et l'adresse de l'administrateur, que la prise en main remplace. */
      name?: string | null;
      email?: string | null;
    };
  }
}
