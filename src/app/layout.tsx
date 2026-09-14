import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "PIER7 · Plataforma de Marketing",
  description: "Dashboard multiempresa de tráfego pago, calendário, planilhas e leads.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-[#f7f7f8] font-sans text-slate-900 antialiased transition-colors dark:bg-[#101012] dark:text-zinc-100">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
