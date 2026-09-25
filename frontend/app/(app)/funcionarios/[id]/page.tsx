"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useCrm } from "../../../lib/CrmContext";
import { api, formatCompetencia, formatDate, formatMoney, statusValidadeClass, statusValidadeLabel } from "../../../lib/ui";
import { Breadcrumb } from "../../../components/Breadcrumb";
import { EmptyState } from "../../../components/EmptyState";

const SITUACAO_LABEL: Record<string, string> = {tem: "Em dia", vence: "Vencendo", falta: "Faltando"};
const SITUACAO_CLASS: Record<string, string> = {tem: "", vence: "warn", falta: "missing"};

const TABS = [
  ["resumo", "Resumo"],
  ["pessoais", "Dados pessoais"],
  ["contrato", "Contrato"],
  ["documentos", "Documentos"],
  ["ponto", "Ponto e escala"],
  ["epis", "EPIs"],
  ["afastamentos", "Férias e afastamentos"],
  ["historico", "Histórico"],
] as const;

function iniciais(nome: string): string {
  return (nome || "").trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("");
}

export default function FichaFuncionarioPage() {
  const params = useParams();
  const id = String(params.id);
  const {me, setEmployeeModal, employeeModal} = useCrm();
  const [ficha, setFicha] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subtab, setSubtab] = useState<typeof TABS[number][0]>("resumo");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api(`/api/funcionarios/${id}/ficha`);
      setFicha(data);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar ficha do funcionário.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);
  // Fecha o modal de edicao reaproveitado e recarrega a ficha depois de salvar.
  useEffect(() => { if (!employeeModal) load(); }, [employeeModal]);

  const canEditSensitive = me?.papel === "admin" || me?.papel === "rh";

  const checklistPendente = useMemo(() => (ficha?.checklist || []).filter((c: any) => c.situacao !== "tem"), [ficha]);
  const proximosVencimentos = useMemo(() => (ficha?.documentos || [])
    .filter((d: any) => d.status_validade === "vencendo" || d.status_validade === "vencido")
    .sort((a: any, b: any) => (a.data_validade || "").localeCompare(b.data_validade || "")), [ficha]);
  const escalaSemana = useMemo(() => {
    const hoje = new Date();
    const em7dias = new Date(hoje.getTime() + 7 * 86400000);
    return (ficha?.escalas_mes || []).filter((e: any) => {
      const d = new Date(e.data);
      return d >= new Date(hoje.toDateString()) && d <= em7dias;
    });
  }, [ficha]);

  const timeline = useMemo(() => {
    const eventos: {data: string; texto: string}[] = [];
    for (const a of ficha?.auditoria || []) {
      eventos.push({data: a.created_at, texto: `${(a.acao || "").replace(/_/g, " ")} por ${a.usuario_nome || "desconhecido"}`});
    }
    for (const d of ficha?.documentos || []) {
      eventos.push({data: d.created_at, texto: `Documento "${d.tipo_documento || d.arquivo_nome}" registrado`});
    }
    for (const o of ficha?.ocorrencias || []) {
      eventos.push({data: o.created_at, texto: `Ocorrência: ${o.titulo}`});
    }
    return eventos.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [ficha]);

  if (loading) return <div className="empty">Carregando ficha…</div>;
  if (error || !ficha) return <div className="alert error">{error || "Funcionário não encontrado."}</div>;

  const f = ficha.funcionario;
  const documentacaoOk = (ficha.checklist || []).filter((c: any) => c.situacao === "tem").length;
  const documentacaoTotal = (ficha.checklist || []).length;

  return (
    <>
      <Breadcrumb items={[{label: "Funcionários", href: "/funcionarios"}, {label: f.nome}]} />

      <section className="panel ficha-header">
        <div className="ficha-avatar">{iniciais(f.nome)}</div>
        <div className="ficha-header-info">
          <h2>{f.nome}</h2>
          <div className="row-actions">
            <span className={"badge " + (f.cargo === "Pendente" ? "warn" : "")}>{f.cargo || "Pendente"}</span>
            <span className="muted">{f.condominio || "Sem condomínio"}</span>
            <span className={"badge " + (f.status === "inativo" ? "warn" : "")}>{f.status === "inativo" ? "Desligado" : "Ativo"}</span>
            {documentacaoTotal > 0 && (
              <span className={"badge " + (documentacaoOk === documentacaoTotal ? "" : "missing")}>Documentação {documentacaoOk}/{documentacaoTotal}</span>
            )}
          </div>
        </div>
        {canEditSensitive && <button className="primary" onClick={() => setEmployeeModal({mode: "edit", employee: f})}>Editar</button>}
      </section>

      <div className="ficha-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={subtab === key ? "active" : ""} onClick={() => setSubtab(key)}>{label}</button>
        ))}
      </div>

      {subtab === "resumo" && (
        <section className="grid-two">
          <div className="panel">
            <div className="panel-head"><h3>Pendências</h3><span>{checklistPendente.length}</span></div>
            {!checklistPendente.length ? <EmptyState icon="check-circle" title="Checklist completo" /> : (
              <div className="results">
                {checklistPendente.map((c: any) => (
                  <article key={c.tipo_documento} className={"result " + (c.situacao === "falta" ? "erro" : "duplicado")}>
                    <div><b>{c.tipo_documento}</b><span>{SITUACAO_LABEL[c.situacao]}</span></div>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Próximos vencimentos</h3><span>{proximosVencimentos.length}</span></div>
            {!proximosVencimentos.length ? <EmptyState icon="check-circle" title="Nenhum vencimento próximo" /> : (
              <div className="table-wrap"><table><thead><tr><th>Documento</th><th>Validade</th><th>Status</th></tr></thead><tbody>
                {proximosVencimentos.map((d: any) => (
                  <tr key={d.id}><td>{d.tipo_documento}</td><td>{formatDate(d.data_validade)}</td><td><span className={statusValidadeClass(d.status_validade)}>{statusValidadeLabel(d.status_validade)}</span></td></tr>
                ))}
              </tbody></table></div>
            )}
          </div>
          <div className="panel span-2">
            <div className="panel-head"><h3>Escala dos próximos 7 dias</h3></div>
            {!escalaSemana.length ? <EmptyState icon="calendar" title="Sem escala nos próximos 7 dias" /> : (
              <div className="table-wrap"><table><thead><tr><th>Data</th><th>Posto</th><th>Condomínio</th><th>Status</th></tr></thead><tbody>
                {escalaSemana.map((e: any) => (
                  <tr key={e.id}><td>{formatDate(e.data)}</td><td>{e.postos_trabalho?.nome || "—"}</td><td>{e.postos_trabalho?.condominios?.nome || "—"}</td><td>{e.status}</td></tr>
                ))}
              </tbody></table></div>
            )}
          </div>
        </section>
      )}

      {subtab === "pessoais" && (
        <section className="panel">
          <div className="panel-head"><h3>Dados pessoais</h3>{!canEditSensitive && <span className="muted">Visível só para leitura</span>}</div>
          <div className="modal-grid" style={{gridTemplateColumns: "1fr 1fr"}}>
            <div><label className="muted">CPF</label><p>{f.cpf || "—"}</p></div>
            <div><label className="muted">RG</label><p>{f.rg || "—"}</p></div>
            <div><label className="muted">Data de nascimento</label><p>{formatDate(f.data_nascimento)}</p></div>
            <div><label className="muted">Telefone</label><p>{f.telefone || "—"}</p></div>
            <div className="span-2"><label className="muted">Endereço</label><p>{f.endereco || "—"}</p></div>
            <div><label className="muted">Contato de emergência</label><p>{f.contato_emergencia_nome || "—"}</p></div>
            <div><label className="muted">Telefone de emergência</label><p>{f.contato_emergencia_telefone || "—"}</p></div>
          </div>
        </section>
      )}

      {subtab === "contrato" && (
        <section className="panel">
          <div className="panel-head"><h3>Contrato</h3></div>
          <div className="modal-grid" style={{gridTemplateColumns: "1fr 1fr"}}>
            <div><label className="muted">Data de admissão</label><p>{formatDate(f.data_admissao)}</p></div>
            <div><label className="muted">Cargo</label><p>{f.cargo || "Pendente"}</p></div>
            <div><label className="muted">Tipo de contrato</label><p>{f.tipo_contrato || "—"}</p></div>
            {canEditSensitive && <div><label className="muted">Salário base</label><p>{f.salario_base ? formatMoney(f.salario_base) : "—"}</p></div>}
            {f.status === "inativo" && <div><label className="muted">Desligamento</label><p>{formatDate(f.data_desligamento)}{f.motivo_desligamento ? ` · ${f.motivo_desligamento}` : ""}</p></div>}
          </div>
        </section>
      )}

      {subtab === "documentos" && (
        <section className="panel">
          <div className="panel-head">
            <div><h3>Checklist de documentos</h3><span>Cargo: {f.cargo || "Pendente"}</span></div>
            <a className="primary" href="/documentos/enviar">Enviar documento</a>
          </div>
          {!ficha.checklist?.length ? (
            <EmptyState icon="file-text" title="Sem checklist obrigatório para este cargo" description="Cargo pendente ou sem documentos obrigatórios configurados." />
          ) : (
            <div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Situação</th><th>Validade</th></tr></thead><tbody>
              {ficha.checklist.map((c: any) => (
                <tr key={c.tipo_documento}>
                  <td>{c.tipo_documento}</td>
                  <td><span className={"badge " + SITUACAO_CLASS[c.situacao]}>{SITUACAO_LABEL[c.situacao]}</span></td>
                  <td>{c.documento ? formatDate(c.documento.data_validade) : "—"}{c.documento?.competencia ? ` · ${formatCompetencia(c.documento.competencia)}` : ""}</td>
                </tr>
              ))}
            </tbody></table></div>
          )}
          <div className="panel-head" style={{marginTop: 18}}><h3>Todos os documentos</h3></div>
          {!ficha.documentos?.length ? <EmptyState icon="file-text" title="Nenhum documento enviado ainda" actionLabel="Enviar documento" href="/documentos/enviar" /> : (
            <div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Ano</th><th>Status</th><th>Arquivo</th></tr></thead><tbody>
              {ficha.documentos.map((d: any) => (
                <tr key={d.id}>
                  <td>{d.tipo_documento || d.arquivo_nome}</td>
                  <td>{d.ano || "—"}</td>
                  <td><span className={statusValidadeClass(d.status_validade)}>{statusValidadeLabel(d.status_validade)}</span></td>
                  <td>{d.arquivo_drive_url ? <a className="link-btn" href={d.arquivo_drive_url} target="_blank" rel="noopener noreferrer">Abrir ↗</a> : "—"}</td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </section>
      )}

      {subtab === "ponto" && (
        <section className="panel">
          <div className="panel-head"><h3>Ponto e escala</h3><span>Mês atual</span></div>
          {!ficha.escalas_mes?.length ? <EmptyState icon="calendar" title="Nenhuma escala neste mês" /> : (
            <div className="table-wrap"><table><thead><tr><th>Data</th><th>Posto</th><th>Condomínio</th><th>Status</th></tr></thead><tbody>
              {ficha.escalas_mes.map((e: any) => (
                <tr key={e.id}>
                  <td>{formatDate(e.data)}</td>
                  <td>{e.postos_trabalho?.nome || "—"}</td>
                  <td>{e.postos_trabalho?.condominios?.nome || "—"}</td>
                  <td><span className={"badge " + (e.status === "falta" ? "danger" : e.status === "substituido" ? "warn" : "")}>{e.status}</span></td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </section>
      )}

      {subtab === "epis" && (
        <section className="panel">
          <div className="panel-head"><h3>EPIs</h3></div>
          {!ficha.epis?.length ? <EmptyState icon="shield" title="Nenhum EPI registrado" /> : (
            <div className="table-wrap"><table><thead><tr><th>Item</th><th>Entrega</th><th>Validade</th><th>Status</th></tr></thead><tbody>
              {ficha.epis.map((e: any) => (
                <tr key={e.id}>
                  <td>{e.item}</td>
                  <td>{formatDate(e.data_entrega)}</td>
                  <td>{formatDate(e.data_validade)}</td>
                  <td><span className={statusValidadeClass(e.status_validade)}>{statusValidadeLabel(e.status_validade)}</span></td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </section>
      )}

      {subtab === "afastamentos" && (
        <section className="panel">
          <div className="panel-head"><h3>Férias e afastamentos</h3></div>
          {!ficha.afastamentos?.length ? <EmptyState icon="umbrella" title="Nenhum afastamento registrado" /> : (
            <div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Início</th><th>Fim</th><th>Status</th></tr></thead><tbody>
              {ficha.afastamentos.map((a: any) => (
                <tr key={a.id}><td>{a.tipo}</td><td>{formatDate(a.data_inicio)}</td><td>{formatDate(a.data_fim)}</td><td>{a.status}</td></tr>
              ))}
            </tbody></table></div>
          )}
        </section>
      )}

      {subtab === "historico" && (
        <section className="panel">
          <div className="panel-head"><h3>Histórico</h3><span>Auditoria + documentos + ocorrências</span></div>
          {!timeline.length ? <EmptyState icon="clock-history" title="Nenhum evento registrado ainda" /> : (
            <div className="results">
              {timeline.map((ev, i) => (
                <article key={i} className="result">
                  <div><b>{ev.texto}</b><span>{ev.data ? new Date(ev.data).toLocaleString("pt-BR") : ""}</span></div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
