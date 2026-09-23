"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        username: data.get("username"),
        password: data.get("password"),
        remember,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Não foi possível entrar.");
      setLoading(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark">LR</div>
        <div>
          <p className="eyebrow">LIFE RECURSOS</p>
          <h1>Central de operações</h1>
          <p className="muted">Acesse o CRM para processar e consultar documentos.</p>
        </div>
        <label>
          Usuário
          <input name="username" autoComplete="username" required />
        </label>
        <label>
          Senha
          <div className="password-field">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </label>
        <label className="remember-field">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          Lembrar de mim neste navegador
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="primary" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
      </form>
    </main>
  );
}
