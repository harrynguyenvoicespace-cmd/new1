import * as React from 'react';

export const Pill = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', children, ...rest }, ref) => (
  <div
    ref={ref}
    className={`pointer-events-auto rounded-[18px] border border-white/75 bg-[#f2f3f1]/90 text-[#23272d] shadow-[0_18px_36px_rgba(44,48,54,0.18)] backdrop-blur-2xl ${className}`}
    {...rest}
  >
    {children}
  </div>
));
Pill.displayName = 'Pill';
