"use client";

import { useCrm } from "../../lib/CrmContext";
import { MeuCondominio } from "../../components/MeuCondominio";

export default function MeuCondominioPage() {
  const {me, condominios, contratos, postos, escalaGrid, lancamentos, ocorrencias, setOcorrenciaModal} = useCrm();
  return (
    <MeuCondominio
      me={me}
      condominios={condominios}
      contratos={contratos}
      postos={postos}
      escalaGrid={escalaGrid}
      lancamentos={lancamentos}
      ocorrencias={ocorrencias}
      onNovaOcorrencia={(condominioId: string) => setOcorrenciaModal({condominioId})}
    />
  );
}
