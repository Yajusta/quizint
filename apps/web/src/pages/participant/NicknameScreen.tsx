// /j/:code before registration (plan § 5.1 « Pseudo ») — light ground, same template as the code
// page: overline = quiz title, room count in mono, one field, one 64 px action.

import { useState, type FormEvent, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '@quiz/shared';

import { Button, Field, Icon, Input } from '../../design-system/index.ts';
import { ValueSkeleton } from '../../components/Skeletons.tsx';
import { NBSP } from '../../lib/format.ts';
import { LightShell, Num, Overline } from './shells.tsx';

export interface NicknameScreenProps {
  quizTitle: string | null;
  participantCount: number | null;
  /** Error code from the join ack (`NICKNAME_TAKEN`…), or null. */
  errorCode: string | null;
  joining: boolean;
  onJoin: (nickname: string) => void;
}

export function NicknameScreen({
  quizTitle,
  participantCount,
  errorCode,
  joining,
  onJoin,
}: NicknameScreenProps) {
  const { t } = useTranslation('participant');
  const [nickname, setNickname] = useState('');
  const [localError, setLocalError] = useState<ReactNode>(null);
  const error = localError ?? (errorCode ? <JoinErrorMessage code={errorCode} /> : null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = nickname.trim();
    if (clean.length < NICKNAME_MIN_LENGTH) {
      setLocalError(
        <Trans
          i18nKey="nickname.minLength"
          ns="participant"
          values={{ count: NICKNAME_MIN_LENGTH }}
          components={{ num: <Num /> }}
        />,
      );
      return;
    }
    setLocalError(null);
    onJoin(clean);
  };

  return (
    <LightShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {quizTitle ? <Overline>{quizTitle}</Overline> : <ValueSkeleton width={140} height={13} />}
          <h1>{t('nickname.title')}</h1>
          {participantCount === null ? (
            <ValueSkeleton width={220} height={20} />
          ) : (
            <p
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                font: 'var(--text-body)',
                color: 'var(--text-secondary)',
              }}
            >
              <Icon name="users" size="sm" />
              <RoomCount count={participantCount} />
            </p>
          )}
        </div>

        <form
          onSubmit={submit}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}
        >
          <Field
            label={t('nickname.fieldLabel')}
            htmlFor="nickname"
            hint={t('nickname.fieldHint')}
            error={error ? <span role="alert">{error}</span> : undefined}
          >
            <Input
              id="nickname"
              size="lg"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value.slice(0, NICKNAME_MAX_LENGTH));
                setLocalError(null);
              }}
              placeholder={t('nickname.placeholder')}
              autoComplete="off"
              autoFocus={window.matchMedia('(pointer: fine)').matches}
              error={Boolean(error)}
              aria-invalid={Boolean(error)}
            />
          </Field>
          <Button type="submit" size="xl" block loading={joining} iconRight="arrow-right">
            {t('nickname.action')}
          </Button>
        </form>
      </div>
    </LightShell>
  );
}

function RoomCount({ count }: { count: number }) {
  const { t } = useTranslation('participant');
  // Zero reads as a whole sentence; from one on, the number leads and the dictionary only gives
  // the words that follow it, so the digits stay in `--font-mono`.
  if (count === 0) return <span>{t('nickname.roomCount', { count })}</span>;
  return (
    <span>
      <Num>{count}</Num>
      {NBSP}
      {t('nickname.roomCount', { count })}
    </span>
  );
}

/** Join ack error code → message. Unknown codes fall back to the generic one. */
export function JoinErrorMessage({ code }: { code: string }): ReactNode {
  const { t } = useTranslation('participant');
  switch (code) {
    case 'NICKNAME_TAKEN':
      return t('nickname.errorTaken');
    case 'NICKNAME_INVALID':
      return (
        <Trans
          i18nKey="nickname.errorInvalid"
          ns="participant"
          values={{ min: NICKNAME_MIN_LENGTH, max: NICKNAME_MAX_LENGTH }}
          components={{ num: <Num /> }}
        />
      );
    case 'SESSION_NOT_FOUND':
      return t('nickname.errorNotFound');
    case 'SESSION_CLOSED_TO_JOIN':
      return t('nickname.errorClosed');
    case 'SESSION_FULL':
      return t('nickname.errorFull');
    default:
      return t('nickname.errorGeneric');
  }
}
