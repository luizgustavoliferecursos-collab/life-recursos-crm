"use client";

import { FormEvent, useState } from "react";
import { CATEGORIAS_DESPESA } from "../../lib/ui";

export function LancamentoModal({mode, lancamento, condominios, funcionarios, onCancel, onSave}: {mode: "create" | "edit"; lancamento: any; condominios: any[]; funcionarios: any[]; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
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
