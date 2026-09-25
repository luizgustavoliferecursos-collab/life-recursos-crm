"use client";

import Link from "next/link";
import { useCrm } from "../../lib/CrmContext";
import { EmptyState } from "../../components/EmptyState";
import { cargoLabel } from "../../lib/ui";

export default function OnboardingPage() {
  const {onboarding} = useCrm();
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Checklist de onboarding</h3><span>{onboarding.length} funcionário(s) com pendência</span></div>
      </div>
      <p className="muted" style={{margin: "0 0 14px"}}>Documentos obrigatórios por cargo que ainda faltam para cada funcionário ativo. Quem está com o checklist completo não aparece aqui.</p>
      {!onboarding.length ? (
        <EmptyState icon="check-circle" title="Nenhuma pendência" description="Todo mundo está com o checklist de documentos completo." />
      ) : (
        <div className="table-wrap"><table><thead><tr><th>Funcionário</th><th>Cargo</th><th>Condomínio</th><th>Documentos faltantes</th></tr></thead><tbody>
          {onboarding.map((o: any) => <tr key={o.funcionario_id}>
            <td><Link href={`/funcionarios/${o.funcionario_id}`} className="link-btn">{o.funcionario}</Link></td>
            <td><span className="badge">{cargoLabel(o.cargo)}</span></td>
            <td>{o.condominio || "—"}</td>
            <td>{o.documentos_faltantes.map((d: string) => <span key={d} className="badge missing" style={{marginRight: 6}}>{d} · Faltando</span>)}</td>
          </tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
