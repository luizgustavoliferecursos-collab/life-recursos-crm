"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useCrm } from "../../../lib/CrmContext";
import { formatDate, formatCompetencia, formatMoney, LANCAMENTO_STATUS_LABEL, STATUS_OCORRENCIA_LABEL, cargoLabel } from "../../../lib/ui";
import { Breadcrumb } from "../../../components/Breadcrumb";
import { DataTable } from "../../../components/DataTable";
import { EmptyState } from "../../../components/EmptyState";

const TABS = [
  ["equipe", "Equipe"],
  ["postos", "Postos & Escala"],
  ["contrato", "Contrato"],
  ["ocorrencias", "Ocorrências"],
  ["folhas", "Folhas de ponto"],
  ["financeiro", "Financeiro"],
] as const;

export default function CondominioDetalhePage() {
  const params = useParams();
  const id = String(params.id);
  const {
    condominios, funcionarios, postos, escalaGrid, contratos, ocorrencias, lancamentos, documentos,
    setPostoModal, setContratoModal, setOcorrenciaModal, setEmployeeModal, setDismissModal, confirmCargo,
    openPreview, marcarOcorrencia,
  } = useCrm();
  const [tab, setTab] = useState<typeof TABS[number][0]>("equipe");

  const condominio = condominios.find((c: any) => c.id === id);

  const equipe = useMemo(() => funcionarios.filter((f: any) => condominio && f.condominio === condominio.nome), [funcionarios, condominio]);
  const meusPostos = useMemo(() => postos.filter((p: any) => p.condominio_id === id), [postos, id]);
  const meusContratos = useMemo(() => contratos.filter((c: any) => c.condominio_id === id), [contratos, id]);
  const minhasOcorrencias = useMemo(() => ocorrencias.filter((o: any) => o.condominio_id === id), [ocorrencias, id]);
  const meuFinanceiro = useMemo(() => lancamentos.filter((l: any) => l.condominio_id === id), [lancamentos, id]);
  const folhasDePonto = useMemo(() => documentos.filter((d: any) => d.condominio_id === id && d.tipo_documento === "FolhaDePonto"), [documentos, id]);
  const meusPostoIds = useMemo(() => new Set(meusPostos.map((p: any) => p.id)), [meusPostos]);

  if (!condominio) {
    return <div className="empty">Condomínio não encontrado.</div>;
  }

  return (
    <>
      <Breadcrumb items={[{label: "Condomínios", href: "/condominios"}, {label: condominio.nome}]} />

      <section className="panel ficha-header">
        <div className="ficha-avatar">{condominio.nome.slice(0, 2).toUpperCase()}</div>
        <div className="ficha-header-info">
          <h2>{condominio.nome}</h2>
          <div className="row-actions">
            <span className="muted">{condominio.cidade || "Cidade não informada"}</span>
            <span className={"badge " + (condominio.status === "inativo" ? "warn" : "")}>{condominio.status === "inativo" ? "Inativo" : "Ativo"}</span>
          </div>
        </div>
      </section>

      <div className="ficha-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === "equipe" && (
        <section className="panel">
          <div className="panel-head">
            <div><h3>Equipe</h3><span>{equipe.length} funcionário(s)</span></div>
            <button className="primary" onClick={() => setEmployeeModal({mode: "create", employee: {condominio: condominio.nome}})}>Novo funcionário</button>
          </div>
          <DataTable
            rows={equipe}
            type="employees"
            onEdit={(row) => setEmployeeModal({mode: "edit", employee: row})}
            onToggleStatus={(row) => setDismissModal(row)}
            onConfirmCargo={confirmCargo}
            emptyIcon="users"
            emptyTitle="Nenhum funcionário alocado neste condomínio"
            emptyActionLabel="Novo funcionário"
            onEmptyAction={() => setEmployeeModal({mode: "create", employee: {condominio: condominio.nome}})}
          />
        </section>
      )}

      {tab === "postos" && (
        <>
          <section className="panel">
            <div className="panel-head">
              <div><h3>Postos de trabalho</h3><span>{meusPostos.length}</span></div>
              <button className="primary" onClick={() => setPostoModal({mode: "create", posto: {condominio_id: id}})}>Novo posto</button>
            </div>
            {!meusPostos.length ? (
              <EmptyState icon="calendar" title="Cadastre o primeiro posto para montar a escala" actionLabel="Novo posto" onAction={() => setPostoModal({mode: "create", posto: {condominio_id: id}})} />
            ) : (
              <div className="table-wrap"><table><thead><tr><th>Posto</th><th>Cargo</th><th>Turno</th><th>Status</th><th>Ações</th></tr></thead><tbody>
                {meusPostos.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td><td>{cargoLabel(p.cargo)}</td><td>{p.turno || "—"}</td>
                    <td><span className={"badge " + (p.status === "inativo" ? "warn" : "")}>{p.status === "inativo" ? "Inativo" : "Ativo"}</span></td>
                    <td className="row-actions"><button className="link-btn" onClick={() => setPostoModal({mode: "edit", posto: p})}>Editar</button></td>
                  </tr>
                ))}
              </tbody></table></div>
            )}
          </section>
          <section className="panel">
            <div className="panel-head"><h3>Escala da semana</h3></div>
            {!escalaGrid.items.filter((it: any) => meusPostoIds.has(it.posto?.id)).length ? (
              <EmptyState icon="calendar" title="Nenhum posto ativo nesta semana" />
            ) : (
              <div className="table-wrap"><table className="escala-grid"><thead><tr>
                <th>Posto</th>
                {escalaGrid.datas.map((dia: string) => <th key={dia}>{formatDate(dia)}</th>)}
              </tr></thead><tbody>
                {escalaGrid.items.filter((it: any) => meusPostoIds.has(it.posto?.id)).map(({posto, escalas_por_dia}: any) => (
                  <tr key={posto.id}>
                    <td><b>{posto.nome}</b></td>
                    {escalaGrid.datas.map((dia: string) => {
                      const escala = escalas_por_dia[dia];
                      const estado = escala?.status === "falta" ? "cell-danger" : escala?.status === "substituido" ? "cell-warn" : escala?.funcionario_id ? "cell-ok" : "cell-vago";
                      return <td key={dia}><span className={"escala-cell " + estado}>{escala?.funcionario?.nome ? escala.funcionario.nome.split(" ")[0] : "Vago"}</span></td>;
                    })}
                  </tr>
                ))}
              </tbody></table></div>
            )}
          </section>
        </>
      )}

      {tab === "contrato" && (
        <section className="panel">
          <div className="panel-head">
            <div><h3>Contratos</h3><span>{meusContratos.length}</span></div>
            <button className="primary" onClick={() => setContratoModal({mode: "create", contrato: {condominio_id: id}})}>Novo contrato</button>
          </div>
          {!meusContratos.length ? (
            <EmptyState icon="briefcase" title="Nenhum contrato cadastrado" actionLabel="Novo contrato" onAction={() => setContratoModal({mode: "create", contrato: {condominio_id: id}})} />
          ) : (
            <div className="results">
              {meusContratos.map((c: any) => (
                <article key={c.id} className="result">
                  <div><b>{c.objeto || "Contrato"}</b><span>{c.status === "encerrado" ? "Encerrado" : "Ativo"}</span></div>
                  <p>{formatMoney(c.valor_mensal)}/mês · vigência {[formatDate(c.data_inicio), formatDate(c.data_fim)].filter(s => s !== "—").join(" a ") || "—"}</p>
                  <button className="link-btn" onClick={() => setContratoModal({mode: "edit", contrato: c})}>Editar</button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "ocorrencias" && (
        <section className="panel">
          <div className="panel-head">
            <div><h3>Ocorrências</h3><span>{minhasOcorrencias.length}</span></div>
            <button className="primary" onClick={() => setOcorrenciaModal({condominioId: id})}>Nova ocorrência</button>
          </div>
          {!minhasOcorrencias.length ? (
            <EmptyState icon="alert-triangle" title="Nenhuma ocorrência registrada" actionLabel="Nova ocorrência" onAction={() => setOcorrenciaModal({condominioId: id})} />
          ) : (
            <div className="results">
              {minhasOcorrencias.map((o: any) => (
                <article key={o.id} className={"result " + (o.status === "resolvida" ? "" : o.status === "em_andamento" ? "duplicado" : "erro")}>
                  <div><b>{o.titulo}</b><span>{STATUS_OCORRENCIA_LABEL[o.status] || o.status}</span></div>
                  <p>{o.descricao || "Sem descrição"}</p>
                  <div className="row-actions">
                    {o.status !== "em_andamento" && o.status !== "resolvida" && <button className="link-btn" onClick={() => marcarOcorrencia(o.id, "em_andamento")}>Marcar em andamento</button>}
                    {o.status !== "resolvida" && <button className="link-btn" onClick={() => marcarOcorrencia(o.id, "resolvida")}>Resolver</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "folhas" && (
        <section className="panel">
          <div className="panel-head"><h3>Folhas de ponto</h3><span>{folhasDePonto.length}</span></div>
          {!folhasDePonto.length ? (
            <EmptyState icon="file-text" title="Nenhuma folha de ponto enviada" actionLabel="Enviar documento" href="/documentos/enviar" />
          ) : (
            <div className="table-wrap"><table><thead><tr><th>Competência</th><th>Ano</th><th>Arquivo</th></tr></thead><tbody>
              {folhasDePonto.map((d: any) => (
                <tr key={d.id}>
                  <td>{d.competencia ? formatCompetencia(d.competencia) : "Sem competência definida"}</td>
                  <td>{d.ano || "—"}</td>
                  <td className="row-actions">{d.arquivo_drive_url && <button type="button" className="link-btn" onClick={() => openPreview(d)}>Visualizar</button>}</td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </section>
      )}

      {tab === "financeiro" && (
        <section className="panel">
          <div className="panel-head"><h3>Financeiro</h3><span>{meuFinanceiro.length} lançamentos</span></div>
          {!meuFinanceiro.length ? (
            <EmptyState icon="dollar-sign" title="Nenhum lançamento para este condomínio" actionLabel="Ver financeiro" href="/financeiro" />
          ) : (
            <div className="table-wrap"><table><thead><tr><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>
              {meuFinanceiro.map((l: any) => (
                <tr key={l.id}>
                  <td>{l.categoria || l.descricao || "—"}</td>
                  <td>{formatMoney(l.valor)}</td>
                  <td>{formatDate(l.vencimento)}</td>
                  <td><span className={"badge " + (l.status_calculado === "atrasado" ? "danger" : l.status_calculado === "pago" ? "" : "warn")}>{LANCAMENTO_STATUS_LABEL[l.status_calculado] || l.status_calculado}</span></td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </section>
      )}
    </>
  );
}
