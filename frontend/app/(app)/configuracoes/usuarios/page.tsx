"use client";

import { useCrm } from "../../../lib/CrmContext";
import { PAPEL_LABEL } from "../../../lib/ui";
import { EmptyState } from "../../../components/EmptyState";

export default function UsuariosPage() {
  const {me, usuarios, setUsuarioModal, toggleUsuarioAtivo} = useCrm();
  if (me && me.papel !== "admin") {
    return <section className="panel"><div className="empty">Acesso restrito a administradores.</div></section>;
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Usuários</h3><span>{usuarios.length} cadastrados</span></div>
        <button className="primary" onClick={() => setUsuarioModal({mode: "create", usuario: {}})}>Novo usuário</button>
      </div>
      {!usuarios.length ? (
        <EmptyState icon="user-cog" title="Nenhum usuário encontrado" description="Cadastre um login para dar acesso ao sistema." actionLabel="Novo usuário" onAction={() => setUsuarioModal({mode: "create", usuario: {}})} />
      ) : (
        <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Login</th><th>Papel</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {usuarios.map((u: any) => <tr key={u.id}>
            <td>{u.nome}</td>
            <td>{u.login}</td>
            <td><span className="badge">{PAPEL_LABEL[u.papel] || u.papel}</span></td>
            <td><span className={"badge " + (!u.ativo ? "warn" : "")}>{u.ativo ? "Ativo" : "Desativado"}</span></td>
            <td className="row-actions">
              <button className="link-btn" onClick={() => setUsuarioModal({mode: "edit", usuario: u})}>Editar</button>
              <button className="link-btn" onClick={() => toggleUsuarioAtivo(u)}>{u.ativo ? "Desativar" : "Reativar"}</button>
            </td>
          </tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
