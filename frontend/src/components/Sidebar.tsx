'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  MessageSquare,
  ScrollText,
  BookOpen,
  ShoppingBag,
  Settings,
} from 'lucide-react';

const NAV = [
  { href: '/',        icon: MessageSquare,  label: 'Live Chat'  },
  { href: '/logs',    icon: ScrollText,     label: 'Sessions'   },
  { href: '/products',icon: ShoppingBag,    label: 'Products'   },
  { href: '/kb',      icon: BookOpen,       label: 'Knowledge'  },
  { href: '/admin/settings', icon: Settings, label: 'Settings'  },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside style={{
      width: 68,
      flexShrink: 0,
      height: '100vh',
      background: '#0f0f13',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 16,
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 20, textDecoration: 'none' }}>
        <div style={{
          width: 38, height: 38,
          background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(124,58,237,0.45)',
        }}>
          <Sparkles size={18} color="#fff" />
        </div>
        <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>WhatSell</span>
      </Link>

      {/* Divider */}
      <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 8 }} />

      {/* Nav items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, width: '100%', padding: '0 6px' }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '10px 4px',
                borderRadius: 10,
                textDecoration: 'none',
                background: active ? 'rgba(124,58,237,0.18)' : 'transparent',
                border: active ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
                color: active ? '#a78bfa' : 'rgba(255,255,255,0.38)',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.38)';
                }
              }}
            >
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1 }}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 12 }} />

      {/* User avatar */}
      <div style={{
        width: 34, height: 34,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
      }}>
        W
      </div>
    </aside>
  );
}
