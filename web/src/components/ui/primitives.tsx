import { Button as BaseButton } from '@base-ui/react/button';
import { Input as BaseInput } from '@base-ui/react/input';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactElement, ReactNode, TextareaHTMLAttributes } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Button({ className, variant = 'secondary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'icon' | 'tab' }) {
  return <BaseButton className={cx(`ui-button ui-button-${variant}`, className)} {...props} />;
}

export function IconButton({ label, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <Tooltip label={label}>
      <Button className={className} variant="icon" aria-label={label} {...props}>{children}</Button>
    </Tooltip>
  );
}

export function Tabs({ value, onValueChange, items, label }: {
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ value: string; label: string; icon: ReactNode }>;
  label: string;
}) {
  return (
    <BaseTabs.Root className="builder-tabs" value={value} onValueChange={onValueChange}>
      <BaseTabs.List aria-label={label}>
        {items.map((item) => (
          <BaseTabs.Tab value={item.value} key={item.value}>
            {item.icon}
            <span>{item.label}</span>
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
    </BaseTabs.Root>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={6}>
          <BaseTooltip.Popup className="ui-tooltip">{label}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cx('panel', className)} {...props} />;
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('status-pill', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('ui-textarea', className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <BaseInput className={cx('ui-input', className)} {...props} />;
}

export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cx('ui-table', className)}>{children}</table>;
}
