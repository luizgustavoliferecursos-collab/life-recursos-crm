"use client";

import { useCrm } from "../../lib/CrmContext";
import { formatDate, statusValidadeClass, statusValidadeLabel } from "../../lib/ui";
import { EmptyState } from "../../components/EmptyState";

export default function EpisPage() {
  const {epis, setEpiModal} = useCrm();
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>EPIs entregues</h3><span>{epis.length} registros</span></div>
        <button className="primary" onClick={() => setEpiModal({mode: "create", epi: {}})}>Novo registro</button>
      </div>
      {!epis.length ? (
        <EmptyState
          icon="shield"
          title="Nenhum EPI registrado"
          description="Registre a entrega de um equipamento de proteção para acompanhar a validade."
          actionLabel="Novo registro"
          onAction={() => setEpiModal({mode: "create", epi: {}})}
        />
      ) : (
        <div className="table-wrap"><table><thead><tr><th>Funcionário</th><th>Item</th><th>Entrega</th><th>Validade</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {epis.map((e: any) => <tr key={e.id}>
            <td>{e.funcionarios?.nome || "—"}</td>
            <td>{e.item}</td>
            <td>{formatDate(e.data_entrega)}</td>
            <td>{formatDate(e.data_validade)}</td>
            <td><span className={statusValidadeClass(e.status_validade)}>{statusValidadeLabel(e.status_validade)}</span></td>
            <td className="row-actions"><button className="link-btn" onClick={() => setEpiModal({mode: "edit", epi: e})}>Editar</button></td>
          </tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
