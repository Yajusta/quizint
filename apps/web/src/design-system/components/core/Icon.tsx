// Patch local du kit (§ 4.2) : le composant du skill charge Lucide depuis unpkg en masque CSS.
// Aucun CDN n'est autorisé ici — on garde ce wrapper lucide-react à imports nommés (tree-shaking).
// Tailles alignées sur le skill : sm/md/lg/xl → 14/18/22/28.

import { createElement } from 'react';
import type * as React from 'react';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronRight,
  CircleQuestionMark,
  Copy,
  Download,
  Eye,
  GripVertical,
  Library,
  ListPlus,
  Lock,
  LogOut,
  Inbox,
  Maximize,
  Maximize2,
  Minimize,
  Minus,
  MonitorSmartphone,
  Pencil,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  RotateCcwClock,
  Search,
  Settings,
  Square,
  Timer as TimerIcon,
  Trash,
  Trophy,
  Upload,
  User,
  UserX,
  Users,
  WifiOff,
  X,
} from 'lucide-react';

const SIZES = { sm: 14, md: 18, lg: 22, xl: 28 } as const;

const REGISTRY: Record<string, unknown> = {
  archive: Archive,
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'bar-chart-3': ChartColumn,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'circle-help': CircleQuestionMark,
  copy: Copy,
  download: Download,
  eye: Eye,
  'grip-vertical': GripVertical,
  history: RotateCcwClock,
  inbox: Inbox,
  library: Library,
  'list-plus': ListPlus,
  lock: Lock,
  'log-out': LogOut,
  maximize: Maximize,
  'maximize-2': Maximize2,
  minimize: Minimize,
  minus: Minus,
  'monitor-smartphone': MonitorSmartphone,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  'qr-code': QrCode,
  'rotate-ccw': RotateCcw,
  search: Search,
  settings: Settings,
  square: Square,
  timer: TimerIcon,
  'trash-2': Trash,
  trophy: Trophy,
  upload: Upload,
  user: User,
  'user-x': UserX,
  users: Users,
  'wifi-off': WifiOff,
  x: X,
};

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Slug Lucide, p. ex. « arrow-right ». */
  name: string;
  /** sm/md/lg/xl → 14/18/22/28, ou un nombre de pixels. @default 'md' */
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  /** @default 1.75 (réglage de marque — 2 est trop lourd sur l'encre) */
  strokeWidth?: number;
  color?: string;
  title?: string;
}

/** Wrapper Lucide — les glyphes héritent de currentColor et tiennent sur les deux fonds. */
export function Icon({
  name,
  size = 'md',
  strokeWidth = 1.75,
  color = 'currentColor',
  title,
  style,
  className = '',
  ...rest
}: IconProps) {
  const px = typeof size === 'number' ? size : (SIZES[size] ?? SIZES.md);
  const Comp = REGISTRY[name] as React.ComponentType<Record<string, unknown>> | undefined;

  const base = { width: px, height: px, display: 'block', flex: '0 0 auto', ...style };
  if (!Comp) {
    return createElement('span', {
      className,
      style: {
        ...base,
        borderRadius: 'var(--radius-xs)',
        border: '1px dashed var(--border-subtle)',
        boxSizing: 'border-box',
      },
      title: title || `icon: ${name}`,
      ...rest,
    });
  }
  return createElement(Comp, {
    className,
    size: px,
    strokeWidth,
    color,
    'aria-hidden': title ? undefined : true,
    style: base,
    ...rest,
  });
}
