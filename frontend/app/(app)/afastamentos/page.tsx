"use client";

import { useCrm } from "../../lib/CrmContext";
import { formatDate, STATUS_AFASTAMENTO_LABEL, TIPO_AFASTAMENTO_LABEL } from "../../lib/ui";
import { EmptyState } from "../../components/EmptyState";

export default function AfastamentosPage() {
  const {afastamentos, dashboard, setAfastamentoModal} = useCrm();
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Férias & Afastamentos</h3><span>{afastamentos.length} registros{dashboard?.afastados_hoje ? ` · ${dashboard.afastados_hoje} afastado(s) hoje` : ""}</span></div>
        <button className="primary" onClick={() => setAfastamentoModal({mode: "create", afastamento: {}})}>Novo afastamento</button>
      </div>
      {!afastamentos.length ? (
        <EmptyState
          icon="umbrella"
          title="Nenhum afastamento registrado"
          description="Registre férias, atestados ou licenças para acompanhar quem está afastado."
          actionLabel="Novo afastamento"
          onAction={() => setAfastamentoModal({mode: "create", afastamento: {}})}
        />
      ) : (
        <div className="table-wrap"><table><thead><tr><th>Funcionário</th><th>Tipo</th><th>Início</th><th>Fim</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {afastamentos.map((a: any) => <tr key={a.id}>
            <td>{a.funcionarios?.nome || "—"}</td>
            <td>{TIPO_AFASTAMENTO_LABEL[a.tipo] || a.tipo}</td>
            <td>{formatDate(a.data_inicio)}</td>
            <td>{formatDate(a.data_fim)}</td>
            <td><span className={"badge " + (a.status === "em_andamento" ? "warn" : "")}>{STATUS_AFASTAMENTO_LABEL[a.status] || a.status}</span></td>
            <td className="row-actions"><button className="link-btn" onClick={() => setAfastamentoModal({mode: "edit", afastamento: a})}>Editar</button></td>
          </tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
