import { useMemo, useState } from "react";
import { FileCheck2, AlertTriangle, XCircle, HelpCircle, Search, ShieldCheck, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";
import { DocumentsTable } from "@/components/DocumentsTable";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SourceShortcut } from "@/components/SourceShortcut";
import { LocalSourcePanel } from "@/components/LocalSourcePanel";
import { DEFAULT_SETTINGS, DocStatus, DocumentItem, Settings, computeStatus } from "@/lib/documents";
import { exportCsv, exportXlsx } from "@/lib/exportReport";

const Index = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<DocStatus | "all">("all");
  const [docs, setDocs] = useState<DocumentItem[]>([]);

  const enriched = useMemo(
    () => docs.map((d) => ({ doc: d, status: computeStatus(d.lastReview, settings) })),
    [settings, docs]
  );

  const stats = useMemo(() => {
    const base = { total: enriched.length, valid: 0, warning: 0, expired: 0, uncontrolled: 0 };
    enriched.forEach((e) => { base[e.status]++; });
    return base;
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched
      .filter((e) => (tab === "all" ? true : e.status === tab))
      .filter((e) =>
        query.trim() === ""
          ? true
          : (e.doc.name + e.doc.location + e.doc.owner).toLowerCase().includes(query.toLowerCase())
      )
      .map((e) => e.doc);
  }, [enriched, tab, query]);

  return (
    <div className="min-h-screen bg-[image:var(--gradient-subtle)]">
      <header className="border-b border-border/60 bg-card/70 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[image:var(--gradient-hero)] flex items-center justify-center shadow-[var(--shadow-elegant)]">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">DocVigil</h1>
              <p className="text-xs text-muted-foreground">Gestão de validade de documentos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2" disabled={docs.length === 0}>
                  <Download className="h-4 w-4" /> Exportar Relatório
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    exportXlsx(docs, settings);
                    toast.success(`Relatório XLSX exportado (${docs.length} arquivos)`);
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    exportCsv(docs, settings);
                    toast.success(`Relatório CSV exportado (${docs.length} arquivos)`);
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" /> CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <SettingsDialog settings={settings} onChange={setSettings} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        <SourceShortcut />
        <LocalSourcePanel onDocumentsChange={(d) => setDocs(d ?? [])} />

        <section>
          <h2 className="text-2xl font-bold tracking-tight">Visão geral</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Validade calculada como <strong>data da última revisão + {settings.validityMonths} meses</strong>. Alertas
            disparados {settings.alertDays} dias antes do vencimento.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5">
            <StatCard label="Total" value={stats.total} icon={FileCheck2} tone="primary" />
            <StatCard label="Válidos" value={stats.valid} icon={FileCheck2} tone="success" />
            <StatCard label="Próximos do vencimento" value={stats.warning} icon={AlertTriangle} tone="warning" />
            <StatCard label="Vencidos" value={stats.expired} icon={XCircle} tone="destructive" />
            <StatCard label="Sem data identificada" value={stats.uncontrolled} icon={HelpCircle} tone="neutral" />
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border/60 shadow-[var(--shadow-card)] overflow-hidden">
          <div className="p-5 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as DocStatus | "all")}>
              <TabsList>
                <TabsTrigger value="all">Todos ({stats.total})</TabsTrigger>
                <TabsTrigger value="warning">Alerta ({stats.warning})</TabsTrigger>
                <TabsTrigger value="expired">Vencidos ({stats.expired})</TabsTrigger>
                <TabsTrigger value="valid">Válidos ({stats.valid})</TabsTrigger>
                <TabsTrigger value="uncontrolled">Sem data ({stats.uncontrolled})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, pasta, responsável..."
                className="pl-9"
              />
            </div>
          </div>
          {docs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Conecte uma pasta local para iniciar o monitoramento.
            </div>
          ) : (
            <DocumentsTable documents={filtered} settings={settings} />
          )}
        </section>
      </main>
    </div>
  );
};

export default Index;
