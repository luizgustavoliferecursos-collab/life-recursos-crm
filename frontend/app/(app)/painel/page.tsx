"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useCrm } from "../../lib/CrmContext";
import { CHART_TOOLTIP_STYLE, Icon, formatMoney, localDateISO } from "../../lib/ui";
import { EmptyState } from "../../components/EmptyState";

const DONUT_COLORS: Record<string, string> = {
  "Em dia": "#16a34a",
  Vencendo: "#f59e0b",
  Vencidos: "#ef4444",
  Faltando: "#dc2626",
};

export default function PainelPage() {
  const {
    dashboard, funcionarios, condominios, postos, escalaGrid, documentos, onboarding, lancamentos,
  } = useCrm();

  const funcionariosAtivos = useMemo(() => funcionarios.filter((f: any) => f.status !== "inativo").length, [funcionarios]);

  const hojeISO = localDateISO();
  const {postosAtivos, postosCobertos} = useMemo(() => {
    const ativos = postos.filter((p: any) => p.status !== "inativo");
    const cobertos = ativos.filter((p: any) => {
      const item = escalaGrid.items.find((e: any) => e.posto?.id === p.id);
      const escala = item?.escalas_por_dia?.[hojeISO];
      return escala?.funcionario_id && escala.status !== "falta";
    });
    return {postosAtivos: ativos.length, postosCobertos: cobertos.length};
  }, [postos, escalaGrid, hojeISO]);

  const resultadoMes = (dashboard?.financeiro?.a_receber ?? 0) - (dashboard?.financeiro?.a_pagar ?? 0);

  const atencao = useMemo(() => {
    const itens: {id: string; titulo: string; detalhe: string; href: string; acao: string}[] = [];
    for (const d of (dashboard?.vencimentos || []).filter((d: any) => d.status_validade === "vencido").slice(0, 5)) {
      itens.push({
        id: `doc-${d.id}`,
        titulo: `${d.tipo_documento || "Documento"} vencido`,
        detalhe: d.funcionarios?.nome || d.condominios?.nome || "",
        href: d.funcionario_id ? `/funcionarios/${d.funcionario_id}` : "/documentos",
        acao: "Resolver",
      });
    }
    const postosDescobertos = postos.filter((p: any) => {
      if (p.status === "inativo") return false;
      const item = escalaGrid.items.find((e: any) => e.posto?.id === p.id);
      const escala = item?.escalas_por_dia?.[hojeISO];
      return !escala?.funcionario_id || escala.status === "falta";
    });
    for (const p of postosDescobertos.slice(0, 5)) {
      itens.push({id: `posto-${p.id}`, titulo: `Posto descoberto hoje: ${p.nome}`, detalhe: p.condominios?.nome || "", href: "/postos", acao: "Escalar"});
    }
    const contasAtrasadas = lancamentos.filter((l: any) => l.status_calculado === "atrasado");
    for (const l of contasAtrasadas.slice(0, 5)) {
      itens.push({
        id: `lanc-${l.id}`,
        titulo: `${l.tipo === "receita" ? "Recebimento" : "Pagamento"} atrasado`,
        detalhe: `${l.condominios?.nome || l.funcionarios?.nome || ""} · ${formatMoney(l.valor)}`,
        href: "/financeiro",
        acao: "Resolver",
      });
    }
    for (const p of (dashboard?.pendencias || []).slice(0, 5)) {
      itens.push({id: `cargo-${p.id}`, titulo: `${p.nome} sem cargo definido`, detalhe: p.condominio || "", href: "/funcionarios", acao: "Definir cargo"});
    }
    return itens;
  }, [dashboard, postos, escalaGrid, hojeISO, lancamentos]);

  const porCondominio = useMemo(() => {
    return condominios.map((c: any) => {
      const equipe = funcionarios.filter((f: any) => f.condominio === c.nome && f.status !== "inativo");
      const equipeIds = new Set(equipe.map((f: any) => f.id));
      const docsEquipe = documentos.filter((d: any) => equipeIds.has(d.funcionario_id) && d.status_validade !== "nao_aplicavel");
      const emDia = docsEquipe.filter((d: any) => d.status_validade === "valido").length;
      const pctDocs = docsEquipe.length ? Math.round((emDia / docsEquipe.length) * 100) : null;
      const financeiroCondo = lancamentos.filter((l: any) => l.condominio_id === c.id);
      const atrasados = financeiroCondo.filter((l: any) => l.status_calculado === "atrasado").length;
      return {condominio: c, equipe: equipe.length, pctDocs, atrasados};
    });
  }, [condominios, funcionarios, documentos, lancamentos]);

  const donutData = useMemo(() => {
    const faltando = onboarding.reduce((sum: number, o: any) => sum + (o.documentos_faltantes?.length || 0), 0);
    return [
      {name: "Em dia", value: documentos.filter((d: any) => d.status_validade === "valido").length},
      {name: "Vencendo", value: documentos.filter((d: any) => d.status_validade === "vencendo").length},
      {name: "Vencidos", value: documentos.filter((d: any) => d.status_validade === "vencido").length},
      {name: "Faltando", value: faltando},
    ].filter(d => d.value > 0);
  }, [documentos, onboarding]);

  return (
    <>
      <section className="panel-head" style={{marginBottom: 18}}>
        <div><p className="eyebrow">BASE DO CRM</p><h2 style={{margin: "4px 0 0", fontSize: 22}}>Painel do dono</h2></div>
        <Link href="/documentos/enviar" className="primary">Enviar documentos</Link>
      </section>

      <section className="stats">
        <article>
          <div className="stat-icon"><Icon name="users" size={16} /></div><span>Funcionários ativos</span>
          {!funcionarios.length ? <EmptyState icon="users" title="Configurar" actionLabel="Configurar" href="/funcionarios" /> : <><strong>{funcionariosAtivos}</strong><small>Total na base</small></>}
        </article>
        <article className={postosAtivos > 0 && postosCobertos < postosAtivos ? "alert-stat" : undefined}>
          <div className="stat-icon"><Icon name="calendar" size={16} /></div><span>Postos cobertos hoje</span>
          {!postosAtivos ? <EmptyState icon="calendar" title="Configurar" actionLabel="Configurar" href="/postos" /> : <><strong>{postosCobertos}/{postosAtivos}</strong><small>Escala de hoje</small></>}
        </article>
        <article className={(dashboard?.vencidos ?? 0) > 0 ? "alert-stat" : undefined}>
          <div className="stat-icon"><Icon name="bell" size={16} /></div><span>Documentos vencidos + vencendo</span>
          <strong>{(dashboard?.vencidos ?? 0) + (dashboard?.vencendo ?? 0)}</strong><small>{dashboard?.vencidos ?? 0} vencidos · {dashboard?.vencendo ?? 0} vencendo</small>
        </article>
        <article>
          <div className={"stat-icon " + (resultadoMes >= 0 ? "green" : "red")}><Icon name="dollar-sign" size={16} /></div><span>Resultado do mês</span>
          {!lancamentos.length ? <EmptyState icon="dollar-sign" title="Configurar" actionLabel="Configurar" href="/financeiro" /> : <><strong style={{color: resultadoMes >= 0 ? "var(--green)" : "var(--red)"}}>{formatMoney(resultadoMes)}</strong><small>A receber − a pagar</small></>}
        </article>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Precisa da sua atenção</h3><span>{atencao.length} item(ns)</span></div>
        {!atencao.length ? (
          <EmptyState icon="check-circle" title="Tudo em dia" description="Nenhum documento vencido, posto descoberto, conta atrasada ou funcionário sem cargo." />
        ) : (
          <div className="results">
            {atencao.map(item => (
              <article key={item.id} className="result erro">
                <div><b>{item.titulo}</b><span>{item.detalhe}</span></div>
                <Link className="link-btn" href={item.href}>{item.acao} ↗</Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="chart-grid-even">
        <div className="panel">
          <div className="panel-head"><h3>Documentos por status</h3><span>{documentos.length} no total</span></div>
          {!donutData.length ? <div className="empty">Nenhum documento registrado.</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {donutData.map((row) => <Cell key={row.name} fill={DONUT_COLORS[row.name] || "#94a3b8"} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{fontSize: 12}} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Documentos recentes</h3><span>Últimos itens</span></div>
          {!dashboard?.recentes?.length ? (
            <EmptyState icon="file-text" title="Nenhum documento ainda" actionLabel="Enviar documento" href="/documentos/enviar" />
          ) : (
            <div className="results">
              {dashboard.recentes.slice(0, 5).map((d: any) => (
                <article key={d.id} className="result">
                  <div><b>{d.tipo_documento || d.arquivo_nome}</b><span>{d.status_validade}</span></div>
                  <p>{d.funcionarios?.nome || d.condominios?.nome || "—"}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Por condomínio</h3><span>{porCondominio.length} condomínio(s)</span></div>
        {!porCondominio.length ? (
          <EmptyState icon="building" title="Configurar" actionLabel="Configurar" href="/condominios" />
        ) : (
          <div className="table-wrap"><table><thead><tr><th>Condomínio</th><th>Equipe</th><th>Documentação em dia</th><th>Financeiro</th></tr></thead><tbody>
            {porCondominio.map((row: any) => (
              <tr key={row.condominio.id} className="clickable-row" onClick={() => window.location.assign(`/condominios/${row.condominio.id}`)}>
                <td><Link href={`/condominios/${row.condominio.id}`} className="link-btn">{row.condominio.nome}</Link></td>
                <td>{row.equipe}</td>
                <td>{row.pctDocs === null ? "—" : <span className={"badge " + (row.pctDocs >= 90 ? "" : row.pctDocs >= 60 ? "warn" : "danger")}>{row.pctDocs}%</span>}</td>
                <td>{row.atrasados > 0 ? <span className="badge danger">{row.atrasados} atrasado(s)</span> : <span className="badge">Em dia</span>}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </>
  );
}
