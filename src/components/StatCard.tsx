import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "destructive" | "neutral";
}

const TONES = {
  primary: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-danger-soft text-destructive",
  neutral: "bg-neutral-soft text-neutral-strong",
};

export const StatCard = ({ label, value, icon: Icon, tone }: Props) => (
  <div className="bg-card rounded-xl p-5 shadow-[var(--shadow-card)] border border-border/60 hover:shadow-[var(--shadow-elegant)] transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold mt-2 text-foreground tabular-nums">{value}</p>
      </div>
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", TONES[tone])}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);
