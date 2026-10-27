"use server";

/**
 * Achats et fournisseurs (lot 13) : commandes, réceptions, règlements, retours.
 *
 * ⚠ TOUT MONTANT ET TOUTE QUANTITÉ SONT TYPÉS EN CHAÎNE, et ce n'est pas un
 * détail de style : DRF sérialise un `DecimalField` en chaîne (le projet ne
 * pose pas `COERCE_DECIMAL_TO_STRING`), et le typer `number` fait planter
 * l'écran sur un `toFixed is not a function` - c'est exactement le défaut tombé
 * en production sur la page Rapports le 23 octobre. `pnpm check:api-decimals`
 * apparie chaque `XxxListSerializer` / `XxxDetailSerializer` à l'interface
 * `Xxx` ci-dessous et le refuse.
 */

import { revalidatePath } from "next/cache";
import { formatAxiosErrorMessage, getErrorBody } from "@/lib/api/drf-error";
import axios from "@/lib/auth/api-helper";
import {
  fetchExportFile,
  type ExportFile,
  type ExportFormat,
} from "@/lib/export/fetch-export";

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8005/api/v1";

// =============================================================================
// TYPES
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "partially_received"
  | "received"
  | "cancelled";

export interface PurchaseOrderItem {
  id: string;
  product: string;
  product_name?: string;
  product_sku?: string;
  variant?: string | null;
  description?: string;
  quantity_ordered: string;
  quantity_received: string;
  quantity_pending: string;
  unit_price: string;
  package_quantity: string;
  loose_quantity: string;
  package_unit_price?: string | null;
  packaging_factor?: number | null;
  /** Lecture en contenants, calculée par le serveur. « 3 cartons + 7 bouteilles ». */
  ordered_display?: string;
  tax_rate: string;
  tax_amount: string;
  discount_percentage: string;
  subtotal: string;
  total: string;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  supplier: string;
  supplier_name?: string;
  supplier_email?: string;
  warehouse?: string | null;
  warehouse_name?: string;
  status: PurchaseOrderStatus;
  status_display?: string;
  subtotal: string;
  tax_amount?: string;
  discount_amount?: string;
  shipping_cost?: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  currency: string;
  exchange_rate?: string;
  order_date: string;
  expected_date?: string | null;
  notes?: string;
  terms?: string;
  created_by?: string | null;
  created_by_name?: string;
  approved_by?: string | null;
  approved_by_name?: string;
  items?: PurchaseOrderItem[];
  items_count?: number;
  receipts_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type GoodsReceiptStatus = "draft" | "completed" | "cancelled";

export interface GoodsReceiptItem {
  id: string;
  purchase_order_item?: string | null;
  product: string;
  product_name?: string;
  product_sku?: string;
  variant?: string | null;
  quantity_received: string;
  quantity_accepted: string;
  quantity_rejected: string;
  unit_cost: string;
  package_quantity: string;
  loose_quantity: string;
  package_unit_cost?: string | null;
  packaging_factor?: number | null;
  received_display?: string;
  batch_number?: string;
  expiry_date?: string | null;
  notes?: string;
  rejection_reason?: string;
}

export interface GoodsReceipt {
  id: string;
  reference: string;
  purchase_order: string;
  purchase_order_reference?: string;
  /**
   * ⚠ La devise d'une réception est celle de sa COMMANDE : ni `GoodsReceipt`
   * ni `PurchaseReturn` n'en porte à lui. Sans elle, les écrans rendaient
   * leurs montants sous le symbole de la devise PRINCIPALE.
   */
  purchase_order_currency?: string;
  warehouse: string;
  warehouse_name?: string;
  status: GoodsReceiptStatus;
  status_display?: string;
  receipt_date: string;
  supplier_invoice?: string;
  supplier_delivery_note?: string;
  notes?: string;
  received_by?: string | null;
  received_by_name?: string;
  items?: GoodsReceiptItem[];
  items_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierPaymentAllocation {
  id?: string;
  purchase_order: string;
  purchase_order_reference?: string;
  amount: string;
}

export interface SupplierPayment {
  id: string;
  reference: string;
  supplier: string;
  supplier_name?: string;
  amount: string;
  currency: string;
  exchange_rate?: string;
  payment_method?: string | null;
  payment_method_name?: string;
  payment_reference?: string;
  status: "pending" | "completed" | "cancelled";
  status_display?: string;
  payment_date: string;
  notes?: string;
  created_by?: string | null;
  created_by_name?: string;
  allocations?: SupplierPaymentAllocation[];
  created_at?: string;
  updated_at?: string;
}

export type PurchaseReturnStatus =
  | "draft"
  | "pending"
  | "approved"
  | "shipped"
  | "completed"
  | "cancelled";

export interface PurchaseReturnItem {
  id?: string;
  product: string;
  product_name?: string;
  product_sku?: string;
  variant?: string | null;
  batch?: string | null;
  quantity: string;
  unit_cost: string;
  total?: string;
  reason?: string;
}

export interface PurchaseReturn {
  id: string;
  reference: string;
  supplier: string;
  supplier_name?: string;
  purchase_order?: string | null;
  /** Devise de la commande d'origine : c'est elle que le serveur oppose. */
  purchase_order_currency?: string;
  warehouse: string;
  warehouse_name?: string;
  status: PurchaseReturnStatus;
  status_display?: string;
  total_amount: string;
  reason: string;
  return_date: string;
  created_by?: string | null;
  created_by_name?: string;
  items?: PurchaseReturnItem[];
  items_count?: number;
  created_at?: string;
  updated_at?: string;
}

/** Une ligne du grand livre d'un fournisseur. */
export interface SupplierLedgerEntry {
  id: string;
  type: "receipt" | "payment" | "return" | "adjustment";
  type_display: string;
  amount: string;
  currency: string;
  balance_before: string;
  balance_after: string;
  purchase_order_reference: string | null;
  goods_receipt_reference: string | null;
  payment_reference: string | null;
  reference: string;
  notes: string;
  created_at: string;
}

export interface PurchaseOrderFilters {
  status?: string;
  supplier?: string;
  warehouse?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  user?: string;
  page?: number;
  page_size?: number;
}

export interface GoodsReceiptFilters {
  status?: string;
  purchase_order?: string;
  warehouse?: string;
  search?: string;
  user?: string;
  page?: number;
  page_size?: number;
}

export interface SupplierPaymentFilters {
  status?: string;
  supplier?: string;
  payment_method?: string;
  search?: string;
  warehouse?: string;
  user?: string;
  page?: number;
  page_size?: number;
}

export interface PurchaseReturnFilters {
  status?: string;
  supplier?: string;
  warehouse?: string;
  search?: string;
  user?: string;
  /**
   * ⚠ `PurchaseReturnFilter.Meta.fields` le DÉCLARE côté serveur, et il
   * manquait ici : le dialogue de retour tirait donc tous les retours de
   * l'établissement et les filtrait en mémoire, bornés à une page. Au-delà de
   * cent retours, ce qui avait déjà été rendu était sous-compté.
   */
  purchase_order?: string;
  page?: number;
  page_size?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function getHeaders(accessToken: string, organizationId: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Organization-ID": organizationId,
  };
}

/**
 * Traduit un jeu de filtres en paramètres de requête.
 *
 * ⚠ Un seul constructeur pour les quatre listes. Les dix-sept `new
 * URLSearchParams()` de `reports.actions.ts` ont déjà montré ce que coûte la
 * recopie : un onglet finit par manquer une clé, et il ignore alors un filtre
 * affiché à deux centimètres.
 */
function buildParams(filters?: object): string {
  const params = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(filters ?? {})) {
    if (valeur === undefined || valeur === null || valeur === "") continue;
    params.append(cle, String(valeur));
  }
  return params.toString();
}

function erreur(contexte: string, error: unknown, repli: string) {
  console.error(
    `[purchases] ${contexte}:`,
    getErrorBody(error) || (error as Error)?.message
  );
  return {
    success: false as const,
    message: formatAxiosErrorMessage(error, repli),
    errors: getErrorBody(error) as Record<string, string[]> | undefined,
  };
}

// =============================================================================
// COMMANDES D'ACHAT
// =============================================================================

export async function getPurchaseOrders(
  accessToken: string,
  organizationId: string,
  filters?: PurchaseOrderFilters
): Promise<ApiResponse<PaginatedResponse<PurchaseOrder>>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/purchase-orders/?${buildParams(filters)}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("getPurchaseOrders", error, "Erreur lors de la récupération des commandes");
  }
}

export async function getPurchaseOrder(
  accessToken: string,
  organizationId: string,
  orderId: string
): Promise<ApiResponse<PurchaseOrder>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/purchase-orders/${orderId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("getPurchaseOrder", error, "Erreur lors de la récupération de la commande");
  }
}

/** Commandes encore à réceptionner, classées par date attendue. */
export async function getPendingPurchaseOrders(
  accessToken: string,
  organizationId: string,
  filters?: { page?: number; page_size?: number }
): Promise<ApiResponse<PaginatedResponse<PurchaseOrder>>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/purchase-orders/pending/?${buildParams(filters)}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("getPendingPurchaseOrders", error, "Erreur lors de la récupération des commandes en attente");
  }
}

export interface CreatePurchaseOrderItemData {
  product: string;
  description?: string;
  quantity_ordered?: string | number;
  unit_price?: string | number;
  package_quantity?: string | number;
  loose_quantity?: string | number;
  package_unit_price?: string | number;
  packaging_factor?: number;
  tax_rate?: string | number;
  discount_percentage?: string | number;
}

export interface CreatePurchaseOrderData {
  supplier: string;
  warehouse?: string | null;
  order_date: string;
  expected_date?: string | null;
  currency?: string;
  exchange_rate?: string | number;
  shipping_cost?: string | number;
  notes?: string;
  terms?: string;
  items: CreatePurchaseOrderItemData[];
}

export async function createPurchaseOrder(
  accessToken: string,
  organizationId: string,
  data: CreatePurchaseOrderData
): Promise<ApiResponse<PurchaseOrder>> {
  try {
    const response = await axios.post(`${API_BASE_URL}/purchase-orders/`, data, {
      headers: getHeaders(accessToken, organizationId),
    });
    revalidatePath("/dashboard/purchases");
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("createPurchaseOrder", error, "Erreur lors de la création de la commande");
  }
}

export async function updatePurchaseOrder(
  accessToken: string,
  organizationId: string,
  orderId: string,
  data: Partial<CreatePurchaseOrderData>
): Promise<ApiResponse<PurchaseOrder>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/purchase-orders/${orderId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    revalidatePath(`/dashboard/purchases/${orderId}`);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("updatePurchaseOrder", error, "Erreur lors de la modification de la commande");
  }
}

/**
 * Les trois transitions d'une commande.
 *
 * ⚠ `approve` et `send` ne sont PAS le même geste, et l'ordre n'est pas
 * imposé : le serveur accepte d'envoyer un brouillon comme une commande déjà
 * confirmée. Un marchand qui téléphone son besoin confirme sans rien envoyer.
 */
async function transitionPurchaseOrder(
  accessToken: string,
  organizationId: string,
  orderId: string,
  action: "approve" | "send" | "cancel",
  repli: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/purchase-orders/${orderId}/${action}/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    revalidatePath(`/dashboard/purchases/${orderId}`);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur(`transitionPurchaseOrder:${action}`, error, repli);
  }
}

export async function approvePurchaseOrder(
  accessToken: string,
  organizationId: string,
  orderId: string
): Promise<ApiResponse<{ status: string }>> {
  return transitionPurchaseOrder(
    accessToken, organizationId, orderId, "approve",
    "Erreur lors de la confirmation de la commande"
  );
}

export async function sendPurchaseOrder(
  accessToken: string,
  organizationId: string,
  orderId: string
): Promise<ApiResponse<{ status: string }>> {
  return transitionPurchaseOrder(
    accessToken, organizationId, orderId, "send",
    "Erreur lors de l'envoi de la commande"
  );
}

export async function cancelPurchaseOrder(
  accessToken: string,
  organizationId: string,
  orderId: string
): Promise<ApiResponse<{ status: string }>> {
  return transitionPurchaseOrder(
    accessToken, organizationId, orderId, "cancel",
    "Erreur lors de l'annulation de la commande"
  );
}

// =============================================================================
// RÉCEPTIONS
// =============================================================================

export async function getGoodsReceipts(
  accessToken: string,
  organizationId: string,
  filters?: GoodsReceiptFilters
): Promise<ApiResponse<PaginatedResponse<GoodsReceipt>>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/goods-receipts/?${buildParams(filters)}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("getGoodsReceipts", error, "Erreur lors de la récupération des réceptions");
  }
}

export async function getGoodsReceipt(
  accessToken: string,
  organizationId: string,
  receiptId: string
): Promise<ApiResponse<GoodsReceipt>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/goods-receipts/${receiptId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("getGoodsReceipt", error, "Erreur lors de la récupération de la réception");
  }
}

export interface CreateGoodsReceiptItemData {
  purchase_order_item: string;
  product: string;
  quantity_received: string | number;
  quantity_accepted: string | number;
  quantity_rejected?: string | number;
  unit_cost?: string | number;
  package_quantity?: string | number;
  loose_quantity?: string | number;
  package_unit_cost?: string | number;
  packaging_factor?: number;
  batch_number?: string;
  expiry_date?: string | null;
  notes?: string;
  rejection_reason?: string;
}

export interface CreateGoodsReceiptData {
  purchase_order: string;
  warehouse: string;
  receipt_date: string;
  supplier_invoice?: string;
  supplier_delivery_note?: string;
  notes?: string;
  items: CreateGoodsReceiptItemData[];
}

export async function createGoodsReceipt(
  accessToken: string,
  organizationId: string,
  data: CreateGoodsReceiptData
): Promise<ApiResponse<GoodsReceipt>> {
  try {
    const response = await axios.post(`${API_BASE_URL}/goods-receipts/`, data, {
      headers: getHeaders(accessToken, organizationId),
    });
    revalidatePath("/dashboard/purchases/receipts");
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("createGoodsReceipt", error, "Erreur lors de la création de la réception");
  }
}

/**
 * Valide la réception : le stock entre, la commande avance, la dette s'inscrit.
 *
 * ⚠ C'est le SEUL geste de tout ce module qui fasse bouger un rayon et une
 * dette en même temps, et il ne se défait pas - son coût moyen pondéré a déjà
 * changé. Le dialogue appelant doit le dire avant.
 */
export async function completeGoodsReceipt(
  accessToken: string,
  organizationId: string,
  receiptId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/goods-receipts/${receiptId}/complete/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    revalidatePath(`/dashboard/purchases/receipts/${receiptId}`);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("completeGoodsReceipt", error, "Erreur lors de la validation de la réception");
  }
}

export async function cancelGoodsReceipt(
  accessToken: string,
  organizationId: string,
  receiptId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/goods-receipts/${receiptId}/cancel/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    revalidatePath(`/dashboard/purchases/receipts/${receiptId}`);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("cancelGoodsReceipt", error, "Erreur lors de l'annulation de la réception");
  }
}

// =============================================================================
// RÈGLEMENTS FOURNISSEURS
// =============================================================================

export async function getSupplierPayments(
  accessToken: string,
  organizationId: string,
  filters?: SupplierPaymentFilters
): Promise<ApiResponse<PaginatedResponse<SupplierPayment>>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/supplier-payments/?${buildParams(filters)}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("getSupplierPayments", error, "Erreur lors de la récupération des règlements");
  }
}

export async function getSupplierPayment(
  accessToken: string,
  organizationId: string,
  paymentId: string
): Promise<ApiResponse<SupplierPayment>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/supplier-payments/${paymentId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("getSupplierPayment", error, "Erreur lors de la récupération du règlement");
  }
}

export interface CreateSupplierPaymentData {
  supplier: string;
  amount: string | number;
  currency?: string;
  exchange_rate?: string | number;
  payment_method?: string | null;
  payment_reference?: string;
  payment_date: string;
  notes?: string;
  /**
   * Imputation explicite. ⚠ Laissée VIDE, le serveur impute de la commande la
   * plus ancienne à la plus récente : sans cela le solde du fournisseur
   * baisserait pendant que chaque `amount_due` resterait intact, et les deux
   * vérités divergeraient.
   */
  allocations?: { purchase_order: string; amount: string | number }[];
}

export async function createSupplierPayment(
  accessToken: string,
  organizationId: string,
  data: CreateSupplierPaymentData
): Promise<ApiResponse<SupplierPayment>> {
  try {
    const response = await axios.post(`${API_BASE_URL}/supplier-payments/`, data, {
      headers: getHeaders(accessToken, organizationId),
    });
    revalidatePath("/dashboard/purchases/payments");
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("createSupplierPayment", error, "Erreur lors de l'enregistrement du règlement");
  }
}

export async function cancelSupplierPayment(
  accessToken: string,
  organizationId: string,
  paymentId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/supplier-payments/${paymentId}/cancel/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    revalidatePath(`/dashboard/purchases/payments/${paymentId}`);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("cancelSupplierPayment", error, "Erreur lors de l'annulation du règlement");
  }
}

// =============================================================================
// RETOURS FOURNISSEURS
// =============================================================================

export async function getPurchaseReturns(
  accessToken: string,
  organizationId: string,
  filters?: PurchaseReturnFilters
): Promise<ApiResponse<PaginatedResponse<PurchaseReturn>>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/purchase-returns/?${buildParams(filters)}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("getPurchaseReturns", error, "Erreur lors de la récupération des retours");
  }
}

export async function getPurchaseReturn(
  accessToken: string,
  organizationId: string,
  returnId: string
): Promise<ApiResponse<PurchaseReturn>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/purchase-returns/${returnId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("getPurchaseReturn", error, "Erreur lors de la récupération du retour");
  }
}

export interface CreatePurchaseReturnData {
  supplier: string;
  purchase_order?: string | null;
  warehouse: string;
  reason: string;
  return_date: string;
  items: {
    product: string;
    quantity: string | number;
    unit_cost: string | number;
    batch?: string | null;
    reason?: string;
  }[];
}

export async function createPurchaseReturn(
  accessToken: string,
  organizationId: string,
  data: CreatePurchaseReturnData
): Promise<ApiResponse<PurchaseReturn>> {
  try {
    const response = await axios.post(`${API_BASE_URL}/purchase-returns/`, data, {
      headers: getHeaders(accessToken, organizationId),
    });
    revalidatePath("/dashboard/purchases/returns");
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("createPurchaseReturn", error, "Erreur lors de la création du retour");
  }
}

/**
 * Les trois transitions d'un retour.
 *
 * ⚠ APPROUVER est l'acte destructeur, pas annuler : c'est lui qui sort la
 * marchandise du rayon. EXPÉDIER éteint la dette et ne rend en caisse que le
 * reliquat. Même grammaire que les retours de vente, où le rouge vit dans la
 * confirmation d'approbation.
 */
async function transitionPurchaseReturn(
  accessToken: string,
  organizationId: string,
  returnId: string,
  action: "approve" | "ship" | "cancel",
  repli: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/purchase-returns/${returnId}/${action}/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    revalidatePath(`/dashboard/purchases/returns/${returnId}`);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur(`transitionPurchaseReturn:${action}`, error, repli);
  }
}

export async function approvePurchaseReturn(
  accessToken: string,
  organizationId: string,
  returnId: string
): Promise<ApiResponse<{ status: string }>> {
  return transitionPurchaseReturn(
    accessToken, organizationId, returnId, "approve",
    "Erreur lors de l'approbation du retour"
  );
}

export async function shipPurchaseReturn(
  accessToken: string,
  organizationId: string,
  returnId: string
): Promise<ApiResponse<{ status: string }>> {
  return transitionPurchaseReturn(
    accessToken, organizationId, returnId, "ship",
    "Erreur lors de l'expédition du retour"
  );
}

export async function cancelPurchaseReturn(
  accessToken: string,
  organizationId: string,
  returnId: string
): Promise<ApiResponse<{ status: string }>> {
  return transitionPurchaseReturn(
    accessToken, organizationId, returnId, "cancel",
    "Erreur lors de l'annulation du retour"
  );
}

// =============================================================================
// LE FOURNISSEUR : SON GRAND LIVRE, ET LA CORRECTION DE SON SOLDE
// =============================================================================

export async function getSupplierLedger(
  accessToken: string,
  organizationId: string,
  supplierId: string,
  filters?: { page?: number; page_size?: number }
): Promise<ApiResponse<PaginatedResponse<SupplierLedgerEntry>>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/suppliers/${supplierId}/ledger/?${buildParams(filters)}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("getSupplierLedger", error, "Erreur lors de la récupération du grand livre");
  }
}

/**
 * Corrige le solde d'un fournisseur.
 *
 * ⚠ CE GESTE FERME UN ÉCART NOMMÉ, ce n'est pas un confort. La dette inscrite
 * à la réception est une RECONSTRUCTION : une facture fournisseur peut porter
 * des lignes qu'aucune commande ne prévoyait, et le total reconstitué ne sera
 * alors pas celui du papier. Sans lui, l'écart resterait pour toujours.
 *
 * `delta` est SIGNÉ : positif creuse la dette, négatif la réduit.
 */
export async function adjustSupplierBalance(
  accessToken: string,
  organizationId: string,
  supplierId: string,
  data: { delta: string | number; notes: string; currency?: string }
): Promise<ApiResponse<{ current_balance: string; balance_after: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/suppliers/${supplierId}/adjust-balance/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    revalidatePath(`/dashboard/contacts/suppliers/${supplierId}`);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return erreur("adjustSupplierBalance", error, "Erreur lors de la correction du solde");
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Document d'une commande d'achat, rendu par le SERVEUR.
 *
 * ⚠ Le registre d'exports serveur est le seul endroit où un document A4 se
 * fabrique, depuis la session du 4 septembre : `lib/pdf-utils.ts` a été
 * supprimé précisément pour ne plus tenir deux moteurs en phase à la main.
 */
export async function exportPurchaseOrders(
  accessToken: string,
  organizationId: string,
  format: ExportFormat,
  filters: PurchaseOrderFilters = {}
): Promise<ExportFile> {
  return fetchExportFile("/purchase-orders/export/", accessToken, organizationId, format, {
    status: filters.status,
    supplier: filters.supplier,
    warehouse: filters.warehouse,
    search: filters.search,
    date_from: filters.date_from,
    date_to: filters.date_to,
    user: filters.user,
  });
}

/** Exporte la liste des réceptions, avec les filtres de l'écran. */
export async function exportGoodsReceipts(
  accessToken: string,
  organizationId: string,
  format: ExportFormat,
  filters: GoodsReceiptFilters = {}
): Promise<ExportFile> {
  return fetchExportFile("/goods-receipts/export/", accessToken, organizationId, format, {
    status: filters.status,
    purchase_order: filters.purchase_order,
    warehouse: filters.warehouse,
    search: filters.search,
    user: filters.user,
  });
}

/** Exporte le journal des règlements fournisseurs. */
export async function exportSupplierPayments(
  accessToken: string,
  organizationId: string,
  format: ExportFormat,
  filters: SupplierPaymentFilters = {}
): Promise<ExportFile> {
  return fetchExportFile("/supplier-payments/export/", accessToken, organizationId, format, {
    status: filters.status,
    supplier: filters.supplier,
    payment_method: filters.payment_method,
    search: filters.search,
    // ⚠ `warehouse` MANQUAIT, et l'écran l'applique : le document couvrait
    // alors tous les dépôts sous un en-tête qui annonce un entrepôt. Un
    // document couvre EXACTEMENT son écran - `SupplierPaymentFilter` le
    // supporte, en traversant l'imputation.
    warehouse: filters.warehouse,
    user: filters.user,
  });
}
