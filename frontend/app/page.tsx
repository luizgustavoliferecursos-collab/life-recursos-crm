"use client";

import { ChangeEvent, FormEvent, JSX, useEffect, useMemo, useRef, useState } from "react";

type Dashboard = {
  funcionarios: number;
  documentos: number;
  condominios: number;
  aguardando_cargo: number;
  vencidos: number;
  vencendo: number;
  recentes: any[];
  pendencias: any[];
  vencimentos: any[];
  financeiro: {a_receber: number; a_pagar: number; vencido_receita: number; vencido_despesa: number};
};

const STATUS_VALIDADE_LABEL: Record<string, string> = {
  valido: "Válido",
  vencendo: "Vencendo",
  vencido: "Vencido",
  nao_aplicavel: "—",
};

const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const CARGOS = ["ASG", "Diarista", "Guardiao", "Portaria", "Seguranca", "Staff", "Pendente"];
const TIPOS_CONTRATO = ["CLT", "Terceirizado", "Autonomo"];
const PAPEIS = ["admin", "rh", "financeiro", "operacional", "sindico"];
const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador",
  rh: "RH",
  financeiro: "Financeiro",
  operacional: "Operacional",
  sindico: "Síndico",
};
const TURNOS = ["12x36 Diurno", "12x36 Noturno", "6x1 Diurno", "6x1 Noturno", "Comercial"];
const ESCALA_STATUS_LABEL: Record<string, string> = {
  previsto: "Previsto",
  confirmado: "Confirmado",
  falta: "Falta",
  substituido: "Substituído",
};
const CATEGORIAS_DESPESA = ["Folha de pagamento", "INSS/FGTS", "Uniforme/EPI", "Fornecedor", "Outro"];
const LANCAMENTO_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
};

function formatMoney(value: any) {
  const n = Number(value);
  return isNaN(n) ? "—" : n.toLocaleString("pt-BR", {style: "currency", currency: "BRL"});
}

// "Hoje" pelo calendario local do navegador, nao UTC: Date().toISOString()
// converte pra UTC, entao entre 21h e meia-noite no Brasil (UTC-3) mostraria
// o dia seguinte por engano (escala do dia, EPI, geracao de mensalidade).
function localDateISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Segunda-feira da semana da data informada (semana sempre comeca na
// segunda, pra escala ficar organizada de forma previsivel).
function mondayOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diff = (date.getDay() + 6) % 7; // 0=domingo -> 6 dias desde a segunda anterior
  date.setDate(date.getDate() - diff);
  return localDateISO(date);
}

function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return localDateISO(date);
}

const DIA_SEMANA_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function formatDiaCurto(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DIA_SEMANA_LABEL[date.getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

const ICON_PATHS: Record<string, JSX.Element> = {
  home: <path d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />,
  bell: <path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 12 6 8ZM9.5 17.5a2.5 2.5 0 0 0 5 0" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 19c0-3 3-5.2 6.5-5.2S15.5 16 15.5 19" /><circle cx="17" cy="8.5" r="2.6" /><path d="M15.5 13.6c2.6.3 4.5 2.2 4.5 5.4" /></>,
  building: <><rect x="4" y="3" width="12" height="18" rx="1" /><path d="M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1M16 21v-8h4v8" /></>,
  "file-text": <><path d="M6 2h9l3 3v17H6z" /><path d="M9 12h6M9 16h6M9 8h3" /></>,
  shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />,
  briefcase: <><rect x="2.5" y="7" width="19" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2.5 12.5h19" /></>,
  "dollar-sign": <><path d="M12 2v20" /><path d="M17 6.5c0-1.9-2.2-3.5-5-3.5S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5" /></>,
  "bar-chart": <path d="M4 20V10M12 20V4M20 20v-7" />,
  "user-cog": <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 19c0-3 3-5.2 6.5-5.2" /><circle cx="18" cy="16" r="2.3" /><path d="M18 12.7v.9M18 18.4v.9M20.6 14.5l-.8.45M15.4 17.55l-.8.45M20.6 17.5l-.8-.45M15.4 14.45l-.8-.45" /></>,
  "log-out": <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  "alert-triangle": <><path d="M10.3 3.9 1.8 18a1 1 0 0 0 .9 1.5h18.6a1 1 0 0 0 .9-1.5L13.7 3.9a1 1 0 0 0-1.7 0Z" /><path d="M12 9v4M12 16.5h.01" /></>,
  "check-circle": <><circle cx="12" cy="12" r="9.5" /><path d="M8 12.5l2.5 2.5 5.5-6" /></>,
  "x-circle": <><circle cx="12" cy="12" r="9.5" /><path d="M9 9l6 6M15 9l-6 6" /></>,
};

function Icon({name, size = 18}: {name: string; size?: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name] || null}
    </svg>
  );
}

function ToastStack({toasts, onDismiss}: {toasts: {id: number; type: "success" | "error"; message: string}[]; onDismiss: (id: number) => void}) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={"toast " + t.type}>
          <Icon name={t.type === "error" ? "x-circle" : "check-circle"} size={16} />
          <span>{t.message}</span>
          <button onClick={() => onDismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({dialog, value, onChange, onClose}: {
  dialog: {type: "confirm" | "prompt"; title: string; message?: string; danger?: boolean} | null;
  value: string;
  onChange: (v: string) => void;
  onClose: (result: any) => void;
}) {
  if (!dialog) return null;
  return (
    <div className="modal-backdrop" onClick={() => onClose(dialog.type === "confirm" ? false : null)}>
      <div className="modal-card modal-small confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className={"confirm-icon" + (dialog.danger ? " danger" : "")}><Icon name="alert-triangle" size={22} /></div>
        <h3>{dialog.title}</h3>
        {dialog.message && <p>{dialog.message}</p>}
        {dialog.type === "prompt" && (
          <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder="Opcional" autoFocus />
        )}
        <div className="modal-actions">
          <button className="link-btn" onClick={() => onClose(dialog.type === "confirm" ? false : null)}>Cancelar</button>
          <button
            className={dialog.danger ? "btn-danger" : "primary"}
            onClick={() => onClose(dialog.type === "confirm" ? true : value)}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadCsv(filename: string, rows: any[], columns: {key: string; label: string}[]) {
  const header = columns.map(c => c.label).join(";");
  const lines = rows.map(row => columns.map(c => {
    const value = row[c.key];
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }).join(";"));
  const csv = [header, ...lines].join("\n");
  const blob = new Blob(["﻿" + csv], {type: "text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPLOYEE_FORM_FIELDS: {key: string; label: string; type?: string; kind?: "select" | "textarea" | "datalist"; options?: string[]}[] = [
  {key: "nome", label: "Nome completo"},
  {key: "cargo", label: "Cargo", kind: "select", options: CARGOS},
  {key: "condominio", label: "Condomínio", kind: "datalist"},
  {key: "cpf", label: "CPF"},
  {key: "rg", label: "RG"},
  {key: "data_nascimento", label: "Data de nascimento", type: "date"},
  {key: "telefone", label: "Telefone"},
  {key: "endereco", label: "Endereço", kind: "textarea"},
  {key: "contato_emergencia_nome", label: "Contato de emergência (nome)"},
  {key: "contato_emergencia_telefone", label: "Contato de emergência (telefone)"},
  {key: "tipo_contrato", label: "Tipo de contrato", kind: "select", options: TIPOS_CONTRATO},
  {key: "salario_base", label: "Salário base (R$)", type: "number"},
  {key: "data_admissao", label: "Data de admissão", type: "date"},
  {key: "banco", label: "Banco"},
  {key: "agencia", label: "Agência"},
  {key: "conta", label: "Conta"},
  {key: "chave_pix", label: "Chave PIX"},
];

const CONDOMINIO_FORM_FIELDS: {key: string; label: string; kind?: "select" | "textarea"; options?: string[]}[] = [
  {key: "nome", label: "Nome"},
  {key: "cnpj", label: "CNPJ"},
  {key: "cidade", label: "Cidade"},
  {key: "endereco", label: "Endereço", kind: "textarea"},
  {key: "sindico_nome", label: "Síndico (nome)"},
  {key: "sindico_telefone", label: "Síndico (telefone)"},
  {key: "sindico_email", label: "Síndico (e-mail)"},
  {key: "administradora", label: "Administradora"},
];

async function api(path: string, init?: RequestInit) {
  if (!API || API.includes("URL_DO_BACKEND")) throw new Error("NEXT_PUBLIC_API_URL ainda não configurada.");
  const response = await fetch(API + path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Falha na comunicação com o backend.");
  return data;
}

export default function Home() {
  const [tab, setTab] = useState("visao");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [condominios, setCondominios] = useState<any[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<any>(null);
  const [drive, setDrive] = useState<any>(null);
  const [employeeModal, setEmployeeModal] = useState<{mode: "create" | "edit"; employee: any} | null>(null);
  const [dismissModal, setDismissModal] = useState<any | null>(null);
  const [condominioModal, setCondominioModal] = useState<{mode: "create" | "edit"; condominio: any} | null>(null);
  const [me, setMe] = useState<{nome: string; papel: string; condominio_id: string | null} | null>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [usuarioModal, setUsuarioModal] = useState<{mode: "create" | "edit"; usuario: any} | null>(null);
  const [contratos, setContratos] = useState<any[]>([]);
  const [contratoModal, setContratoModal] = useState<{mode: "create" | "edit"; contrato: any} | null>(null);
  const [postos, setPostos] = useState<any[]>([]);
  const [postoModal, setPostoModal] = useState<{mode: "create" | "edit"; posto: any} | null>(null);
  const [semanaInicio, setSemanaInicio] = useState(() => mondayOf(localDateISO()));
  const [escalaGrid, setEscalaGrid] = useState<{datas: string[]; items: any[]}>({datas: [], items: []});
  const [escalaCell, setEscalaCell] = useState<{posto: any; dia: string; escala: any} | null>(null);
  const [gerarEscalaModal, setGerarEscalaModal] = useState<any | null>(null);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [lancamentoFiltro, setLancamentoFiltro] = useState("");
  const [lancamentoModal, setLancamentoModal] = useState<{mode: "create" | "edit"; lancamento: any} | null>(null);
  const [epis, setEpis] = useState<any[]>([]);
  const [epiModal, setEpiModal] = useState<{mode: "create" | "edit"; epi: any} | null>(null);
  const [alertas, setAlertas] = useState<any>({total: 0, vencidos: 0, vencendo: 0, items: []});
  const [relatorios, setRelatorios] = useState<any>({faturamento_por_condominio: [], turnover: {}, absenteismo: {}});
  const [toasts, setToasts] = useState<{id: number; type: "success" | "error"; message: string}[]>([]);
  const [dialog, setDialog] = useState<{type: "confirm" | "prompt"; title: string; message?: string; danger?: boolean} | null>(null);
  const [dialogValue, setDialogValue] = useState("");
  const dialogResolver = useRef<((v: any) => void) | null>(null);

  function pushToast(message: string, type: "success" | "error" = "success") {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, {id, type, message}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }

  function askConfirm(title: string, opts?: {message?: string; danger?: boolean}): Promise<boolean> {
    setDialog({type: "confirm", title, message: opts?.message, danger: opts?.danger});
    return new Promise(resolve => { dialogResolver.current = resolve; });
  }

  function askPrompt(title: string, message?: string): Promise<string | null> {
    setDialogValue("");
    setDialog({type: "prompt", title, message});
    return new Promise(resolve => { dialogResolver.current = resolve; });
  }

  function closeDialog(result: any) {
    setDialog(null);
    dialogResolver.current?.(result);
    dialogResolver.current = null;
  }

  async function refresh() {
    setError("");
    try {
      const [d, f, docs, condos, h, ds, c, p] = await Promise.all([
        api("/api/dashboard"),
        api("/api/funcionarios"),
        api("/api/documentos?limit=200"),
        api("/api/condominios"),
        api("/health"),
        api("/api/drive/status"),
        api("/api/contratos"),
        api("/api/postos-trabalho"),
      ]);
      setDashboard(d);
      setFuncionarios(f.items || []);
      setDocumentos(docs.items || []);
      setCondominios(condos.items || []);
      setHealth(h);
      setDrive(ds);
      setContratos(c.items || []);
      setPostos(p.items || []);
      await Promise.all([loadFinanceiro(), loadEpis(), loadAlertas(), loadRelatorios()]);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar dados.");
    }
  }

  async function loadFinanceiro() {
    try {
      const r = await api("/api/financeiro" + (lancamentoFiltro ? `?status=${lancamentoFiltro}` : ""));
      setLancamentos(r.items || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar financeiro.");
    }
  }

  async function loadEpis() {
    try {
      const r = await api("/api/epis");
      setEpis(r.items || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar EPIs.");
    }
  }

  async function loadAlertas() {
    try {
      const r = await api("/api/notificacoes");
      setAlertas(r);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar alertas.");
    }
  }

  async function loadRelatorios() {
    try {
      const r = await api("/api/relatorios");
      setRelatorios(r);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar relatórios.");
    }
  }

  async function loadUsuarios() {
    try {
      const u = await api("/api/usuarios");
      setUsuarios(u.items || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar usuários.");
    }
  }

  async function loadEscalas(inicioSemana: string) {
    try {
      const r = await api(`/api/escalas?data=${inicioSemana}&dias=7`);
      setEscalaGrid({datas: r.datas || [], items: r.items || []});
    } catch (e: any) {
      setError(e.message || "Erro ao carregar escalas.");
    }
  }

  useEffect(() => {
    refresh();
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => { loadEscalas(semanaInicio); }, [semanaInicio]);
  useEffect(() => { loadFinanceiro(); }, [lancamentoFiltro]);

  useEffect(() => {
    if (me?.papel === "admin") loadUsuarios();
  }, [me?.papel]);

  const filteredEmployees = useMemo(() => funcionarios.filter(item =>
    JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
  ), [funcionarios, query]);

  const filteredDocuments = useMemo(() => documentos.filter(item =>
    JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
  ), [documentos, query]);

  const filteredCondos = useMemo(() => condominios.filter(item =>
    JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
  ), [condominios, query]);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []).filter(file =>
      ["application/pdf", "image/jpeg", "image/png"].includes(file.type)
    );
    setFiles(selected);
    setResults([]);
  }

  async function processFiles() {
    if (!files.length) return;
    setProcessing(true);
    setProgress(10);
    setError("");
    const form = new FormData();
    files.forEach(file => form.append("files", file));
    const timer = window.setInterval(() => setProgress(p => p < 85 ? p + 5 : p), 450);
    try {
      const payload = await api("/api/documentos/processar", {method: "POST", body: form});
      setResults(payload.resultados || []);
      setProgress(100);
      await refresh();
    } catch (e: any) {
      setError(e.message || "Erro ao processar.");
    } finally {
      window.clearInterval(timer);
      setProcessing(false);
    }
  }

  async function saveEmployee(data: Record<string, any>) {
    const mode = employeeModal?.mode;
    const id = employeeModal?.employee?.id;
    const clean: Record<string, any> = {};
    for (const field of EMPLOYEE_FORM_FIELDS) {
      const value = data[field.key];
      if (value === undefined || value === "") continue;
      clean[field.key] = field.type === "number" ? Number(value) : value;
    }
    if (mode === "edit" && id) {
      await api(`/api/funcionarios/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(clean),
      });
    } else {
      await api("/api/funcionarios", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(clean),
      });
    }
    setEmployeeModal(null);
    pushToast(mode === "edit" ? "Funcionário atualizado." : "Funcionário cadastrado.");
    await refresh();
  }

  async function submitDismiss(motivo: string) {
    if (!dismissModal) return;
    const isInactive = dismissModal.status === "inativo";
    if (isInactive) {
      await api(`/api/funcionarios/${dismissModal.id}/reativar`, {method: "POST"});
    } else {
      await api(`/api/funcionarios/${dismissModal.id}/desligar`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({motivo: motivo || null}),
      });
    }
    setDismissModal(null);
    pushToast(isInactive ? "Funcionário reativado." : "Funcionário desligado.");
    await refresh();
  }

  async function saveCondominio(data: Record<string, any>) {
    const mode = condominioModal?.mode;
    const id = condominioModal?.condominio?.id;
    const clean: Record<string, any> = {};
    for (const field of CONDOMINIO_FORM_FIELDS) {
      const value = data[field.key];
      if (value === undefined || value === "") continue;
      clean[field.key] = value;
    }
    if (mode === "edit" && id) {
      await api(`/api/condominios/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(clean),
      });
    } else {
      await api("/api/condominios", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(clean),
      });
    }
    setCondominioModal(null);
    pushToast(mode === "edit" ? "Condomínio atualizado." : "Condomínio cadastrado.");
    await refresh();
  }

  async function toggleCondominioStatus(row: any) {
    const next = row.status === "inativo" ? "ativo" : "inativo";
    const action = next === "inativo" ? "inativar" : "reativar";
    const ok = await askConfirm(`Confirma ${action} o condomínio?`, {message: `"${row.nome}" será ${action === "inativar" ? "marcado como inativo" : "reativado"}.`, danger: action === "inativar"});
    if (!ok) return;
    try {
      await api(`/api/condominios/${row.id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({status: next}),
      });
      pushToast(`Condomínio ${action === "inativar" ? "inativado" : "reativado"}.`);
      await refresh();
    } catch (e: any) {
      setError(e.message || "Erro ao atualizar condomínio.");
      pushToast("Erro ao atualizar condomínio.", "error");
    }
  }

  async function saveUsuario(data: Record<string, any>) {
    const mode = usuarioModal?.mode;
    const id = usuarioModal?.usuario?.id;
    const payload: Record<string, any> = {
      nome: data.nome,
      papel: data.papel,
      condominio_id: data.papel === "sindico" ? (data.condominio_id || null) : null,
    };
    if (data.senha) payload.senha = data.senha;
    if (mode === "edit" && id) {
      await api(`/api/usuarios/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/usuarios", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({...payload, login: data.login, senha: data.senha, ativo: true}),
      });
    }
    setUsuarioModal(null);
    pushToast(mode === "edit" ? "Usuário atualizado." : "Usuário criado.");
    await loadUsuarios();
  }

  async function toggleUsuarioAtivo(row: any) {
    const next = !row.ativo;
    const ok = await askConfirm(`Confirma ${next ? "reativar" : "desativar"} o usuário?`, {message: `"${row.nome}" ${next ? "volta a ter acesso" : "perde o acesso"} ao sistema.`, danger: !next});
    if (!ok) return;
    try {
      await api(`/api/usuarios/${row.id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ativo: next}),
      });
      pushToast(`Usuário ${next ? "reativado" : "desativado"}.`);
      await loadUsuarios();
    } catch (e: any) {
      setError(e.message || "Erro ao atualizar usuário.");
      pushToast("Erro ao atualizar usuário.", "error");
    }
  }

  async function saveContrato(data: Record<string, any>) {
    const mode = contratoModal?.mode;
    const id = contratoModal?.contrato?.id;
    const clean: Record<string, any> = {};
    for (const key of ["condominio_id", "objeto", "valor_mensal", "indice_reajuste", "data_inicio", "data_fim", "data_renovacao", "status"]) {
      const value = data[key];
      if (value === undefined || value === "") continue;
      clean[key] = key === "valor_mensal" ? Number(value) : value;
    }
    if (mode === "edit" && id) {
      delete clean.condominio_id;
      await api(`/api/contratos/${id}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    } else {
      await api("/api/contratos", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    }
    setContratoModal(null);
    pushToast(mode === "edit" ? "Contrato atualizado." : "Contrato cadastrado.");
    await refresh();
  }

  async function savePosto(data: Record<string, any>) {
    const mode = postoModal?.mode;
    const id = postoModal?.posto?.id;
    const clean: Record<string, any> = {};
    for (const key of ["condominio_id", "nome", "cargo", "turno", "carga_horaria_semanal", "status"]) {
      const value = data[key];
      if (value === undefined || value === "") continue;
      clean[key] = key === "carga_horaria_semanal" ? Number(value) : value;
    }
    if (mode === "edit" && id) {
      delete clean.condominio_id;
      await api(`/api/postos-trabalho/${id}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    } else {
      await api("/api/postos-trabalho", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    }
    setPostoModal(null);
    pushToast(mode === "edit" ? "Posto atualizado." : "Posto cadastrado.");
    await refresh();
  }

  async function atribuirEscala(postoId: string, dia: string, funcionarioId: string) {
    try {
      const resultado = await api("/api/escalas", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({posto_id: postoId, data: dia, funcionario_id: funcionarioId || null}),
      });
      if (resultado.aviso) pushToast(resultado.aviso, "error");
      else pushToast(funcionarioId ? "Escala atribuída." : "Posto marcado como vago.");
      await loadEscalas(semanaInicio);
    } catch (e: any) {
      setError(e.message || "Erro ao atribuir escala.");
      pushToast("Erro ao atribuir escala.", "error");
    }
  }

  async function marcarFalta(escalaId: string) {
    const motivo = await askPrompt("Marcar falta", "Motivo da falta (opcional).");
    if (motivo === null) return;
    try {
      await api(`/api/escalas/${escalaId}/falta`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({motivo: motivo || null}),
      });
      pushToast("Falta registrada.");
      await loadEscalas(semanaInicio);
    } catch (e: any) {
      setError(e.message || "Erro ao marcar falta.");
      pushToast("Erro ao marcar falta.", "error");
    }
  }

  async function substituirEscala(escalaId: string, substitutoId: string) {
    if (!substitutoId) return;
    try {
      await api(`/api/escalas/${escalaId}/substituir`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({substituto_id: substitutoId}),
      });
      pushToast("Substituição registrada.");
      await loadEscalas(semanaInicio);
    } catch (e: any) {
      setError(e.message || "Erro ao substituir.");
      pushToast("Erro ao substituir.", "error");
    }
  }

  async function gerarEscalaAutomatica(data: {posto_id: string; funcionario_id: string; data_inicio: string; dias: number}) {
    const r = await api("/api/escalas/gerar-recorrencia", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data),
    });
    pushToast(`${r.criados} dia(s) de escala gerado(s) automaticamente${r.ja_ocupados ? ` · ${r.ja_ocupados} já tinham escala e não foram alterados` : ""}.`);
    setGerarEscalaModal(null);
    await loadEscalas(semanaInicio);
  }

  async function saveLancamento(data: Record<string, any>) {
    const mode = lancamentoModal?.mode;
    const id = lancamentoModal?.lancamento?.id;
    const clean: Record<string, any> = {};
    for (const key of ["tipo", "condominio_id", "funcionario_id", "categoria", "descricao", "valor", "vencimento", "origem"]) {
      const value = data[key];
      if (value === undefined || value === "") continue;
      clean[key] = key === "valor" ? Number(value) : value;
    }
    if (mode === "edit" && id) {
      delete clean.tipo;
      await api(`/api/financeiro/${id}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    } else {
      await api("/api/financeiro", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    }
    setLancamentoModal(null);
    pushToast(mode === "edit" ? "Lançamento atualizado." : "Lançamento criado.");
    await refresh();
  }

  async function marcarPago(id: string) {
    const ok = await askConfirm("Marcar como pago?", {message: "O lançamento será marcado como pago hoje."});
    if (!ok) return;
    try {
      await api(`/api/financeiro/${id}/pagar`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({})});
      pushToast("Lançamento marcado como pago.");
      await loadFinanceiro();
      await refresh();
    } catch (e: any) {
      setError(e.message || "Erro ao marcar pagamento.");
      pushToast("Erro ao marcar pagamento.", "error");
    }
  }

  async function gerarMensalidades() {
    const mes = localDateISO().slice(0, 7);
    const ok = await askConfirm("Gerar cobranças do mês?", {message: `Cria uma cobrança de mensalidade para cada contrato ativo com valor definido, referente a ${mes}.`});
    if (!ok) return;
    try {
      const r = await api("/api/financeiro/gerar-mensalidades", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({mes}),
      });
      pushToast(`${r.criados} cobrança(s) gerada(s) · ${r.ja_existentes} já existiam${r.ignorados_sem_valor ? ` · ${r.ignorados_sem_valor} sem valor mensal` : ""}.`);
      await loadFinanceiro();
      await refresh();
    } catch (e: any) {
      setError(e.message || "Erro ao gerar mensalidades.");
      pushToast("Erro ao gerar mensalidades.", "error");
    }
  }

  async function saveEpi(data: Record<string, any>) {
    const mode = epiModal?.mode;
    const id = epiModal?.epi?.id;
    const clean: Record<string, any> = {};
    for (const key of ["funcionario_id", "item", "data_entrega", "data_validade", "termo_assinado_url", "observacao"]) {
      const value = data[key];
      if (value === undefined || value === "") continue;
      clean[key] = value;
    }
    if (mode === "edit" && id) {
      delete clean.funcionario_id;
      await api(`/api/epis/${id}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    } else {
      await api("/api/epis", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    }
    setEpiModal(null);
    pushToast(mode === "edit" ? "EPI atualizado." : "EPI registrado.");
    await loadEpis();
    await loadAlertas();
  }

  async function logout() {
    await fetch("/api/auth/logout", {method: "POST"});
    window.location.href = "/login";
  }

  const isSindico = me?.papel === "sindico";
  const navSections: {label: string; items: [string, string, string][]}[] = isSindico ? [
    {label: "", items: [["meu-condominio", "Meu condomínio", "building"]]},
  ] : [
    {label: "Operação", items: [
      ["visao", "Visão geral", "home"],
      ["alertas", "Alertas", "bell"],
      ["postos", "Postos & Escalas", "calendar"],
      ["processar", "Processar documentos", "upload"],
    ]},
    {label: "Cadastros", items: [
      ["funcionarios", "Funcionários", "users"],
      ["condominios", "Condomínios", "building"],
      ["documentos", "Documentos", "file-text"],
      ["epis", "EPIs", "shield"],
    ]},
    {label: "Negócios", items: [
      ["contratos", "Contratos", "briefcase"],
      ["financeiro", "Financeiro", "dollar-sign"],
      ["relatorios", "Relatórios", "bar-chart"],
    ]},
    ...(me?.papel === "admin" ? [{label: "Sistema", items: [["usuarios", "Usuários", "user-cog"]] as [string, string, string][]}] : []),
  ];
  const tabs = navSections.flatMap(s => s.items);

  useEffect(() => {
    if (isSindico && tab !== "meu-condominio") setTab("meu-condominio");
  }, [isSindico]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">LR</span><div><b>LIFE RECURSOS</b><small>Central de operações</small></div></div>
        <div className="nav-scroll">
          {navSections.map(sec => (
            <div className="nav-section" key={sec.label || "root"}>
              {sec.label && <div className="nav-section-label">{sec.label}</div>}
              <nav>
                {sec.items.map(([key, label, icon]) => (
                  <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
                    <Icon name={icon} size={17} />
                    <span>{label}</span>
                    {key === "alertas" && alertas.total > 0 && <span className="nav-badge">{alertas.total}</span>}
                  </button>
                ))}
              </nav>
            </div>
          ))}
        </div>
        <div className="sidebar-foot">
          <span className={"dot " + (health?.status === "ok" ? "online" : "")}></span>
          <span className="who">{me?.nome ? `${me.nome} · ${PAPEL_LABEL[me.papel] || me.papel}` : (health?.status === "ok" ? "Backend online" : "Backend indisponível")}</span>
          <button onClick={logout}><Icon name="log-out" size={14} /> Sair</button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div><p className="eyebrow">GESTÃO</p><h1>{tabs.find(t => t[0] === tab)?.[1]}</h1></div>
          <input className="search" placeholder="Buscar no sistema" value={query} onChange={e => setQuery(e.target.value)} />
        </header>

        {error && <div className="alert error">{error}</div>}

        {tab === "visao" && (
          <>
            <section className="hero"><div><p className="eyebrow">BASE DO CRM</p><h2>Documentos organizados. Operação pronta para crescer.</h2><p>Acompanhe funcionários, documentos e condomínios em uma única visão.</p></div><button className="primary" onClick={() => setTab("processar")}>Processar documentos</button></section>
            <section className="stats">
              <article><div className="stat-icon"><Icon name="users" size={16} /></div><span>Funcionários</span><strong>{dashboard?.funcionarios ?? "—"}</strong><small>{dashboard?.aguardando_cargo ?? 0} aguardando cargo</small></article>
              <article><div className="stat-icon"><Icon name="file-text" size={16} /></div><span>Documentos</span><strong>{dashboard?.documentos ?? "—"}</strong><small>Registrados no CRM</small></article>
              <article><div className="stat-icon"><Icon name="building" size={16} /></div><span>Condomínios</span><strong>{dashboard?.condominios ?? "—"}</strong><small>Identificados na base</small></article>
              <article><div className="stat-icon"><Icon name="upload" size={16} /></div><span>Fluxo</span><strong>{drive?.status === "ok" ? "OK" : "—"}</strong><small>Claude → Drive → Supabase</small></article>
              <article className={(dashboard?.vencidos ?? 0) > 0 ? "alert-stat" : undefined}><div className="stat-icon"><Icon name="bell" size={16} /></div><span>Vencimentos</span><strong>{(dashboard?.vencidos ?? 0) + (dashboard?.vencendo ?? 0)}</strong><small>{dashboard?.vencidos ?? 0} vencidos · {dashboard?.vencendo ?? 0} vencendo em 30 dias</small></article>
              <article><div className="stat-icon"><Icon name="dollar-sign" size={16} /></div><span>A receber</span><strong>{formatMoney(dashboard?.financeiro?.a_receber ?? 0)}</strong><small>Pendente + atrasado</small></article>
              <article className={(dashboard?.financeiro?.vencido_receita ?? 0) + (dashboard?.financeiro?.vencido_despesa ?? 0) > 0 ? "alert-stat" : undefined}><div className="stat-icon"><Icon name="dollar-sign" size={16} /></div><span>A pagar</span><strong>{formatMoney(dashboard?.financeiro?.a_pagar ?? 0)}</strong><small>{formatMoney((dashboard?.financeiro?.vencido_receita ?? 0) + (dashboard?.financeiro?.vencido_despesa ?? 0))} em atraso</small></article>
            </section>
            <section className="grid-two">
              <div className="panel"><div className="panel-head"><h3>Documentos recentes</h3><span>Últimos itens</span></div><DataTable rows={dashboard?.recentes || []} type="docs" /></div>
              <div className="panel"><div className="panel-head"><h3>Pendências</h3><span>Aguardando cargo</span></div><DataTable rows={dashboard?.pendencias || []} type="employees" /></div>
            </section>
            {!!dashboard?.vencimentos?.length && (
              <section className="panel">
                <div className="panel-head"><h3>Documentos vencidos ou vencendo</h3><span>Próximos 30 dias</span></div>
                <DataTable rows={dashboard.vencimentos} type="docs" />
              </section>
            )}
          </>
        )}

        {tab === "processar" && (
          <section className="panel upload-panel">
            <div className="panel-head"><div><h3>Enviar documentos</h3><span>PDF, JPG e PNG • múltiplos arquivos</span></div></div>
            <label className="dropzone">
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={chooseFiles} />
              <b>Selecione ou arraste arquivos</b>
              <span>{files.length ? files.map(f => f.name).join(" • ") : "Nenhum arquivo selecionado"}</span>
            </label>
            {processing && <div className="progress"><div style={{width: progress + "%"}}></div></div>}
            <button className="primary" disabled={!files.length || processing} onClick={processFiles}>{processing ? "Processando..." : "Processar documentos"}</button>
            {!!results.length && <div className="results">{results.map((r, i) => <article key={i} className={"result " + r.status}><div><b>{r.arquivo_original}</b><span>{r.status}</span></div><p>{r.mensagem || [r.funcionario, r.documento, r.condominio, r.cargo, r.ano].filter(Boolean).join(" • ")}</p>{r.arquivo_drive_url && <a href={r.arquivo_drive_url} target="_blank">Abrir no Drive</a>}</article>)}</div>}
          </section>
        )}

        {tab === "funcionarios" && (
          <section className="panel">
            <div className="panel-head">
              <div><h3>Funcionários</h3><span>{filteredEmployees.length} registros</span></div>
              <button className="primary" onClick={() => setEmployeeModal({mode: "create", employee: {}})}>Novo funcionário</button>
            </div>
            <DataTable
              rows={filteredEmployees}
              type="employees"
              onEdit={(row) => setEmployeeModal({mode: "edit", employee: row})}
              onToggleStatus={(row) => setDismissModal(row)}
            />
          </section>
        )}
        {tab === "documentos" && <section className="panel"><div className="panel-head"><h3>Documentos</h3><span>{filteredDocuments.length} registros</span></div><DataTable rows={filteredDocuments} type="docs" /></section>}
        {tab === "condominios" && (
          <section className="panel">
            <div className="panel-head">
              <div><h3>Condomínios</h3><span>{filteredCondos.length} identificados</span></div>
              <button className="primary" onClick={() => setCondominioModal({mode: "create", condominio: {}})}>Novo condomínio</button>
            </div>
            <DataTable
              rows={filteredCondos}
              type="condos"
              onEdit={(row) => setCondominioModal({mode: "edit", condominio: row})}
              onToggleStatus={toggleCondominioStatus}
            />
          </section>
        )}
        {tab === "contratos" && (
          <section className="panel">
            <div className="panel-head">
              <div><h3>Contratos</h3><span>{contratos.length} registros</span></div>
              <button className="primary" onClick={() => setContratoModal({mode: "create", contrato: {}})}>Novo contrato</button>
            </div>
            {!contratos.length ? <div className="empty">Nenhum contrato cadastrado.</div> : (
              <div className="table-wrap"><table><thead><tr><th>Condomínio</th><th>Objeto</th><th>Valor mensal</th><th>Vigência</th><th>Status</th><th>Ações</th></tr></thead><tbody>
                {contratos.map(c => <tr key={c.id}>
                  <td>{c.condominios?.nome || "—"}</td>
                  <td>{c.objeto || "—"}</td>
                  <td>{c.valor_mensal ? `R$ ${Number(c.valor_mensal).toLocaleString("pt-BR", {minimumFractionDigits: 2})}` : "—"}</td>
                  <td>{[c.data_inicio, c.data_fim].filter(Boolean).join(" → ") || "—"}</td>
                  <td><span className={"badge " + (c.status === "encerrado" ? "warn" : "")}>{c.status === "encerrado" ? "Encerrado" : "Ativo"}</span></td>
                  <td className="row-actions"><button className="link-btn" onClick={() => setContratoModal({mode: "edit", contrato: c})}>Editar</button></td>
                </tr>)}
              </tbody></table></div>
            )}
          </section>
        )}
        {tab === "postos" && (
          <>
            <section className="panel">
              <div className="panel-head">
                <div><h3>Postos de trabalho</h3><span>{postos.length} cadastrados</span></div>
                <button className="primary" onClick={() => setPostoModal({mode: "create", posto: {}})}>Novo posto</button>
              </div>
              {!postos.length ? <div className="empty">Nenhum posto cadastrado.</div> : (
                <div className="table-wrap"><table><thead><tr><th>Posto</th><th>Condomínio</th><th>Cargo</th><th>Turno</th><th>Status</th><th>Ações</th></tr></thead><tbody>
                  {postos.map(p => <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.condominios?.nome || "—"}</td>
                    <td>{p.cargo}</td>
                    <td>{p.turno || "—"}</td>
                    <td><span className={"badge " + (p.status === "inativo" ? "warn" : "")}>{p.status === "inativo" ? "Inativo" : "Ativo"}</span></td>
                    <td className="row-actions"><button className="link-btn" onClick={() => setPostoModal({mode: "edit", posto: p})}>Editar</button></td>
                  </tr>)}
                </tbody></table></div>
              )}
            </section>
            <section className="panel">
              <div className="panel-head">
                <div><h3>Escala da semana</h3><span>{formatDiaCurto(semanaInicio)} – {escalaGrid.datas.length ? formatDiaCurto(escalaGrid.datas[escalaGrid.datas.length - 1]) : ""}</span></div>
                <div className="row-actions">
                  <button onClick={() => setSemanaInicio(addDaysISO(semanaInicio, -7))}>← Anterior</button>
                  <button onClick={() => setSemanaInicio(mondayOf(localDateISO()))}>Esta semana</button>
                  <button onClick={() => setSemanaInicio(addDaysISO(semanaInicio, 7))}>Próxima →</button>
                </div>
              </div>
              {!escalaGrid.items.length ? <div className="empty">Nenhum posto ativo cadastrado.</div> : (
                <div className="table-wrap"><table className="escala-grid"><thead><tr>
                  <th>Posto</th>
                  {escalaGrid.datas.map(dia => <th key={dia}>{formatDiaCurto(dia)}</th>)}
                  <th>Automação</th>
                </tr></thead><tbody>
                  {escalaGrid.items.map(({posto, escalas_por_dia}: any) => (
                    <tr key={posto.id}>
                      <td><b>{posto.nome}</b><br /><small className="muted">{posto.condominios?.nome}{posto.turno ? ` · ${posto.turno}` : ""}</small></td>
                      {escalaGrid.datas.map((dia: string) => {
                        const escala = escalas_por_dia[dia];
                        const estado = escala?.status === "falta" ? "cell-danger" : escala?.status === "substituido" ? "cell-warn" : escala?.funcionario_id ? "cell-ok" : "cell-vago";
                        return (
                          <td key={dia}>
                            <button className={"escala-cell " + estado} onClick={() => setEscalaCell({posto, dia, escala})}>
                              {escala?.funcionario?.nome ? escala.funcionario.nome.split(" ")[0] : "Vago"}
                            </button>
                          </td>
                        );
                      })}
                      <td className="row-actions"><button className="link-btn" onClick={() => setGerarEscalaModal(posto)}>Gerar automático</button></td>
                    </tr>
                  ))}
                </tbody></table></div>
              )}
            </section>
          </>
        )}
        {tab === "financeiro" && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Financeiro</h3>
                <span>{lancamentos.length} lançamentos</span>
              </div>
              <div className="row-actions">
                <select value={lancamentoFiltro} onChange={e => setLancamentoFiltro(e.target.value)}>
                  <option value="">Todos os status</option>
                  <option value="pendente">Pendente</option>
                  <option value="atrasado">Atrasado</option>
                  <option value="pago">Pago</option>
                </select>
                <button onClick={gerarMensalidades}>Gerar cobranças do mês</button>
                <button className="primary" onClick={() => setLancamentoModal({mode: "create", lancamento: {}})}>Novo lançamento</button>
              </div>
            </div>
            {!lancamentos.length ? <div className="empty">Nenhum lançamento encontrado.</div> : (
              <div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Condomínio/Funcionário</th><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>
                {lancamentos.map((l: any) => <tr key={l.id}>
                  <td><span className={"badge " + (l.tipo === "despesa" ? "warn" : "")}>{l.tipo === "receita" ? "Receita" : "Despesa"}</span></td>
                  <td>{l.condominios?.nome || l.funcionarios?.nome || "—"}</td>
                  <td>{l.categoria || l.descricao || "—"}</td>
                  <td>{formatMoney(l.valor)}</td>
                  <td>{l.vencimento || "—"}</td>
                  <td><span className={"badge " + (l.status_calculado === "atrasado" ? "danger" : l.status_calculado === "pago" ? "" : "warn")}>{LANCAMENTO_STATUS_LABEL[l.status_calculado] || l.status_calculado}</span></td>
                  <td className="row-actions">
                    <button className="link-btn" onClick={() => setLancamentoModal({mode: "edit", lancamento: l})}>Editar</button>
                    {l.status_calculado !== "pago" && <button className="link-btn" onClick={() => marcarPago(l.id)}>Marcar pago</button>}
                  </td>
                </tr>)}
              </tbody></table></div>
            )}
          </section>
        )}
        {tab === "epis" && (
          <section className="panel">
            <div className="panel-head">
              <div><h3>EPIs entregues</h3><span>{epis.length} registros</span></div>
              <button className="primary" onClick={() => setEpiModal({mode: "create", epi: {}})}>Novo registro</button>
            </div>
            {!epis.length ? <div className="empty">Nenhum EPI registrado.</div> : (
              <div className="table-wrap"><table><thead><tr><th>Funcionário</th><th>Item</th><th>Entrega</th><th>Validade</th><th>Status</th><th>Ações</th></tr></thead><tbody>
                {epis.map((e: any) => <tr key={e.id}>
                  <td>{e.funcionarios?.nome || "—"}</td>
                  <td>{e.item}</td>
                  <td>{e.data_entrega || "—"}</td>
                  <td>{e.data_validade || "—"}</td>
                  <td><span className={"badge " + (e.status_validade === "vencido" ? "danger" : e.status_validade === "vencendo" ? "warn" : "")}>{STATUS_VALIDADE_LABEL[e.status_validade] || "—"}</span></td>
                  <td className="row-actions"><button className="link-btn" onClick={() => setEpiModal({mode: "edit", epi: e})}>Editar</button></td>
                </tr>)}
              </tbody></table></div>
            )}
          </section>
        )}
        {tab === "alertas" && (
          <section className="panel">
            <div className="panel-head">
              <div><h3>Central de alertas</h3><span>{alertas.vencidos} vencidos · {alertas.vencendo} vencendo em 30 dias</span></div>
            </div>
            <p className="muted" style={{margin: "0 0 14px"}}>Alertas gerados dentro do app (documentos, EPIs, contratos e financeiro). Envio automático por e-mail/WhatsApp ainda não está configurado.</p>
            {!alertas.items.length ? <div className="empty">Nenhum alerta no momento.</div> : (
              <div className="results">
                {alertas.items.map((a: any, i: number) => (
                  <article key={i} className={"result " + (a.urgencia === "vencido" ? "erro" : "duplicado")}>
                    <div><b>{a.titulo}</b><span>{a.tipo}</span></div>
                    <p>{a.detalhe}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {tab === "relatorios" && (
          <>
            <section className="stats">
              <article><span>Turnover (90 dias)</span><strong>{relatorios.turnover?.taxa_pct ?? 0}%</strong><small>{relatorios.turnover?.desligados_periodo ?? 0} desligados · {relatorios.turnover?.ativos ?? 0} ativos</small></article>
              <article><span>Absenteísmo (30 dias)</span><strong>{relatorios.absenteismo?.taxa_pct ?? 0}%</strong><small>{relatorios.absenteismo?.faltas_periodo ?? 0} faltas de {relatorios.absenteismo?.total_escalas_periodo ?? 0} escalas</small></article>
            </section>
            <section className="panel">
              <div className="panel-head"><h3>Faturamento por condomínio</h3><span>Mês atual</span></div>
              {!relatorios.faturamento_por_condominio?.length ? <div className="empty">Sem contratos ativos.</div> : (
                <div className="table-wrap"><table><thead><tr><th>Condomínio</th><th>Previsto mensal</th><th>Faturado este mês</th></tr></thead><tbody>
                  {relatorios.faturamento_por_condominio.map((r: any) => <tr key={r.condominio_id}>
                    <td>{r.condominio}</td>
                    <td>{formatMoney(r.previsto_mensal)}</td>
                    <td>{formatMoney(r.faturado_mes)}</td>
                  </tr>)}
                </tbody></table></div>
              )}
            </section>
            <section className="panel">
              <div className="panel-head"><h3>Exportar dados</h3><span>CSV, abre direto no Excel/Sheets</span></div>
              <div className="row-actions">
                <button onClick={() => downloadCsv("funcionarios.csv", funcionarios, [
                  {key: "nome", label: "Nome"}, {key: "cargo", label: "Cargo"}, {key: "condominio", label: "Condomínio"},
                  {key: "status", label: "Status"}, {key: "cpf", label: "CPF"}, {key: "telefone", label: "Telefone"},
                  {key: "data_admissao", label: "Admissão"},
                ])}>Exportar funcionários</button>
                <button onClick={() => downloadCsv("documentos.csv", documentos, [
                  {key: "tipo_documento", label: "Tipo"}, {key: "ano", label: "Ano"},
                  {key: "data_validade", label: "Validade"}, {key: "status_validade", label: "Status"},
                ])}>Exportar documentos</button>
                <button onClick={() => downloadCsv("financeiro.csv", lancamentos, [
                  {key: "tipo", label: "Tipo"}, {key: "categoria", label: "Categoria"}, {key: "valor", label: "Valor"},
                  {key: "vencimento", label: "Vencimento"}, {key: "status_calculado", label: "Status"},
                ])}>Exportar financeiro</button>
              </div>
            </section>
          </>
        )}
        {tab === "meu-condominio" && isSindico && (
          <MeuCondominio
            me={me}
            condominios={condominios}
            contratos={contratos}
            postos={postos}
            escalaGrid={escalaGrid}
            lancamentos={lancamentos}
          />
        )}
        {tab === "usuarios" && me?.papel === "admin" && (
          <section className="panel">
            <div className="panel-head">
              <div><h3>Usuários</h3><span>{usuarios.length} cadastrados</span></div>
              <button className="primary" onClick={() => setUsuarioModal({mode: "create", usuario: {}})}>Novo usuário</button>
            </div>
            {!usuarios.length ? <div className="empty">Nenhum usuário encontrado.</div> : (
              <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Login</th><th>Papel</th><th>Status</th><th>Ações</th></tr></thead><tbody>
                {usuarios.map(u => <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.login}</td>
                  <td><span className="badge">{PAPEL_LABEL[u.papel] || u.papel}</span></td>
                  <td><span className={"badge " + (!u.ativo ? "warn" : "")}>{u.ativo ? "Ativo" : "Desativado"}</span></td>
                  <td className="row-actions">
                    <button className="link-btn" onClick={() => setUsuarioModal({mode: "edit", usuario: u})}>Editar</button>
                    <button className="link-btn" onClick={() => toggleUsuarioAtivo(u)}>{u.ativo ? "Desativar" : "Reativar"}</button>
                  </td>
                </tr>)}
              </tbody></table></div>
            )}
          </section>
        )}
      </main>

      <datalist id="condominios-datalist">
        {condominios.map((c) => <option key={c.id || c.nome} value={c.nome} />)}
      </datalist>

      {employeeModal && (
        <EmployeeModal
          mode={employeeModal.mode}
          employee={employeeModal.employee}
          onCancel={() => setEmployeeModal(null)}
          onSave={saveEmployee}
        />
      )}

      {dismissModal && (
        <DismissModal
          employee={dismissModal}
          onCancel={() => setDismissModal(null)}
          onConfirm={submitDismiss}
        />
      )}

      {condominioModal && (
        <CondominioModal
          mode={condominioModal.mode}
          condominio={condominioModal.condominio}
          onCancel={() => setCondominioModal(null)}
          onSave={saveCondominio}
        />
      )}

      {usuarioModal && (
        <UsuarioModal
          mode={usuarioModal.mode}
          usuario={usuarioModal.usuario}
          condominios={condominios}
          onCancel={() => setUsuarioModal(null)}
          onSave={saveUsuario}
        />
      )}

      {contratoModal && (
        <ContratoModal
          mode={contratoModal.mode}
          contrato={contratoModal.contrato}
          condominios={condominios}
          onCancel={() => setContratoModal(null)}
          onSave={saveContrato}
        />
      )}

      {postoModal && (
        <PostoModal
          mode={postoModal.mode}
          posto={postoModal.posto}
          condominios={condominios}
          onCancel={() => setPostoModal(null)}
          onSave={savePosto}
        />
      )}

      {lancamentoModal && (
        <LancamentoModal
          mode={lancamentoModal.mode}
          lancamento={lancamentoModal.lancamento}
          condominios={condominios}
          funcionarios={funcionarios}
          onCancel={() => setLancamentoModal(null)}
          onSave={saveLancamento}
        />
      )}

      {epiModal && (
        <EpiModal
          mode={epiModal.mode}
          epi={epiModal.epi}
          funcionarios={funcionarios}
          onCancel={() => setEpiModal(null)}
          onSave={saveEpi}
        />
      )}

      {escalaCell && (
        <EscalaCellModal
          cell={escalaCell}
          funcionarios={funcionarios}
          onAssign={atribuirEscala}
          onFalta={marcarFalta}
          onSubstituir={substituirEscala}
          onClose={() => setEscalaCell(null)}
        />
      )}

      {gerarEscalaModal && (
        <GerarEscalaModal
          posto={gerarEscalaModal}
          funcionarios={funcionarios}
          onGerar={gerarEscalaAutomatica}
          onCancel={() => setGerarEscalaModal(null)}
        />
      )}

      <ConfirmDialog dialog={dialog} value={dialogValue} onChange={setDialogValue} onClose={closeDialog} />
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  );
}

function DataTable({rows, type, onEdit, onToggleStatus}: {rows: any[]; type: string; onEdit?: (row: any) => void; onToggleStatus?: (row: any) => void}) {
  if (!rows.length) return <div className="empty">Nenhum registro encontrado.</div>;
  return <div className="table-wrap"><table><thead><tr>{
    type === "employees" ? <><th>Nome</th><th>Cargo</th><th>Condomínio</th><th>Status</th>{onEdit && <th>Ações</th>}</> :
    type === "condos" ? <><th>Condomínio</th><th>Cidade</th><th>Síndico</th><th>Status</th>{onEdit && <th>Ações</th>}</> :
    <><th>Documento</th><th>Funcionário</th><th>Ano</th><th>Status</th></>
  }</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id || i}>{
    type === "employees" ? <>
      <td>{row.nome}</td>
      <td><span className={"badge " + (row.cargo === "Pendente" ? "warn" : "")}>{row.cargo || "—"}</span></td>
      <td>{row.condominio || "—"}</td>
      <td><span className={"badge " + (row.status === "inativo" ? "warn" : "")}>{row.status === "inativo" ? "Desligado" : "Ativo"}</span></td>
      {onEdit && <td className="row-actions">
        <button className="link-btn" onClick={() => onEdit(row)}>Editar</button>
        <button className="link-btn" onClick={() => onToggleStatus?.(row)}>{row.status === "inativo" ? "Reativar" : "Desligar"}</button>
      </td>}
    </> :
    type === "condos" ? <>
      <td>{row.nome}</td>
      <td>{row.cidade || "—"}</td>
      <td>{row.sindico_nome || "—"}</td>
      <td><span className={"badge " + (row.status === "inativo" ? "warn" : "")}>{row.status === "inativo" ? "Inativo" : "Ativo"}</span></td>
      {onEdit && <td className="row-actions">
        <button className="link-btn" onClick={() => onEdit(row)}>Editar</button>
        <button className="link-btn" onClick={() => onToggleStatus?.(row)}>{row.status === "inativo" ? "Reativar" : "Inativar"}</button>
      </td>}
    </> :
    <><td>{row.tipo_documento || row.arquivo_nome || "Documento"}</td><td>{row.funcionarios?.nome || "—"}</td><td>{row.ano || "—"}</td><td><span className={"badge " + (row.status_validade === "vencido" ? "danger" : row.status_validade === "vencendo" ? "warn" : "")}>{STATUS_VALIDADE_LABEL[row.status_validade] || "Registrado"}</span></td></>
  }</tr>)}</tbody></table></div>;
}

function EmployeeModal({mode, employee, onCancel, onSave}: {mode: "create" | "edit"; employee: any; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
  const [form, setForm] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    for (const field of EMPLOYEE_FORM_FIELDS) initial[field.key] = employee?.[field.key] ?? "";
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (e: any) {
      setError(e.message || "Erro ao salvar funcionário.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>{mode === "create" ? "Novo funcionário" : `Editar ${employee?.nome || ""}`}</h3>
          <button type="button" className="link-btn" onClick={onCancel}>Fechar</button>
        </div>
        <div className="modal-grid">
          {EMPLOYEE_FORM_FIELDS.map(field => (
            <label key={field.key} className={field.kind === "textarea" ? "span-2" : undefined}>
              {field.label}
              {field.kind === "select" ? (
                <select value={form[field.key]} onChange={e => setForm(f => ({...f, [field.key]: e.target.value}))} required={field.key === "cargo"}>
                  <option value="">—</option>
                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : field.kind === "textarea" ? (
                <textarea value={form[field.key]} onChange={e => setForm(f => ({...f, [field.key]: e.target.value}))} rows={2} />
              ) : field.kind === "datalist" ? (
                <input
                  type="text"
                  list="condominios-datalist"
                  value={form[field.key]}
                  onChange={e => setForm(f => ({...f, [field.key]: e.target.value}))}
                />
              ) : (
                <input
                  type={field.type || "text"}
                  value={form[field.key]}
                  onChange={e => setForm(f => ({...f, [field.key]: e.target.value}))}
                  required={field.key === "nome"}
                />
              )}
            </label>
          ))}
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}

function DismissModal({employee, onCancel, onConfirm}: {employee: any; onCancel: () => void; onConfirm: (motivo: string) => Promise<void>}) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isInactive = employee.status === "inativo";

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      await onConfirm(motivo);
    } catch (e: any) {
      setError(e.message || "Erro ao atualizar status.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isInactive ? "Reativar" : "Desligar"} {employee.nome}</h3>
          <button type="button" className="link-btn" onClick={onCancel}>Fechar</button>
        </div>
        {!isInactive && (
          <label>
            Motivo do desligamento (opcional)
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} />
          </label>
        )}
        {isInactive && <p className="muted">O funcionário volta para status ativo, sem data de desligamento.</p>}
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>
          <button className="primary" onClick={confirm} disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}

function CondominioModal({mode, condominio, onCancel, onSave}: {mode: "create" | "edit"; condominio: any; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
  const [form, setForm] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    for (const field of CONDOMINIO_FORM_FIELDS) initial[field.key] = condominio?.[field.key] ?? "";
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (e: any) {
      setError(e.message || "Erro ao salvar condomínio.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>{mode === "create" ? "Novo condomínio" : `Editar ${condominio?.nome || ""}`}</h3>
          <button type="button" className="link-btn" onClick={onCancel}>Fechar</button>
        </div>
        <div className="modal-grid">
          {CONDOMINIO_FORM_FIELDS.map(field => (
            <label key={field.key} className={field.kind === "textarea" ? "span-2" : undefined}>
              {field.label}
              {field.kind === "textarea" ? (
                <textarea value={form[field.key]} onChange={e => setForm(f => ({...f, [field.key]: e.target.value}))} rows={2} />
              ) : (
                <input
                  type="text"
                  value={form[field.key]}
                  onChange={e => setForm(f => ({...f, [field.key]: e.target.value}))}
                  required={field.key === "nome"}
                />
              )}
            </label>
          ))}
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}

function UsuarioModal({mode, usuario, condominios, onCancel, onSave}: {mode: "create" | "edit"; usuario: any; condominios: any[]; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
  const [nome, setNome] = useState(usuario?.nome || "");
  const [login, setLogin] = useState(usuario?.login || "");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState(usuario?.papel || "operacional");
  const [condominioId, setCondominioId] = useState(usuario?.condominio_id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({nome, login, senha, papel, condominio_id: condominioId});
    } catch (e: any) {
      setError(e.message || "Erro ao salvar usuário.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-card modal-small" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>{mode === "create" ? "Novo usuário" : `Editar ${usuario?.nome || ""}`}</h3>
          <button type="button" className="link-btn" onClick={onCancel}>Fechar</button>
        </div>
        <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} required /></label>
        <label>Login<input value={login} onChange={e => setLogin(e.target.value)} required disabled={mode === "edit"} /></label>
        <label>
          {mode === "create" ? "Senha" : "Nova senha (deixe em branco para manter)"}
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required={mode === "create"} minLength={6} />
        </label>
        <label>
          Papel
          <select value={papel} onChange={e => setPapel(e.target.value)}>
            {PAPEIS.map(p => <option key={p} value={p}>{PAPEL_LABEL[p] || p}</option>)}
          </select>
        </label>
        {papel === "sindico" && (
          <label>
            Condomínio
            <select value={condominioId} onChange={e => setCondominioId(e.target.value)} required>
              <option value="">—</option>
              {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
        )}
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}

function ContratoModal({mode, contrato, condominios, onCancel, onSave}: {mode: "create" | "edit"; contrato: any; condominios: any[]; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
  const [form, setForm] = useState({
    condominio_id: contrato?.condominio_id || "",
    objeto: contrato?.objeto || "",
    valor_mensal: contrato?.valor_mensal || "",
    indice_reajuste: contrato?.indice_reajuste || "",
    data_inicio: contrato?.data_inicio || "",
    data_fim: contrato?.data_fim || "",
    data_renovacao: contrato?.data_renovacao || "",
    status: contrato?.status || "ativo",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (e: any) {
      setError(e.message || "Erro ao salvar contrato.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>{mode === "create" ? "Novo contrato" : "Editar contrato"}</h3>
          <button type="button" className="link-btn" onClick={onCancel}>Fechar</button>
        </div>
        <div className="modal-grid">
          <label>
            Condomínio
            <select value={form.condominio_id} onChange={e => setForm(f => ({...f, condominio_id: e.target.value}))} required disabled={mode === "edit"}>
              <option value="">—</option>
              {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label>Status
            <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
              <option value="ativo">Ativo</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </label>
          <label className="span-2">Objeto<textarea value={form.objeto} onChange={e => setForm(f => ({...f, objeto: e.target.value}))} rows={2} /></label>
          <label>Valor mensal (R$)<input type="number" step="0.01" value={form.valor_mensal} onChange={e => setForm(f => ({...f, valor_mensal: e.target.value}))} /></label>
          <label>Índice de reajuste<input value={form.indice_reajuste} onChange={e => setForm(f => ({...f, indice_reajuste: e.target.value}))} placeholder="IGPM, IPCA..." /></label>
          <label>Início da vigência<input type="date" value={form.data_inicio} onChange={e => setForm(f => ({...f, data_inicio: e.target.value}))} /></label>
          <label>Fim da vigência<input type="date" value={form.data_fim} onChange={e => setForm(f => ({...f, data_fim: e.target.value}))} /></label>
          <label>Data de renovação<input type="date" value={form.data_renovacao} onChange={e => setForm(f => ({...f, data_renovacao: e.target.value}))} /></label>
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}

function PostoModal({mode, posto, condominios, onCancel, onSave}: {mode: "create" | "edit"; posto: any; condominios: any[]; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
  const [form, setForm] = useState({
    condominio_id: posto?.condominio_id || "",
    nome: posto?.nome || "",
    cargo: posto?.cargo || "",
    turno: posto?.turno || "",
    carga_horaria_semanal: posto?.carga_horaria_semanal || "",
    status: posto?.status || "ativo",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (e: any) {
      setError(e.message || "Erro ao salvar posto.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>{mode === "create" ? "Novo posto de trabalho" : `Editar ${posto?.nome || ""}`}</h3>
          <button type="button" className="link-btn" onClick={onCancel}>Fechar</button>
        </div>
        <div className="modal-grid">
          <label>
            Condomínio
            <select value={form.condominio_id} onChange={e => setForm(f => ({...f, condominio_id: e.target.value}))} required disabled={mode === "edit"}>
              <option value="">—</option>
              {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label>Nome do posto<input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} required placeholder="Portaria diurna" /></label>
          <label>
            Cargo
            <select value={form.cargo} onChange={e => setForm(f => ({...f, cargo: e.target.value}))} required>
              <option value="">—</option>
              {CARGOS.filter(c => c !== "Pendente").map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            Turno
            <select value={form.turno} onChange={e => setForm(f => ({...f, turno: e.target.value}))}>
              <option value="">—</option>
              {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>Carga horária semanal<input type="number" value={form.carga_horaria_semanal} onChange={e => setForm(f => ({...f, carga_horaria_semanal: e.target.value}))} /></label>
          <label>Status
            <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}

function LancamentoModal({mode, lancamento, condominios, funcionarios, onCancel, onSave}: {mode: "create" | "edit"; lancamento: any; condominios: any[]; funcionarios: any[]; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
  const [form, setForm] = useState({
    tipo: lancamento?.tipo || "receita",
    condominio_id: lancamento?.condominio_id || "",
    funcionario_id: lancamento?.funcionario_id || "",
    categoria: lancamento?.categoria || "",
    descricao: lancamento?.descricao || "",
    valor: lancamento?.valor || "",
    vencimento: lancamento?.vencimento || "",
    origem: lancamento?.origem || "outro",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (e: any) {
      setError(e.message || "Erro ao salvar lançamento.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>{mode === "create" ? "Novo lançamento" : "Editar lançamento"}</h3>
          <button type="button" className="link-btn" onClick={onCancel}>Fechar</button>
        </div>
        <div className="modal-grid">
          <label>
            Tipo
            <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))} disabled={mode === "edit"}>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
          </label>
          <label>Valor (R$)<input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({...f, valor: e.target.value}))} required /></label>
          <label>
            Condomínio (opcional)
            <select value={form.condominio_id} onChange={e => setForm(f => ({...f, condominio_id: e.target.value}))}>
              <option value="">—</option>
              {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label>
            Funcionário (opcional)
            <select value={form.funcionario_id} onChange={e => setForm(f => ({...f, funcionario_id: e.target.value}))}>
              <option value="">—</option>
              {funcionarios.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </label>
          <label>
            Categoria
            {form.tipo === "despesa" ? (
              <select value={form.categoria} onChange={e => setForm(f => ({...f, categoria: e.target.value}))}>
                <option value="">—</option>
                {CATEGORIAS_DESPESA.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input value={form.categoria} onChange={e => setForm(f => ({...f, categoria: e.target.value}))} placeholder="Mensalidade, taxa extra..." />
            )}
          </label>
          <label>Vencimento<input type="date" value={form.vencimento} onChange={e => setForm(f => ({...f, vencimento: e.target.value}))} /></label>
          <label className="span-2">Descrição<textarea value={form.descricao} onChange={e => setForm(f => ({...f, descricao: e.target.value}))} rows={2} /></label>
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}

function EpiModal({mode, epi, funcionarios, onCancel, onSave}: {mode: "create" | "edit"; epi: any; funcionarios: any[]; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
  const [form, setForm] = useState({
    funcionario_id: epi?.funcionario_id || "",
    item: epi?.item || "",
    data_entrega: epi?.data_entrega || localDateISO(),
    data_validade: epi?.data_validade || "",
    termo_assinado_url: epi?.termo_assinado_url || "",
    observacao: epi?.observacao || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (e: any) {
      setError(e.message || "Erro ao salvar EPI.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>{mode === "create" ? "Novo registro de EPI" : `Editar ${epi?.item || ""}`}</h3>
          <button type="button" className="link-btn" onClick={onCancel}>Fechar</button>
        </div>
        <div className="modal-grid">
          <label>
            Funcionário
            <select value={form.funcionario_id} onChange={e => setForm(f => ({...f, funcionario_id: e.target.value}))} required disabled={mode === "edit"}>
              <option value="">—</option>
              {funcionarios.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </label>
          <label>Item<input value={form.item} onChange={e => setForm(f => ({...f, item: e.target.value}))} required placeholder="Colete, capacete, uniforme..." /></label>
          <label>Data de entrega<input type="date" value={form.data_entrega} onChange={e => setForm(f => ({...f, data_entrega: e.target.value}))} /></label>
          <label>Validade<input type="date" value={form.data_validade} onChange={e => setForm(f => ({...f, data_validade: e.target.value}))} /></label>
          <label className="span-2">Termo assinado (link)<input value={form.termo_assinado_url} onChange={e => setForm(f => ({...f, termo_assinado_url: e.target.value}))} placeholder="URL do termo de responsabilidade" /></label>
          <label className="span-2">Observação<textarea value={form.observacao} onChange={e => setForm(f => ({...f, observacao: e.target.value}))} rows={2} /></label>
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}

function MeuCondominio({me, condominios, contratos, postos, escalaGrid, lancamentos}: {me: any; condominios: any[]; contratos: any[]; postos: any[]; escalaGrid: {datas: string[]; items: any[]}; lancamentos: any[]}) {
  const condominio = condominios.find((c: any) => c.id === me?.condominio_id);
  const meusContratos = contratos.filter((c: any) => c.condominio_id === me?.condominio_id);
  const meusPostos = postos.filter((p: any) => p.condominio_id === me?.condominio_id);
  const meuFinanceiro = lancamentos.filter((l: any) => l.condominio_id === me?.condominio_id);
  const hojeISO = localDateISO();
  const escalaPorPosto = (postoId: string) => {
    const item = escalaGrid.items.find((e: any) => e.posto?.id === postoId);
    return item?.escalas_por_dia?.[hojeISO];
  };

  if (!condominio) {
    return <section className="panel"><div className="empty">Nenhum condomínio vinculado a este usuário ainda. Peça para um administrador configurar.</div></section>;
  }

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">SEU CONDOMÍNIO</p>
          <h2>{condominio.nome}</h2>
          <p>{condominio.endereco || "Endereço não cadastrado"}{condominio.cidade ? ` · ${condominio.cidade}` : ""}</p>
        </div>
      </section>
      <section className="grid-two">
        <div className="panel">
          <div className="panel-head"><h3>Contrato vigente</h3></div>
          {!meusContratos.length ? <div className="empty">Nenhum contrato cadastrado.</div> : (
            <div className="results">
              {meusContratos.map((c: any) => (
                <article key={c.id} className="result">
                  <div><b>{c.objeto || "Contrato"}</b><span>{c.status === "encerrado" ? "Encerrado" : "Ativo"}</span></div>
                  <p>{formatMoney(c.valor_mensal)}/mês · vigência {[c.data_inicio, c.data_fim].filter(Boolean).join(" a ") || "—"}</p>
                </article>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Postos de trabalho</h3><span>{meusPostos.length}</span></div>
          {!meusPostos.length ? <div className="empty">Nenhum posto cadastrado.</div> : (
            <div className="table-wrap"><table><thead><tr><th>Posto</th><th>Cargo</th><th>Turno</th><th>Hoje</th></tr></thead><tbody>
              {meusPostos.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.nome}</td><td>{p.cargo}</td><td>{p.turno || "—"}</td>
                  <td>{escalaPorPosto(p.id)?.funcionario?.nome || "Vago"}</td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h3>Financeiro</h3><span>{meuFinanceiro.length} lançamentos</span></div>
        {!meuFinanceiro.length ? <div className="empty">Nenhum lançamento.</div> : (
          <div className="table-wrap"><table><thead><tr><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>
            {meuFinanceiro.map((l: any) => (
              <tr key={l.id}>
                <td>{l.categoria || l.descricao || "—"}</td>
                <td>{formatMoney(l.valor)}</td>
                <td>{l.vencimento || "—"}</td>
                <td><span className={"badge " + (l.status_calculado === "atrasado" ? "danger" : l.status_calculado === "pago" ? "" : "warn")}>{LANCAMENTO_STATUS_LABEL[l.status_calculado] || l.status_calculado}</span></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </>
  );
}

function EscalaCellModal({cell, funcionarios, onAssign, onFalta, onSubstituir, onClose}: {
  cell: {posto: any; dia: string; escala: any};
  funcionarios: any[];
  onAssign: (postoId: string, dia: string, funcionarioId: string) => Promise<void>;
  onFalta: (escalaId: string) => Promise<void>;
  onSubstituir: (escalaId: string, substitutoId: string) => Promise<void>;
  onClose: () => void;
}) {
  const {posto, dia, escala} = cell;
  const funcionariosAtivos = funcionarios.filter((f: any) => f.status !== "inativo");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{posto.nome}</h3>
          <button type="button" className="link-btn" onClick={onClose}>Fechar</button>
        </div>
        <p className="muted">{posto.condominios?.nome || "—"} · {formatDiaCurto(dia)}</p>
        <label>
          Funcionário
          <select
            value={escala?.funcionario_id || ""}
            onChange={(e) => { onAssign(posto.id, dia, e.target.value); onClose(); }}
          >
            <option value="">Vago</option>
            {funcionariosAtivos.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
        {escala && (
          <p className="muted">
            Status atual: <span className={"badge " + (escala.status === "falta" ? "danger" : escala.status === "substituido" ? "warn" : "")}>{ESCALA_STATUS_LABEL[escala.status] || escala.status}</span>
          </p>
        )}
        {escala && escala.status !== "falta" && (
          <button onClick={() => { onFalta(escala.id); onClose(); }}>Marcar falta</button>
        )}
        {escala && escala.status === "falta" && (
          <label>
            Substituir por
            <select defaultValue="" onChange={(e) => { if (e.target.value) { onSubstituir(escala.id, e.target.value); onClose(); } }}>
              <option value="">Selecione...</option>
              {funcionariosAtivos.filter((f: any) => f.id !== escala.funcionario_id).map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

function GerarEscalaModal({posto, funcionarios, onGerar, onCancel}: {posto: any; funcionarios: any[]; onGerar: (data: {posto_id: string; funcionario_id: string; data_inicio: string; dias: number}) => Promise<void>; onCancel: () => void}) {
  const [funcionarioId, setFuncionarioId] = useState("");
  const [dataInicio, setDataInicio] = useState(() => localDateISO());
  const [dias, setDias] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const funcionariosAtivos = funcionarios.filter((f: any) => f.status !== "inativo");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onGerar({posto_id: posto.id, funcionario_id: funcionarioId, data_inicio: dataInicio, dias});
    } catch (e: any) {
      setError(e.message || "Erro ao gerar escala.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-card modal-small" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>Gerar escala automática</h3>
          <button type="button" className="link-btn" onClick={onCancel}>Fechar</button>
        </div>
        <p className="muted">{posto.nome} · turno {posto.turno || "não definido"}</p>
        <label>
          Funcionário
          <select value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)} required>
            <option value="">—</option>
            {funcionariosAtivos.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
        <label>Data de início<input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></label>
        <label>Gerar para quantos dias<input type="number" min={1} max={90} value={dias} onChange={e => setDias(Number(e.target.value) || 1)} /></label>
        <p className="muted">Segue o padrão do turno do posto: 12x36 alterna dia sim/dia não, 6x1 folga 1 dia a cada 7, Comercial só em dias úteis. Dias que já têm alguém escalado não são alterados.</p>
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>
          <button className="primary" disabled={saving || !funcionarioId}>{saving ? "Gerando..." : "Gerar"}</button>
        </div>
      </form>
    </div>
  );
}
