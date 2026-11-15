import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "@/lib/documents";
import { toast } from "sonner";

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
}

export const SettingsDialog = ({ settings, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [validity, setValidity] = useState(settings.validityMonths);
  const [alert, setAlert] = useState(settings.alertDays);

  const save = () => {
    onChange({ validityMonths: validity, alertDays: alert });
    setOpen(false);
    toast.success("Configurações atualizadas");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SettingsIcon className="h-4 w-4" /> Configurações
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parâmetros de monitoramento</DialogTitle>
          <DialogDescription>
            Defina o período de validade dos documentos e o prazo para envio de alertas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="validity">Período de validade (meses)</Label>
            <Input id="validity" type="number" min={1} max={60} value={validity} onChange={(e) => setValidity(+e.target.value)} />
            <p className="text-xs text-muted-foreground">Padrão: 12 meses (1 ano após a última revisão).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert">Prazo de alerta (dias antes)</Label>
            <Input id="alert" type="number" min={1} max={180} value={alert} onChange={(e) => setAlert(+e.target.value)} />
            <p className="text-xs text-muted-foreground">Documentos a vencer dentro desse prazo entram em alerta.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
