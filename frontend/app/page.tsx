"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Dashboard = {
  funcionarios: number;
  documentos: number;
  condominios: number;
  aguardando_cargo: number;
  recentes: any[];
  pendencias: any[];
};

const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

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

  useEffect(() => { refresh(); }, []);

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
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">LR</span><div><b>LIFE RECURSOS</b><small>Central de operações</small></div></div>
        <nav>{tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>
        <div className="sidebar-foot"><span className={"dot " + (health?.status === "ok" ? "online" : "")}></span>{health?.status === "ok" ? "Backend online" : "Backend indisponível"}<button onClick={logout}>Sair</button></div>
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

        {tab === "funcionarios" && <section className="panel"><div className="panel-head"><h3>Funcionários</h3><span>{filteredEmployees.length} registros</span></div><DataTable rows={filteredEmployees} type="employees" /></section>}
        {tab === "documentos" && <section className="panel"><div className="panel-head"><h3>Documentos</h3><span>{filteredDocuments.length} registros</span></div><DataTable rows={filteredDocuments} type="docs" /></section>}
        {tab === "condominios" && <section className="panel"><div className="panel-head"><h3>Condomínios</h3><span>{filteredCondos.length} identificados</span></div><DataTable rows={filteredCondos} type="condos" /></section>}
      </main>
    </div>
  );
}

function DataTable({rows, type}: {rows: any[]; type: string}) {
  if (!rows.length) return <div className="empty">Nenhum registro encontrado.</div>;
  return <div className="table-wrap"><table><thead><tr>{type === "employees" ? <><th>Nome</th><th>Cargo</th><th>Condomínio</th></> : type === "condos" ? <th>Condomínio</th> : <><th>Documento</th><th>Funcionário</th><th>Ano</th><th>Status</th></>}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id || i}>{type === "employees" ? <><td>{row.nome}</td><td><span className={"badge " + (row.cargo === "Pendente" ? "warn" : "")}>{row.cargo || "—"}</span></td><td>{row.condominio || "—"}</td></> : type === "condos" ? <td>{row.nome}</td> : <><td>{row.tipo_documento || row.arquivo_nome || "Documento"}</td><td>{row.funcionarios?.nome || "—"}</td><td>{row.ano || "—"}</td><td><span className="badge">Registrado</span></td></>}</tr>)}</tbody></table></div>;
}
