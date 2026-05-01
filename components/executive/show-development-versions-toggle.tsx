'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type ShowDevelopmentVersionsToggleProps = {
  enabled: boolean;
};

export function ShowDevelopmentVersionsToggle({ enabled }: ShowDevelopmentVersionsToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());

    if (checked) {
      params.set('showDrafts', '1');
    } else {
      params.delete('showDrafts');
      params.delete('version');
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => handleChange(event.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 text-slate-700"
      />
      <span>Show dev versions</span>
    </label>
  );
}
