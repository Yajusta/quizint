// Two fixed grounds (plan § 5.1): the light app before registration, the stage once the participant
// is in the room. `<meta name="theme-color">` and the canvas behind overscroll follow the active
// ground so the phone's chrome never flashes against the page. Values come from the CSS tokens
// (resolved at runtime) — no colour literal lives here.

import { useEffect } from 'react';

export type PageTone = 'light' | 'stage';

const TOKEN: Record<PageTone, string> = { light: '--surface-page', stage: '--stage-bg' };

/** Resolves a custom property to its final value, following `var(--x)` aliases if the engine left them. */
export function resolveToken(name: string): string {
  const styles = getComputedStyle(document.documentElement);
  let value = styles.getPropertyValue(name).trim();
  for (let i = 0; i < 5; i += 1) {
    const alias = /^var\((--[\w-]+)\)$/.exec(value);
    if (!alias) break;
    value = styles.getPropertyValue(alias[1] as string).trim();
  }
  return value;
}

export function useThemeColor(tone: PageTone): void {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const root = document.documentElement;
    const previousMeta = meta?.content ?? null;
    const previousCanvas = root.style.backgroundColor;
    const token = TOKEN[tone];
    const resolved = resolveToken(token);
    if (meta && resolved) meta.content = resolved;
    root.style.backgroundColor = `var(${token})`;
    return () => {
      if (meta && previousMeta !== null) meta.content = previousMeta;
      root.style.backgroundColor = previousCanvas;
    };
  }, [tone]);
}
