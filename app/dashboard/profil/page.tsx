"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    User,
    Mail,
    Phone,
    Camera,
    Trash2,
    Lock,
    Loader2,
    Shield,
    Calendar,
    Building2,
    Eye,
    EyeOff,
    Save,
    LogIn,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, getMediaUrl } from "@/lib/format";
import { ImageCropDialog } from "@/components/shared/ImageCropDialog";
import {
    getUserProfile,
    updateUserProfile,
    updateUserAvatar,
    removeUserAvatar,
    changePassword,
    type UserProfile,
    type UpdateProfileData,
    type ChangePasswordData,
} from "@/actions/auth.actions";

export default function ProfilePage() {
    const { data: session } = useSession();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Edit profile
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState<UpdateProfileData>({
        first_name: "",
        last_name: "",
        phone: "",
    });

    // Avatar
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [showCropDialog, setShowCropDialog] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Change password dialog
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState<ChangePasswordData>({
        current_password: "",
        new_password: "",
        new_password_confirm: "",
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Fetch profile
    useEffect(() => {
        const fetchProfile = async () => {
            if (!session?.accessToken) return;
            const result = await getUserProfile(session.accessToken);
            if (result.success && result.data) {
                setProfile(result.data);
                setProfileForm({
                    first_name: result.data.first_name || "",
                    last_name: result.data.last_name || "",
                    phone: result.data.phone || "",
                });
            } else {
                toast.error("Impossible de charger le profil");
            }
            setIsLoading(false);
        };
        fetchProfile();
    }, [session?.accessToken]);

    const getInitials = (name?: string | null) => {
        if (!name) return "?";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    // Save profile
    const handleSaveProfile = async () => {
        if (!session?.accessToken) return;
        setIsSavingProfile(true);
        const result = await updateUserProfile(session.accessToken, profileForm);
        if (result.success && result.data) {
            setProfile(result.data);
            setIsEditingProfile(false);
            toast.success(result.message);
        } else {
            toast.error(result.message || "Erreur lors de la mise à jour");
        }
        setIsSavingProfile(false);
    };

    // Sélection d'image → ouvrir le crop dialog
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error("La taille de l'image ne doit pas dépasser 10 Mo");
            return;
        }

        if (!file.type.startsWith("image/")) {
            toast.error("Veuillez sélectionner un fichier image");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setCropImageSrc(reader.result as string);
            setShowCropDialog(true);
        };
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Upload après crop
    const handleCroppedAvatar = async (croppedFile: File) => {
        if (!session?.accessToken) return;
        setIsUploadingAvatar(true);
        const result = await updateUserAvatar(session.accessToken, croppedFile);
        if (result.success && result.data) {
            setProfile(result.data);
            toast.success(result.message);
        } else {
            toast.error(result.message || "Erreur lors de la mise à jour de la photo");
        }
        setIsUploadingAvatar(false);
    };

    // Remove avatar
    const handleRemoveAvatar = async () => {
        if (!session?.accessToken) return;
        setIsUploadingAvatar(true);
        const result = await removeUserAvatar(session.accessToken);
        if (result.success && result.data) {
            setProfile(result.data);
            toast.success(result.message);
        } else {
            toast.error(result.message || "Erreur");
        }
        setIsUploadingAvatar(false);
    };

    // Change password
    const handleChangePassword = async () => {
        if (!session?.accessToken) return;

        if (passwordForm.new_password.length < 8) {
            toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères");
            return;
        }
        if (passwordForm.new_password !== passwordForm.new_password_confirm) {
            toast.error("Les mots de passe ne correspondent pas");
            return;
        }

        setIsChangingPassword(true);
        const result = await changePassword(session.accessToken, passwordForm);
        if (result.success) {
            toast.success(result.message);
            setShowPasswordDialog(false);
            setPasswordForm({ current_password: "", new_password: "", new_password_confirm: "" });
            setShowCurrentPassword(false);
            setShowNewPassword(false);
        } else {
            toast.error(result.message);
        }
        setIsChangingPassword(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
                <p className="text-sm text-gray-500 mt-1">Gérez vos informations personnelles et votre sécurité</p>
            </div>

            {/* Avatar + Name Card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        {/* Avatar */}
                        <div className="relative group">
                            <Avatar className="h-24 w-24 text-2xl">
                                <AvatarImage src={getMediaUrl(profile.avatar)} />
                                <AvatarFallback className="bg-orange-500 text-white text-2xl">
                                    {getInitials(profile.full_name)}
                                </AvatarFallback>
                            </Avatar>
                            {isUploadingAvatar && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                </div>
                            )}
                        </div>

                        {/* Name + Actions */}
                        <div className="flex-1 text-center sm:text-left">
                            <h2 className="text-xl font-semibold text-gray-900">{profile.full_name}</h2>
                            <p className="text-sm text-gray-500">{profile.email}</p>
                            {profile.organizations.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2 justify-center sm:justify-start">
                                    {profile.organizations.map((org) => (
                                        <Badge key={org.id} variant="outline" className="text-xs">
                                            <Building2 className="h-3 w-3 mr-1" />
                                            {org.name} — {org.role_display}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingAvatar}
                                >
                                    <Camera className="h-4 w-4 mr-1.5" />
                                    Changer la photo
                                </Button>
                                {profile.avatar && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRemoveAvatar}
                                        disabled={isUploadingAvatar}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4 mr-1.5" />
                                        Supprimer
                                    </Button>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Personal Info */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Informations personnelles</CardTitle>
                        <CardDescription>Vos informations de base</CardDescription>
                    </div>
                    {!isEditingProfile ? (
                        <Button variant="outline" size="sm" onClick={() => setIsEditingProfile(true)}>
                            Modifier
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setIsEditingProfile(false);
                                    setProfileForm({
                                        first_name: profile.first_name || "",
                                        last_name: profile.last_name || "",
                                        phone: profile.phone || "",
                                    });
                                }}
                            >
                                Annuler
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveProfile}
                                disabled={isSavingProfile}
                                className="bg-orange-500 hover:bg-orange-600"
                            >
                                {isSavingProfile ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                                Enregistrer
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" />
                                Prénom
                            </Label>
                            {isEditingProfile ? (
                                <Input
                                    value={profileForm.first_name}
                                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                                    placeholder="Votre prénom"
                                />
                            ) : (
                                <p className="text-sm font-medium text-gray-900">{profile.first_name || "—"}</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" />
                                Nom
                            </Label>
                            {isEditingProfile ? (
                                <Input
                                    value={profileForm.last_name}
                                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                                    placeholder="Votre nom"
                                />
                            ) : (
                                <p className="text-sm font-medium text-gray-900">{profile.last_name || "—"}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" />
                                Email
                            </Label>
                            <p className="text-sm font-medium text-gray-900">{profile.email}</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5" />
                                Téléphone
                            </Label>
                            {isEditingProfile ? (
                                <Input
                                    value={profileForm.phone}
                                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                                    placeholder="Votre numéro de téléphone"
                                />
                            ) : (
                                <p className="text-sm font-medium text-gray-900">{profile.phone || "—"}</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Security */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Sécurité</CardTitle>
                    <CardDescription>Gérez votre mot de passe</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border">
                                <Lock className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">Mot de passe</p>
                                <p className="text-xs text-gray-500">Changez votre mot de passe régulièrement pour plus de sécurité</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setShowPasswordDialog(true)}>
                            Modifier
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Account Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Informations du compte</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Shield className="h-3.5 w-3.5" />
                                Statut
                            </Label>
                            <Badge className={profile.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                                {profile.is_active ? "Actif" : "Inactif"}
                            </Badge>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                Membre depuis
                            </Label>
                            <p className="text-sm font-medium text-gray-900">
                                {profile.date_joined ? formatDateTime(profile.date_joined) : "—"}
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <LogIn className="h-3.5 w-3.5" />
                                Dernière connexion
                            </Label>
                            <p className="text-sm font-medium text-gray-900">
                                {profile.last_login ? formatDateTime(profile.last_login) : "—"}
                            </p>
                        </div>
                        {profile.organizations.length > 0 && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5" />
                                    Organisation(s)
                                </Label>
                                <div className="space-y-1">
                                    {profile.organizations.map((org) => (
                                        <p key={org.id} className="text-sm font-medium text-gray-900">
                                            {org.name} <span className="text-gray-500 font-normal">({org.role_display})</span>
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Change Password Dialog */}
            <Dialog open={showPasswordDialog} onOpenChange={(open) => {
                if (!isChangingPassword) {
                    setShowPasswordDialog(open);
                    if (!open) {
                        setPasswordForm({ current_password: "", new_password: "", new_password_confirm: "" });
                        setShowCurrentPassword(false);
                        setShowNewPassword(false);
                    }
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Modifier le mot de passe</DialogTitle>
                        <DialogDescription>
                            Entrez votre mot de passe actuel puis choisissez un nouveau mot de passe
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Mot de passe actuel</Label>
                            <div className="relative">
                                <Input
                                    type={showCurrentPassword ? "text" : "password"}
                                    value={passwordForm.current_password}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                                    placeholder="••••••••"
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Nouveau mot de passe</Label>
                            <div className="relative">
                                <Input
                                    type={showNewPassword ? "text" : "password"}
                                    value={passwordForm.new_password}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                    placeholder="••••••••"
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">Minimum 8 caractères</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Confirmer le nouveau mot de passe</Label>
                            <Input
                                type={showNewPassword ? "text" : "password"}
                                value={passwordForm.new_password_confirm}
                                onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirm: e.target.value })}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPasswordDialog(false)} disabled={isChangingPassword}>
                            Annuler
                        </Button>
                        <Button
                            onClick={handleChangePassword}
                            disabled={isChangingPassword || !passwordForm.current_password || !passwordForm.new_password || !passwordForm.new_password_confirm}
                            className="bg-orange-500 hover:bg-orange-600"
                        >
                            {isChangingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            <Lock className="h-4 w-4 mr-2" />
                            Modifier le mot de passe
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Image Crop Dialog */}
            <ImageCropDialog
                open={showCropDialog}
                onOpenChange={setShowCropDialog}
                imageSrc={cropImageSrc}
                onCropComplete={handleCroppedAvatar}
                cropShape="round"
                title="Recadrer la photo de profil"
            />
        </div>
    );
}
