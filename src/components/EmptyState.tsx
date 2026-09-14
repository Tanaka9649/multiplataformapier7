export function EmptyState({ message }: { message: string }) {
  return (
    <div className="animate-fade-in rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
      {message}
    </div>
  );
}
