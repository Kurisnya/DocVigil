import { Mail, MapPin } from "lucide-react";
import { DocumentItem, Settings, computeExpiry, computeStatus, daysUntilExpiry, formatDate } from "@/lib/documents";
import { FileTypeIcon } from "./FileTypeIcon";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface Props {
  documents: DocumentItem[];
  settings: Settings;
}

export const DocumentsTable = ({ documents, settings }: Props) => {
  if (documents.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Nenhum documento corresponde aos filtros aplicados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="font-medium px-4 py-3">Documento</th>
            <th className="font-medium px-4 py-3">Última revisão</th>
            <th className="font-medium px-4 py-3">Validade</th>
            <th className="font-medium px-4 py-3">Status</th>
            <th className="font-medium px-4 py-3 text-right">Ação</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const status = computeStatus(doc.lastReview, settings);
            const expiry = computeExpiry(doc.lastReview, settings.validityMonths);
            const days = daysUntilExpiry(doc.lastReview, settings);
            return (
              <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 min-w-[280px]">
                    <FileTypeIcon type={doc.type} />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {doc.location} · <span className="text-muted-foreground/80">{doc.owner}</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground/80 tabular-nums">{formatDate(doc.lastReview)}</td>
                <td className="px-4 py-3 tabular-nums">
                  <div>{formatDate(expiry)}</div>
                  {days !== null && (
                    <div className="text-xs text-muted-foreground">
                      {days < 0 ? `${Math.abs(days)} dia(s) atrás` : `em ${days} dia(s)`}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3"><StatusBadge status={status} /></td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    disabled={status === "valid" || status === "uncontrolled"}
                    onClick={() => toast.success(`Alerta enviado para ${doc.owner}`)}
                  >
                    <Mail className="h-4 w-4" /> Notificar
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
