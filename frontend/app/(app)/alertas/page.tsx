"use client";

import { useCrm } from "../../lib/CrmContext";
import { EmptyState } from "../../components/EmptyState";

export default function AlertasPage() {
  const {alertas} = useCrm();
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Central de alertas</h3><span>{alertas.vencidos} vencidos · {alertas.vencendo} vencendo em 30 dias</span></div>
      </div>
      <p className="muted" style={{margin: "0 0 14px"}}>Alertas gerados dentro do app (documentos, EPIs, contratos e financeiro). Envio automático por e-mail/WhatsApp ainda não está configurado.</p>
      {!alertas.items.length ? (
        <EmptyState icon="check-circle" title="Nenhum alerta no momento" description="Tudo em dia — nenhum documento, EPI ou lançamento vencendo ou vencido." />
      ) : (
        <div className="results">
          {alertas.items.map((a: any, i: number) => (
            <article key={i} className={"result " + (a.urgencia === "vencido" ? "erro" : "duplicado")}>
              <div><b>{a.titulo}</b><span>{a.tipo}</span></div>
              <p>{a.detalhe}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
