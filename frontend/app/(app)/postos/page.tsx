"use client";

import { useCrm } from "../../lib/CrmContext";
import { addDaysISO, formatDiaCurto, localDateISO, mondayOf, cargoLabel } from "../../lib/ui";
import { EmptyState } from "../../components/EmptyState";

export default function PostosPage() {
  const {postos, setPostoModal, escalaGrid, semanaInicio, setSemanaInicio, setEscalaCell, setGerarEscalaModal} = useCrm();
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div><h3>Postos de trabalho</h3><span>{postos.length} cadastrados</span></div>
          <button className="primary" onClick={() => setPostoModal({mode: "create", posto: {}})}>Novo posto</button>
        </div>
        {!postos.length ? (
          <EmptyState
            icon="calendar"
            title="Cadastre o primeiro posto para montar a escala"
            description="Um posto de trabalho representa uma vaga a ser coberta em um condomínio (ex.: portaria diurna)."
            actionLabel="Novo posto"
            onAction={() => setPostoModal({mode: "create", posto: {}})}
          />
        ) : (
          <div className="table-wrap"><table><thead><tr><th>Posto</th><th>Condomínio</th><th>Cargo</th><th>Turno</th><th>Status</th><th>Ações</th></tr></thead><tbody>
            {postos.map((p: any) => <tr key={p.id}>
              <td>{p.nome}</td>
              <td>{p.condominios?.nome || "—"}</td>
              <td>{cargoLabel(p.cargo)}</td>
              <td>{p.turno || "—"}</td>
              <td><span className={"badge " + (p.status === "inativo" ? "warn" : "")}>{p.status === "inativo" ? "Inativo" : "Ativo"}</span></td>
              <td className="row-actions"><button className="link-btn" onClick={() => setPostoModal({mode: "edit", posto: p})}>Editar</button></td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div><h3>Escala da semana</h3><span>{formatDiaCurto(semanaInicio)} – {escalaGrid.datas.length ? formatDiaCurto(escalaGrid.datas[escalaGrid.datas.length - 1]) : ""}</span></div>
          <div className="row-actions">
            <button onClick={() => setSemanaInicio(addDaysISO(semanaInicio, -7))}>← Anterior</button>
            <button onClick={() => setSemanaInicio(mondayOf(localDateISO()))}>Esta semana</button>
            <button onClick={() => setSemanaInicio(addDaysISO(semanaInicio, 7))}>Próxima →</button>
          </div>
        </div>
        {!escalaGrid.items.length ? (
          <EmptyState icon="calendar" title="Nenhum posto ativo cadastrado" description="Cadastre um posto de trabalho acima para montar a escala da semana." />
        ) : (
          <div className="table-wrap"><table className="escala-grid"><thead><tr>
            <th>Posto</th>
            {escalaGrid.datas.map((dia: string) => <th key={dia}>{formatDiaCurto(dia)}</th>)}
            <th>Automação</th>
          </tr></thead><tbody>
            {escalaGrid.items.map(({posto, escalas_por_dia}: any) => (
              <tr key={posto.id}>
                <td><b>{posto.nome}</b><br /><small className="muted">{posto.condominios?.nome}{posto.turno ? ` · ${posto.turno}` : ""}</small></td>
                {escalaGrid.datas.map((dia: string) => {
                  const escala = escalas_por_dia[dia];
                  const estado = escala?.status === "falta" ? "cell-danger" : escala?.status === "substituido" ? "cell-warn" : escala?.funcionario_id ? "cell-ok" : "cell-vago";
                  return (
                    <td key={dia}>
                      <button className={"escala-cell " + estado} onClick={() => setEscalaCell({posto, dia, escala})}>
                        {escala?.funcionario?.nome ? escala.funcionario.nome.split(" ")[0] : "Vago"}
                      </button>
                    </td>
                  );
                })}
                <td className="row-actions"><button className="link-btn" onClick={() => setGerarEscalaModal(posto)}>Gerar automático</button></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </>
  );
}
