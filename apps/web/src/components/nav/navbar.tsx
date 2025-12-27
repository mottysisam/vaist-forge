/**
 * Navbar - Top navigation for authenticated users
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  LayoutDashboard,
  Hammer,
  Music,
  Settings,
  LogOut,
  Key,
  ChevronDown,
  User,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { ApiQuotaIndicator } from './api-quota-indicator';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/forge', label: 'Forge', icon: Hammer },
  { href: '/studio', label: 'Studio', icon: Music },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, hasApiKey, logout } = useAuthStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-16 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30">
            <Zap className="w-5 h-5 text-orange-400" />
          </div>
          <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
            vAIst
          </span>
          <span className="text-xs text-zinc-600 font-mono">FORGE</span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Section: Quota + User Menu */}
        <div className="flex items-center gap-3">
          {/* API Quota Indicator */}
          <ApiQuotaIndicator />

          {/* User Menu */}
          <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800/50 transition"
          >
            {/* Avatar */}
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || 'User'}
                className="w-8 h-8 rounded-full border border-zinc-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <User className="w-4 h-4 text-zinc-500" />
              </div>
            )}

            {/* Name (desktop) */}
            <span className="hidden md:block text-sm text-zinc-300 max-w-[120px] truncate">
              {user?.name || user?.email}
            </span>

            <ChevronDown
              className={cn(
                'w-4 h-4 text-zinc-500 transition-transform',
                isUserMenuOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {isUserMenuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />

                {/* Menu */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-56 z-50 forge-glass rounded-xl border border-zinc-800 overflow-hidden shadow-xl"
                >
                  {/* User Info */}
                  <div className="p-4 border-b border-zinc-800">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {user?.email}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className="p-2">
                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition"
                    >
                      <Key className="w-4 h-4" />
                      <span>API Keys</span>
                      {!hasApiKey && (
                        <span className="ml-auto text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          Setup
                        </span>
                      )}
                    </Link>

                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </Link>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>
    </nav>
  );
}
