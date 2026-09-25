"use client";

import { useCrm } from "../../lib/CrmContext";
import { STATUS_OCORRENCIA_LABEL } from "../../lib/ui";
import { EmptyState } from "../../components/EmptyState";

export default function OcorrenciasPage() {
  const {ocorrencias, marcarOcorrencia} = useCrm();
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Ocorrências</h3><span>{ocorrencias.length} registradas pelos síndicos</span></div>
      </div>
      {!ocorrencias.length ? (
        <EmptyState icon="alert-triangle" title="Nenhuma ocorrência registrada" description="Ocorrências registradas pelos síndicos de cada condomínio aparecem aqui." />
      ) : (
        <div className="table-wrap"><table><thead><tr><th>Condomínio</th><th>Título</th><th>Descrição</th><th>Status</th><th>Resposta</th><th>Ações</th></tr></thead><tbody>
          {ocorrencias.map((o: any) => <tr key={o.id}>
            <td>{o.condominios?.nome || "—"}</td>
            <td>{o.titulo}</td>
            <td>{o.descricao || "—"}</td>
            <td><span className={"badge " + (o.status === "aberta" ? "danger" : o.status === "em_andamento" ? "warn" : "")}>{STATUS_OCORRENCIA_LABEL[o.status] || o.status}</span></td>
            <td>{o.resposta || "—"}</td>
            <td className="row-actions">
              {o.status !== "em_andamento" && o.status !== "resolvida" && <button className="link-btn" onClick={() => marcarOcorrencia(o.id, "em_andamento")}>Marcar em andamento</button>}
              {o.status !== "resolvida" && <button className="link-btn" onClick={() => marcarOcorrencia(o.id, "resolvida")}>Resolver</button>}
            </td>
          </tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
