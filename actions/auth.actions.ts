"use server";

import axios from "@/lib/auth/api-helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface RegisterWithOrganizationData {
    email: string;
    password: string;
    password_confirm: string;
    first_name: string;
    last_name: string;
    phone?: string;
    organization_name: string;
    business_type: string;
    currency: string;
    country: string;
}

export interface RegisterWithOrganizationResponse {
    success: boolean;
    data?: {
        access: string;
        refresh: string;
        user: {
            id: string;
            email: string;
            first_name: string;
            last_name: string;
        };
        organization: {
            id: string;
            name: string;
            slug: string;
        };
    };
    message?: string;
    errors?: Record<string, string[]>;
}

export async function registerWithOrganization(
    data: RegisterWithOrganizationData
): Promise<RegisterWithOrganizationResponse> {
    try {
        console.log("[Server Action] Registering user with organization:", data.email);

        const response = await fetch(`${API_BASE_URL}/auth/register-with-organization/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            console.log("[Server Action] Registration error:", result);
            return {
                success: false,
                message: result.detail || "Erreur lors de l'inscription",
                errors: result,
            };
        }

        console.log("[Server Action] Registration successful");
        return {
            success: true,
            data: result,
        };
    } catch (error) {
        console.error("[Server Action] Registration error:", error);
        return {
            success: false,
            message: "Impossible de contacter le serveur",
        };
    }
}

// Types pour les réponses
interface RegisterResponse {
    success: boolean;
    message?: string;
    data?: {
        access: string;
        refresh: string;
        user: {
            id: string;
            email: string;
            first_name: string;
            last_name: string;
        };
    };
    errors?: Record<string, string[]>;
}

interface LoginResponse {
    success: boolean;
    message?: string;
    data?: {
        access: string;
        refresh: string;
    };
    errors?: Record<string, string>;
}

/**
 * Server Action pour créer un compte utilisateur
 */
export async function registerUser(formData: {
    email: string;
    password: string;
    password_confirm: string;
    first_name: string;
    last_name: string;
}): Promise<RegisterResponse> {
    try {
        console.log("[Server Action] Registering user:", {
            email: formData.email,
            first_name: formData.first_name,
            last_name: formData.last_name,
        });

        const response = await axios.post(
            `${API_BASE_URL}/auth/register/`,
            {
                email: formData.email,
                password: formData.password,
                password_confirm: formData.password_confirm,
                first_name: formData.first_name,
                last_name: formData.last_name,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("[Server Action] Registration successful");

        return {
            success: true,
            message: "Compte créé avec succès",
            data: response.data,
        };
    } catch (error: any) {
        console.error("[Server Action] Registration error:", error.response?.data || error.message);

        // Gérer les erreurs de validation du backend
        if (error.response?.data) {
            const errorData = error.response.data;

            return {
                success: false,
                message: errorData.detail || "Erreur lors de la création du compte",
                errors: errorData,
            };
        }

        return {
            success: false,
            message: error.message || "Une erreur est survenue lors de la création du compte",
        };
    }
}

/**
 * Server Action pour se connecter
 */
export async function loginUser(formData: {
    email: string;
    password: string;
}): Promise<LoginResponse> {
    try {
        console.log("[Server Action] Logging in user:", formData.email);

        const response = await axios.post(
            `${API_BASE_URL}/auth/token/`,
            {
                email: formData.email,
                password: formData.password,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("[Server Action] Login successful");

        return {
            success: true,
            message: "Connexion réussie",
            data: response.data,
        };
    } catch (error: any) {
        console.error("[Server Action] Login error:", error.response?.data || error.message);

        if (error.response?.status === 401) {
            return {
                success: false,
                message: "Email ou mot de passe incorrect",
            };
        }

        return {
            success: false,
            message: error.message || "Une erreur est survenue lors de la connexion",
        };
    }
}

/**
 * Server Action pour récupérer le profil utilisateur
 */
export async function getUserProfile(accessToken: string) {
    try {
        const response = await axios.get(`${API_BASE_URL}/users/me/`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        return {
            success: true,
            data: response.data,
        };
    } catch (error: any) {
        console.error("[Server Action] Get profile error:", error.response?.data || error.message);

        return {
            success: false,
            message: error.message || "Impossible de récupérer le profil",
        };
    }
}
