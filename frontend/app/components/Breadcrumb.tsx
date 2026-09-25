"use client";

import Link from "next/link";
import { Icon } from "../lib/ui";

// Trilha estilo Drive: cada nivel clicavel leva de volta pra ele, so o
// ultimo (a tela atual) fica sem link.
export function Breadcrumb({items}: {items: {label: string; href?: string}[]}) {
  return (
    <nav className="breadcrumb">
      {items.map((item, i) => (
        <span className="breadcrumb-item" key={i}>
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span className="current">{item.label}</span>}
          {i < items.length - 1 && <Icon name="chevron-right" size={13} />}
        </span>
      ))}
    </nav>
  );
}
