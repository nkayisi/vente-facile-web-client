"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelectAsyncWithEmpty } from "@/components/ui/searchable-select-async-empty";
import { createWarehouseSearchHandler } from "@/lib/select-search-handlers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Search,
  Loader2,
  Calculator,
  Play,
  Square,
  Settings,
  Pencil,
  Trash2,
  Clock,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getRegisters,
  getRegisterSessions,
  createRegister,
  updateRegister,
  deleteRegister,
  openSession,
  closeSession,
  Register,
  RegisterSession,
  CreateRegisterData,
} from "@/actions/sales.actions";
import { usePermissions } from "@/components/auth/permissions-provider";

export default function RegistersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canManageRegisters = hasPermission("sales.manage_registers");

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  // Les selects async pour succursale + entrepôt chargent leur liste à la
  // volée — pas besoin de state local complet.
  const [sessions, setSessions] = useState<RegisterSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showOpenSessionDialog, setShowOpenSessionDialog] = useState(false);
  const [showCloseSessionDialog, setShowCloseSessionDialog] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState<Register | null>(null);
  const [selectedSession, setSelectedSession] = useState<RegisterSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Fermeture de session : comptage manuel optionnel + notes
  const [closeCountedBalance, setCloseCountedBalance] = useState<string>("");
  // Comptage manuel par devise (multi-devise RDC) : { code: montant saisi }.
  const [closeCountedByCurrency, setCloseCountedByCurrency] = useState<Record<string, string>>({});
  const [closeNotes, setCloseNotes] = useState<string>("");

  // Form state — plus de champ "branch" : la succursale est dérivée côté backend
  // à partir de l'entrepôt (ou de la succursale principale).
  const [formData, setFormData] = useState<CreateRegisterData>({
    name: "",
    code: "",
    warehouse: "",
    is_active: true,
    receipt_header: "",
    receipt_footer: "",
  });

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          // Fetch in parallel — la liste des succursales/entrepôts est
          // résolue dynamiquement par les selects async.
          const [registersResult, sessionsResult] = await Promise.all([
            getRegisters(session.accessToken, org.id),
            getRegisterSessions(session.accessToken, org.id, { status: "open" }),
          ]);

          if (registersResult.success && registersResult.data) {
            setRegisters(registersResult.data);
          }
          if (sessionsResult.success && sessionsResult.data) {
            setSessions(sessionsResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching registers:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken]);

  // Mémo conservé pour la stabilité de la ref du handler warehouse —
  // sinon le composant async perd son cache à chaque render du parent.

  // Handle create/update register
  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id) return;

    if (!selectedRegister && !formData.warehouse) {
      toast.error("Veuillez sélectionner un entrepôt.");
      return;
    }

    setIsSubmitting(true);

    try {
      // On n'envoie PAS de succursale : le backend la dérive de l'entrepôt.
      const dataToSend: CreateRegisterData = {
        name: formData.name,
        code: formData.code,
        warehouse: formData.warehouse,
        is_active: formData.is_active,
        receipt_header: formData.receipt_header,
        receipt_footer: formData.receipt_footer,
      };

      let result;
      if (selectedRegister) {
        result = await updateRegister(
          session.accessToken,
          organization.id,
          selectedRegister.id,
          dataToSend
        );
      } else {
        result = await createRegister(session.accessToken, organization.id, dataToSend);
      }

      if (result.success) {
        toast.success(selectedRegister ? "Caisse mise à jour" : "Caisse créée");

        // Refresh list
        const registersResult = await getRegisters(session.accessToken, organization.id);
        if (registersResult.success && registersResult.data) {
          setRegisters(registersResult.data);
        }

        setShowRegisterDialog(false);
        resetForm();
      } else {
        toast.error(result.message || "Erreur lors de l'opération");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete register
  const handleDeleteRegister = async () => {
    if (!session?.accessToken || !organization?.id || !selectedRegister) return;

    setIsSubmitting(true);

    try {
      const result = await deleteRegister(
        session.accessToken,
        organization.id,
        selectedRegister.id
      );

      if (result.success) {
        toast.success("Caisse supprimée");
        setRegisters(prev => prev.filter(r => r.id !== selectedRegister.id));
        setShowDeleteDialog(false);
        setSelectedRegister(null);
      } else {
        toast.error(result.message || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle open session
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id || !selectedRegister) return;

    setIsSubmitting(true);

    try {
      const result = await openSession(session.accessToken, organization.id, {
        register: selectedRegister.id,
      });

      if (result.success) {
        toast.success("Session ouverte avec succès");

        // Refresh data
        const [registersResult, sessionsResult] = await Promise.all([
          getRegisters(session.accessToken, organization.id),
          getRegisterSessions(session.accessToken, organization.id, { status: "open" }),
        ]);

        if (registersResult.success && registersResult.data) {
          setRegisters(registersResult.data);
        }
        if (sessionsResult.success && sessionsResult.data) {
          setSessions(sessionsResult.data);
        }

        setShowOpenSessionDialog(false);

        // Redirect to POS
        router.push("/dashboard/sales/pos");
      } else {
        toast.error(result.message || "Erreur lors de l'ouverture");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Solde attendu = solde d'ouverture + total ventes cash de la session.
  // On utilise `sales_total` comme proxy si le backend ne renvoie pas
  // encore `expected_balance` (champ calculé à la fermeture).
  const closeExpectedBalance = useMemo(() => {
    if (!selectedSession) return 0;
    const opening = parseFloat(selectedSession.opening_balance || "0") || 0;
    const salesCash = parseFloat(selectedSession.sales_total || "0") || 0;
    return opening + salesCash;
  }, [selectedSession]);

  // Devises présentes dans le tiroir de la session (multi-devise RDC).
  const closeCurrencies = useMemo(
    () => (selectedSession?.currency_balances || []).map(c => c.currency),
    [selectedSession],
  );
  const isMultiCurrencyClose = closeCurrencies.length > 1;

  const closeCountedNum = useMemo(() => {
    const v = parseFloat(closeCountedBalance);
    return Number.isFinite(v) ? v : null;
  }, [closeCountedBalance]);

  const closeDifference = useMemo(() => {
    if (closeCountedNum === null) return 0;
    return closeCountedNum - closeExpectedBalance;
  }, [closeCountedNum, closeExpectedBalance]);

  // Handle close session
  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id || !selectedSession) return;

    // Mono-devise : on peut pré-valider l'écart client-side. Multi-devise :
    // l'attendu par devise est calculé au backend, qui exige la note si écart.
    if (!isMultiCurrencyClose && closeCountedNum !== null && Math.abs(closeDifference) > 0.005 && !closeNotes.trim()) {
      toast.error("Une note explicative est obligatoire lorsque le comptage diffère du solde attendu.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: {
        counted_balance?: string;
        counted_balances?: { currency: string; amount: string }[];
        notes?: string;
      } = {};
      if (isMultiCurrencyClose) {
        const entries = closeCurrencies
          .map(c => ({ currency: c, raw: closeCountedByCurrency[c] }))
          .filter(e => e.raw !== undefined && e.raw !== "" && Number.isFinite(parseFloat(e.raw)))
          .map(e => ({ currency: e.currency, amount: parseFloat(e.raw).toFixed(2) }));
        if (entries.length > 0) payload.counted_balances = entries;
      } else if (closeCountedNum !== null) {
        payload.counted_balance = closeCountedNum.toFixed(2);
      }
      if (closeNotes.trim()) {
        payload.notes = closeNotes.trim();
      }

      const result = await closeSession(
        session.accessToken,
        organization.id,
        selectedSession.id,
        payload,
      );

      if (result.success) {
        toast.success("Session fermée avec succès");

        // Refresh data
        const [registersResult, sessionsResult] = await Promise.all([
          getRegisters(session.accessToken, organization.id),
          getRegisterSessions(session.accessToken, organization.id, { status: "open" }),
        ]);

        if (registersResult.success && registersResult.data) {
          setRegisters(registersResult.data);
        }
        if (sessionsResult.success && sessionsResult.data) {
          setSessions(sessionsResult.data);
        }

        setShowCloseSessionDialog(false);
        setSelectedSession(null);
        setCloseCountedBalance("");
        setCloseCountedByCurrency({});
        setCloseNotes("");
      } else {
        toast.error(result.message || "Erreur lors de la fermeture");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      warehouse: "",
      is_active: true,
      receipt_header: "",
      receipt_footer: "",
    });
    setSelectedRegister(null);
  };

  // Edit register
  const handleEditRegister = (register: Register) => {
    setSelectedRegister(register);
    setFormData({
      name: register.name,
      code: register.code,
      warehouse: register.warehouse || "",
      is_active: register.is_active,
      receipt_header: register.receipt_header || "",
      receipt_footer: register.receipt_footer || "",
    });
    setShowRegisterDialog(true);
  };


  // Filter registers
  const filteredRegisters = (Array.isArray(registers) ? registers : []).filter(
    r =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get session for register
  const getRegisterSession = (registerId: string) => {
    return sessions.find(s => s.register === registerId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sales">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Caisses</h1>
            <p className="text-sm text-gray-500 mt-1">Gérez vos caisses et sessions</p>
          </div>
        </div>
        {canManageRegisters ? (
          <Button
            onClick={() => {
              resetForm();
              setShowRegisterDialog(true);
            }}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle caisse
          </Button>
        ) : null}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Rechercher une caisse..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Registers Grid */}
      {filteredRegisters.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calculator className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune caisse</h3>
            <p className="text-sm text-gray-500 mb-4">
              {canManageRegisters
                ? "Créez votre première caisse pour commencer à vendre."
                : "Aucune caisse disponible pour votre périmètre. Contactez un responsable pour en créer une."}
            </p>
            {canManageRegisters ? (
              <Button onClick={() => setShowRegisterDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer une caisse
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRegisters.map(register => {
            const activeSession = getRegisterSession(register.id);
            const hasSession = !!activeSession || !!register.current_session;

            return (
              <Card key={register.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${hasSession ? "bg-green-100" : "bg-gray-100"}`}>
                        <Calculator className={`h-5 w-5 ${hasSession ? "text-green-600" : "text-gray-600"}`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{register.name}</h3>
                        <p className="text-xs text-gray-500">{register.code}</p>
                      </div>
                    </div>
                    {canManageRegisters ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditRegister(register)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => {
                            setSelectedRegister(register);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Succursale</span>
                      <span className="font-medium">{register.branch_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Entrepôt</span>
                      <span className="font-medium">{register.warehouse_name ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Statut</span>
                      <Badge className={register.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                        {register.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  {hasSession ? (
                    <div className="p-3 bg-green-50 rounded-lg mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-900">Session active</span>
                      </div>
                      <p className="text-xs text-green-700">
                        Ouvert par {register.current_session?.opened_by || activeSession?.opened_by_name}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex gap-2">
                    {hasSession ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedSession(activeSession || null);
                            setShowCloseSessionDialog(true);
                          }}
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Fermer
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-orange-500 hover:bg-orange-600"
                          onClick={() => router.push("/dashboard/sales/pos")}
                        >
                          Continuer
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setSelectedRegister(register);
                          setShowOpenSessionDialog(true);
                        }}
                        disabled={!register.is_active}
                        title={
                          !register.is_active
                            ? "Cette caisse est désactivée — réactivez-la dans les paramètres pour ouvrir une session."
                            : undefined
                        }
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Ouvrir une session
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Register Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedRegister ? "Modifier la caisse" : "Nouvelle caisse"}
            </DialogTitle>
            <DialogDescription>
              {selectedRegister
                ? "Modifiez les informations de la caisse"
                : "Créez une nouvelle caisse pour votre point de vente"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Caisse 1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  placeholder="CAI001"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Entrepôt *</Label>
              <SearchableSelectAsyncWithEmpty
                value={formData.warehouse || null}
                onValueChange={value => setFormData({ ...formData, warehouse: value || "" })}
                onSearch={
                  session?.accessToken && organization?.id
                    ? createWarehouseSearchHandler(session.accessToken, organization.id, {
                        is_active: true,
                      })
                    : async () => []
                }
                emptyLabel="—"
                placeholder="Sélectionner un entrepôt"
                searchPlaceholder="Rechercher un entrepôt..."
                disabled={!session?.accessToken || !organization?.id}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Caisse active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowRegisterDialog(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedRegister ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer la caisse</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la caisse "{selectedRegister?.name}" ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteRegister} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Session Dialog */}
      <Dialog open={showOpenSessionDialog} onOpenChange={setShowOpenSessionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ouvrir une session</DialogTitle>
            <DialogDescription>
              Ouvrez une session de caisse sur "{selectedRegister?.name}"
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleOpenSession} className="space-y-4">
            <p className="text-sm text-gray-600">
              La session démarre avec un solde d&apos;ouverture à zéro. Vous serez redirigé vers le point de vente.
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowOpenSessionDialog(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ouvrir la session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog
        open={showCloseSessionDialog}
        onOpenChange={(open) => {
          setShowCloseSessionDialog(open);
          if (!open) {
            setCloseCountedBalance("");
        setCloseCountedByCurrency({});
            setCloseNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fermer la session</DialogTitle>
            <DialogDescription>
              Vérifiez le comptage de caisse avant de clôturer.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCloseSession} className="space-y-4">
            {selectedSession && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Solde d&apos;ouverture</span>
                  <span className="font-medium">
                    {formatPrice(selectedSession.opening_balance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ventes</span>
                  <span className="font-medium">
                    {selectedSession.sales_count} ({formatPrice(selectedSession.sales_total)})
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600 font-medium">Solde attendu</span>
                  <span className="font-semibold">
                    {formatPrice(closeExpectedBalance.toFixed(2))}
                  </span>
                </div>
              </div>
            )}

            {isMultiCurrencyClose ? (
              <div className="space-y-2">
                <Label>Montant réellement compté, par devise (optionnel)</Label>
                <p className="text-xs text-gray-500">
                  Le tiroir contient plusieurs devises. Comptez chacune séparément —
                  le solde attendu est calculé par devise à la fermeture.
                </p>
                {closeCurrencies.map((code) => (
                  <div key={code} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-sm font-semibold">{code}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Laisser vide pour utiliser l'attendu"
                      value={closeCountedByCurrency[code] ?? ""}
                      onChange={(e) =>
                        setCloseCountedByCurrency((prev) => ({ ...prev, [code]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="counted_balance">
                  Montant réellement compté en caisse (optionnel)
                </Label>
                <Input
                  id="counted_balance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Laisser vide pour utiliser le solde attendu"
                  value={closeCountedBalance}
                  onChange={(e) => setCloseCountedBalance(e.target.value)}
                />
                {closeCountedNum !== null && Math.abs(closeDifference) > 0.005 && (
                  <p
                    className={
                      closeDifference < 0
                        ? "text-sm font-medium text-red-600"
                        : "text-sm font-medium text-amber-600"
                    }
                  >
                    Écart : {closeDifference > 0 ? "+" : ""}
                    {formatPrice(closeDifference.toFixed(2))}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="close_notes">
                Notes {closeCountedNum !== null && Math.abs(closeDifference) > 0.005 && (
                  <span className="text-red-600">*</span>
                )}
              </Label>
              <textarea
                id="close_notes"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Explication obligatoire en cas d'écart"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCloseSessionDialog(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Fermer la session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
