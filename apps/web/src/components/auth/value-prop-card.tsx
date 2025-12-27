/**
 * Value Prop Card - Bento-style feature highlight
 */

'use client';

import { motion } from 'framer-motion';
import { Cpu, Package, Zap, Sparkles, type LucideIcon } from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  cpu: Cpu,
  package: Package,
  zap: Zap,
  sparkles: Sparkles,
};

interface ValuePropCardProps {
  icon: keyof typeof icons;
  title: string;
  description: string;
  delay?: number;
}

export function ValuePropCard({
  icon,
  title,
  description,
  delay = 0,
}: ValuePropCardProps) {
  const Icon = icons[icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="
        forge-glass rounded-2xl p-5
        border border-orange-900/20
        hover:border-orange-500/30 transition-all duration-300
        hover:shadow-[0_0_30px_rgba(255,92,0,0.1)]
      "
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <Icon className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-orange-400 tracking-wider mb-1">
            {title}
          </h3>
          <p className="text-xs text-zinc-500 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
