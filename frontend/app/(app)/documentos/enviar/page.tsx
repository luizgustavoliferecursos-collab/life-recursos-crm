"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";
import { useCrm } from "../../../lib/CrmContext";
import { api, DIRECT_API } from "../../../lib/ui";
import { DataTable } from "../../../components/DataTable";

type FileStatus = "enviando" | "processando" | "sucesso" | "duplicado" | "erro";

type FileProgress = {
  file: File;
  status: FileStatus;
  percent: number;
  resultado?: any;
};

const STATUS_LABEL: Record<FileStatus, string> = {
  enviando: "Enviando",
  processando: "Lendo e identificando",
  sucesso: "Salvo",
  duplicado: "Duplicado",
  erro: "Erro",
};

export default function EnviarDocumentosPage() {
  const {dashboard, refresh} = useCrm();
  const [queue, setQueue] = useState<FileProgress[]>([]);
  const [processing, setProcessing] = useState(false);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []).filter(file =>
      ["application/pdf", "image/jpeg", "image/png"].includes(file.type)
    );
    setQueue(selected.map(file => ({file, status: "enviando", percent: 0})));
  }

  function updateAt(index: number, patch: Partial<FileProgress>) {
    setQueue(q => q.map((item, i) => i === index ? {...item, ...patch} : item));
  }

  // Um arquivo por vez, via XMLHttpRequest, pra ter progresso real de upload
  // (Enviando = bytes ainda subindo) e um estagio "Lendo e identificando"
  // honesto (upload terminou, aguardando a IA/Drive no servidor) - nao um
  // progresso fake, so o que da pra observar de fato sem streaming do backend.
  async function processFile(index: number, token: string): Promise<any> {
    return new Promise((resolve) => {
      const item = queue[index];
      const form = new FormData();
      form.append("files", item.file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", DIRECT_API + "/api/documentos/processar");
      xhr.setRequestHeader("X-Upload-Token", token);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) updateAt(index, {percent: Math.round((e.loaded / e.total) * 100)});
      };
      xhr.upload.onload = () => updateAt(index, {status: "processando", percent: 100});
      xhr.onload = () => {
        try {
          const payload = JSON.parse(xhr.responseText || "{}");
          const resultado = payload.resultados?.[0];
          const status: FileStatus = resultado?.status === "sucesso" ? "sucesso" : resultado?.status === "duplicado" ? "duplicado" : "erro";
          updateAt(index, {status, resultado});
          resolve(resultado);
        } catch {
          updateAt(index, {status: "erro", resultado: {mensagem: "Resposta inválida do servidor."}});
          resolve(null);
        }
      };
      xhr.onerror = () => {
        updateAt(index, {status: "erro", resultado: {mensagem: "Falha de conexão ao processar."}});
        resolve(null);
      };
      xhr.send(form);
    });
  }

  async function processAll() {
    if (!queue.length) return;
    setProcessing(true);
    try {
      const {token} = await api("/api/documentos/upload-auth", {method: "POST"});
      for (let i = 0; i < queue.length; i++) {
        await processFile(i, token);
      }
      await refresh();
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="enviar-grid">
      <section className="panel upload-panel">
        <div className="panel-head"><div><h3>Enviar documentos</h3><span>PDF, JPG e PNG • múltiplos arquivos</span></div></div>
        <label className="dropzone">
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={chooseFiles} />
          <b>Selecione ou arraste arquivos</b>
          <span>{queue.length ? queue.map(f => f.file.name).join(" • ") : "Nenhum arquivo selecionado"}</span>
        </label>
        <button className="primary" disabled={!queue.length || processing} onClick={processAll}>{processing ? "Processando..." : "Processar documentos"}</button>

        {!!queue.length && (
          <div className="upload-queue">
            {queue.map((item, i) => (
              <article key={i} className={"upload-row status-" + item.status}>
                <div className="upload-row-head">
                  <b>{item.file.name}</b>
                  <span className={"badge " + (item.status === "erro" ? "danger" : item.status === "duplicado" ? "warn" : item.status === "sucesso" ? "" : "neutral")}>{STATUS_LABEL[item.status]}</span>
                </div>
                {(item.status === "enviando" || item.status === "processando") && (
                  <div className="progress"><div style={{width: (item.status === "processando" ? 100 : item.percent) + "%"}}></div></div>
                )}
                {item.resultado && (
                  <p className="upload-row-msg">
                    {item.resultado.mensagem || [item.resultado.funcionario, item.resultado.documento, item.resultado.condominio, item.resultado.cargo, item.resultado.ano].filter(Boolean).join(" • ")}
                    {item.resultado.funcionario_id && <> · <Link href={`/funcionarios/${item.resultado.funcionario_id}`}>Ver ficha</Link></>}
                    {!item.resultado.funcionario_id && item.resultado.condominio_id && <> · <Link href={`/condominios/${item.resultado.condominio_id}`}>Ver condomínio</Link></>}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Últimos processados</h3><span>10 mais recentes</span></div>
        <DataTable rows={(dashboard?.recentes || []).slice(0, 10)} type="docs" />
      </section>
    </div>
  );
}
