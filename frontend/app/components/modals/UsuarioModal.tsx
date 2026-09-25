"use client";

import { FormEvent, useState } from "react";
import { PAPEIS, PAPEL_LABEL } from "../../lib/ui";

export function UsuarioModal({mode, usuario, condominios, funcionarios, onCancel, onSave}: {mode: "create" | "edit"; usuario: any; condominios: any[]; funcionarios: any[]; onCancel: () => void; onSave: (data: Record<string, any>) => Promise<void>}) {
  const [nome, setNome] = useState(usuario?.nome || "");
  const [login, setLogin] = useState(usuario?.login || "");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState(usuario?.papel || "operacional");
  const [condominioId, setCondominioId] = useState(usuario?.condominio_id || "");
  const [funcionarioId, setFuncionarioId] = useState(usuario?.funcionario_id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({nome, login, senha, papel, condominio_id: condominioId, funcionario_id: funcionarioId});
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
        {papel === "colaborador" && (
          <label>
            Funcionário
            <select value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)} required>
              <option value="">—</option>
              {funcionarios.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
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
