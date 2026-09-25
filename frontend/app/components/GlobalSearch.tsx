"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalize } from "../lib/ui";

export function GlobalSearch({funcionarios, documentos, condominios}: {funcionarios: any[]; documentos: any[]; condominios: any[]}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const results = useMemo(() => {
    const q = normalize(term);
    if (q.length < 2) return {funcionarios: [] as any[], documentos: [] as any[], condominios: [] as any[]};
    return {
      funcionarios: funcionarios.filter(f =>
        normalize(f.nome).includes(q) || normalize(f.cpf).includes(q) || normalize(f.condominio).includes(q)
      ).slice(0, 6),
      documentos: documentos.filter(d =>
        normalize(d.tipo_documento).includes(q) || normalize(d.arquivo_nome).includes(q) ||
        normalize(d.funcionarios?.nome).includes(q) || normalize(d.condominios?.nome).includes(q)
      ).slice(0, 6),
      condominios: condominios.filter(c =>
        normalize(c.nome).includes(q) || normalize(c.cidade).includes(q)
      ).slice(0, 6),
    };
  }, [term, funcionarios, documentos, condominios]);

  const total = results.funcionarios.length + results.documentos.length + results.condominios.length;
  const showDropdown = open && term.trim().length >= 2;

  return (
    <div className="global-search" ref={boxRef}>
      <input
        className="search"
        placeholder="Buscar no sistema"
        value={term}
        onChange={e => { setTerm(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {showDropdown && (
        <div className="search-dropdown">
          {!total ? (
            <div className="search-empty">Nada encontrado para "{term}".</div>
          ) : (
            <>
              {!!results.funcionarios.length && (
                <div className="search-group">
                  <div className="search-group-label">Funcionários</div>
                  {results.funcionarios.map(f => (
                    <Link key={f.id} href={`/funcionarios/${f.id}`} className="search-result" onClick={() => setOpen(false)}>
                      <b>{f.nome}</b><span>{f.cargo || "Pendente"}{f.condominio ? ` · ${f.condominio}` : ""}</span>
                    </Link>
                  ))}
                </div>
              )}
              {!!results.condominios.length && (
                <div className="search-group">
                  <div className="search-group-label">Condomínios</div>
                  {results.condominios.map(c => (
                    <Link key={c.id} href={`/condominios/${c.id}`} className="search-result" onClick={() => setOpen(false)}>
                      <b>{c.nome}</b><span>{c.cidade || ""}</span>
                    </Link>
                  ))}
                </div>
              )}
              {!!results.documentos.length && (
                <div className="search-group">
                  <div className="search-group-label">Documentos</div>
                  {results.documentos.map(d => (
                    <Link
                      key={d.id}
                      href={d.funcionario_id ? `/funcionarios/${d.funcionario_id}` : (d.condominio_id ? `/condominios/${d.condominio_id}` : "/documentos")}
                      className="search-result"
                      onClick={() => setOpen(false)}
                    >
                      <b>{d.tipo_documento || d.arquivo_nome || "Documento"}</b><span>{d.funcionarios?.nome || d.condominios?.nome || ""}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
