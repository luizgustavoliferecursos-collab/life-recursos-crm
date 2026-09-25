"use client";

import { FormEvent, useState } from "react";
import { EMPLOYEE_FORM_FIELDS, cargoLabel } from "../../lib/ui";

export function EmployeeModal({mode, employee, onCancel, onSave}: {mode: "create" | "edit"; employee: any; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
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
                  {field.options?.map(opt => <option key={opt} value={opt}>{field.key === "cargo" ? cargoLabel(opt) : opt}</option>)}
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

export function DismissModal({employee, onCancel, onConfirm}: {employee: any; onCancel: () => void; onConfirm: (motivo: string) => Promise<void>}) {
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
