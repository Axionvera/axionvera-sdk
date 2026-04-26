import React from 'react';
import type { TxStep } from './useVault';

const STEPS: { key: TxStep; label: string }[] = [
  { key: 'signed', label: 'Signed' },
  { key: 'submitted', label: 'Submitted to Network' },
  { key: 'confirmed', label: 'Confirmed in Ledger' },
];

const ORDER: TxStep[] = ['idle', 'signed', 'submitted', 'confirmed'];

type Props = {
  step: TxStep;
  /** Override labels for each step */
  labels?: Partial<Record<TxStep, string>>;
};

/**
 * Visual stepper that reflects the Soroban transaction lifecycle.
 *
 * @example
 * ```tsx
 * <TransactionStepper step={step} />
 * ```
 */
export function TransactionStepper({ step, labels }: Props): React.ReactElement | null {
  if (step === 'idle') return null;

  const currentIndex = ORDER.indexOf(step);

  return (
    <ol
      role="list"
      aria-label="Transaction progress"
      style={{ display: 'flex', gap: '0.5rem', listStyle: 'none', padding: 0, margin: 0 }}
    >
      {STEPS.map(({ key, label }, i) => {
        const stepIndex = i + 1; // idle=0, signed=1, submitted=2, confirmed=3
        const isDone = currentIndex > stepIndex;
        const isActive = currentIndex === stepIndex;
        const displayLabel = labels?.[key] ?? label;

        return (
          <li
            key={key}
            aria-current={isActive ? 'step' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontWeight: isActive ? 'bold' : 'normal',
              opacity: stepIndex > currentIndex ? 0.4 : 1,
            }}
          >
            <span aria-hidden="true">{isDone ? '✓' : isActive ? '⏳' : '○'}</span>
            <span>{displayLabel}</span>
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" style={{ margin: '0 0.25rem' }}>
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
