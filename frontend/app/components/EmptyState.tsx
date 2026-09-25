"use client";

import Link from "next/link";
import { Icon } from "../lib/ui";

// Estado vazio consistente: icone + motivo + proximo passo, nunca so um "0"
// solto na tela (ex.: "Cadastre o primeiro posto para montar a escala").
export function EmptyState({icon = "file-text", title, description, actionLabel, onAction, href}: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon name={icon} size={24} /></div>
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {actionLabel && (
        href ? (
          <Link href={href} className="primary">{actionLabel}</Link>
        ) : (
          <button type="button" className="primary" onClick={onAction}>{actionLabel}</button>
        )
      )}
    </div>
  );
}
