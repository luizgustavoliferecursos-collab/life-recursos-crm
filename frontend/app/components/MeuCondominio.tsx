"use client";

import { localDateISO, formatMoney, formatDate, LANCAMENTO_STATUS_LABEL, STATUS_OCORRENCIA_LABEL, cargoLabel } from "../lib/ui";

export function MeuCondominio({me, condominios, contratos, postos, escalaGrid, lancamentos, ocorrencias, onNovaOcorrencia}: {me: any; condominios: any[]; contratos: any[]; postos: any[]; escalaGrid: {datas: string[]; items: any[]}; lancamentos: any[]; ocorrencias: any[]; onNovaOcorrencia: (condominioId: string) => void}) {
  const condominio = condominios.find((c: any) => c.id === me?.condominio_id);
  const meusContratos = contratos.filter((c: any) => c.condominio_id === me?.condominio_id);
  const meusPostos = postos.filter((p: any) => p.condominio_id === me?.condominio_id);
  const meuFinanceiro = lancamentos.filter((l: any) => l.condominio_id === me?.condominio_id);
  const minhasOcorrencias = ocorrencias.filter((o: any) => o.condominio_id === me?.condominio_id);
  const hojeISO = localDateISO();
  const escalaPorPosto = (postoId: string) => {
    const item = escalaGrid.items.find((e: any) => e.posto?.id === postoId);
    return item?.escalas_por_dia?.[hojeISO];
  };

  if (!condominio) {
    return <section className="panel"><div className="empty">Nenhum condomínio vinculado a este usuário ainda. Peça para um administrador configurar.</div></section>;
  }

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">SEU CONDOMÍNIO</p>
          <h2>{condominio.nome}</h2>
          <p>{condominio.endereco || "Endereço não cadastrado"}{condominio.cidade ? ` · ${condominio.cidade}` : ""}</p>
        </div>
      </section>
      <section className="grid-two">
        <div className="panel">
          <div className="panel-head"><h3>Contrato vigente</h3></div>
          {!meusContratos.length ? <div className="empty">Nenhum contrato cadastrado.</div> : (
            <div className="results">
              {meusContratos.map((c: any) => (
                <article key={c.id} className="result">
                  <div><b>{c.objeto || "Contrato"}</b><span>{c.status === "encerrado" ? "Encerrado" : "Ativo"}</span></div>
                  <p>{formatMoney(c.valor_mensal)}/mês · vigência {[formatDate(c.data_inicio), formatDate(c.data_fim)].filter(s => s !== "—").join(" a ") || "—"}</p>
                </article>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Postos de trabalho</h3><span>{meusPostos.length}</span></div>
          {!meusPostos.length ? <div className="empty">Nenhum posto cadastrado.</div> : (
            <div className="table-wrap"><table><thead><tr><th>Posto</th><th>Cargo</th><th>Turno</th><th>Hoje</th></tr></thead><tbody>
              {meusPostos.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.nome}</td><td>{cargoLabel(p.cargo)}</td><td>{p.turno || "—"}</td>
                  <td>{escalaPorPosto(p.id)?.funcionario?.nome || "Vago"}</td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h3>Financeiro</h3><span>{meuFinanceiro.length} lançamentos</span></div>
        {!meuFinanceiro.length ? <div className="empty">Nenhum lançamento.</div> : (
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
      <section className="panel">
        <div className="panel-head">
          <div><h3>Ocorrências</h3><span>{minhasOcorrencias.length} registrada(s)</span></div>
          <button className="primary" onClick={() => onNovaOcorrencia(condominio.id)}>Nova ocorrência</button>
        </div>
        {!minhasOcorrencias.length ? <div className="empty">Nenhuma ocorrência registrada ainda.</div> : (
          <div className="results">
            {minhasOcorrencias.map((o: any) => (
              <article key={o.id} className={"result " + (o.status === "resolvida" ? "" : o.status === "em_andamento" ? "duplicado" : "erro")}>
                <div><b>{o.titulo}</b><span>{STATUS_OCORRENCIA_LABEL[o.status] || o.status}</span></div>
                <p>{o.descricao || "Sem descrição"}</p>
                {o.resposta && <p><b>Resposta:</b> {o.resposta}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
