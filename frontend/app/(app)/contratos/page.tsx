"use client";

import { useCrm } from "../../lib/CrmContext";
import { formatDate } from "../../lib/ui";
import { EmptyState } from "../../components/EmptyState";

export default function ContratosPage() {
  const {contratos, setContratoModal} = useCrm();
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Contratos</h3><span>{contratos.length} registros</span></div>
        <button className="primary" onClick={() => setContratoModal({mode: "create", contrato: {}})}>Novo contrato</button>
      </div>
      {!contratos.length ? (
        <EmptyState
          icon="briefcase"
          title="Nenhum contrato cadastrado"
          description="Cadastre o contrato de um condomínio para acompanhar valor mensal e vigência."
          actionLabel="Novo contrato"
          onAction={() => setContratoModal({mode: "create", contrato: {}})}
        />
      ) : (
        <div className="table-wrap"><table><thead><tr><th>Condomínio</th><th>Objeto</th><th>Valor mensal</th><th>Vigência</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {contratos.map((c: any) => <tr key={c.id}>
            <td>{c.condominios?.nome || "—"}</td>
            <td>{c.objeto || "—"}</td>
            <td>{c.valor_mensal ? `R$ ${Number(c.valor_mensal).toLocaleString("pt-BR", {minimumFractionDigits: 2})}` : "—"}</td>
            <td>{[formatDate(c.data_inicio), formatDate(c.data_fim)].filter(s => s !== "—").join(" → ") || "—"}</td>
            <td><span className={"badge " + (c.status === "encerrado" ? "warn" : "")}>{c.status === "encerrado" ? "Encerrado" : "Ativo"}</span></td>
            <td className="row-actions"><button className="link-btn" onClick={() => setContratoModal({mode: "edit", contrato: c})}>Editar</button></td>
          </tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
