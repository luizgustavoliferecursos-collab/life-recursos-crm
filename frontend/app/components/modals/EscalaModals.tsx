"use client";

import { FormEvent, useState } from "react";
import { formatDiaCurto, ESCALA_STATUS_LABEL, localDateISO } from "../../lib/ui";

export function EscalaCellModal({cell, funcionarios, onAssign, onFalta, onSubstituir, onClose}: {
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

export function GerarEscalaModal({posto, funcionarios, onGerar, onCancel}: {posto: any; funcionarios: any[]; onGerar: (data: {posto_id: string; funcionario_id: string; data_inicio: string; dias: number}) => Promise<void>; onCancel: () => void}) {
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
