"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { useCurrency } from "@/components/providers/currency-provider";
import { getUserOrganizations, getBranches, Organization, Branch } from "@/actions/organization.actions";
import { getWarehouses, Warehouse } from "@/actions/stock.actions";
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

export default function RegistersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { currency: defaultCurrency } = useCurrency();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
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

  // Form state
  const [formData, setFormData] = useState<CreateRegisterData>({
    name: "",
    code: "",
    branch: "",
    warehouse: "",
    is_active: true,
    receipt_header: "",
    receipt_footer: "",
  });

  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          // Fetch in parallel
          const [registersResult, warehousesResult, branchesResult, sessionsResult] = await Promise.all([
            getRegisters(session.accessToken, org.id),
            getWarehouses(session.accessToken, org.id),
            getBranches(session.accessToken, org.id),
            getRegisterSessions(session.accessToken, org.id, { status: "open" }),
          ]);

          if (registersResult.success && registersResult.data) {
            setRegisters(registersResult.data);
          }
          if (warehousesResult.success && warehousesResult.data) {
            setWarehouses(warehousesResult.data);
          }
          if (branchesResult.success && branchesResult.data) {
            setBranches(branchesResult.data);
            // Set default branch
            if (branchesResult.data.length > 0) {
              setFormData(prev => ({ ...prev, branch: branchesResult.data![0].id }));
            }
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

  // Handle create/update register
  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id) return;

    setIsSubmitting(true);

    try {
      const dataToSend = {
        ...formData,
        warehouse: formData.warehouse || undefined,
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
        opening_balance: parseFloat(openingBalance) || 0,
        notes: sessionNotes,
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
        setOpeningBalance("");
        setSessionNotes("");

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

  // Handle close session
  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id || !selectedSession) return;

    setIsSubmitting(true);

    try {
      const result = await closeSession(
        session.accessToken,
        organization.id,
        selectedSession.id,
        {
          closing_balance: parseFloat(closingBalance) || 0,
          notes: sessionNotes,
        }
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
        setClosingBalance("");
        setSessionNotes("");
        setSelectedSession(null);
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
      branch: branches.length > 0 ? branches[0].id : "",
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
      branch: register.branch,
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
              Créez votre première caisse pour commencer à vendre
            </p>
            <Button onClick={() => setShowRegisterDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Créer une caisse
            </Button>
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
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Succursale</span>
                      <span className="font-medium">{register.branch_name}</span>
                    </div>
                    {register.warehouse_name && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Entrepôt</span>
                        <span className="font-medium">{register.warehouse_name}</span>
                      </div>
                    )}
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
                      <p className="text-xs text-green-700">
                        Solde: {formatPrice(register.current_session?.opening_balance || activeSession?.opening_balance || 0)}
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
              <Label>Succursale *</Label>
              <SearchableSelect
                options={branches.map((branch: Branch) => ({ value: branch.id, label: branch.name }))}
                value={formData.branch || undefined}
                onValueChange={value => setFormData({ ...formData, branch: value })}
                placeholder="Sélectionner une succursale"
                searchPlaceholder="Rechercher une succursale..."
              />
            </div>

            <div className="space-y-2">
              <Label>Entrepôt (optionnel)</Label>
              <SearchableSelect
                options={[
                  { value: "none", label: "Aucun" },
                  ...warehouses.map(warehouse => ({ value: warehouse.id, label: warehouse.name })),
                ]}
                value={formData.warehouse || "none"}
                onValueChange={value => setFormData({ ...formData, warehouse: value === "none" ? "" : value })}
                placeholder="Sélectionner un entrepôt"
                searchPlaceholder="Rechercher un entrepôt..."
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
            <div className="space-y-2">
              <Label>Solde d'ouverture ({defaultCurrency.symbol}) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  step="any"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(e.target.value)}
                  placeholder="0"
                  className="pl-9"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">
                Montant en espèces dans la caisse au début de la session
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                placeholder="Notes pour cette session..."
                rows={2}
              />
            </div>

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
      <Dialog open={showCloseSessionDialog} onOpenChange={setShowCloseSessionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fermer la session</DialogTitle>
            <DialogDescription>
              Fermez la session de caisse en cours
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCloseSession} className="space-y-4">
            {selectedSession && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Solde d'ouverture</span>
                  <span className="font-medium">{formatPrice(selectedSession.opening_balance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ventes</span>
                  <span className="font-medium">{selectedSession.sales_count} ({formatPrice(selectedSession.sales_total)})</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Solde de fermeture ({defaultCurrency.symbol}) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  step="any"
                  value={closingBalance}
                  onChange={e => setClosingBalance(e.target.value)}
                  placeholder="0"
                  className="pl-9"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">
                Montant en espèces comptées dans la caisse
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                placeholder="Notes de clôture..."
                rows={2}
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
