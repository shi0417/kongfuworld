import React from 'react';
import styles from './PillSelect.module.css';

export type PillOption<T extends string | number> = {
  label: string;
  value: T;
  disabled?: boolean;
};

type CommonProps<T extends string | number> = {
  options: Array<PillOption<T>>;
  disabled?: boolean;
  className?: string;
};

type SingleProps<T extends string | number> = CommonProps<T> & {
  mode: 'single';
  value: T;
  onChange: (value: T) => void;
};

type MultiProps<T extends string | number> = CommonProps<T> & {
  mode: 'multi';
  values: T[];
  onToggle: (value: T) => void;
};

export default function PillSelect<T extends string | number>(props: SingleProps<T> | MultiProps<T>) {
  const isSelected = (v: T) => {
    if (props.mode === 'single') return props.value === v;
    return props.values.includes(v);
  };

  return (
    <div className={`${styles.root} ${props.className || ''}`}>
      {props.options.map((opt) => {
        const selected = isSelected(opt.value);
        const disabled = !!props.disabled || !!opt.disabled;
        return (
          <button
            key={String(opt.value)}
            type="button"
            className={[
              styles.pill,
              selected ? styles.selected : '',
              disabled ? styles.disabled : ''
            ].join(' ')}
            onClick={() => {
              if (disabled) return;
              if (props.mode === 'single') props.onChange(opt.value);
              else props.onToggle(opt.value);
            }}
            aria-pressed={selected}
            disabled={disabled}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}


