"use client";

import { useState } from "react";
import { drivePreviewUrl, formatCompetencia } from "../lib/ui";

export function DocumentPreviewModal({doc, onClose, onSaveCompetencia}: {doc: any; onClose: () => void; onSaveCompetencia: (id: string, competencia: string) => Promise<void>}) {
  const [competencia, setCompetencia] = useState(doc.competencia ? String(doc.competencia).slice(0, 7) : "");
  const [saving, setSaving] = useState(false);
  const url = doc.arquivo_drive_url ? drivePreviewUrl(doc.arquivo_drive_url) : "";

  async function salvarCompetencia() {
    setSaving(true);
    try {
      await onSaveCompetencia(doc.id, competencia ? `${competencia}-01` : "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card preview-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Visualizar documento</h3>
          <div className="row-actions">
            {doc.arquivo_drive_url && <a className="link-btn" href={doc.arquivo_drive_url} target="_blank" rel="noopener noreferrer">Abrir no Drive ↗</a>}
            <button type="button" className="link-btn" onClick={onClose}>Fechar</button>
          </div>
        </div>
        {doc.tipo_documento === "FolhaDePonto" && (
          <div className="row-actions" style={{alignItems: "flex-end"}}>
            <label style={{display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--muted)"}}>
              Competência{competencia && <span className="muted" style={{fontWeight: 500}}> · {formatCompetencia(`${competencia}-01`)}</span>}
              <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} />
            </label>
            <button className="primary" disabled={saving} onClick={salvarCompetencia}>{saving ? "Salvando..." : "Salvar competência"}</button>
          </div>
        )}
        {url ? <iframe src={url} className="preview-frame" allow="autoplay" title="Preview do documento" /> : <div className="empty">Sem arquivo para visualizar.</div>}
      </div>
    </div>
  );
}
