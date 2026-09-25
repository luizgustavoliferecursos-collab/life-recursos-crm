"use client";

import Link from "next/link";
import { useState } from "react";
import { CARGOS, statusValidadeClass, statusValidadeLabel, cargoLabel, tipoDocLabel } from "../lib/ui";
import { EmptyState } from "./EmptyState";

export function CargoQuickSelect({row, onConfirm}: {row: any; onConfirm: (id: string, cargo: string) => Promise<void>}) {
  const [cargo, setCargo] = useState(CARGOS[0]);
  const [saving, setSaving] = useState(false);

  async function confirmar() {
    setSaving(true);
    try {
      await onConfirm(row.id, cargo);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="row-actions">
      <select value={cargo} onChange={e => setCargo(e.target.value)} style={{padding: "6px 8px"}}>
        {CARGOS.filter(c => c !== "Pendente").map(opt => <option key={opt} value={opt}>{cargoLabel(opt)}</option>)}
      </select>
      <button type="button" className="link-btn" disabled={saving} onClick={confirmar}>{saving ? "Confirmando..." : "Confirmar"}</button>
    </div>
  );
}

export function DataTable({rows, type, onEdit, onToggleStatus, onPreview, onConfirmCargo, emptyIcon, emptyTitle, emptyDescription, emptyActionLabel, onEmptyAction, emptyHref}: {
  rows: any[]; type: string;
  onEdit?: (row: any) => void; onToggleStatus?: (row: any) => void; onPreview?: (row: any) => void;
  onConfirmCargo?: (id: string, cargo: string) => Promise<void>;
  emptyIcon?: string; emptyTitle?: string; emptyDescription?: string; emptyActionLabel?: string; onEmptyAction?: () => void; emptyHref?: string;
}) {
  if (!rows.length) {
    if (emptyTitle) {
      return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} actionLabel={emptyActionLabel} onAction={onEmptyAction} href={emptyHref} />;
    }
    return <div className="empty">Nenhum registro encontrado.</div>;
  }
  return <div className="table-wrap"><table><thead><tr>{
    type === "employees" ? <><th>Nome</th><th>Cargo</th><th>Condomínio</th><th>Status</th>{onEdit && <th>Ações</th>}</> :
    type === "condos" ? <><th>Condomínio</th><th>Cidade</th><th>Síndico</th><th>Status</th>{onEdit && <th>Ações</th>}</> :
    <><th>Documento</th><th>Funcionário / Condomínio</th><th>Ano</th><th>Status</th><th>Arquivo</th></>
  }</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id || i}>{
    type === "employees" ? <>
      <td><Link href={`/funcionarios/${row.id}`} className="link-btn">{row.nome}</Link></td>
      <td>{row.cargo === "Pendente" && onConfirmCargo ? (
        <CargoQuickSelect row={row} onConfirm={onConfirmCargo} />
      ) : (
        <span className={"badge " + (row.cargo === "Pendente" ? "warn" : "")}>{cargoLabel(row.cargo)}</span>
      )}</td>
      <td>{row.condominio || "—"}</td>
      <td><span className={"badge " + (row.status === "inativo" ? "warn" : "")}>{row.status === "inativo" ? "Desligado" : "Ativo"}</span></td>
      {onEdit && <td className="row-actions">
        <button className="link-btn" onClick={() => onEdit(row)}>Editar</button>
        <button className="link-btn" onClick={() => onToggleStatus?.(row)}>{row.status === "inativo" ? "Reativar" : "Desligar"}</button>
      </td>}
    </> :
    type === "condos" ? <>
      <td><Link href={`/condominios/${row.id}`} className="link-btn">{row.nome}</Link></td>
      <td>{row.cidade || "—"}</td>
      <td>{row.sindico_nome || "—"}</td>
      <td><span className={"badge " + (row.status === "inativo" ? "warn" : "")}>{row.status === "inativo" ? "Inativo" : "Ativo"}</span></td>
      {onEdit && <td className="row-actions">
        <button className="link-btn" onClick={() => onEdit(row)}>Editar</button>
        <button className="link-btn" onClick={() => onToggleStatus?.(row)}>{row.status === "inativo" ? "Reativar" : "Inativar"}</button>
      </td>}
    </> :
    <><td>{tipoDocLabel(row.tipo_documento, row.arquivo_nome || "Documento")}{row.versao_anterior_id && <span className="badge" style={{marginLeft: 6}} title="Existe uma versão anterior deste documento (renovação)">Renovado</span>}</td><td>{row.funcionarios?.nome ? (row.funcionario_id ? <Link href={`/funcionarios/${row.funcionario_id}`} className="link-btn">{row.funcionarios.nome}</Link> : row.funcionarios.nome) : (row.condominios?.nome ? `${row.condominios.nome} (condomínio)` : "—")}</td><td>{row.ano || "—"}</td><td><span className={statusValidadeClass(row.status_validade)}>{statusValidadeLabel(row.status_validade)}</span></td><td className="row-actions">{row.arquivo_drive_url ? <>{onPreview && <button type="button" className="link-btn" onClick={() => onPreview(row)}>Visualizar</button>}<a className="link-btn" href={row.arquivo_drive_url} target="_blank" rel="noopener noreferrer">Abrir ↗</a></> : "—"}</td></>
  }</tr>)}</tbody></table></div>;
}
