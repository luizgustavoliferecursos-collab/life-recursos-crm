"use client";

import { useCrm } from "../../../lib/CrmContext";
import { EmptyState } from "../../../components/EmptyState";

export default function AuditoriaPage() {
  const {me, auditoria} = useCrm();
  if (me && me.papel !== "admin") {
    return <section className="panel"><div className="empty">Acesso restrito a administradores.</div></section>;
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Auditoria</h3><span>{auditoria.length} registros mais recentes</span></div>
      </div>
      <p className="muted" style={{margin: "0 0 14px"}}>Quem criou, editou, desligou ou pagou cada registro do sistema.</p>
      {!auditoria.length ? (
        <EmptyState icon="activity" title="Nenhum registro de auditoria ainda" description="Ações no sistema (criar, editar, desligar, pagar) aparecem aqui conforme forem acontecendo." />
      ) : (
        <div className="table-wrap"><table><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead><tbody>
          {auditoria.map((a: any) => <tr key={a.id}>
            <td>{new Date(a.created_at).toLocaleString("pt-BR")}</td>
            <td>{a.usuario_nome || "desconhecido"}</td>
            <td><span className="badge">{(a.acao || "").replace(/_/g, " ")}</span></td>
            <td>{(a.entidade || "").replace(/_/g, " ")}</td>
            <td>{a.detalhes ? JSON.stringify(a.detalhes) : "—"}</td>
          </tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
