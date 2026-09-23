"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Dashboard = {
  funcionarios: number;
  documentos: number;
  condominios: number;
  aguardando_cargo: number;
  recentes: any[];
  pendencias: any[];
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

  async function refresh() {
    setError("");
    try {
      const [d, f, docs, condos, h, ds] = await Promise.all([
        api("/api/dashboard"),
        api("/api/funcionarios"),
        api("/api/documentos?limit=200"),
        api("/api/condominios"),
        api("/health"),
        api("/api/drive/status"),
      ]);
      setDashboard(d);
      setFuncionarios(f.items || []);
      setDocumentos(docs.items || []);
      setCondominios(condos.items || []);
      setHealth(h);
      setDrive(ds);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar dados.");
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

  useEffect(() => {
    refresh();
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(setMe).catch(() => setMe(null));
  }, []);

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
    await refresh();
  }

  async function toggleCondominioStatus(row: any) {
    const next = row.status === "inativo" ? "ativo" : "inativo";
    const action = next === "inativo" ? "inativar" : "reativar";
    if (!window.confirm(`Confirma ${action} o condomínio "${row.nome}"?`)) return;
    try {
      await api(`/api/condominios/${row.id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({status: next}),
      });
      await refresh();
    } catch (e: any) {
      setError(e.message || "Erro ao atualizar condomínio.");
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
    await loadUsuarios();
  }

  async function toggleUsuarioAtivo(row: any) {
    const next = !row.ativo;
    if (!window.confirm(`Confirma ${next ? "reativar" : "desativar"} o usuário "${row.nome}"?`)) return;
    try {
      await api(`/api/usuarios/${row.id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ativo: next}),
      });
      await loadUsuarios();
    } catch (e: any) {
      setError(e.message || "Erro ao atualizar usuário.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", {method: "POST"});
    window.location.href = "/login";
  }

  const tabs = [
    ["visao", "Visão geral"],
    ["processar", "Processar documentos"],
    ["funcionarios", "Funcionários"],
    ["documentos", "Documentos"],
    ["condominios", "Condomínios"],
    ...(me?.papel === "admin" ? [["usuarios", "Usuários"]] : []),
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">LR</span><div><b>LIFE RECURSOS</b><small>Central de operações</small></div></div>
        <nav>{tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>
        <div className="sidebar-foot"><span className={"dot " + (health?.status === "ok" ? "online" : "")}></span>{me?.nome ? `${me.nome} · ${PAPEL_LABEL[me.papel] || me.papel}` : (health?.status === "ok" ? "Backend online" : "Backend indisponível")}<button onClick={logout}>Sair</button></div>
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
              <article><span>Funcionários</span><strong>{dashboard?.funcionarios ?? "—"}</strong><small>{dashboard?.aguardando_cargo ?? 0} aguardando cargo</small></article>
              <article><span>Documentos</span><strong>{dashboard?.documentos ?? "—"}</strong><small>Registrados no CRM</small></article>
              <article><span>Condomínios</span><strong>{dashboard?.condominios ?? "—"}</strong><small>Identificados na base</small></article>
              <article><span>Fluxo</span><strong>{drive?.status === "ok" ? "OK" : "—"}</strong><small>Claude → Drive → Supabase</small></article>
            </section>
            <section className="grid-two">
              <div className="panel"><div className="panel-head"><h3>Documentos recentes</h3><span>Últimos itens</span></div><DataTable rows={dashboard?.recentes || []} type="docs" /></div>
              <div className="panel"><div className="panel-head"><h3>Pendências</h3><span>Aguardando cargo</span></div><DataTable rows={dashboard?.pendencias || []} type="employees" /></div>
            </section>
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
    <><td>{row.tipo_documento || row.arquivo_nome || "Documento"}</td><td>{row.funcionarios?.nome || "—"}</td><td>{row.ano || "—"}</td><td><span className="badge">Registrado</span></td></>
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
