"use client";

import { FormEvent, useState } from "react";
import { CONDOMINIO_FORM_FIELDS, CARGOS, TURNOS } from "../../lib/ui";

export function CondominioModal({mode, condominio, onCancel, onSave}: {mode: "create" | "edit"; condominio: any; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
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

export function OcorrenciaModal({onCancel, onSave}: {onCancel: () => void; onSave: (titulo: string, descricao: string) => Promise<void>}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(titulo, descricao);
    } catch (e: any) {
      setError(e.message || "Erro ao registrar ocorrência.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-card modal-small" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>Nova ocorrência</h3>
          <button type="button" className="link-btn" onClick={onCancel}>Fechar</button>
        </div>
        <label>Título<input value={titulo} onChange={e => setTitulo(e.target.value)} required placeholder="Ex.: Vazamento na garagem" /></label>
        <label>Descrição<textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={4} placeholder="Detalhes da ocorrência" /></label>
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving ? "Enviando..." : "Registrar"}</button>
        </div>
      </form>
    </div>
  );
}

export function ContratoModal({mode, contrato, condominios, onCancel, onSave}: {mode: "create" | "edit"; contrato: any; condominios: any[]; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
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

export function PostoModal({mode, posto, condominios, onCancel, onSave}: {mode: "create" | "edit"; posto: any; condominios: any[]; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
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
