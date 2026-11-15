export type DocType = "docx" | "xlsx" | "pptx" | "pdf";
export type DocStatus = "valid" | "warning" | "expired" | "uncontrolled";

export interface DocumentItem {
  id: string;
  name: string;
  type: DocType;
  location: string;
  owner: string;
  lastReview: string | null; // ISO date — extracted "Última Revisão"
  reviewFound?: boolean;
  lastModified?: number; // epoch ms
  source?: "Pasta local" | "OneDrive" | "SharePoint";
}

export interface Settings {
  validityMonths: number;
  alertDays: number;
}

export const DEFAULT_SETTINGS: Settings = {
  validityMonths: 12,
  alertDays: 10,
};

export function computeExpiry(lastReview: string | null, validityMonths: number) {
  if (!lastReview) return null;
  const d = new Date(lastReview);
  d.setMonth(d.getMonth() + validityMonths);
  return d;
}

export function computeStatus(lastReview: string | null, settings: Settings): DocStatus {
  if (!lastReview) return "uncontrolled";
  const expiry = computeExpiry(lastReview, settings.validityMonths)!;
  const now = new Date();
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return "expired";
  if (diffDays <= settings.alertDays) return "warning";
  return "valid";
}

export function daysUntilExpiry(lastReview: string | null, settings: Settings) {
  const expiry = computeExpiry(lastReview, settings.validityMonths);
  if (!expiry) return null;
  return Math.ceil((expiry.getTime() - new Date().getTime()) / 86400000);
}

export function formatDate(iso: string | null | Date) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("pt-BR");
}

export const STATUS_LABEL: Record<DocStatus, string> = {
  valid: "Válido",
  warning: "Próximo do vencimento",
  expired: "Vencido",
  uncontrolled: "Data de revisão não identificada",
};
