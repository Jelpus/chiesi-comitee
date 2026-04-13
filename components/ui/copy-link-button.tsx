'use client';

import { useState } from 'react';

type CopyLinkButtonProps = {
  href: string;
  className?: string;
};

export function CopyLinkButton({ href, className }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      const absoluteUrl = `${window.location.origin}${href}`;
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ??
        'rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-700 transition hover:border-slate-400'
      }
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}

