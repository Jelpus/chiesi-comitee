'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import Image from 'next/image';

export default function AccessPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch('/api/access/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      setError('Incorrect password.');
      setSubmitting(false);
      return;
    }

    const nextPath =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('next') || '/executive'
        : '/executive';

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <section className="mx-auto max-w-md py-10">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">

        <div className="inline-flex rounded-lg bg-slate-900 p-2">
          <Image
            src="/logo.svg"
            alt="Chiesi"
            width={100}
            height={40}
            className=""
          />
        </div>



        <div className="flex items-center gap-2 pt-5">
          <Lock className="h-5 w-5 text-slate-700" />
          <h1 className="text-lg font-semibold text-slate-900">Executive Access</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Enter the master password to continue.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            placeholder="Master password"
            autoFocus
            required
          />

          {error ? <p className="text-xs font-medium text-rose-700">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? 'Validating...' : 'Unlock Executive'}
          </button>
        </form>
      </article>
    </section>
  );
}
