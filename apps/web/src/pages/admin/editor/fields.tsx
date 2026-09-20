// Small form helpers shared by the editor panes — a number input that tolerates a half-typed
// value (« - », « 3, ») and an overline label. Layout helpers, not kit components.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { Input } from '../../../design-system/index.ts';
import { MINUS } from '../../../lib/format.ts';

function parseNumber(text: string, integer: boolean): number | null {
  const t = text.trim().replace(',', '.').replace(MINUS, '-');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  if (integer && !Number.isInteger(n)) return null;
  return n;
}

function formatNumber(n: number | null): string {
  return n === null ? '' : String(n).replace('-', MINUS);
}

export interface NumberInputProps {
  id?: string;
  value: number | null;
  /** Called with the parsed number, or `null` when the field is emptied (if `allowEmpty`). */
  onCommit: (n: number | null) => void;
  integer?: boolean;
  allowEmpty?: boolean;
  disabled?: boolean;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  error?: boolean;
  'aria-label'?: string;
  style?: CSSProperties;
}

/**
 * Controlled number field over the kit `Input`. Keeps the raw text so that a transient state
 * (« − », « 12, ») does not snap back to 0; commits only parseable values. Digits in mono.
 */
export function NumberInput({
  value,
  onCommit,
  integer = false,
  allowEmpty = false,
  disabled,
  placeholder,
  size,
  error,
  id,
  style,
  ...rest
}: NumberInputProps) {
  const [text, setText] = useState(() => formatNumber(value));
  const textRef = useRef(text);
  textRef.current = text;

  // External change (type switch, draft restore): realign the text unless it already means `value`.
  useEffect(() => {
    if (parseNumber(textRef.current, integer) !== value) setText(formatNumber(value));
  }, [value, integer]);

  return (
    <Input
      id={id}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      size={size}
      error={error}
      aria-label={rest['aria-label']}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = parseNumber(t, integer);
        if (n !== null) onCommit(n);
        else if (t.trim() === '' && allowEmpty) onCommit(null);
      }}
      onBlur={() => setText(formatNumber(value))}
      style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, ...style }}
    />
  );
}

/** Overline — the only uppercase allowed (skill), micro-context above a block. */
export function Overline({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <p
      style={{
        font: 'var(--text-overline)',
        letterSpacing: 'var(--tracking-wide)',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        ...style,
      }}
    >
      {children}
    </p>
  );
}

/** Inline error under a block that is not a single `Field` (propositions, numeric row). */
export function BlockError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" style={{ font: 'var(--text-body-sm)', color: 'var(--state-danger)' }}>
      {children}
    </p>
  );
}
