'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  // Acción principal: cian neón con brillo; animación de pulso al hacer clic.
  primary:
    'bg-ev-cyan text-ev-base font-black hover:brightness-110 shadow-[0_0_0_1px_rgba(0,229,255,0.35),0_0_18px_rgba(0,229,255,0.25)] hover:shadow-[0_0_0_1px_rgba(0,229,255,0.7),0_0_28px_rgba(0,229,255,0.5)]',
  // Secundaria: contorno cian sobre cristal.
  secondary:
    'border border-ev-cyan/40 bg-ev-surface/60 text-ev-cyan hover:bg-ev-cyan/10 hover:border-ev-cyan hover:shadow-[0_0_16px_rgba(0,229,255,0.25)]',
  // Destructiva / emergencia.
  danger:
    'bg-ev-red text-white font-black hover:brightness-110 shadow-[0_0_0_1px_rgba(255,59,78,0.4),0_0_18px_rgba(255,59,78,0.3)] hover:shadow-[0_0_0_1px_rgba(255,59,78,0.8),0_0_28px_rgba(255,59,78,0.55)]',
  // Terciaria: solo texto.
  ghost: 'text-ev-label hover:text-white hover:bg-white/5',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3 text-xs gap-1.5',
  md: 'min-h-[44px] px-4 text-sm gap-2',
  lg: 'min-h-[52px] px-6 text-base gap-2.5',
};

export interface EvButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Muestra un indicador de actividad y desactiva el botón */
  loading?: boolean;
}

/**
 * Botón del sistema EXOVITALS. Estados: por defecto, hover (brillo),
 * activo (se hunde y emite una onda de energía: `data-ev-press`),
 * deshabilitado (apagado, sin brillo) y cargando.
 */
export const Button = forwardRef<HTMLButtonElement, EvButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, loading = false, disabled, className = '', children, type = 'button', ...rest },
  ref
) {
  const animated = variant === 'primary' || variant === 'danger';
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-ev-press={animated ? '' : undefined}
      className={`relative inline-flex items-center justify-center rounded-lg font-mono uppercase tracking-[0.12em] transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ev-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-ev-base active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:brightness-75 disabled:active:scale-100 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  );
});

export default Button;
