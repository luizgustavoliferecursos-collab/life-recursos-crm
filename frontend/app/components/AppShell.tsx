"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCrm } from "../lib/CrmContext";
import { Icon, PAPEL_LABEL } from "../lib/ui";
import { GlobalSearch } from "./GlobalSearch";
import { EmployeeModal, DismissModal } from "./modals/EmployeeModals";
import { CondominioModal, OcorrenciaModal, ContratoModal, PostoModal } from "./modals/CondominioModals";
import { UsuarioModal } from "./modals/UsuarioModal";
import { LancamentoModal } from "./modals/FinanceiroModal";
import { EpiModal, AfastamentoModal } from "./modals/EpiAfastamentoModals";
import { EscalaCellModal, GerarEscalaModal } from "./modals/EscalaModals";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { ToastStack, ConfirmDialog } from "../lib/ui";

type NavItem = [href: string, label: string, icon: string];
type NavGroup = {key: string; label: string; items: NavItem[]};

const ROLE_GROUPS: Record<string, string[]> = {
  admin: ["painel", "pessoas", "documentos", "condominios", "financeiro", "configuracoes"],
  rh: ["painel", "pessoas", "documentos"],
  financeiro: ["painel", "financeiro", "condominios", "documentos"],
  operacional: ["painel", "condominios", "documentos"],
};

const NAV_GROUPS: NavGroup[] = [
  {key: "painel", label: "Painel", items: [
    ["/painel", "Visão geral", "home"],
    ["/alertas", "Alertas", "bell"],
  ]},
  {key: "pessoas", label: "Pessoas", items: [
    ["/funcionarios", "Funcionários", "users"],
    ["/onboarding", "Onboarding", "check-circle"],
    ["/epis", "EPIs", "shield"],
    ["/afastamentos", "Férias & Afastamentos", "umbrella"],
  ]},
  {key: "documentos", label: "Documentos", items: [
    ["/documentos/enviar", "Enviar", "upload"],
    ["/documentos", "Todos os documentos", "file-text"],
  ]},
  {key: "condominios", label: "Condomínios", items: [
    ["/condominios", "Cadastro", "building"],
    ["/postos", "Postos & Escalas", "calendar"],
    ["/ocorrencias", "Ocorrências", "alert-triangle"],
    ["/contratos", "Contratos", "briefcase"],
  ]},
  {key: "financeiro", label: "Financeiro", items: [
    ["/financeiro", "Lançamentos", "dollar-sign"],
    ["/relatorios", "Relatórios", "bar-chart"],
  ]},
  {key: "configuracoes", label: "Configurações", items: [
    ["/configuracoes/usuarios", "Usuários", "user-cog"],
    ["/configuracoes/auditoria", "Auditoria", "activity"],
    ["/configuracoes/integracoes", "Status das integrações", "link"],
  ]},
];

export function AppShell({children}: {children: React.ReactNode}) {
  const crm = useCrm();
  const {
    me, alertas, onboarding, ocorrencias, health, toasts, setToasts, dialog, dialogValue, setDialogValue, closeDialog,
    collapsedGroups, setCollapsedGroups, condominios,
    employeeModal, setEmployeeModal, saveEmployee,
    dismissModal, setDismissModal, submitDismiss,
    condominioModal, setCondominioModal, saveCondominio,
    ocorrenciaModal, setOcorrenciaModal, saveOcorrencia,
    previewDoc, setPreviewDoc, saveCompetencia,
    usuarioModal, setUsuarioModal, saveUsuario,
    contratoModal, setContratoModal, saveContrato,
    postoModal, setPostoModal, savePosto,
    lancamentoModal, setLancamentoModal, saveLancamento,
    epiModal, setEpiModal, saveEpi,
    afastamentoModal, setAfastamentoModal, saveAfastamento,
    escalaCell, setEscalaCell, atribuirEscala, marcarFalta, substituirEscala,
    gerarEscalaModal, setGerarEscalaModal, gerarEscalaAutomatica,
    funcionarios, logout, isSindico, isColaborador,
  } = crm;

  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (isSindico && pathname !== "/meu-condominio") router.replace("/meu-condominio");
    if (isColaborador && pathname !== "/minha-escala") router.replace("/minha-escala");
  }, [isSindico, isColaborador, pathname, router]);

  useEffect(() => { setMobileNavOpen(false); }, [pathname]);

  const navSections: NavGroup[] = isSindico ? [
    {key: "root", label: "", items: [["/meu-condominio", "Meu condomínio", "building"]]},
  ] : isColaborador ? [
    {key: "root", label: "", items: [["/minha-escala", "Minha escala", "calendar"]]},
  ] : NAV_GROUPS.filter(g => (ROLE_GROUPS[me?.papel || "admin"] || ROLE_GROUPS.admin).includes(g.key));

  const flatItems = navSections.flatMap(s => s.items);
  const currentTitle = flatItems.find(([href]) => href === pathname)?.[1] || "";

  return (
    <div className="app-shell">
      <button type="button" className="mobile-nav-toggle" onClick={() => setMobileNavOpen(v => !v)} aria-label="Abrir menu">
        <Icon name="menu" size={20} />
      </button>
      {mobileNavOpen && <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />}

      <aside className={"sidebar" + (mobileNavOpen ? " open" : "")}>
        <div className="brand"><span className="brand-mark">LR</span><div><b>LIFE RECURSOS</b><small>Central de operações</small></div></div>
        <div className="nav-scroll">
          {navSections.map(sec => {
            const collapsed = !!sec.label && !!collapsedGroups[sec.key];
            return (
              <div className={"nav-section" + (collapsed ? " collapsed" : "")} key={sec.key}>
                {sec.label && (
                  <button
                    type="button"
                    className="nav-section-label"
                    onClick={() => setCollapsedGroups((s: Record<string, boolean>) => ({...s, [sec.key]: !s[sec.key]}))}
                  >
                    <span>{sec.label}</span>
                    <Icon name="chevron-down" size={12} />
                  </button>
                )}
                {!collapsed && (
                  <nav>
                    {sec.items.filter(([href]) => href !== "/configuracoes/usuarios" || me?.papel === "admin").map(([href, label, icon]) => (
                      <Link key={href} href={href} className={pathname === href ? "active" : ""}>
                        <Icon name={icon} size={17} />
                        <span>{label}</span>
                        {href === "/alertas" && alertas.total > 0 && <span className="nav-badge">{alertas.total}</span>}
                        {href === "/onboarding" && onboarding.length > 0 && <span className="nav-badge">{onboarding.length}</span>}
                        {href === "/ocorrencias" && ocorrencias.filter((o: any) => o.status !== "resolvida").length > 0 && <span className="nav-badge">{ocorrencias.filter((o: any) => o.status !== "resolvida").length}</span>}
                      </Link>
                    ))}
                  </nav>
                )}
              </div>
            );
          })}
        </div>
        <div className="sidebar-foot">
          <span className={"dot " + (health?.status === "ok" ? "online" : "")}></span>
          <span className="who">{me?.nome ? `${me.nome} · ${PAPEL_LABEL[me.papel] || me.papel}` : (health?.status === "ok" ? "Backend online" : "Backend indisponível")}</span>
          <button onClick={logout}><Icon name="log-out" size={14} /> Sair</button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div><p className="eyebrow">GESTÃO</p><h1>{currentTitle}</h1></div>
          <GlobalSearch funcionarios={funcionarios} documentos={crm.documentos} condominios={condominios} />
        </header>

        {crm.error && <div className="alert error">{crm.error}</div>}

        {children}
      </main>

      <datalist id="condominios-datalist">
        {condominios.map((c: any) => <option key={c.id || c.nome} value={c.nome} />)}
      </datalist>

      {employeeModal && (
        <EmployeeModal mode={employeeModal.mode} employee={employeeModal.employee} onCancel={() => setEmployeeModal(null)} onSave={saveEmployee} />
      )}
      {dismissModal && (
        <DismissModal employee={dismissModal} onCancel={() => setDismissModal(null)} onConfirm={submitDismiss} />
      )}
      {condominioModal && (
        <CondominioModal mode={condominioModal.mode} condominio={condominioModal.condominio} onCancel={() => setCondominioModal(null)} onSave={saveCondominio} />
      )}
      {ocorrenciaModal && (
        <OcorrenciaModal onCancel={() => setOcorrenciaModal(null)} onSave={(titulo: string, descricao: string) => saveOcorrencia(ocorrenciaModal.condominioId, titulo, descricao)} />
      )}
      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} onSaveCompetencia={saveCompetencia} />
      )}
      {usuarioModal && (
        <UsuarioModal mode={usuarioModal.mode} usuario={usuarioModal.usuario} condominios={condominios} funcionarios={funcionarios} onCancel={() => setUsuarioModal(null)} onSave={saveUsuario} />
      )}
      {contratoModal && (
        <ContratoModal mode={contratoModal.mode} contrato={contratoModal.contrato} condominios={condominios} onCancel={() => setContratoModal(null)} onSave={saveContrato} />
      )}
      {postoModal && (
        <PostoModal mode={postoModal.mode} posto={postoModal.posto} condominios={condominios} onCancel={() => setPostoModal(null)} onSave={savePosto} />
      )}
      {lancamentoModal && (
        <LancamentoModal mode={lancamentoModal.mode} lancamento={lancamentoModal.lancamento} condominios={condominios} funcionarios={funcionarios} onCancel={() => setLancamentoModal(null)} onSave={saveLancamento} />
      )}
      {epiModal && (
        <EpiModal mode={epiModal.mode} epi={epiModal.epi} funcionarios={funcionarios} onCancel={() => setEpiModal(null)} onSave={saveEpi} />
      )}
      {afastamentoModal && (
        <AfastamentoModal mode={afastamentoModal.mode} afastamento={afastamentoModal.afastamento} funcionarios={funcionarios} onCancel={() => setAfastamentoModal(null)} onSave={saveAfastamento} />
      )}
      {escalaCell && (
        <EscalaCellModal cell={escalaCell} funcionarios={funcionarios} onAssign={atribuirEscala} onFalta={marcarFalta} onSubstituir={substituirEscala} onClose={() => setEscalaCell(null)} />
      )}
      {gerarEscalaModal && (
        <GerarEscalaModal posto={gerarEscalaModal} funcionarios={funcionarios} onGerar={gerarEscalaAutomatica} onCancel={() => setGerarEscalaModal(null)} />
      )}

      <ConfirmDialog dialog={dialog} value={dialogValue} onChange={setDialogValue} onClose={closeDialog} />
      <ToastStack toasts={toasts} onDismiss={(id: number) => setToasts((t: any[]) => t.filter(x => x.id !== id))} />
    </div>
  );
}
