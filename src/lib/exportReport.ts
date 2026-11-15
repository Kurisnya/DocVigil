import * as XLSX from "xlsx";
import { DocumentItem, Settings, STATUS_LABEL, computeExpiry, computeStatus, formatDate } from "./documents";

const TYPE_LABEL: Record<string, string> = {
  docx: "Word (.docx)",
  xlsx: "Excel (.xlsx)",
  pptx: "PowerPoint (.pptx)",
  pdf: "PDF (.pdf)",
};

function fmt(d: Date | null) {
  return d ? d.toLocaleDateString("pt-BR") : "";
}
function fmtDt(ms?: number | null) {
  return ms ? new Date(ms).toLocaleString("pt-BR") : "";
}

export interface ExportRow {
  "Nome do arquivo": string;
  "Caminho/Localização": string;
  "Tipo": string;
  "Última modificação": string;
  "Última revisão": string;
  "Validade calculada": string;
  "Status": string;
  "Verificado em": string;
  "Origem": string;
}

export function buildRows(docs: DocumentItem[], settings: Settings): ExportRow[] {
  const verifiedAt = new Date().toLocaleString("pt-BR");
  return docs.map((d) => {
    const status = computeStatus(d.lastReview, settings);
    const expiry = computeExpiry(d.lastReview, settings.validityMonths);
    return {
      "Nome do arquivo": d.name,
      "Caminho/Localização": d.location,
      "Tipo": TYPE_LABEL[d.type] ?? d.type,
      "Última modificação": fmtDt(d.lastModified),
      "Última revisão": d.lastReview ? formatDate(d.lastReview) : "Não identificada",
      "Validade calculada": fmt(expiry),
      "Status": STATUS_LABEL[status],
      "Verificado em": verifiedAt,
      "Origem": d.source ?? "Pasta local",
    };
  });
}

function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportXlsx(docs: DocumentItem[], settings: Settings) {
  const rows = buildRows(docs, settings);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 40 }, { wch: 50 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `docvigil_relatorio_${timestamp()}.xlsx`);
}

export function exportCsv(docs: DocumentItem[], settings: Settings) {
  const rows = buildRows(docs, settings);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
  download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `docvigil_relatorio_${timestamp()}.csv`);
}
