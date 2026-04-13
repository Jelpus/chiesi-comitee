export type AppNavItem = {
  href: string;
  label: string;
};

export const appNavigation: AppNavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/forms', label: 'Forms' },
  { href: '/closing-inputs', label: 'Closing Inputs' },
  { href: '/admin', label: 'Admin' },
  { href: '/admin/periods', label: 'Periods' },
  { href: '/admin/versions', label: 'Versions' },
  { href: '/admin/uploads', label: 'Uploads' },
  { href: '/admin/uploads/logs', label: 'Upload Logs' },
  { href: '/admin/tables', label: 'Tables' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/targets', label: 'Targets' },
  { href: '/admin/opex-groups', label: 'Opex Groups' },
  { href: '/executive', label: 'Executive' },
  { href: '/executive/sales-internal', label: 'Sales Internal' },
  { href: '/executive/business-excellence', label: 'Business Excellence' },
  { href: '/executive/human-resources', label: 'Human Resources' },
  { href: '/executive/commercial-operations', label: 'Commercial Operations' },
  { href: '/executive/medical', label: 'Medical' },
  { href: '/executive/opex', label: 'Opex' },
  { href: '/executive/ra-quality-fv', label: 'RA - Quality - FV' },
  { href: '/executive/legal-compliance', label: 'Legal & Compliance' },
];
