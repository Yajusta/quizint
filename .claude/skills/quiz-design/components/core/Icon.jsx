import React from 'react';

const SIZES = { sm: 14, md: 18, lg: 22, xl: 28 };

/* Lucide (static SVG, CDN) rendered as a masked box so it inherits currentColor. */
export function Icon({ name, size = 'md', color = 'currentColor', strokeWidth, style, ...rest }) {
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md;
  const url = `https://unpkg.com/lucide-static@0.441.0/icons/${name}.svg`;
  return (
    <span
      aria-hidden="true"
      {...rest}
      style={{
        display: 'inline-block', width: px, height: px, flex: '0 0 auto',
        background: color,
        WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`,
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center', maskPosition: 'center',
        WebkitMaskSize: 'contain', maskSize: 'contain',
        ...style,
      }}
    />
  );
}
