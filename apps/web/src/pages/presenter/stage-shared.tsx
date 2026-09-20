// Stage building blocks shared by the presenter screens (plan § 5.2). Layout helpers only — every
// visible control comes from the kit. Numbers always render in mono (`Num`), the overline is the
// only uppercase, colours are limited to brand + the reveal.

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';

import { isGradedType, type SnapshotQuestion } from '@quiz/shared';

import {
  Badge,
  Button,
  IconButton,
  ProgressBar,
  StageFrame,
  StageInsetContext,
  type StageKbd,
} from '../../design-system/index.ts';
import { NBSP } from '../../lib/format.ts';
import { useMediaQuery } from '../../lib/useMediaQuery.ts';
import { resolveToken } from '../../lib/useThemeColor.ts';
import { mediaSrc } from '../../lib/media-src.ts';
import { ZoomImage } from '../../features/shared-live/ZoomImage.tsx';
import { Num } from '../participant/shells.tsx';

/** Below 900 px of height (1280 × 800, 1366 × 768) the stage tightens: md tiles, smaller media. */
export const SHORT_STAGE = '(max-height: 899px)';
/** StageFrame switches to 40 px gutters under 1100 px (§ 13.2). */
const COMPACT_MAX = 1099;
/** Under 1440 px the footer is squeezed: status joins the left cell, the toggles become icons. */
const NARROW_MAX = 1439;
/** Under 1700 px the back action shrinks to an icon: with three actions, its label squeezes the status. */
const BACK_LABEL_MAX = 1699;

/**
 * Width breakpoint measured on the room left to the stage: the participants panel docked on the
 * right (`StageInsetContext`) narrows the frame as much as a smaller window would.
 */
function useStageMaxWidth(maxWidth: number): boolean {
  const inset = useContext(StageInsetContext);
  return useMediaQuery(`(max-width: ${maxWidth + inset}px)`);
}

/** Under 1440 px of stage width: status joins the progress cell, secondary actions go icon-only. */
export function useNarrowStage(): boolean {
  return useStageMaxWidth(NARROW_MAX);
}

/** Height left to the main area of a `StageFrame` (100dvh − footer 88 − vertical gutters). */
export function useStageMainHeight(): string {
  const compact = useStageMaxWidth(COMPACT_MAX);
  return compact ? 'calc(100dvh - 88px - 2 * var(--space-9))' : 'calc(100dvh - 88px - 2 * var(--space-11))';
}

/** Stage-wide toggles owned by the page, reached by every screen's footer. */
export interface StageControls {
  panelOpen: boolean;
  togglePanel: () => void;
  fullscreen: boolean;
  toggleFullscreen: () => void;
}

export const StageControlsContext = createContext<StageControls | null>(null);

/**
 * Footer shortcuts (§ 5.2). Espace/→ carries the phase's own verb and stays a plain hint (the
 * primary button does the same); F and P are icon + key buttons doing what the key does (label as
 * tooltip and accessible name). Under 1440 px the Espace hint goes, so the 88 px footer never overflows.
 */
export function useStageKbd(action: string): StageKbd[] {
  const { t } = useTranslation('presenter');
  const narrow = useNarrowStage();
  const controls = useContext(StageControlsContext);
  const toggles: StageKbd[] = [
    {
      key: 'F',
      label: controls?.fullscreen ? t('stage.fullscreenExit') : t('stage.fullscreenEnter'),
      icon: controls?.fullscreen ? 'minimize' : 'maximize',
      onClick: controls?.toggleFullscreen,
      pressed: controls?.fullscreen,
      iconOnly: true,
    },
    {
      key: 'P',
      label: t('stage.participants'),
      icon: 'users',
      onClick: controls?.togglePanel,
      pressed: controls?.panelOpen,
      iconOnly: true,
    },
  ];
  return narrow ? toggles : [{ key: t('stage.spaceKey'), label: action }, ...toggles];
}

/** Secondary « back » action of the footer: a labelled button, an icon under 1700 px. */
export function StageBackButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  const narrow = useStageMaxWidth(BACK_LABEL_MAX);
  return narrow ? (
    <IconButton icon={icon} label={label} variant="inverse" size="lg" onClick={onClick} />
  ) : (
    <Button variant="inverse" size="lg" icon={icon} onClick={onClick}>
      {label}
    </Button>
  );
}

/**
 * QR modules in --brand-900 on a white panel — colours read from the tokens, no literal here.
 * Rendered as an <img> data URI so the SVG scales with its box (lobby, participants panel).
 */
export function useQrSrc(joinUrl: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!joinUrl) return;
    let cancelled = false;
    const dark = resolveToken('--brand-900');
    const light = resolveToken('--white');
    QRCode.toString(joinUrl, { type: 'svg', margin: 0, color: { dark, light } })
      .then((svg) => {
        if (!cancelled) setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);
  return src;
}

/** « ABC DEF » — the session code in two groups of three, read aloud more easily. */
export function groupCode(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)}${NBSP}${code.slice(3)}` : code;
}

/** Overline at stage scale: the kit's 11 px is illegible from the room, 15 px keeps the micro-context role. */
export function StageOverline({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        font: 'var(--text-overline)',
        fontSize: 15,
        letterSpacing: 'var(--tracking-wide)',
        textTransform: 'uppercase',
        color: 'var(--stage-ink-2)',
      }}
    >
      {children}
    </p>
  );
}

/**
 * Footer slots (§ 5.2): progress left, status centre. On narrow stages the status joins the left
 * cell so neither the status nor the action label ever wraps.
 */
export function useFooterSlots(
  progress: ReactNode,
  status: ReactNode,
): { progress: ReactNode; status?: ReactNode } {
  const narrow = useNarrowStage();
  if (!narrow) return { progress, status };
  return {
    progress: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-7)', whiteSpace: 'nowrap' }}>
        {progress}
        <span style={{ color: 'var(--stage-ink-2)' }}>{status}</span>
      </div>
    ),
    status: undefined,
  };
}

/** Footer, left slot: question progress (§ 5.2). */
export function StageProgress({ index, total }: { index: number; total: number }) {
  const { t } = useTranslation('common');
  const narrow = useNarrowStage();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
      <ProgressBar
        tone="inverse"
        value={index + 1}
        max={Math.max(1, total)}
        aria-label={t('question.progressAria', { current: index + 1, total })}
        style={{ width: narrow ? 140 : 200 }}
      />
      <span style={{ font: 'var(--text-body-lg)', color: 'var(--stage-ink-2)', whiteSpace: 'nowrap' }}>
        {t('question.label')}
        {NBSP}
        <Num style={{ color: 'var(--stage-ink)' }}>
          {index + 1} / {total}
        </Num>
      </span>
    </div>
  );
}

/** Neutral badge restyled for the stage (the kit's neutral tone is meant for the light app). */
export function StageBadge({ children, icon }: { children: ReactNode; icon?: string }) {
  return (
    <Badge
      tone="neutral"
      icon={icon}
      style={{
        background: 'var(--stage-control)',
        color: 'var(--stage-ink)',
        borderColor: 'var(--stage-border-strong)',
      }}
    >
      {children}
    </Badge>
  );
}

/** « Question 7 / 12 · QCM · 100 pts · bonus rapidité » */
export function QuestionMeta({
  view,
  index,
  total,
}: {
  view: SnapshotQuestion;
  index: number;
  total: number;
}) {
  const { t } = useTranslation(['presenter', 'common']);
  return (
    <StageOverline>
      <span style={{ display: 'inline-flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span>{t('common:question.label')}</span>
        <Num style={{ fontWeight: 700 }}>
          {index + 1} / {total}
        </Num>
        <span aria-hidden>·</span>
        <span>{t(`common:questionType.${view.type}`)}</span>
        {isGradedType(view.type) && (
          <>
            <span aria-hidden>·</span>
            <span>
              <Num style={{ fontWeight: 700 }}>{view.pointsCorrect}</Num>
              {NBSP}
              {t('common:units.pts')}
            </span>
          </>
        )}
        {view.speedBonusMax > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>{t('question.speedBonus')}</span>
          </>
        )}
      </span>
    </StageOverline>
  );
}

/**
 * Prompt sizing (§ 3, § 5.2): hierarchy by size — `clamp(40px, 4vw, 64px)` on a 22 ch measure for a
 * short wording; a long one (> 70 characters) steps down to `clamp(40px, 2.8vw, 48px)` on 40 ch so it
 * stays within four lines and never squeezes the grid. 40 px is the floor everywhere.
 */
export function promptStyle(prompt: string): CSSProperties {
  const long = prompt.length > 70;
  return {
    font: long
      ? '600 clamp(40px, 2.8vw, 48px)/1.12 var(--font-display)'
      : '600 clamp(40px, 4vw, 64px)/1.06 var(--font-display)',
    letterSpacing: 'var(--tracking-tight)',
    maxWidth: long ? '40ch' : '22ch',
    textWrap: 'pretty',
    overflowWrap: 'anywhere',
  };
}

export interface QuestionHeadProps {
  view: SnapshotQuestion;
  index: number;
  total: number;
  /** Right-hand slot (Timer while the question is open). */
  aside?: ReactNode;
  /** Tighter media (short viewports, closed screen). */
  compact?: boolean;
  /** The open question lays its image out itself, between the head and the answers. */
  hideImage?: boolean;
}

/** Head of the question screens: overline, prompt, media to the right, optional timer. */
export function QuestionHead({
  view,
  index,
  total,
  aside,
  compact = false,
  hideImage = false,
}: QuestionHeadProps) {
  const image = !hideImage && view.media && view.media.kind === 'IMAGE' ? view.media : null;
  const audio = view.media && view.media.kind === 'AUDIO' ? view.media : null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-10)', minWidth: 0 }}>
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <QuestionMeta view={view} index={index} total={total} />
        <h1 style={promptStyle(view.prompt)}>{view.prompt}</h1>
        {audio && (
          <audio controls src={mediaSrc(audio.url)} preload="none" style={{ width: '100%', maxWidth: 560 }} />
        )}
      </div>
      {image && (
        <ZoomImage
          src={image.url}
          style={{ flex: '0 1 auto', maxWidth: '34%' }}
          imgStyle={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: compact ? '26vh' : 'min(40vh, 360px)',
            objectFit: 'contain',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--stage-panel)',
          }}
        />
      )}
      {aside && <div style={{ flex: '0 0 auto', marginLeft: image ? undefined : 'auto' }}>{aside}</div>}
    </div>
  );
}

/** Transitional stage screen (result or ranking not received yet): pulsing dot, one line. */
export function StageWaiting({ title }: { title: string }) {
  return (
    <StageFrame>
      <div
        aria-busy="true"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)' }}
      >
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 'var(--radius-full)',
            background: 'var(--brand-300)',
            animation: 'qiPulse 1.6s ease-in-out infinite',
          }}
        />
        <h2 style={{ color: 'var(--stage-ink-2)' }}>{title}</h2>
      </div>
    </StageFrame>
  );
}

/** Head shown when the wording is unknown (reconnection during QUESTION_CLOSED: the snapshot has no question). */
export function ResultHead({ index, total }: { index: number; total: number }) {
  const { t } = useTranslation(['presenter', 'common']);
  const title = t('question.resultsTitle');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <StageOverline>
        {t('common:question.label')}
        {NBSP}
        <Num style={{ fontWeight: 700 }}>
          {index + 1} / {total}
        </Num>
      </StageOverline>
      <h1 style={promptStyle(title)}>{title}</h1>
    </div>
  );
}
