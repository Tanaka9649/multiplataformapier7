"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BUTTON_PRIMARY, CARD_SURFACE, INPUT_BASE, LABEL_BASE, cx } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push("/dashboard");
        router.refresh();
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setInfo(
          "Conta criada. Se a confirmação por e-mail estiver ativa no projeto Supabase, verifique sua caixa de entrada antes de entrar. Depois de entrar, seu acesso ficará aguardando aprovação do administrador."
        );
        setMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a operação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4 transition-colors dark:bg-[#101012]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className={cx(CARD_SURFACE, "w-full max-w-sm animate-fade-in-up p-8")}>
        <div className="mb-8 flex justify-center">
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            PIER7
          </span>
        </div>

        <h1 className="mb-1 text-center text-lg font-semibold text-slate-900 dark:text-zinc-100">
          {mode === "signin" ? "Entrar na plataforma" : "Criar conta"}
        </h1>
        <p className="mb-6 text-center text-sm text-slate-500 dark:text-zinc-400">
          Acesso restrito às equipes autorizadas do grupo PIER7.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={LABEL_BASE} htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_BASE}
              placeholder="voce@empresa.com"
            />
          </div>
          <div>
            <label className={LABEL_BASE} htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_BASE}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="animate-fade-in rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          {info && (
            <p className="animate-fade-in rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {info}
            </p>
          )}

          <button type="submit" disabled={loading} className={`w-full ${BUTTON_PRIMARY}`}>
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
          className="mt-5 w-full text-center text-sm text-brand-700 transition-colors hover:underline dark:text-brand-400"
        >
          {mode === "signin" ? "Não tem conta? Criar acesso" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}
