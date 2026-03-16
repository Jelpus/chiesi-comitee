'use client';

import Image from 'next/image';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

export default function AccessPage() {
  const router = useRouter();
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
    <section className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center py-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-64 w-64 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-200/35 blur-3xl" />
      </div>

      <article className="w-full rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur md:p-10">
        <button
          type="button"
          onClick={handleLogoTap}
          className="inline-flex rounded-2xl bg-white p-2.5 ring-1 ring-slate-200"
          aria-label="Chiesi logo"
        >
          <Image src="/chiesi_color.png" alt="Chiesi" width={220} height={72} priority />
        </button>

        <div className="mt-7 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <ShieldAlert className="h-5 w-5 text-slate-700" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">Restricted Executive Content</h1>
        </div>

        <p className="mt-4 max-w-4xl text-base leading-7 text-slate-600 md:text-lg">
          The content at this address is encrypted and can only be consumed through active Power BI service authentication.
          You currently do not have access to this content.
        </p>
        <p className="mt-3 max-w-4xl text-base leading-7 text-slate-600 md:text-lg">
          If you require access, please contact{' '}
          <a href="mailto:j.arevalo@chiesi.com" className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2">
            j.arevalo@chiesi.com
          </a>
          .
        </p>
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
