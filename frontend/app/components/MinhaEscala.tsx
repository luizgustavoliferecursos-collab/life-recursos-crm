"use client";

import { formatDiaCurto, ESCALA_STATUS_LABEL } from "../lib/ui";

export function MinhaEscala({me, escalaGrid}: {me: any; escalaGrid: {datas: string[]; items: any[]}}) {
  const meuFuncionarioId = me?.funcionario_id;

  if (!meuFuncionarioId) {
    return <section className="panel"><div className="empty">Nenhum funcionário vinculado a este usuário ainda. Peça para um administrador configurar.</div></section>;
  }

  const minhaSemana = escalaGrid.datas.map(dia => {
    for (const item of escalaGrid.items) {
      const escala = item.escalas_por_dia?.[dia];
      if (!escala) continue;
      if (escala.funcionario_id === meuFuncionarioId) return {dia, posto: item.posto, escala, substituindo: false};
      if (escala.substituto_id === meuFuncionarioId) return {dia, posto: item.posto, escala, substituindo: true};
    }
    return {dia, posto: null, escala: null, substituindo: false};
  });

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">MINHA ESCALA</p>
          <h2>Sua semana de trabalho</h2>
          <p>{escalaGrid.datas.length ? `De ${formatDiaCurto(escalaGrid.datas[0])} a ${formatDiaCurto(escalaGrid.datas[escalaGrid.datas.length - 1])}` : "Semana atual"}</p>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h3>Escala da semana</h3></div>
        <div className="table-wrap"><table><thead><tr><th>Dia</th><th>Posto</th><th>Condomínio</th><th>Status</th></tr></thead><tbody>
          {minhaSemana.map(row => (
            <tr key={row.dia}>
              <td>{formatDiaCurto(row.dia)}</td>
              <td>{row.posto?.nome || "—"}{row.substituindo ? " (substituição)" : ""}</td>
              <td>{row.posto?.condominios?.nome || "—"}</td>
              <td>{row.escala
                ? <span className={"badge " + (row.escala.status === "falta" ? "danger" : "")}>{ESCALA_STATUS_LABEL[row.escala.status] || row.escala.status}</span>
                : <span className="badge warn">Folga</span>}</td>
            </tr>
          ))}
        </tbody></table></div>
      </section>
    </>
  );
}
