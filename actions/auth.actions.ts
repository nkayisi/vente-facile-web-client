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
    organization_phone: string;
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

export interface UserProfile {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    phone: string;
    avatar: string | null;
    is_active: boolean;
    is_email_verified: boolean;
    active_organization: string | null;
    active_organization_name: string | null;
    organizations: {
        id: string;
        name: string;
        role: string;
        role_display: string;
    }[];
    preferences: Record<string, any>;
    date_joined: string;
    last_login: string;
}

export interface UpdateProfileData {
    first_name?: string;
    last_name?: string;
    phone?: string;
}

export interface ChangePasswordData {
    current_password: string;
    new_password: string;
    new_password_confirm: string;
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
            data: response.data as UserProfile,
        };
    } catch (error: any) {
        console.error("[Server Action] Get profile error:", error.response?.data || error.message);

        return {
            success: false,
            message: error.message || "Impossible de récupérer le profil",
        };
    }
}

/**
 * Server Action pour mettre à jour le profil utilisateur
 */
export async function updateUserProfile(accessToken: string, data: UpdateProfileData) {
    try {
        const response = await axios.patch(`${API_BASE_URL}/users/me/`, data, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        return {
            success: true,
            data: response.data as UserProfile,
            message: "Profil mis à jour avec succès",
        };
    } catch (error: any) {
        console.error("[Server Action] Update profile error:", error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data?.detail || "Erreur lors de la mise à jour du profil",
        };
    }
}

/**
 * Server Action pour mettre à jour l'avatar
 */
export async function updateUserAvatar(accessToken: string, file: File) {
    try {
        const formData = new FormData();
        formData.append("avatar", file);

        const response = await axios.patch(`${API_BASE_URL}/users/me/`, formData, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "multipart/form-data",
            },
        });

        return {
            success: true,
            data: response.data as UserProfile,
            message: "Photo de profil mise à jour",
        };
    } catch (error: any) {
        console.error("[Server Action] Update avatar error:", error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data?.detail || "Erreur lors de la mise à jour de la photo",
        };
    }
}

/**
 * Server Action pour supprimer l'avatar
 */
export async function removeUserAvatar(accessToken: string) {
    try {
        const response = await axios.patch(`${API_BASE_URL}/users/me/`, { avatar: null }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        return {
            success: true,
            data: response.data as UserProfile,
            message: "Photo de profil supprimée",
        };
    } catch (error: any) {
        console.error("[Server Action] Remove avatar error:", error.response?.data || error.message);
        return {
            success: false,
            message: "Erreur lors de la suppression de la photo",
        };
    }
}

/**
 * Server Action pour changer le mot de passe
 */
export async function changePassword(accessToken: string, data: ChangePasswordData) {
    try {
        await axios.post(`${API_BASE_URL}/users/me/change-password/`, data, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        return {
            success: true,
            message: "Mot de passe modifié avec succès",
        };
    } catch (error: any) {
        console.error("[Server Action] Change password error:", error.response?.data || error.message);

        const errors = error.response?.data;
        let message = "Erreur lors du changement de mot de passe";
        if (errors?.current_password) message = errors.current_password[0] || errors.current_password;
        else if (errors?.new_password) message = errors.new_password[0] || errors.new_password;
        else if (errors?.new_password_confirm) message = errors.new_password_confirm[0] || errors.new_password_confirm;
        else if (errors?.non_field_errors) message = errors.non_field_errors[0];
        else if (errors?.detail) message = errors.detail;

        return {
            success: false,
            message,
        };
    }
}

/**
 * Server Action pour demander la réinitialisation du mot de passe
 */
export async function requestPasswordReset(email: string) {
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/password-reset/`, { email });

        return {
            success: true,
            message: response.data?.message || "Si cet email existe, un lien de réinitialisation a été envoyé.",
        };
    } catch (error: any) {
        console.error("[Server Action] Request password reset error:", error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data?.error || "Une erreur est survenue. Veuillez réessayer.",
        };
    }
}

/**
 * Server Action pour confirmer la réinitialisation du mot de passe
 */
export async function confirmPasswordReset(uid: string, token: string, new_password: string, new_password_confirm: string) {
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/password-reset/confirm/`, {
            uid,
            token,
            new_password,
            new_password_confirm,
        });

        return {
            success: true,
            message: response.data?.message || "Mot de passe réinitialisé avec succès.",
        };
    } catch (error: any) {
        console.error("[Server Action] Confirm password reset error:", error.response?.data || error.message);

        const errors = error.response?.data;
        let message = "Une erreur est survenue. Veuillez réessayer.";
        if (errors?.error) message = errors.error;
        else if (errors?.new_password) message = Array.isArray(errors.new_password) ? errors.new_password[0] : errors.new_password;
        else if (errors?.new_password_confirm) message = Array.isArray(errors.new_password_confirm) ? errors.new_password_confirm[0] : errors.new_password_confirm;
        else if (errors?.token) message = "Le lien de réinitialisation est invalide ou a expiré.";
        else if (errors?.uid) message = "Le lien de réinitialisation est invalide.";
        else if (errors?.non_field_errors) message = errors.non_field_errors[0];

        return {
            success: false,
            message,
        };
    }
}
