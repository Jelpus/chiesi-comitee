export type AppNavItem = {
  href: string;
  label: string;
};

export const appNavigation: AppNavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/admin', label: 'Admin' },
  { href: '/admin/periods', label: 'Periods' },
  { href: '/admin/versions', label: 'Versions' },
  { href: '/admin/uploads', label: 'Uploads' },
  { href: '/admin/uploads/logs', label: 'Upload Logs' },
  { href: '/admin/tables', label: 'Tables' },
  { href: '/admin/products', label: 'Products' },
  { href: '/executive', label: 'Executive' },
  { href: '/executive/sales-internal', label: 'Sales Internal' },
  { href: '/executive/business-excellence', label: 'Business Excellence' },
];
