'use client';

import Image from 'next/image';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export default function AccessPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const logoTapCountRef = useRef(0);
  const logoTapTimerRef = useRef<number | null>(null);

  function getNextPath() {
    return typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('next') || '/executive'
      : '/executive';
  }

  function handleLogoTap() {
    logoTapCountRef.current += 1;

    if (logoTapTimerRef.current) {
      window.clearTimeout(logoTapTimerRef.current);
    }

    logoTapTimerRef.current = window.setTimeout(() => {
      logoTapCountRef.current = 0;
    }, 1800);

    if (logoTapCountRef.current >= 5) {
      logoTapCountRef.current = 0;
      setAdminOpen(true);
      setAdminError(null);
      setAdminPassword('');
    }
  }

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

    router.replace(getNextPath());
    router.refresh();
  }

  async function onAdminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminSubmitting(true);
    setAdminError(null);

    const response = await fetch('/api/access/admin-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword }),
    });

    if (!response.ok) {
      setAdminError('Invalid admin password.');
      setAdminSubmitting(false);
      return;
    }

    setAdminOpen(false);
    router.replace(getNextPath());
    router.refresh();
  }

  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center py-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-56 w-56 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/35 blur-3xl" />
      </div>

      <article className="w-full rounded-3xl border border-slate-200 bg-white/95 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur">
        <button
          type="button"
          onClick={handleLogoTap}
          className="inline-flex rounded-xl bg-slate-900 p-2"
          aria-label="Chiesi logo"
        >
          <Image src="/logo.svg" alt="Chiesi" width={112} height={44} />
        </button>

        <div className="mt-6 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
            <Lock className="h-4.5 w-4.5 text-slate-700" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Protected Executive Content</h1>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          The content at this address is encrypted and can only be consumed through available Power BI service authentication.
          If you require access and do not currently have it, please request it at{' '}
          <a href="mailto:j.arevalo@chiesi.com" className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2">
            j.arevalo@chiesi.com
          </a>
          .
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Master Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
            placeholder="Enter password"
            autoFocus
            required
          />

          {error ? <p className="text-xs font-medium text-rose-700">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? 'Validating...' : 'Continue'}
          </button>
        </form>
      </article>

      {adminOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <article className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-900">Admin Override</h2>
            <p className="mt-1 text-xs text-slate-500">Enter admin password to continue.</p>

            <form onSubmit={onAdminSubmit} className="mt-4 space-y-3">
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                placeholder="Admin password"
                required
              />
              {adminError ? <p className="text-xs font-medium text-rose-700">{adminError}</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdminOpen(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminSubmitting}
                  className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {adminSubmitting ? 'Validating...' : 'Unlock'}
                </button>
              </div>
            </form>
          </article>
        </div>
      ) : null}
    </section>
  );
}
