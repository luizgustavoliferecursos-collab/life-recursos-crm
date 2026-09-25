"use client";

import { FormEvent, useState } from "react";
import { localDateISO, TIPOS_AFASTAMENTO, TIPO_AFASTAMENTO_LABEL } from "../../lib/ui";

export function EpiModal({mode, epi, funcionarios, onCancel, onSave}: {mode: "create" | "edit"; epi: any; funcionarios: any[]; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
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

export function AfastamentoModal({mode, afastamento, funcionarios, onCancel, onSave}: {mode: "create" | "edit"; afastamento: any; funcionarios: any[]; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
  const [form, setForm] = useState({
    funcionario_id: afastamento?.funcionario_id || "",
    tipo: afastamento?.tipo || "Ferias",
    data_inicio: afastamento?.data_inicio || localDateISO(),
    data_fim: afastamento?.data_fim || localDateISO(),
    observacao: afastamento?.observacao || "",
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
      setError(e.message || "Erro ao salvar afastamento.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>{mode === "create" ? "Novo afastamento" : `Editar afastamento`}</h3>
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
          <label>
            Tipo
            <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))} required>
              {TIPOS_AFASTAMENTO.map(t => <option key={t} value={t}>{TIPO_AFASTAMENTO_LABEL[t]}</option>)}
            </select>
          </label>
          <label>Início<input type="date" value={form.data_inicio} onChange={e => setForm(f => ({...f, data_inicio: e.target.value}))} required /></label>
          <label>Fim<input type="date" value={form.data_fim} onChange={e => setForm(f => ({...f, data_fim: e.target.value}))} required /></label>
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
