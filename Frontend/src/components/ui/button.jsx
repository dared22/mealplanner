import React from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './buttonVariants';

const Button = React.forwardRef(
  ({ className, variant, size, ...props }, ref) => {
    const Comp = 'button';
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

export { Button };
