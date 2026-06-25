'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

const mainLinks = [
  { href: '/', label: 'Início' },
  { href: '/importacoes/pecas', label: 'Importação de Peças' },
  { href: '/importacoes/historico', label: 'Histórico' },
  { href: '/diagnostico', label: 'Diagnóstico' },
  { href: '/auditoria', label: 'Auditoria' },
  { href: '/revisao', label: 'Central de Revisão' },
  { href: '/catalogo-preview', label: 'Catálogo Preview' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/marketplace/ad-link', label: 'Vínculo de Anúncio' },
];

const devLinks = [
  { href: '/test-import', label: 'Teste técnico' },
  { href: '/test-import/tests', label: 'Testes' },
];

const showDevLinks = process.env.NEXT_PUBLIC_SHOW_DEV_LINKS === 'true';

const isActive = (pathname: string, href: string): boolean =>
  href === '/'
    ? pathname === href
    : href === '/marketplace'
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

export function AppNavigation() {
  const pathname = usePathname();
  const links = showDevLinks ? [...mainLinks, ...devLinks] : mainLinks;

  return (
    <nav
      aria-label="Navegação principal"
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 24,
        padding: 10,
        border: '1px solid #dbe2ea',
        borderRadius: 10,
        backgroundColor: '#fff',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
      }}
    >
      {links.map((link) => {
        const active = isActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              backgroundColor: active ? '#2563eb' : '#f8fafc',
              color: active ? '#fff' : '#334155',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
