"use client";

import { useCrm } from "../../lib/CrmContext";
import { MinhaEscala } from "../../components/MinhaEscala";

export default function MinhaEscalaPage() {
  const {me, escalaGrid} = useCrm();
  return <MinhaEscala me={me} escalaGrid={escalaGrid} />;
}
