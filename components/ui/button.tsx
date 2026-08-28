import type { ButtonHTMLAttributes, ReactNode } from 'react';

export default function Button({ children, variant = 'default', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary'; children: ReactNode }) {
  return <button className={`ui-button ${variant === 'primary' ? 'ui-button-primary' : ''}`} {...props}>{children}</button>;
}
