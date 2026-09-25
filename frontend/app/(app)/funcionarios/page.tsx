"use client";

import { useMemo, useState } from "react";
import { useCrm } from "../../lib/CrmContext";
import { normalize } from "../../lib/ui";
import { DataTable } from "../../components/DataTable";

export default function FuncionariosPage() {
  const {funcionarios, setEmployeeModal, setDismissModal, confirmCargo} = useCrm();
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = normalize(busca);
    if (!q) return funcionarios;
    return funcionarios.filter((f: any) => normalize(f.nome).includes(q) || normalize(f.cpf).includes(q) || normalize(f.condominio).includes(q) || normalize(f.cargo).includes(q));
  }, [funcionarios, busca]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Funcionários</h3><span>{filtrados.length} registros</span></div>
        <div className="row-actions">
          <input placeholder="Buscar por nome, CPF, cargo ou condomínio" value={busca} onChange={e => setBusca(e.target.value)} style={{minWidth: 240}} />
          <button className="primary" onClick={() => setEmployeeModal({mode: "create", employee: {}})}>Novo funcionário</button>
        </div>
      </div>
      <DataTable
        rows={filtrados}
        type="employees"
        onEdit={(row) => setEmployeeModal({mode: "edit", employee: row})}
        onToggleStatus={(row) => setDismissModal(row)}
        onConfirmCargo={confirmCargo}
        emptyIcon="users"
        emptyTitle={busca ? "Nenhum funcionário encontrado" : "Nenhum funcionário cadastrado ainda"}
        emptyDescription={busca ? "Tente outro termo de busca." : "Cadastre o primeiro funcionário ou processe um documento para criar um automaticamente."}
        emptyActionLabel={busca ? undefined : "Novo funcionário"}
        onEmptyAction={() => setEmployeeModal({mode: "create", employee: {}})}
      />
    </section>
  );
}
