import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'supervisor' | 'worker' | 'evaluator' | 'openai' | 'azure_openai' | 'anthropic' | 'gemini' | 'default' | 'success' | 'amber';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const getStyles = () => {
    switch (variant) {
      case 'supervisor':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60';
      case 'worker':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60';
      case 'evaluator':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
      case 'openai':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
      case 'azure_openai':
        return 'bg-sky-950/80 text-sky-300 border-sky-800/60';
      case 'anthropic':
        return 'bg-orange-950/80 text-orange-300 border-orange-800/60';
      case 'gemini':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
      case 'success':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
      case 'amber':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStyles()} ${className}`}>
      {children}
    </span>
  );
}
