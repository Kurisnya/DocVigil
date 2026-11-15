import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, HardDrive, RefreshCw, Play, Pause, Trash2, AlertTriangle, FilePlus2, FileEdit, FileX2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import {
  ChangeEvent,
  ScannedFile,
  SUPPORTED_EXTENSIONS,
  clearRootHandle,
  diffSnapshots,
  ensurePermission,
  isFileSystemAccessSupported,
  loadRootHandle,
  saveRootHandle,
  scanDirectory,
  scanFiles,
  toDocumentItems,
} from "@/lib/localScanner";
import { DocType, DocumentItem } from "@/lib/documents";

interface Props {
  onDocumentsChange: (docs: DocumentItem[] | null) => void;
}

const POLL_KEY = "docvigil:poll-seconds";
const BATCH_KEY = "docvigil:batch-hours";
const LOG_KEY = "docvigil:event-log";
const MAX_LOG = 200;

export const LocalSourcePanel = ({ onDocumentsChange }: Props) => {
  const supported = isFileSystemAccessSupported();
  const [rootName, setRootName] = useState<string>("");
  const [hasHandle, setHasHandle] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [watching, setWatching] = useState(false);
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [events, setEvents] = useState<ChangeEvent[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { return []; }
  });
  const [pollSeconds, setPollSeconds] = useState<number>(() => +(localStorage.getItem(POLL_KEY) || 30));
  const [batchHours, setBatchHours] = useState<number>(() => +(localStorage.getItem(BATCH_KEY) || 24));
  const [lastScan, setLastScan] = useState<number | null>(null);

  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const filesRef = useRef<ScannedFile[]>([]);
  const pollTimerRef = useRef<number | null>(null);
  const batchTimerRef = useRef<number | null>(null);
  const dailyTimerRef = useRef<number | null>(null);
  const DAILY_KEY = "docvigil:last-daily-run";
  const DAILY_HOUR = 12;

  const persistEvents = (next: ChangeEvent[]) => {
    const trimmed = next.slice(0, MAX_LOG);
    setEvents(trimmed);
    localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
  };

  const performScan = useCallback(async (silent = false) => {
    const handle = handleRef.current;
    if (!handle) return;
    try {
      setScanning(true);
      const ok = await ensurePermission(handle);
      if (!ok) { toast.error("Permissão negada para a pasta"); return; }
      const prevMap = new Map(filesRef.current.map((f) => [f.id, f]));
      const next = await scanDirectory(handle, prevMap);
      const diffs = diffSnapshots(filesRef.current, next);
      filesRef.current = next;
      setFiles(next);
      setLastScan(Date.now());
      onDocumentsChange(toDocumentItems(next, handle.name));
      if (diffs.length) {
        persistEvents([...diffs, ...events]);
        if (!silent) toast.success(`${diffs.length} alteração(ões) detectada(s)`);
      } else if (!silent) {
        toast.message("Nenhuma alteração", { description: `${next.length} arquivo(s) monitorado(s).` });
      }
    } catch (e: any) {
      toast.error("Falha ao varrer pasta", { description: e?.message });
    } finally {
      setScanning(false);
    }
  }, [events, onDocumentsChange]);

  // Restore handle on mount
  useEffect(() => {
    if (!supported) return;
    (async () => {
      const h = await loadRootHandle();
      if (h) {
        handleRef.current = h;
        setRootName(h.name);
        setHasHandle(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watcher lifecycle
  useEffect(() => {
    if (pollTimerRef.current) { window.clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    if (batchTimerRef.current) { window.clearInterval(batchTimerRef.current); batchTimerRef.current = null; }
    if (!watching || !hasHandle) return;
    pollTimerRef.current = window.setInterval(() => performScan(true), Math.max(5, pollSeconds) * 1000);
    batchTimerRef.current = window.setInterval(() => performScan(false), Math.max(1, batchHours) * 3600 * 1000);
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      if (batchTimerRef.current) window.clearInterval(batchTimerRef.current);
    };
  }, [watching, hasHandle, pollSeconds, batchHours, performScan]);

  // Daily scheduled scan at 12:00 (auto, runs while app is open / handle available)
  useEffect(() => {
    if (!hasHandle) return;
    const tick = () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const last = localStorage.getItem(DAILY_KEY);
      if (now.getHours() >= DAILY_HOUR && last !== today) {
        localStorage.setItem(DAILY_KEY, today);
        toast.info("Monitoramento diário (12h) iniciado");
        performScan(false);
      }
    };
    tick();
    dailyTimerRef.current = window.setInterval(tick, 60 * 1000);
    return () => {
      if (dailyTimerRef.current) window.clearInterval(dailyTimerRef.current);
    };
  }, [hasHandle, performScan]);


  const pickFolder = async () => {
    try {
      // @ts-expect-error - vendor API
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: "read" });
      handleRef.current = handle;
      setRootName(handle.name);
      setHasHandle(true);
      try { await saveRootHandle(handle); } catch (err) { console.warn("saveRootHandle falhou", err); }
      filesRef.current = [];
      setFiles([]);
      toast.success(`Pasta '${handle.name}' configurada`);
      await performScan(true);
    } catch (e: any) {
      console.error("showDirectoryPicker erro:", e);
      if (e?.name === "AbortError") return;
      const inIframe = window.self !== window.top;
      if (e?.name === "SecurityError" || inIframe) {
        toast.error("Bloqueado pelo navegador no preview", {
          description:
            "A API de pastas exige uma janela de topo. Abra o app em uma aba nova (ícone ↗ no preview) ou use 'Selecionar via input' abaixo.",
        });
        fallbackInputRef.current?.click();
        return;
      }
      toast.error("Não foi possível selecionar a pasta", { description: e?.message ?? String(e) });
    }
  };

  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  const onFallbackPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const all = Array.from(list);
    const rootName = (all[0] as any).webkitRelativePath?.split("/")[0] ?? "Pasta";
    const items: { id: string; name: string; type: DocType; location: string; file: File }[] = [];
    for (const f of all) {
      const rel: string = (f as any).webkitRelativePath || f.name;
      const name = f.name;
      if (name.startsWith("~$") || name.startsWith(".~") || name.startsWith(".")) continue;
      const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;
      const parts = rel.split("/");
      const location = parts.slice(0, -1).join("/");
      items.push({ id: rel, name, type: ext as DocType, location, file: f });
    }
    setScanning(true);
    try {
      const scanned = await scanFiles(items);
      handleRef.current = null;
      filesRef.current = scanned;
      setFiles(scanned);
      setRootName(rootName);
      setHasHandle(true);
      setLastScan(Date.now());
      onDocumentsChange(toDocumentItems(scanned, rootName));
      const noDate = scanned.filter((s) => !s.reviewFound).length;
      toast.success(`Pasta '${rootName}' carregada`, {
        description: `${scanned.length} arquivo(s). ${noDate ? `${noDate} sem data identificada.` : ""} Modo somente-leitura.`,
      });
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  };

  const disconnect = async () => {
    setWatching(false);
    handleRef.current = null;
    filesRef.current = [];
    setFiles([]);
    setHasHandle(false);
    setRootName("");
    await clearRootHandle();
    onDocumentsChange(null);
    toast.success("Pasta desconectada");
  };

  const savePoll = (v: number) => { setPollSeconds(v); localStorage.setItem(POLL_KEY, String(v)); };
  const saveBatch = (v: number) => { setBatchHours(v); localStorage.setItem(BATCH_KEY, String(v)); };
  const clearLog = () => { persistEvents([]); toast.success("Log limpo"); };

  if (!supported) {
    return (
      <section className="bg-card rounded-2xl border border-warning/40 p-5">
        <div className="flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm">Acesso a pasta local não suportado</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Use Microsoft Edge ou Google Chrome em desktop para habilitar a leitura da pasta sincronizada do OneDrive
              (File System Access API). Em outros navegadores, apenas o atalho via SharePoint está disponível.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card rounded-2xl border border-border/60 shadow-[var(--shadow-card)] p-5 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <HardDrive className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">Pasta local monitorada</h3>
            <p className="text-xs text-muted-foreground">
              Selecione um diretório (ex: pasta sincronizada do OneDrive/SharePoint). Formatos suportados: .docx, .xlsx, .pptx, .pdf.
              <span className="ml-1 text-primary">Varredura automática diária às 12h. Detecta automaticamente o campo "Última Revisão".</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fallbackInputRef}
            type="file"
            // @ts-expect-error - non-standard attrs
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={onFallbackPick}
          />
          {!hasHandle ? (
            <>
              <Button onClick={pickFolder} className="gap-2"><FolderOpen className="h-4 w-4" /> Selecionar pasta</Button>
              <Button variant="outline" size="sm" onClick={() => fallbackInputRef.current?.click()}>
                Selecionar via input
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => performScan(false)} disabled={!handleRef.current || scanning}>
                <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} /> Varrer agora
              </Button>
              <Button
                variant={watching ? "secondary" : "default"}
                size="sm"
                className="gap-2"
                onClick={() => setWatching((w) => !w)}
                disabled={!handleRef.current}
              >
                {watching ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Iniciar monitor</>}
              </Button>
              <Button variant="ghost" size="sm" onClick={disconnect} className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {hasHandle && (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pasta raiz</div>
              <div className="text-sm font-medium truncate" title={rootName}>{rootName}</div>
            </div>
            <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Arquivos monitorados</div>
              <div className="text-sm font-medium tabular-nums">{files.length}</div>
            </div>
            <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Última varredura</div>
              <div className="text-sm font-medium">
                {lastScan ? new Date(lastScan).toLocaleTimeString("pt-BR") : "—"}
                {watching && <span className="ml-2 text-xs text-success">● ativo</span>}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="poll" className="text-xs">Modo tempo real — intervalo (segundos)</Label>
              <Input id="poll" type="number" min={5} max={3600} value={pollSeconds} onChange={(e) => savePoll(+e.target.value || 30)} />
              <p className="text-[11px] text-muted-foreground">Polling otimizado: detecta novos, alterados e removidos.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch" className="text-xs">Modo batch — varredura completa (horas)</Label>
              <Input id="batch" type="number" min={1} max={168} value={batchHours} onChange={(e) => saveBatch(+e.target.value || 24)} />
              <p className="text-[11px] text-muted-foreground">Garantia de consistência mesmo com aba inativa por longos períodos.</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Log de eventos</h4>
              {events.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearLog} className="text-xs h-7">Limpar</Button>
              )}
            </div>
            <div className="rounded-lg border border-border bg-background/60 max-h-56 overflow-y-auto divide-y divide-border/60">
              {events.length === 0 ? (
                <div className="text-xs text-muted-foreground px-3 py-6 text-center">Nenhum evento registrado ainda.</div>
              ) : (
                events.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                    {e.kind === "added" && <FilePlus2 className="h-3.5 w-3.5 text-success" />}
                    {e.kind === "modified" && <FileEdit className="h-3.5 w-3.5 text-warning" />}
                    {e.kind === "removed" && <FileX2 className="h-3.5 w-3.5 text-destructive" />}
                    <span className="font-medium capitalize w-20 shrink-0">{e.kind === "added" ? "novo" : e.kind === "modified" ? "alterado" : "removido"}</span>
                    <span className="truncate flex-1" title={e.path}>{e.path}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">{new Date(e.at).toLocaleTimeString("pt-BR")}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
