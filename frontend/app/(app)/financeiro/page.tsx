"use client";

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { useCrm } from "../../lib/CrmContext";
import { CHART_PALETTE, CHART_TOOLTIP_STYLE, Icon, LANCAMENTO_STATUS_LABEL, formatDate, formatMoney } from "../../lib/ui";
import { EmptyState } from "../../components/EmptyState";

export default function FinanceiroPage() {
  const {
    financeiroStats, lancamentoFiltro, lancamentoTipoFiltro, filtrarFinanceiro, setLancamentoTipoFiltro, setLancamentoFiltro,
    filteredLancamentos, lancamentos, gerarMensalidades, setLancamentoModal, marcarPago,
  } = useCrm();
  return (
    <>
      <section className="stats fin-kpis">
        <article className={"clickable" + (!lancamentoFiltro && lancamentoTipoFiltro === "receita" ? " active" : "")} onClick={() => filtrarFinanceiro("", "receita")}>
          <div className="stat-icon green"><Icon name="trending-up" size={17} /></div>
          <span>A receber</span>
          <strong>{formatMoney(financeiroStats.aReceber)}</strong>
          <small>Pendente + atrasado</small>
        </article>
        <article className={"clickable" + (!lancamentoFiltro && lancamentoTipoFiltro === "despesa" ? " active" : "")} onClick={() => filtrarFinanceiro("", "despesa")}>
          <div className="stat-icon"><Icon name="trending-down" size={17} /></div>
          <span>A pagar</span>
          <strong>{formatMoney(financeiroStats.aPagar)}</strong>
          <small>Pendente + atrasado</small>
        </article>
        <article className={"clickable" + (lancamentoFiltro === "pago" && lancamentoTipoFiltro === "receita" ? " active" : "")} onClick={() => filtrarFinanceiro("pago", "receita")}>
          <div className="stat-icon green"><Icon name="wallet" size={17} /></div>
          <span>Recebido este mês</span>
          <strong>{formatMoney(financeiroStats.recebidoMes)}</strong>
          <small>Pago no mês atual</small>
        </article>
        <article className={"clickable" + (lancamentoFiltro === "pago" && lancamentoTipoFiltro === "despesa" ? " active" : "")} onClick={() => filtrarFinanceiro("pago", "despesa")}>
          <div className="stat-icon"><Icon name="wallet" size={17} /></div>
          <span>Pago este mês</span>
          <strong>{formatMoney(financeiroStats.pagoMes)}</strong>
          <small>Despesas quitadas</small>
        </article>
        <article>
          <div className={"stat-icon " + (financeiroStats.saldoMes >= 0 ? "green" : "red")}><Icon name="bar-chart" size={17} /></div>
          <span>Saldo do mês</span>
          <strong style={{color: financeiroStats.saldoMes >= 0 ? "var(--green)" : "var(--red)"}}>{formatMoney(financeiroStats.saldoMes)}</strong>
          <small>Recebido − pago</small>
        </article>
        <article className={"alert-stat clickable" + (lancamentoFiltro === "atrasado" && !lancamentoTipoFiltro ? " active" : "")} onClick={() => filtrarFinanceiro("atrasado", "")}>
          <div className="stat-icon"><Icon name="alert-triangle" size={17} /></div>
          <span>Inadimplência</span>
          <strong>{formatMoney(financeiroStats.inadimplencia)}</strong>
          <small>Vencido sem pagamento</small>
        </article>
      </section>

      <section className="chart-grid">
        <div className="panel">
          <div className="panel-head"><h3>Receita x despesa</h3><span>Últimos {financeiroStats.serieMensal.length || 6} meses</span></div>
          {!financeiroStats.serieMensal.length ? <div className="empty">Sem lançamentos com data suficiente.</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={financeiroStats.serieMensal}>
                <CartesianGrid stroke="#eef0f6" vertical={false} />
                <XAxis dataKey="mes" tick={{fontSize: 12, fill: "#6b7280"}} axisLine={{stroke: "#e7e9f0"}} tickLine={false} />
                <YAxis tick={{fontSize: 11, fill: "#9aa1ac"}} axisLine={false} tickLine={false} width={68} tickFormatter={v => formatMoney(v)} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: any) => formatMoney(v)} />
                <Legend wrapperStyle={{fontSize: 12}} />
                <Bar dataKey="receita" name="Receita" fill="#16a34a" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#2563eb" strokeWidth={2.5} dot={{r: 3}} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Despesas por categoria</h3><span>Distribuição</span></div>
          {!financeiroStats.distribuicaoCategorias.length ? <div className="empty">Sem despesas registradas.</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={financeiroStats.distribuicaoCategorias} dataKey="valor" nameKey="nome" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {financeiroStats.distribuicaoCategorias.map((_: any, i: number) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: any) => formatMoney(v)} />
                <Legend wrapperStyle={{fontSize: 11.5}} layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {!!financeiroStats.condominiosOrdenados.length && (
        <section className="panel">
          <div className="panel-head"><h3>Receita por condomínio</h3><span>Top {financeiroStats.condominiosOrdenados.length}</span></div>
          <ResponsiveContainer width="100%" height={Math.max(180, financeiroStats.condominiosOrdenados.length * 44)}>
            <ComposedChart data={financeiroStats.condominiosOrdenados} layout="vertical" margin={{left: 8}}>
              <CartesianGrid stroke="#eef0f6" horizontal={false} />
              <XAxis type="number" tick={{fontSize: 11, fill: "#9aa1ac"}} axisLine={false} tickLine={false} tickFormatter={v => formatMoney(v)} />
              <YAxis type="category" dataKey="nome" tick={{fontSize: 12.5, fill: "#13151a"}} axisLine={false} tickLine={false} width={150} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: any) => formatMoney(v)} />
              <Bar dataKey="valor" name="Receita" fill="#2563eb" radius={[0, 6, 6, 0]} maxBarSize={22} />
            </ComposedChart>
          </ResponsiveContainer>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Lançamentos</h3>
            <span>{filteredLancamentos.length} de {lancamentos.length} lançamentos{(lancamentoFiltro || lancamentoTipoFiltro) ? " (filtrado)" : ""}</span>
          </div>
          <div className="row-actions">
            <select value={lancamentoTipoFiltro} onChange={e => setLancamentoTipoFiltro(e.target.value)}>
              <option value="">Receita e despesa</option>
              <option value="receita">Só receita</option>
              <option value="despesa">Só despesa</option>
            </select>
            <select value={lancamentoFiltro} onChange={e => setLancamentoFiltro(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
              <option value="pago">Pago</option>
            </select>
            {(lancamentoFiltro || lancamentoTipoFiltro) && <button className="link-btn" onClick={() => filtrarFinanceiro("", "")}>Limpar filtros</button>}
            <button onClick={gerarMensalidades}>Gerar cobranças do mês</button>
            <button className="primary" onClick={() => setLancamentoModal({mode: "create", lancamento: {}})}>Novo lançamento</button>
          </div>
        </div>
        {!filteredLancamentos.length ? (
          <EmptyState
            icon="dollar-sign"
            title="Nenhum lançamento encontrado"
            description={lancamentoFiltro || lancamentoTipoFiltro ? "Nenhum lançamento corresponde a este filtro." : "Cadastre o primeiro lançamento financeiro."}
            actionLabel="Novo lançamento"
            onAction={() => setLancamentoModal({mode: "create", lancamento: {}})}
          />
        ) : (
          <div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Condomínio/Funcionário</th><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>
            {filteredLancamentos.map((l: any) => <tr key={l.id}>
              <td><span className={"badge " + (l.tipo === "despesa" ? "warn" : "")}><Icon name={l.tipo === "receita" ? "trending-up" : "trending-down"} size={12} />{l.tipo === "receita" ? "Receita" : "Despesa"}</span></td>
              <td>{l.condominios?.nome || l.funcionarios?.nome || "—"}</td>
              <td>{l.categoria || l.descricao || "—"}</td>
              <td style={{color: l.tipo === "despesa" ? "var(--red)" : "var(--green)", fontWeight: 700}}>{formatMoney(l.valor)}</td>
              <td>{formatDate(l.vencimento)}</td>
              <td><span className={"badge " + (l.status_calculado === "atrasado" ? "danger" : l.status_calculado === "pago" ? "" : "warn")}>{LANCAMENTO_STATUS_LABEL[l.status_calculado] || l.status_calculado}</span></td>
              <td className="row-actions">
                <button className="link-btn" onClick={() => setLancamentoModal({mode: "edit", lancamento: l})}>Editar</button>
                {l.status_calculado !== "pago" && <button className="link-btn" onClick={() => marcarPago(l.id)}>Marcar pago</button>}
              </td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>
    </>
  );
}
