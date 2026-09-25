"use client";

import { useCrm } from "../../../lib/CrmContext";
import { DRIVE_FOLDER_LABEL, Icon, SERVICO_LABEL } from "../../../lib/ui";

export default function IntegracoesPage() {
  const {me, health, drive} = useCrm();
  if (me && me.papel !== "admin") {
    return <section className="panel"><div className="empty">Acesso restrito a administradores.</div></section>;
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Status das integrações</h3><span>Claude → Drive → Supabase</span></div>
      </div>
      <div className="stats">
        <article>
          <div className={"stat-icon " + (health?.status === "ok" ? "green" : "red")}><Icon name="activity" size={16} /></div>
          <span>Backend</span><strong>{health?.status === "ok" ? "OK" : "Indisponível"}</strong><small>{health?.service || "API"}</small>
        </article>
        <article>
          <div className={"stat-icon " + (drive?.status === "ok" ? "green" : "red")}><Icon name="upload" size={16} /></div>
          <span>Fluxo</span><strong>{drive?.status === "ok" ? "OK" : "Indisponível"}</strong><small>Claude → Drive → Supabase</small>
        </article>
      </div>
      {health?.configured && (
        <div className="table-wrap"><table><thead><tr><th>Serviço</th><th>Status</th></tr></thead><tbody>
          {Object.entries(health.configured).map(([key, ok]: [string, any]) => (
            <tr key={key}><td>{SERVICO_LABEL[key] || key}</td><td><span className={"badge " + (ok ? "" : "danger")}>{ok ? "Configurado" : "Não configurado"}</span></td></tr>
          ))}
        </tbody></table></div>
      )}
      {drive?.folders && (
        <div className="table-wrap" style={{marginTop: 16}}><table><thead><tr><th>Pasta do Drive</th><th>Status</th></tr></thead><tbody>
          {Object.entries(drive.folders).map(([key, info]: [string, any]) => (
            <tr key={key}><td>{DRIVE_FOLDER_LABEL[key] || key}</td><td><span className={"badge " + (info.ok ? "" : "danger")}>{info.ok ? (info.nome || "OK") : (info.motivo || "Erro")}</span></td></tr>
          ))}
        </tbody></table></div>
      )}
    </section>
  );
}
