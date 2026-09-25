"use client";

import { JSX } from "react";

export type Dashboard = {
  funcionarios: number;
  documentos: number;
  condominios: number;
  aguardando_cargo: number;
  afastados_hoje: number;
  vencidos: number;
  vencendo: number;
  recentes: any[];
  pendencias: any[];
  vencimentos: any[];
  financeiro: {a_receber: number; a_pagar: number; vencido_receita: number; vencido_despesa: number};
};

export const STATUS_VALIDADE_LABEL: Record<string, string> = {
  valido: "Em dia",
  vencendo: "Vencendo",
  vencido: "Vencido",
  nao_aplicavel: "Sem validade",
};
export const STATUS_VALIDADE_CLASS: Record<string, string> = {
  valido: "",
  vencendo: "warn",
  vencido: "danger",
  nao_aplicavel: "neutral",
};
export function statusValidadeLabel(status: string | null | undefined): string {
  return STATUS_VALIDADE_LABEL[status || "nao_aplicavel"] || STATUS_VALIDADE_LABEL.nao_aplicavel;
}
export function statusValidadeClass(status: string | null | undefined): string {
  return "badge " + (STATUS_VALIDADE_CLASS[status || "nao_aplicavel"] ?? "neutral");
}

export const TIPOS_AFASTAMENTO = ["Ferias", "AtestadoMedico", "LicencaMaternidade", "LicencaPaternidade", "Suspensao", "Outro"];
export const TIPO_AFASTAMENTO_LABEL: Record<string, string> = {
  Ferias: "Férias",
  AtestadoMedico: "Atestado médico",
  LicencaMaternidade: "Licença maternidade",
  LicencaPaternidade: "Licença paternidade",
  Suspensao: "Suspensão",
  Outro: "Outro",
};
export const STATUS_AFASTAMENTO_LABEL: Record<string, string> = {
  agendado: "Agendado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};
export const STATUS_OCORRENCIA_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  resolvida: "Resolvida",
};

// Todo o trafego passa por este proxy same-origin (frontend/app/api/proxy) em
// vez de chamar o backend do Render direto do navegador: o proxy exige a
// sessao (life_auth, verificada no middleware) e injeta o segredo interno que
// o Python passou a exigir. Excecao: upload de documentos, que usa um token
// de curta duracao pra chamar o Render direto (ver DIRECT_API/uploadToken) -
// a Vercel limita o corpo de uma function em 4.5MB, pequeno demais pra PDFs
// escaneados de ate 30MB.
export const API = "/api/proxy";
export const DIRECT_API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export const CARGOS = ["ASG", "Diarista", "Guardiao", "Portaria", "Seguranca", "Staff", "Pendente"];
export const TIPOS_CONTRATO = ["CLT", "Terceirizado", "Autonomo"];
export const PAPEIS = ["admin", "rh", "financeiro", "operacional", "sindico", "colaborador"];
export const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador",
  rh: "RH",
  financeiro: "Financeiro",
  operacional: "Operacional",
  sindico: "Síndico",
  colaborador: "Colaborador",
};
export const TURNOS = ["12x36 Diurno", "12x36 Noturno", "6x1 Diurno", "6x1 Noturno", "Comercial"];
export const ESCALA_STATUS_LABEL: Record<string, string> = {
  previsto: "Previsto",
  confirmado: "Confirmado",
  falta: "Falta",
  substituido: "Substituído",
};
export const CATEGORIAS_DESPESA = ["Folha de pagamento", "INSS/FGTS", "Uniforme/EPI", "Fornecedor", "Outro"];
export const LANCAMENTO_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
};
export const SERVICO_LABEL: Record<string, string> = {
  anthropic: "Claude (Anthropic)",
  supabase: "Supabase",
  google: "Google Drive (credenciais)",
  drive_folders: "Pastas do Drive (IDs)",
};
export const DRIVE_FOLDER_LABEL: Record<string, string> = {
  documentos_condominio: "Documentos do condomínio",
  funcionarios: "Funcionários",
  aguardando_cargo: "Aguardando cargo",
};

// Busca sem acento e sem diferenciar maiuscula/minuscula: "joao" acha "João".
// Compara campo a campo (nunca JSON.stringify do objeto inteiro, que casa
// com qualquer chave/valor interno e não reflete o que a pessoa está vendo).
export function normalize(value: any): string {
  return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function formatMoney(value: any) {
  const n = Number(value);
  return isNaN(n) ? "—" : n.toLocaleString("pt-BR", {style: "currency", currency: "BRL"});
}

// Datas guardadas/trafegadas em ISO (aaaa-mm-dd); exibicao sempre em dd/mm/aaaa.
export function formatDate(value: any): string {
  if (!value) return "—";
  const iso = String(value).slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

// competencia guarda sempre o dia 1 do mes (aaaa-mm-01); exibicao como "Set/2026".
export function formatCompetencia(value: any): string {
  if (!value) return "";
  const [y, m] = String(value).slice(0, 7).split("-");
  const mes = MES_CURTO[Number(m) - 1];
  return mes ? `${mes}/${y}` : "";
}

export const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const CHART_PALETTE = ["#2563eb", "#38bdf8", "#16a34a", "#f59e0b", "#a855f7", "#94a3b8"];
export const CHART_TOOLTIP_STYLE = {
  background: "#fff", border: "1px solid #e7e9f0", borderRadius: 10,
  fontSize: 12, boxShadow: "0 10px 30px rgba(15,15,25,.08)", padding: "8px 12px",
};

// Converte o link "abrir" do Drive (.../view) pro formato embutivel em
// iframe (.../preview) - se o link ja vier em outro formato, usa como esta.
export function drivePreviewUrl(viewUrl: string): string {
  return viewUrl.replace(/\/view(\?.*)?$/, "/preview");
}

// "Hoje" pelo calendario local do navegador, nao UTC: Date().toISOString()
// converte pra UTC, entao entre 21h e meia-noite no Brasil (UTC-3) mostraria
// o dia seguinte por engano (escala do dia, EPI, geracao de mensalidade).
export function localDateISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Segunda-feira da semana da data informada (semana sempre comeca na
// segunda, pra escala ficar organizada de forma previsivel).
export function mondayOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diff = (date.getDay() + 6) % 7; // 0=domingo -> 6 dias desde a segunda anterior
  date.setDate(date.getDate() - diff);
  return localDateISO(date);
}

export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return localDateISO(date);
}

export const DIA_SEMANA_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function formatDiaCurto(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DIA_SEMANA_LABEL[date.getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export const ICON_PATHS: Record<string, JSX.Element> = {
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
  activity: <path d="M3 12h4l2.5 7 4-14 2.5 7h4" />,
  umbrella: <><path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z" /><path d="M12 3v1" /><path d="M12 12v7a2 2 0 0 1-4 0" /></>,
  "trending-up": <><path d="M3 16.5 10 9.5l4 4 7-7.5" /><path d="M15 6h6v6" /></>,
  "trending-down": <><path d="M3 7.5 10 14.5l4-4 7 7.5" /><path d="M15 18h6v-6" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M17 12h3v3h-3a1.5 1.5 0 0 1 0-3Z" /><path d="M3 8.5h18" /></>,
  link: <><path d="M9 15l6-6" /><path d="M8 13l-2.5 2.5a3.5 3.5 0 1 0 5 5L13 18" /><path d="M16 11l2.5-2.5a3.5 3.5 0 1 0-5-5L11 6" /></>,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  "clock-history": <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  "arrow-left": <><path d="M19 12H5" /><path d="M11 18l-6-6 6-6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15 1.65 1.65 0 0 0 3.09 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.13.36.37.68.7.91.32.23.71.36 1.11.36H21a2 2 0 0 1 0 4h-.09c-.4 0-.79.13-1.11.36-.33.23-.57.55-.7.91Z" /></>,
};

export function Icon({name, size = 18}: {name: string; size?: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name] || null}
    </svg>
  );
}

export function ToastStack({toasts, onDismiss}: {toasts: {id: number; type: "success" | "error"; message: string}[]; onDismiss: (id: number) => void}) {
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

export function ConfirmDialog({dialog, value, onChange, onClose}: {
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

export function downloadCsv(filename: string, rows: any[], columns: {key: string; label: string}[]) {
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

export const EMPLOYEE_FORM_FIELDS: {key: string; label: string; type?: string; kind?: "select" | "textarea" | "datalist"; options?: string[]}[] = [
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

export const CONDOMINIO_FORM_FIELDS: {key: string; label: string; kind?: "select" | "textarea"; options?: string[]}[] = [
  {key: "nome", label: "Nome"},
  {key: "cnpj", label: "CNPJ"},
  {key: "cidade", label: "Cidade"},
  {key: "endereco", label: "Endereço", kind: "textarea"},
  {key: "sindico_nome", label: "Síndico (nome)"},
  {key: "sindico_telefone", label: "Síndico (telefone)"},
  {key: "sindico_email", label: "Síndico (e-mail)"},
  {key: "administradora", label: "Administradora"},
];

export async function api(path: string, init?: RequestInit) {
  const response = await fetch(API + path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || "Falha na comunicação com o backend.");
  return data;
}
