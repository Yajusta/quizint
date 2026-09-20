// Question image that opens full screen on click and closes on a second click (or Escape). Shared by
// the stage, the phone and the editor preview. An in-page layer rather than the Fullscreen API: iOS
// Safari only grants that one to videos. Rendered into <body> so no ancestor transform (the scaled
// editor preview) or overflow can clip it.
//
// A small badge sits in the top-right corner of the picture itself (diagonal arrows inline, a cross
// full screen). The button hugs the displayed picture, never its letterboxed box: in `fill` mode the
// picture is sized with container units against the room its parent leaves.

import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Icon } from '../../design-system/index.ts';
import { mediaSrc } from '../../lib/media-src.ts';

const RESET: CSSProperties = {
  display: 'block',
  padding: 0,
  margin: 0,
  border: 0,
  background: 'none',
  font: 'inherit',
  color: 'inherit',
  lineHeight: 0,
};

/** Container filling its positioned parent; its children size against it with cqw / cqh. */
const FILL_BOX: CSSProperties = {
  position: 'absolute',
  inset: 0,
  containerType: 'size',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/**
 * Largest size keeping the proportions inside the container (a small picture is enlarged). Until the
 * picture has loaded its ratio is unknown: it is only capped meanwhile.
 */
function fitStyle(ratio: number | null): CSSProperties {
  return ratio
    ? { display: 'block', width: `min(100cqw, calc(100cqh * ${ratio}))`, height: 'auto' }
    : { display: 'block', maxWidth: '100cqw', maxHeight: '100cqh' };
}

function CornerBadge({ icon }: { icon: string }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: 'var(--space-3)',
        right: 'var(--space-3)',
        display: 'grid',
        placeItems: 'center',
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-full)',
        background: 'var(--scrim)',
        color: 'var(--white)',
        pointerEvents: 'none',
      }}
    >
      <Icon name={icon} size="md" />
    </span>
  );
}

export interface ZoomImageProps {
  src: string;
  /** Fill the positioned parent (the picture takes all its room, proportions kept). */
  fill?: boolean;
  /** Box of the inline button (size, flex) — outside `fill` mode. */
  style?: CSSProperties;
  /** Style of the inline image — outside `fill` mode. */
  imgStyle?: CSSProperties;
}

export function ZoomImage({ src, fill = false, style, imgStyle }: ZoomImageProps) {
  const { t } = useTranslation('common');
  const [zoomed, setZoomed] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const layer = useRef<HTMLButtonElement>(null);
  const url = mediaSrc(src);

  useEffect(() => {
    if (!zoomed) return undefined;
    layer.current?.focus();
    // Capture phase: Escape closes the image only, not the stage's participants panel as well.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setZoomed(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [zoomed]);

  const close = () => {
    setZoomed(false);
    trigger.current?.focus();
  };

  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) setRatio(naturalWidth / naturalHeight);
  };

  const inline = (
    <button
      ref={trigger}
      type="button"
      aria-label={t('image.zoomIn')}
      onClick={() => setZoomed(true)}
      style={{ ...RESET, position: 'relative', cursor: 'zoom-in', ...(fill ? {} : style) }}
    >
      <img src={url} alt="" onLoad={onLoad} style={fill ? fitStyle(ratio) : imgStyle} />
      <CornerBadge icon="maximize-2" />
    </button>
  );

  return (
    <>
      {fill ? <div style={FILL_BOX}>{inline}</div> : inline}
      {zoomed &&
        createPortal(
          <button
            ref={layer}
            type="button"
            aria-label={t('image.zoomOut')}
            onClick={close}
            style={{
              ...RESET,
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              width: '100%',
              height: '100%',
              background: 'var(--stage-bg)',
              cursor: 'zoom-out',
              animation: 'qiFade var(--dur-base) var(--ease-out) both',
            }}
          >
            <span style={{ ...FILL_BOX, inset: 'var(--space-5)' }}>
              <span style={{ position: 'relative', display: 'block' }}>
                <img src={url} alt="" onLoad={onLoad} style={fitStyle(ratio)} />
                <CornerBadge icon="x" />
              </span>
            </span>
          </button>,
          document.body,
        )}
    </>
  );
}
