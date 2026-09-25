"use client";

import { useMemo, useState } from "react";
import { useCrm } from "../../lib/CrmContext";
import { normalize } from "../../lib/ui";
import { DataTable } from "../../components/DataTable";

export default function DocumentosPage() {
  const {documentos, openPreview} = useCrm();
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = normalize(busca);
    if (!q) return documentos;
    return documentos.filter((d: any) =>
      normalize(d.tipo_documento).includes(q) || normalize(d.arquivo_nome).includes(q) ||
      normalize(d.funcionarios?.nome).includes(q) || normalize(d.condominios?.nome).includes(q)
    );
  }, [documentos, busca]);

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Documentos</h3>
        <div className="row-actions">
          <input placeholder="Buscar por tipo, arquivo, funcionário ou condomínio" value={busca} onChange={e => setBusca(e.target.value)} style={{minWidth: 260}} />
          <span className="muted">{filtrados.length} registros</span>
        </div>
      </div>
      <DataTable
        rows={filtrados}
        type="docs"
        onPreview={openPreview}
        emptyIcon="file-text"
        emptyTitle={busca ? "Nenhum documento encontrado" : "Nenhum documento registrado ainda"}
        emptyDescription={busca ? "Tente outro termo de busca." : "Envie o primeiro documento para começar a organizar tudo aqui."}
        emptyActionLabel={busca ? undefined : "Enviar documento"}
        emptyHref="/documentos/enviar"
      />
    </section>
  );
}
