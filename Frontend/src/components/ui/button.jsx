import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--primary)] text-white rounded-full shadow-lg shadow-[var(--primary)]/20 hover:shadow-xl hover:shadow-[var(--primary)]/30 focus:ring-[var(--primary)]/50',
        outline:
          'bg-white border-2 border-[var(--border)] text-[var(--foreground)] rounded-full hover:bg-[var(--secondary)] hover:border-[var(--primary)]/30 focus:ring-[var(--primary)]/30',
        ghost:
          'bg-transparent text-[var(--foreground)] rounded-full hover:bg-[var(--secondary)] focus:ring-[var(--primary)]/30',
        secondary:
          'bg-[var(--accent)] text-[var(--primary)] rounded-full hover:bg-[var(--accent)]/80 focus:ring-[var(--primary)]/30',
        destructive:
          'bg-[var(--destructive)] text-white rounded-full hover:bg-[var(--destructive)]/90 focus:ring-[var(--destructive)]/50',
        link:
          'text-[var(--primary)] underline-offset-4 hover:underline focus:ring-0',
      },
      size: {
        default: 'px-6 py-3 text-sm',
        sm: 'px-4 py-2 text-xs',
        lg: 'px-8 py-4 text-base',
        xl: 'px-10 py-5 text-lg',
        icon: 'p-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? 'span' : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
