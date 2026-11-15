import { useEffect, useState } from "react";
import { ExternalLink, FolderOpen, Link2, Pencil, Check, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";

const STORAGE_KEY = "docvigil:source-url";
const NAME_KEY = "docvigil:source-name";

export const SourceShortcut = () => {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    const u = localStorage.getItem(STORAGE_KEY) ?? "";
    const n = localStorage.getItem(NAME_KEY) ?? "";
    setUrl(u);
    setName(n);
    if (!u) setEditing(true);
  }, []);

  const startEdit = () => {
    setDraftUrl(url);
    setDraftName(name);
    setEditing(true);
  };

  const save = () => {
    if (!draftUrl.trim()) {
      toast.error("Informe a URL da pasta");
      return;
    }
    try {
      new URL(draftUrl);
    } catch {
      toast.error("URL inválida");
      return;
    }
    localStorage.setItem(STORAGE_KEY, draftUrl);
    localStorage.setItem(NAME_KEY, draftName || "Pasta monitorada");
    setUrl(draftUrl);
    setName(draftName || "Pasta monitorada");
    setEditing(false);
    toast.success("Atalho salvo");
  };

  return (
    <section className="bg-card rounded-2xl border border-border/60 shadow-[var(--shadow-card)] p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">Fonte de documentos</h3>
            <p className="text-xs text-muted-foreground">
              Atalho para a pasta do SharePoint/OneDrive monitorada pelo DocVigil.
            </p>
          </div>
        </div>

        {!editing && url && (
          <div className="flex items-center gap-2 flex-1 md:flex-none md:min-w-[320px] justify-end">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-sm min-w-0 max-w-full"
            >
              <Link2 className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate font-medium">{name || "Pasta monitorada"}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </a>
            <Button variant="ghost" size="icon" onClick={startEdit} aria-label="Editar atalho">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto] items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome do atalho</label>
            <Input
              placeholder="Ex: Compliance / Políticas"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">URL da pasta (SharePoint / OneDrive)</label>
            <Input
              placeholder="https://contoso.sharepoint.com/sites/.../Documentos%20Compartilhados"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="gap-1.5"><Check className="h-4 w-4" /> Salvar</Button>
            {url && (
              <Button variant="ghost" onClick={() => setEditing(false)} className="gap-1.5">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
