"use client";

import { useCrm } from "../../lib/CrmContext";
import { downloadCsv, formatMoney } from "../../lib/ui";

export default function RelatoriosPage() {
  const {relatorios, funcionarios, documentos, lancamentos} = useCrm();
  return (
    <>
      <section className="stats">
        <article><span>Turnover (90 dias)</span><strong>{relatorios.turnover?.taxa_pct ?? 0}%</strong><small>{relatorios.turnover?.desligados_periodo ?? 0} desligados · {relatorios.turnover?.ativos ?? 0} ativos</small></article>
        <article><span>Absenteísmo (30 dias)</span><strong>{relatorios.absenteismo?.taxa_pct ?? 0}%</strong><small>{relatorios.absenteismo?.faltas_periodo ?? 0} faltas de {relatorios.absenteismo?.total_escalas_periodo ?? 0} escalas</small></article>
      </section>
      <section className="panel">
        <div className="panel-head"><h3>Faturamento por condomínio</h3><span>Mês atual</span></div>
        {!relatorios.faturamento_por_condominio?.length ? <div className="empty">Sem contratos ativos.</div> : (
          <div className="table-wrap"><table><thead><tr><th>Condomínio</th><th>Previsto mensal</th><th>Faturado este mês</th></tr></thead><tbody>
            {relatorios.faturamento_por_condominio.map((r: any) => <tr key={r.condominio_id}>
              <td>{r.condominio}</td>
              <td>{formatMoney(r.previsto_mensal)}</td>
              <td>{formatMoney(r.faturado_mes)}</td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div><h3>Margem por condomínio</h3><span>Mês {relatorios.mes_referencia || "atual"} · receita do contrato vs. custo de mão de obra</span></div>
        </div>
        <p className="muted" style={{margin: "0 0 14px"}}>Custo de mão de obra estimado a partir do salário-base dos funcionários escalados em cada posto no mês (rateado quando alguém cobre postos diferentes). Indicador aproximado, não substitui o cálculo contábil exato.</p>
        {!relatorios.margem_por_condominio?.length ? <div className="empty">Sem condomínios ativos.</div> : (
          <div className="table-wrap"><table><thead><tr><th>Condomínio</th><th>Receita mensal</th><th>Custo de mão de obra</th><th>Margem</th><th>Postos (custo)</th></tr></thead><tbody>
            {relatorios.margem_por_condominio.map((r: any) => <tr key={r.condominio_id}>
              <td>{r.condominio}</td>
              <td>{formatMoney(r.receita_mensal)}</td>
              <td>{formatMoney(r.custo_mao_de_obra)}</td>
              <td style={{color: r.margem < 0 ? "var(--red)" : "var(--green)", fontWeight: 700}}>{formatMoney(r.margem)}{r.margem_pct !== null ? ` (${r.margem_pct}%)` : ""}</td>
              <td>{r.postos?.length ? r.postos.map((p: any) => `${p.posto}: ${formatMoney(p.custo_mao_de_obra)}`).join(" · ") : "—"}</td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div><h3>Horas trabalhadas / extras</h3><span>Mês {relatorios.mes_referencia || "atual"} · estimado a partir da escala</span></div>
        </div>
        <p className="muted" style={{margin: "0 0 14px"}}>Aproximação para apoiar a folha (12x36 = 12h/dia, 6x1 e comercial = 8h/dia), acima de {relatorios.limite_mensal_horas ?? 220}h/mês conta como hora extra. Não substitui o cálculo legal exato.</p>
        {!relatorios.horas_por_funcionario?.length ? <div className="empty">Nenhuma escala registrada no mês.</div> : (
          <div className="table-wrap"><table><thead><tr><th>Funcionário</th><th>Cargo</th><th>Condomínio</th><th>Dias trabalhados</th><th>Horas trabalhadas</th><th>Horas extras</th></tr></thead><tbody>
            {relatorios.horas_por_funcionario.map((r: any) => <tr key={r.funcionario_id}>
              <td>{r.funcionario}</td>
              <td>{r.cargo || "—"}</td>
              <td>{r.condominio || "—"}</td>
              <td>{r.dias_trabalhados}</td>
              <td>{r.horas_trabalhadas}h</td>
              <td>{r.horas_extras > 0 ? <span className="badge warn">{r.horas_extras}h</span> : "—"}</td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>
      <section className="panel">
        <div className="panel-head"><h3>Exportar dados</h3><span>CSV, abre direto no Excel/Sheets</span></div>
        <div className="row-actions">
          <button onClick={() => downloadCsv("funcionarios.csv", funcionarios, [
            {key: "nome", label: "Nome"}, {key: "cargo", label: "Cargo"}, {key: "condominio", label: "Condomínio"},
            {key: "status", label: "Status"}, {key: "cpf", label: "CPF"}, {key: "telefone", label: "Telefone"},
            {key: "data_admissao", label: "Admissão"}, {key: "data_desligamento", label: "Demissão"},
            {key: "motivo_desligamento", label: "Motivo do desligamento"},
          ])}>Exportar funcionários</button>
          <button onClick={() => downloadCsv("documentos.csv", documentos, [
            {key: "tipo_documento", label: "Tipo"}, {key: "ano", label: "Ano"},
            {key: "data_validade", label: "Validade"}, {key: "status_validade", label: "Status"},
          ])}>Exportar documentos</button>
          <button onClick={() => downloadCsv("financeiro.csv", lancamentos, [
            {key: "tipo", label: "Tipo"}, {key: "categoria", label: "Categoria"}, {key: "valor", label: "Valor"},
            {key: "vencimento", label: "Vencimento"}, {key: "status_calculado", label: "Status"},
          ])}>Exportar financeiro</button>
          <button onClick={() => downloadCsv("horas-trabalhadas.csv", relatorios.horas_por_funcionario || [], [
            {key: "funcionario", label: "Funcionário"}, {key: "cargo", label: "Cargo"}, {key: "condominio", label: "Condomínio"},
            {key: "dias_trabalhados", label: "Dias trabalhados"}, {key: "horas_trabalhadas", label: "Horas trabalhadas"},
            {key: "horas_extras", label: "Horas extras"},
          ])}>Exportar horas</button>
        </div>
      </section>
    </>
  );
}
