"use client";

import { ChangeEvent, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  api, EMPLOYEE_FORM_FIELDS, CONDOMINIO_FORM_FIELDS, MES_CURTO, localDateISO, mondayOf,
  statusValidadeLabel, DIRECT_API, type Dashboard,
} from "./ui";

function useCrmValue() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [condominios, setCondominios] = useState<any[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [ocorrenciaModal, setOcorrenciaModal] = useState<{condominioId: string} | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<any>(null);
  const [drive, setDrive] = useState<any>(null);
  const [employeeModal, setEmployeeModal] = useState<{mode: "create" | "edit"; employee: any} | null>(null);
  const [dismissModal, setDismissModal] = useState<any | null>(null);
  const [condominioModal, setCondominioModal] = useState<{mode: "create" | "edit"; condominio: any} | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [me, setMe] = useState<{nome: string; papel: string; condominio_id: string | null; funcionario_id: string | null} | null>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [auditoria, setAuditoria] = useState<any[]>([]);
  const [usuarioModal, setUsuarioModal] = useState<{mode: "create" | "edit"; usuario: any} | null>(null);
  const [contratos, setContratos] = useState<any[]>([]);
  const [contratoModal, setContratoModal] = useState<{mode: "create" | "edit"; contrato: any} | null>(null);
  const [postos, setPostos] = useState<any[]>([]);
  const [postoModal, setPostoModal] = useState<{mode: "create" | "edit"; posto: any} | null>(null);
  const [semanaInicio, setSemanaInicio] = useState(() => mondayOf(localDateISO()));
  const [escalaGrid, setEscalaGrid] = useState<{datas: string[]; items: any[]}>({datas: [], items: []});
  const [escalaCell, setEscalaCell] = useState<{posto: any; dia: string; escala: any} | null>(null);
  const [gerarEscalaModal, setGerarEscalaModal] = useState<any | null>(null);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [lancamentoFiltro, setLancamentoFiltro] = useState("");
  const [lancamentoTipoFiltro, setLancamentoTipoFiltro] = useState("");
  const [lancamentoModal, setLancamentoModal] = useState<{mode: "create" | "edit"; lancamento: any} | null>(null);
  const [epis, setEpis] = useState<any[]>([]);
  const [onboarding, setOnboarding] = useState<any[]>([]);
  const [epiModal, setEpiModal] = useState<{mode: "create" | "edit"; epi: any} | null>(null);
  const [afastamentos, setAfastamentos] = useState<any[]>([]);
  const [afastamentoModal, setAfastamentoModal] = useState<{mode: "create" | "edit"; afastamento: any} | null>(null);
  const [alertas, setAlertas] = useState<any>({total: 0, vencidos: 0, vencendo: 0, items: []});
  const [relatorios, setRelatorios] = useState<any>({faturamento_por_condominio: [], turnover: {}, absenteismo: {}});
  const [toasts, setToasts] = useState<{id: number; type: "success" | "error"; message: string}[]>([]);
  const [dialog, setDialog] = useState<{type: "confirm" | "prompt"; title: string; message?: string; danger?: boolean} | null>(null);
  const [dialogValue, setDialogValue] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const dialogResolver = useRef<((v: any) => void) | null>(null);

  function pushToast(message: string, type: "success" | "error" = "success") {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, {id, type, message}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }

  function askConfirm(title: string, opts?: {message?: string; danger?: boolean}): Promise<boolean> {
    setDialog({type: "confirm", title, message: opts?.message, danger: opts?.danger});
    return new Promise(resolve => { dialogResolver.current = resolve; });
  }

  function askPrompt(title: string, message?: string): Promise<string | null> {
    setDialogValue("");
    setDialog({type: "prompt", title, message});
    return new Promise(resolve => { dialogResolver.current = resolve; });
  }

  function closeDialog(result: any) {
    setDialog(null);
    dialogResolver.current?.(result);
    dialogResolver.current = null;
  }

  async function refresh() {
    setError("");
    try {
      const [d, f, docs, condos, h, ds, c, p] = await Promise.all([
        api("/api/dashboard"),
        api("/api/funcionarios"),
        api("/api/documentos?limit=200"),
        api("/api/condominios"),
        api("/health"),
        api("/api/drive/status"),
        api("/api/contratos"),
        api("/api/postos-trabalho"),
      ]);
      setDashboard(d);
      setFuncionarios(f.items || []);
      setDocumentos(docs.items || []);
      setCondominios(condos.items || []);
      setHealth(h);
      setDrive(ds);
      setContratos(c.items || []);
      setPostos(p.items || []);
      await Promise.all([loadFinanceiro(), loadEpis(), loadAfastamentos(), loadOnboarding(), loadOcorrencias(), loadAlertas(), loadRelatorios()]);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar dados.");
    }
  }

  async function loadFinanceiro() {
    try {
      // Carrega tudo de uma vez; status e tipo agora sao filtrados no cliente
      // (useMemo abaixo), pra alimentar os KPIs/graficos com o universo
      // completo e a tabela ficar instantanea ao trocar de filtro.
      const r = await api("/api/financeiro");
      setLancamentos(r.items || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar financeiro.");
    }
  }

  async function loadEpis() {
    try {
      const r = await api("/api/epis");
      setEpis(r.items || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar EPIs.");
    }
  }

  async function loadAfastamentos() {
    try {
      const r = await api("/api/afastamentos");
      setAfastamentos(r.items || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar afastamentos.");
    }
  }

  async function loadOnboarding() {
    try {
      const r = await api("/api/onboarding");
      setOnboarding(r.items || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar checklist de onboarding.");
    }
  }

  async function loadOcorrencias() {
    try {
      const r = await api("/api/ocorrencias");
      setOcorrencias(r.items || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar ocorrências.");
    }
  }

  async function saveOcorrencia(condominioId: string, titulo: string, descricao: string) {
    await api("/api/ocorrencias", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({condominio_id: condominioId, titulo, descricao: descricao || undefined}),
    });
    setOcorrenciaModal(null);
    pushToast("Ocorrência registrada.");
    await loadOcorrencias();
  }

  async function marcarOcorrencia(id: string, status: string) {
    let resposta: string | null = null;
    if (status === "resolvida") {
      resposta = await askPrompt("Resolver ocorrência", "Resposta para o síndico (opcional).");
      if (resposta === null) return;
    }
    try {
      await api(`/api/ocorrencias/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({status, ...(resposta ? {resposta} : {})}),
      });
      pushToast("Ocorrência atualizada.");
      await loadOcorrencias();
    } catch (e: any) {
      pushToast(e.message || "Erro ao atualizar ocorrência.", "error");
    }
  }

  async function loadAlertas() {
    try {
      const r = await api("/api/notificacoes");
      setAlertas(r);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar alertas.");
    }
  }

  async function loadRelatorios() {
    try {
      const r = await api("/api/relatorios");
      setRelatorios(r);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar relatórios.");
    }
  }

  async function loadUsuarios() {
    try {
      const u = await api("/api/usuarios");
      setUsuarios(u.items || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar usuários.");
    }
  }

  async function loadAuditoria() {
    try {
      const a = await api("/api/auditoria?limit=200");
      setAuditoria(a.items || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar auditoria.");
    }
  }

  async function loadEscalas(inicioSemana: string) {
    try {
      const r = await api(`/api/escalas?data=${inicioSemana}&dias=7`);
      setEscalaGrid({datas: r.datas || [], items: r.items || []});
    } catch (e: any) {
      setError(e.message || "Erro ao carregar escalas.");
    }
  }

  useEffect(() => {
    refresh();
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => { loadEscalas(semanaInicio); }, [semanaInicio]);

  useEffect(() => {
    if (me?.papel === "admin") { loadUsuarios(); loadAuditoria(); }
  }, [me?.papel]);

  const documentosPorStatus = useMemo(() => {
    const contagem: Record<string, number> = {};
    for (const doc of documentos) {
      const status = doc.status_validade || "nao_aplicavel";
      contagem[status] = (contagem[status] || 0) + 1;
    }
    return Object.entries(contagem)
      .map(([status, total]) => ({status, nome: statusValidadeLabel(status), total}))
      .filter(row => row.total > 0);
  }, [documentos]);

  const funcionariosPorCargo = useMemo(() => {
    const contagem: Record<string, number> = {};
    for (const f of funcionarios) {
      if (f.status === "inativo") continue;
      const cargo = f.cargo || "Pendente";
      contagem[cargo] = (contagem[cargo] || 0) + 1;
    }
    return Object.entries(contagem)
      .map(([cargo, total]) => ({cargo, total}))
      .sort((a, b) => b.total - a.total);
  }, [funcionarios]);

  const filteredLancamentos = useMemo(() => lancamentos.filter(item =>
    (!lancamentoFiltro || item.status_calculado === lancamentoFiltro) &&
    (!lancamentoTipoFiltro || item.tipo === lancamentoTipoFiltro)
  ), [lancamentos, lancamentoFiltro, lancamentoTipoFiltro]);

  // KPIs e series dos graficos sempre vem do universo COMPLETO de lancamentos
  // (nao dos filtrados da tabela), pra nao mudar de valor so porque a pessoa
  // esta olhando uma view filtrada da lista abaixo.
  const financeiroStats = useMemo(() => {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    let aReceber = 0, aPagar = 0, recebidoMes = 0, pagoMes = 0, atrasadoReceita = 0, atrasadoDespesa = 0;
    const porMes: Record<string, {receita: number; despesa: number}> = {};
    const porCategoria: Record<string, number> = {};
    const porCondominio: Record<string, number> = {};

    for (const l of lancamentos) {
      const valor = Number(l.valor) || 0;
      const isReceita = l.tipo === "receita";
      if (l.status_calculado === "pendente" || l.status_calculado === "atrasado") {
        if (isReceita) aReceber += valor; else aPagar += valor;
      }
      if (l.status_calculado === "atrasado") {
        if (isReceita) atrasadoReceita += valor; else atrasadoDespesa += valor;
      }
      if (l.status_calculado === "pago" && (l.data_pagamento || "").slice(0, 7) === mesAtual) {
        if (isReceita) recebidoMes += valor; else pagoMes += valor;
      }
      const mesRef = (l.vencimento || l.data_pagamento || "").slice(0, 7);
      if (mesRef) {
        porMes[mesRef] = porMes[mesRef] || {receita: 0, despesa: 0};
        if (isReceita) porMes[mesRef].receita += valor; else porMes[mesRef].despesa += valor;
      }
      if (!isReceita) {
        const cat = l.categoria || l.descricao || "Outro";
        porCategoria[cat] = (porCategoria[cat] || 0) + valor;
      } else {
        const condo = l.condominios?.nome || "Sem condomínio";
        porCondominio[condo] = (porCondominio[condo] || 0) + valor;
      }
    }

    const mesesOrdenados = Object.keys(porMes).sort().slice(-6);
    const serieMensal = mesesOrdenados.map(m => {
      const [ano, mes] = m.split("-");
      const receita = porMes[m].receita, despesa = porMes[m].despesa;
      return {mes: `${MES_CURTO[Number(mes) - 1]}/${ano.slice(2)}`, receita, despesa, saldo: receita - despesa};
    });

    const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
    const topCategorias = categoriasOrdenadas.slice(0, 5);
    const outrosCategorias = categoriasOrdenadas.slice(5).reduce((soma, [, v]) => soma + v, 0);
    const distribuicaoCategorias = [...topCategorias, ...(outrosCategorias > 0 ? [["Outros", outrosCategorias] as [string, number]] : [])]
      .map(([nome, valor]) => ({nome, valor}));

    const condominiosOrdenados = Object.entries(porCondominio).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([nome, valor]) => ({nome, valor}));

    return {
      aReceber, aPagar, recebidoMes, pagoMes, atrasadoReceita, atrasadoDespesa,
      saldoMes: recebidoMes - pagoMes,
      inadimplencia: atrasadoReceita + atrasadoDespesa,
      serieMensal, distribuicaoCategorias, condominiosOrdenados,
    };
  }, [lancamentos]);

  function filtrarFinanceiro(status: string, tipo: string) {
    setLancamentoFiltro(status);
    setLancamentoTipoFiltro(tipo);
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []).filter(file =>
      ["application/pdf", "image/jpeg", "image/png"].includes(file.type)
    );
    setFiles(selected);
    setResults([]);
  }

  async function processFiles() {
    if (!files.length) return;
    setProcessing(true);
    setProgress(10);
    setError("");
    const form = new FormData();
    files.forEach(file => form.append("files", file));
    const timer = window.setInterval(() => setProgress(p => p < 85 ? p + 5 : p), 450);
    try {
      // Upload vai direto pro Render (nao pelo /api/proxy): a Vercel limita o
      // corpo de uma function em 4.5MB, pequeno demais pra PDF escaneado.
      // O token de curta duracao prova que quem esta chamando tem sessao
      // valida, sem precisar do segredo interno (esse nunca vai pro navegador).
      const {token} = await api("/api/documentos/upload-auth", {method: "POST"});
      const uploadResponse = await fetch(DIRECT_API + "/api/documentos/processar", {
        method: "POST",
        headers: {"X-Upload-Token": token},
        body: form,
      });
      const payload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) throw new Error(payload.detail || "Falha ao processar documentos.");
      setResults(payload.resultados || []);
      setProgress(100);
      await refresh();
    } catch (e: any) {
      setError(e.message || "Erro ao processar.");
    } finally {
      window.clearInterval(timer);
      setProcessing(false);
    }
  }

  async function saveEmployee(data: Record<string, any>) {
    const mode = employeeModal?.mode;
    const id = employeeModal?.employee?.id;
    const clean: Record<string, any> = {};
    for (const field of EMPLOYEE_FORM_FIELDS) {
      const value = data[field.key];
      if (value === undefined || value === "") continue;
      clean[field.key] = field.type === "number" ? Number(value) : value;
    }
    if (mode === "edit" && id) {
      await api(`/api/funcionarios/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(clean),
      });
    } else {
      await api("/api/funcionarios", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(clean),
      });
    }
    setEmployeeModal(null);
    pushToast(mode === "edit" ? "Funcionário atualizado." : "Funcionário cadastrado.");
    await refresh();
  }

  async function confirmCargo(id: string, cargo: string) {
    await api(`/api/funcionarios/${id}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({cargo}),
    });
    pushToast("Cargo confirmado.");
    await refresh();
  }

  async function submitDismiss(motivo: string) {
    if (!dismissModal) return;
    const isInactive = dismissModal.status === "inativo";
    if (isInactive) {
      await api(`/api/funcionarios/${dismissModal.id}/reativar`, {method: "POST"});
    } else {
      await api(`/api/funcionarios/${dismissModal.id}/desligar`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({motivo: motivo || null}),
      });
    }
    setDismissModal(null);
    pushToast(isInactive ? "Funcionário reativado." : "Funcionário desligado.");
    await refresh();
  }

  async function saveCondominio(data: Record<string, any>) {
    const mode = condominioModal?.mode;
    const id = condominioModal?.condominio?.id;
    const clean: Record<string, any> = {};
    for (const field of CONDOMINIO_FORM_FIELDS) {
      const value = data[field.key];
      if (value === undefined || value === "") continue;
      clean[field.key] = value;
    }
    if (mode === "edit" && id) {
      await api(`/api/condominios/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(clean),
      });
    } else {
      await api("/api/condominios", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(clean),
      });
    }
    setCondominioModal(null);
    pushToast(mode === "edit" ? "Condomínio atualizado." : "Condomínio cadastrado.");
    await refresh();
  }

  async function toggleCondominioStatus(row: any) {
    const next = row.status === "inativo" ? "ativo" : "inativo";
    const action = next === "inativo" ? "inativar" : "reativar";
    const ok = await askConfirm(`Confirma ${action} o condomínio?`, {message: `"${row.nome}" será ${action === "inativar" ? "marcado como inativo" : "reativado"}.`, danger: action === "inativar"});
    if (!ok) return;
    try {
      await api(`/api/condominios/${row.id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({status: next}),
      });
      pushToast(`Condomínio ${action === "inativar" ? "inativado" : "reativado"}.`);
      await refresh();
    } catch (e: any) {
      setError(e.message || "Erro ao atualizar condomínio.");
      pushToast("Erro ao atualizar condomínio.", "error");
    }
  }

  async function saveUsuario(data: Record<string, any>) {
    const mode = usuarioModal?.mode;
    const id = usuarioModal?.usuario?.id;
    const payload: Record<string, any> = {
      nome: data.nome,
      papel: data.papel,
      condominio_id: data.papel === "sindico" ? (data.condominio_id || null) : null,
      funcionario_id: data.papel === "colaborador" ? (data.funcionario_id || null) : null,
    };
    if (data.senha) payload.senha = data.senha;
    if (mode === "edit" && id) {
      await api(`/api/usuarios/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/usuarios", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({...payload, login: data.login, senha: data.senha, ativo: true}),
      });
    }
    setUsuarioModal(null);
    pushToast(mode === "edit" ? "Usuário atualizado." : "Usuário criado.");
    await loadUsuarios();
  }

  async function toggleUsuarioAtivo(row: any) {
    const next = !row.ativo;
    const ok = await askConfirm(`Confirma ${next ? "reativar" : "desativar"} o usuário?`, {message: `"${row.nome}" ${next ? "volta a ter acesso" : "perde o acesso"} ao sistema.`, danger: !next});
    if (!ok) return;
    try {
      await api(`/api/usuarios/${row.id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ativo: next}),
      });
      pushToast(`Usuário ${next ? "reativado" : "desativado"}.`);
      await loadUsuarios();
    } catch (e: any) {
      setError(e.message || "Erro ao atualizar usuário.");
      pushToast("Erro ao atualizar usuário.", "error");
    }
  }

  async function saveContrato(data: Record<string, any>) {
    const mode = contratoModal?.mode;
    const id = contratoModal?.contrato?.id;
    const clean: Record<string, any> = {};
    for (const key of ["condominio_id", "objeto", "valor_mensal", "indice_reajuste", "data_inicio", "data_fim", "data_renovacao", "status"]) {
      const value = data[key];
      if (value === undefined || value === "") continue;
      clean[key] = key === "valor_mensal" ? Number(value) : value;
    }
    if (mode === "edit" && id) {
      delete clean.condominio_id;
      await api(`/api/contratos/${id}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    } else {
      await api("/api/contratos", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    }
    setContratoModal(null);
    pushToast(mode === "edit" ? "Contrato atualizado." : "Contrato cadastrado.");
    await refresh();
  }

  async function savePosto(data: Record<string, any>) {
    const mode = postoModal?.mode;
    const id = postoModal?.posto?.id;
    const clean: Record<string, any> = {};
    for (const key of ["condominio_id", "nome", "cargo", "turno", "carga_horaria_semanal", "status"]) {
      const value = data[key];
      if (value === undefined || value === "") continue;
      clean[key] = key === "carga_horaria_semanal" ? Number(value) : value;
    }
    if (mode === "edit" && id) {
      delete clean.condominio_id;
      await api(`/api/postos-trabalho/${id}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    } else {
      await api("/api/postos-trabalho", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    }
    setPostoModal(null);
    pushToast(mode === "edit" ? "Posto atualizado." : "Posto cadastrado.");
    await refresh();
  }

  async function atribuirEscala(postoId: string, dia: string, funcionarioId: string) {
    try {
      const resultado = await api("/api/escalas", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({posto_id: postoId, data: dia, funcionario_id: funcionarioId || null}),
      });
      if (resultado.aviso) pushToast(resultado.aviso, "error");
      else pushToast(funcionarioId ? "Escala atribuída." : "Posto marcado como vago.");
      await loadEscalas(semanaInicio);
    } catch (e: any) {
      setError(e.message || "Erro ao atribuir escala.");
      pushToast("Erro ao atribuir escala.", "error");
    }
  }

  async function marcarFalta(escalaId: string) {
    const motivo = await askPrompt("Marcar falta", "Motivo da falta (opcional).");
    if (motivo === null) return;
    try {
      await api(`/api/escalas/${escalaId}/falta`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({motivo: motivo || null}),
      });
      pushToast("Falta registrada.");
      await loadEscalas(semanaInicio);
    } catch (e: any) {
      setError(e.message || "Erro ao marcar falta.");
      pushToast("Erro ao marcar falta.", "error");
    }
  }

  async function substituirEscala(escalaId: string, substitutoId: string) {
    if (!substitutoId) return;
    try {
      await api(`/api/escalas/${escalaId}/substituir`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({substituto_id: substitutoId}),
      });
      pushToast("Substituição registrada.");
      await loadEscalas(semanaInicio);
    } catch (e: any) {
      setError(e.message || "Erro ao substituir.");
      pushToast("Erro ao substituir.", "error");
    }
  }

  async function gerarEscalaAutomatica(data: {posto_id: string; funcionario_id: string; data_inicio: string; dias: number}) {
    const r = await api("/api/escalas/gerar-recorrencia", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data),
    });
    pushToast(`${r.criados} dia(s) de escala gerado(s) automaticamente${r.ja_ocupados ? ` · ${r.ja_ocupados} já tinham escala e não foram alterados` : ""}.`);
    setGerarEscalaModal(null);
    await loadEscalas(semanaInicio);
  }

  async function saveLancamento(data: Record<string, any>) {
    const mode = lancamentoModal?.mode;
    const id = lancamentoModal?.lancamento?.id;
    const clean: Record<string, any> = {};
    for (const key of ["tipo", "condominio_id", "funcionario_id", "categoria", "descricao", "valor", "vencimento", "origem"]) {
      const value = data[key];
      if (value === undefined || value === "") continue;
      clean[key] = key === "valor" ? Number(value) : value;
    }
    if (mode === "edit" && id) {
      delete clean.tipo;
      await api(`/api/financeiro/${id}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    } else {
      await api("/api/financeiro", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    }
    setLancamentoModal(null);
    pushToast(mode === "edit" ? "Lançamento atualizado." : "Lançamento criado.");
    await refresh();
  }

  async function marcarPago(id: string) {
    const ok = await askConfirm("Marcar como pago?", {message: "O lançamento será marcado como pago hoje."});
    if (!ok) return;
    try {
      await api(`/api/financeiro/${id}/pagar`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({})});
      pushToast("Lançamento marcado como pago.");
      await loadFinanceiro();
      await refresh();
    } catch (e: any) {
      setError(e.message || "Erro ao marcar pagamento.");
      pushToast("Erro ao marcar pagamento.", "error");
    }
  }

  async function gerarMensalidades() {
    const mes = localDateISO().slice(0, 7);
    const ok = await askConfirm("Gerar cobranças do mês?", {message: `Cria uma cobrança de mensalidade para cada contrato ativo com valor definido, referente a ${mes}.`});
    if (!ok) return;
    try {
      const r = await api("/api/financeiro/gerar-mensalidades", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({mes}),
      });
      pushToast(`${r.criados} cobrança(s) gerada(s) · ${r.ja_existentes} já existiam${r.ignorados_sem_valor ? ` · ${r.ignorados_sem_valor} sem valor mensal` : ""}.`);
      await loadFinanceiro();
      await refresh();
    } catch (e: any) {
      setError(e.message || "Erro ao gerar mensalidades.");
      pushToast("Erro ao gerar mensalidades.", "error");
    }
  }

  async function saveEpi(data: Record<string, any>) {
    const mode = epiModal?.mode;
    const id = epiModal?.epi?.id;
    const clean: Record<string, any> = {};
    for (const key of ["funcionario_id", "item", "data_entrega", "data_validade", "termo_assinado_url", "observacao"]) {
      const value = data[key];
      if (value === undefined || value === "") continue;
      clean[key] = value;
    }
    if (mode === "edit" && id) {
      delete clean.funcionario_id;
      await api(`/api/epis/${id}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    } else {
      await api("/api/epis", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    }
    setEpiModal(null);
    pushToast(mode === "edit" ? "EPI atualizado." : "EPI registrado.");
    await loadEpis();
    await loadAlertas();
  }

  async function saveAfastamento(data: Record<string, any>) {
    const mode = afastamentoModal?.mode;
    const id = afastamentoModal?.afastamento?.id;
    const clean: Record<string, any> = {};
    for (const key of ["funcionario_id", "tipo", "data_inicio", "data_fim", "observacao"]) {
      const value = data[key];
      if (value === undefined || value === "") continue;
      clean[key] = value;
    }
    if (mode === "edit" && id) {
      delete clean.funcionario_id;
      await api(`/api/afastamentos/${id}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    } else {
      await api("/api/afastamentos", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(clean)});
    }
    setAfastamentoModal(null);
    pushToast(mode === "edit" ? "Afastamento atualizado." : "Afastamento registrado.");
    await refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", {method: "POST"});
    window.location.href = "/login";
  }

  function openPreview(row: any) {
    setPreviewDoc(row);
  }

  async function saveCompetencia(documentoId: string, competencia: string) {
    await api(`/api/documentos/${documentoId}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({competencia: competencia || null}),
    });
    setPreviewDoc((d: any) => d && d.id === documentoId ? {...d, competencia: competencia || null} : d);
    pushToast("Competência salva.");
    await refresh();
  }

  const isSindico = me?.papel === "sindico";
  const isColaborador = me?.papel === "colaborador";
  return {
    dashboard, setDashboard, funcionarios, setFuncionarios, documentos, setDocumentos, condominios,
    setCondominios, ocorrencias, setOcorrencias, ocorrenciaModal, setOcorrenciaModal, files, setFiles,
    processing, setProcessing, progress, setProgress, results, setResults, error, setError,
    health, setHealth, drive, setDrive, employeeModal, setEmployeeModal, dismissModal, setDismissModal,
    condominioModal, setCondominioModal, previewDoc, setPreviewDoc, me, setMe, usuarios, setUsuarios,
    auditoria, setAuditoria, usuarioModal, setUsuarioModal, contratos, setContratos, contratoModal,
    setContratoModal, postos, setPostos, postoModal, setPostoModal, semanaInicio, setSemanaInicio,
    escalaGrid, setEscalaGrid, escalaCell, setEscalaCell, gerarEscalaModal, setGerarEscalaModal, lancamentos,
    setLancamentos, lancamentoFiltro, setLancamentoFiltro, lancamentoTipoFiltro, setLancamentoTipoFiltro,
    lancamentoModal, setLancamentoModal, epis, setEpis, onboarding, setOnboarding, epiModal, setEpiModal,
    afastamentos, setAfastamentos, afastamentoModal, setAfastamentoModal, alertas, setAlertas, relatorios,
    setRelatorios, toasts, setToasts, dialog, setDialog, dialogValue, setDialogValue, collapsedGroups,
    setCollapsedGroups, pushToast, askConfirm, askPrompt, closeDialog, refresh, loadFinanceiro, loadEpis,
    loadAfastamentos, loadOnboarding, loadOcorrencias, saveOcorrencia, marcarOcorrencia, loadAlertas,
    loadRelatorios, loadUsuarios, loadAuditoria, loadEscalas,
    documentosPorStatus, funcionariosPorCargo, filteredLancamentos, financeiroStats,
    filtrarFinanceiro, chooseFiles, processFiles, saveEmployee, confirmCargo, submitDismiss, saveCondominio,
    toggleCondominioStatus, saveUsuario, toggleUsuarioAtivo, saveContrato, savePosto, atribuirEscala,
    marcarFalta, substituirEscala, gerarEscalaAutomatica, saveLancamento, marcarPago, gerarMensalidades,
    saveEpi, saveAfastamento, logout, openPreview, saveCompetencia, isSindico, isColaborador,
  };
}

const CrmContext = createContext<ReturnType<typeof useCrmValue> | null>(null);

export function CrmProvider({children}: {children: React.ReactNode}) {
  const value = useCrmValue();
  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm precisa estar dentro de um CrmProvider.");
  return ctx;
}
