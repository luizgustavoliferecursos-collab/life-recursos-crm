"use client";

import { useMemo, useState } from "react";
import { useCrm } from "../../lib/CrmContext";
import { normalize } from "../../lib/ui";
import { DataTable } from "../../components/DataTable";

export default function CondominiosPage() {
  const {condominios, setCondominioModal, toggleCondominioStatus} = useCrm();
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = normalize(busca);
    if (!q) return condominios;
    return condominios.filter((c: any) => normalize(c.nome).includes(q) || normalize(c.cidade).includes(q));
  }, [condominios, busca]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Condomínios</h3><span>{filtrados.length} identificados</span></div>
        <div className="row-actions">
          <input placeholder="Buscar por nome ou cidade" value={busca} onChange={e => setBusca(e.target.value)} style={{minWidth: 220}} />
          <button className="primary" onClick={() => setCondominioModal({mode: "create", condominio: {}})}>Novo condomínio</button>
        </div>
      </div>
      <DataTable
        rows={filtrados}
        type="condos"
        onEdit={(row) => setCondominioModal({mode: "edit", condominio: row})}
        onToggleStatus={toggleCondominioStatus}
        emptyIcon="building"
        emptyTitle={busca ? "Nenhum condomínio encontrado" : "Nenhum condomínio cadastrado ainda"}
        emptyDescription={busca ? "Tente outro termo de busca." : "Cadastre o primeiro condomínio para começar a organizar equipes, postos e documentos."}
        emptyActionLabel={busca ? undefined : "Novo condomínio"}
        onEmptyAction={() => setCondominioModal({mode: "create", condominio: {}})}
      />
    </section>
  );
}
