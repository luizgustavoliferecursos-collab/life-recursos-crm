"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useCrm } from "../../lib/CrmContext";
import { CHART_TOOLTIP_STYLE, Icon, formatMoney, localDateISO, statusValidadeLabel, STATUS_VALIDADE_CLASS, tipoDocLabel } from "../../lib/ui";
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
    const itens: {id: string; titulo: string; detalhe: string; href: string; acao: string; sev: "danger" | "warn" | "info"}[] = [];
    for (const d of (dashboard?.vencimentos || []).filter((d: any) => d.status_validade === "vencido").slice(0, 5)) {
      itens.push({
        id: `doc-${d.id}`,
        titulo: `${tipoDocLabel(d.tipo_documento)} vencido`,
        detalhe: d.funcionarios?.nome || d.condominios?.nome || "",
        href: d.funcionario_id ? `/funcionarios/${d.funcionario_id}` : "/documentos",
        acao: "Resolver",
        sev: "danger",
      });
    }
    const postosDescobertos = postos.filter((p: any) => {
      if (p.status === "inativo") return false;
      const item = escalaGrid.items.find((e: any) => e.posto?.id === p.id);
      const escala = item?.escalas_por_dia?.[hojeISO];
      return !escala?.funcionario_id || escala.status === "falta";
    });
    for (const p of postosDescobertos.slice(0, 5)) {
      itens.push({id: `posto-${p.id}`, titulo: `Posto descoberto hoje: ${p.nome}`, detalhe: p.condominios?.nome || "", href: "/postos", acao: "Escalar", sev: "danger"});
    }
    const contasAtrasadas = lancamentos.filter((l: any) => l.status_calculado === "atrasado");
    for (const l of contasAtrasadas.slice(0, 5)) {
      itens.push({
        id: `lanc-${l.id}`,
        titulo: `${l.tipo === "receita" ? "Recebimento" : "Pagamento"} atrasado`,
        detalhe: `${l.condominios?.nome || l.funcionarios?.nome || ""} · ${formatMoney(l.valor)}`,
        href: "/financeiro",
        acao: "Resolver",
        sev: "warn",
      });
    }
    for (const p of (dashboard?.pendencias || []).slice(0, 5)) {
      itens.push({id: `cargo-${p.id}`, titulo: `${p.nome} sem cargo definido`, detalhe: p.condominio || "", href: p.id ? `/funcionarios/${p.id}` : "/funcionarios", acao: "Definir cargo", sev: "info"});
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

  const hoje = new Date().toLocaleDateString("pt-BR", {weekday: "long", day: "numeric", month: "long"});
  const totalDocsAlerta = (dashboard?.vencidos ?? 0) + (dashboard?.vencendo ?? 0);

  return (
    <>
      <section className="page-intro">
        <p><span className="live-dot" /> {hoje.charAt(0).toUpperCase() + hoje.slice(1)} · resumo da operação</p>
        <Link href="/documentos/enviar" className="primary"><Icon name="upload" size={15} /> Enviar documentos</Link>
      </section>

      <section className="kpis">
        <Kpi icon="users" label="Funcionários ativos"
          value={funcionarios.length ? String(funcionariosAtivos) : null}
          sub="Total na base" cta="Cadastrar funcionários" href="/funcionarios" />
        <Kpi icon="calendar" label="Postos cobertos hoje" tone={postosAtivos > 0 && postosCobertos < postosAtivos ? "warn" : undefined}
          value={postosAtivos ? `${postosCobertos}/${postosAtivos}` : null}
          sub={postosAtivos && postosCobertos < postosAtivos ? `${postosAtivos - postosCobertos} descoberto(s)` : "Escala de hoje"}
          cta="Cadastrar postos" href="/postos" />
        <Kpi icon="bell" label="Documentos a vencer" tone={(dashboard?.vencidos ?? 0) > 0 ? "danger" : totalDocsAlerta > 0 ? "warn" : undefined}
          value={String(totalDocsAlerta)}
          sub={`${dashboard?.vencidos ?? 0} vencido(s) · ${dashboard?.vencendo ?? 0} em 30 dias`} href="/alertas" />
        <Kpi icon="dollar-sign" label="Resultado do mês" tone={lancamentos.length && resultadoMes < 0 ? "danger" : undefined}
          value={lancamentos.length ? formatMoney(resultadoMes) : null}
          sub="A receber − a pagar" cta="Lançar receitas e despesas" href="/financeiro" />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Precisa da sua atenção</h3>
          {atencao.length > 0 && <span className="count-pill">{atencao.length}</span>}
        </div>
        {!atencao.length ? (
          <EmptyState icon="check-circle" title="Tudo em dia" description="Nenhum documento vencido, posto descoberto, conta atrasada ou funcionário sem cargo." />
        ) : (
          <ul className="attention-list">
            {atencao.map(item => (
              <li key={item.id} className={"attention-item sev-" + item.sev}>
                <span className="sev-dot" />
                <div className="attention-text"><b>{item.titulo}</b>{item.detalhe && <span>{item.detalhe}</span>}</div>
                <Link className="btn-ghost" href={item.href}>{item.acao}<Icon name="chevron-right" size={14} /></Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="chart-grid-even">
        <div className="panel">
          <div className="panel-head"><h3>Documentos por status</h3><span>{documentos.length} no total</span></div>
          {!donutData.length ? <EmptyState icon="file-text" title="Nenhum documento ainda" actionLabel="Enviar documento" href="/documentos/enviar" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                  {donutData.map((row) => <Cell key={row.name} fill={DONUT_COLORS[row.name] || "#94a3b8"} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize: 12}} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Documentos recentes</h3><Link href="/documentos" className="link-btn">Ver todos</Link></div>
          {!dashboard?.recentes?.length ? (
            <EmptyState icon="file-text" title="Nenhum documento ainda" actionLabel="Enviar documento" href="/documentos/enviar" />
          ) : (
            <ul className="row-list">
              {dashboard.recentes.slice(0, 5).map((d: any) => (
                <li key={d.id}>
                  <span className="row-icon"><Icon name="file-text" size={15} /></span>
                  <div className="row-text"><b>{tipoDocLabel(d.tipo_documento, d.arquivo_nome)}</b><span>{d.funcionarios?.nome || d.condominios?.nome || "Sem vínculo"}</span></div>
                  <span className={"badge " + (STATUS_VALIDADE_CLASS[d.status_validade || "nao_aplicavel"] || "neutral")}>{statusValidadeLabel(d.status_validade)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Por condomínio</h3><span>{porCondominio.length} condomínio(s)</span></div>
        {!porCondominio.length ? (
          <EmptyState icon="building" title="Nenhum condomínio cadastrado" description="Cadastre os condomínios atendidos para ver equipe, documentação e financeiro de cada um." actionLabel="Cadastrar condomínio" href="/condominios" />
        ) : (
          <div className="table-wrap"><table><thead><tr><th>Condomínio</th><th>Equipe</th><th>Documentação em dia</th><th>Financeiro</th></tr></thead><tbody>
            {porCondominio.map((row: any) => (
              <tr key={row.condominio.id} className="clickable-row" onClick={() => window.location.assign(`/condominios/${row.condominio.id}`)}>
                <td><Link href={`/condominios/${row.condominio.id}`} className="cell-strong">{row.condominio.nome}</Link></td>
                <td>{row.equipe}</td>
                <td>{row.pctDocs === null ? <span className="muted">Sem documentos</span> : (
                  <div className="meter"><div className="meter-bar"><div className={"meter-fill " + (row.pctDocs >= 90 ? "ok" : row.pctDocs >= 60 ? "warn" : "danger")} style={{width: `${row.pctDocs}%`}} /></div><span>{row.pctDocs}%</span></div>
                )}</td>
                <td>{row.atrasados > 0 ? <span className="badge danger">{row.atrasados} atrasado(s)</span> : <span className="badge">Em dia</span>}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </>
  );
}

function Kpi({icon, label, value, sub, cta, href, tone}: {icon: string; label: string; value: string | null; sub?: string; cta?: string; href?: string; tone?: "warn" | "danger"}) {
  const empty = value === null;
  const content = (
    <>
      <div className="kpi-top"><span className="kpi-label">{label}</span><span className="kpi-icon"><Icon name={icon} size={15} /></span></div>
      {empty ? (
        <>
          <strong className="kpi-value is-empty">—</strong>
          <span className="kpi-cta">{cta}<Icon name="chevron-right" size={13} /></span>
        </>
      ) : (
        <>
          <strong className="kpi-value">{value}</strong>
          {sub && <small className="kpi-sub">{sub}</small>}
        </>
      )}
    </>
  );
  const cls = "kpi" + (tone ? " tone-" + tone : "") + (empty ? " is-empty" : "");
  return href ? <Link href={href} className={cls}>{content}</Link> : <article className={cls}>{content}</article>;
}
