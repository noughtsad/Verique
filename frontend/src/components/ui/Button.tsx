import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent-strong disabled:bg-accent/40',
  secondary: 'border border-line bg-white/5 text-zinc-100 hover:bg-white/10',
  ghost: 'text-zinc-300 hover:bg-white/5 hover:text-white',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-600/40',
} as const;

const SIZES = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-[15px]' } as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
