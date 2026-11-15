import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { DocStatus, STATUS_LABEL } from "@/lib/documents";
import { cn } from "@/lib/utils";

const STYLES: Record<DocStatus, string> = {
  valid: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  expired: "bg-danger-soft text-destructive border-destructive/20",
  uncontrolled: "bg-neutral-soft text-neutral-strong border-border",
};

const ICONS = {
  valid: CheckCircle2,
  warning: AlertTriangle,
  expired: XCircle,
  uncontrolled: HelpCircle,
};

export const StatusBadge = ({ status }: { status: DocStatus }) => {
  const Icon = ICONS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap", STYLES[status])}>
      <Icon className="h-3.5 w-3.5" />
      {STATUS_LABEL[status]}
    </span>
  );
};
