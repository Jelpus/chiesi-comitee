import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SalesInternalIndexPage() {
  redirect('/executive/sales-internal/insights');
}

