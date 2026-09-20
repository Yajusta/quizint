/* @ds-bundle: {"format":4,"namespace":"QuizDesignSystem_2d5b8b","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"ProgressBar","sourcePath":"components/feedback/ProgressBar.jsx"},{"name":"Timer","sourcePath":"components/feedback/Timer.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"SideNav","sourcePath":"components/navigation/SideNav.jsx"},{"name":"Stepper","sourcePath":"components/navigation/Stepper.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"AnswerOption","sourcePath":"components/quiz/AnswerOption.jsx"},{"name":"JoinCode","sourcePath":"components/quiz/JoinCode.jsx"},{"name":"LeaderboardRow","sourcePath":"components/quiz/LeaderboardRow.jsx"},{"name":"PlayerChip","sourcePath":"components/quiz/PlayerChip.jsx"},{"name":"QuestionDisplay","sourcePath":"components/quiz/QuestionDisplay.jsx"},{"name":"StatTile","sourcePath":"components/quiz/StatTile.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"2c605ca73d30","components/core/Button.jsx":"5acee47525af","components/core/Card.jsx":"b64f2031dd7f","components/core/Icon.jsx":"c83127d23d22","components/core/IconButton.jsx":"34116cf01cff","components/core/Tag.jsx":"d48d518cced4","components/feedback/Dialog.jsx":"49b82e35b235","components/feedback/EmptyState.jsx":"537ee3af898b","components/feedback/ProgressBar.jsx":"e194dccb7b74","components/feedback/Timer.jsx":"73a677d4b097","components/forms/Checkbox.jsx":"8c4e3962b163","components/forms/Field.jsx":"d52e5bcf4ee0","components/forms/Input.jsx":"827def456f2a","components/forms/Radio.jsx":"7391ba2bcbb1","components/forms/Select.jsx":"f8ff1eb4cb8b","components/forms/Switch.jsx":"d17dbf210bb5","components/forms/Textarea.jsx":"72123be579ba","components/navigation/SideNav.jsx":"f5c7ab5f03de","components/navigation/Stepper.jsx":"7f1095cbfd20","components/navigation/Tabs.jsx":"21003d41ae59","components/quiz/AnswerOption.jsx":"24f75d15edb4","components/quiz/JoinCode.jsx":"07c272b651e1","components/quiz/LeaderboardRow.jsx":"d7bbfef31f7b","components/quiz/PlayerChip.jsx":"fc4b56dcd203","components/quiz/QuestionDisplay.jsx":"155e420237cb","components/quiz/StatTile.jsx":"0ad3196758e0","ui_kits/participant/Screens.jsx":"061f3bd46ab4","ui_kits/presenter/EditorScreen.jsx":"2a651c1a6714","ui_kits/presenter/LibraryScreen.jsx":"b3b419bffdbd","ui_kits/presenter/StageScreens.jsx":"75cc046c0b05"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.QuizDesignSystem_2d5b8b = window.QuizDesignSystem_2d5b8b || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  padding = 'md',
  interactive,
  selected,
  elevation = 1,
  header,
  footer,
  children,
  style,
  ...rest
}) {
  const pad = {
    none: 0,
    sm: 'var(--space-5)',
    md: 'var(--space-7)',
    lg: 'var(--space-8)'
  }[padding] ?? padding;
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("section", _extends({
    onMouseEnter: () => interactive && setHover(true),
    onMouseLeave: () => interactive && setHover(false)
  }, rest, {
    style: {
      background: 'var(--surface-card)',
      border: `1px solid ${selected ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
      borderRadius: 'var(--radius-lg)',
      boxShadow: selected ? '0 0 0 3px var(--brand-50)' : hover ? 'var(--shadow-2)' : elevation === 0 ? 'none' : 'var(--shadow-1)',
      transition: 'box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)',
      cursor: interactive ? 'pointer' : undefined,
      overflow: 'hidden',
      ...style
    }
  }), header && /*#__PURE__*/React.createElement("header", {
    style: {
      padding: '14px var(--space-7)',
      borderBottom: '1px solid var(--border-subtle)',
      font: 'var(--text-h3)'
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: pad
    }
  }, children), footer && /*#__PURE__*/React.createElement("footer", {
    style: {
      padding: '14px var(--space-7)',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--gray-50)'
    }
  }, footer));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: 14,
  md: 18,
  lg: 22,
  xl: 28
};

/* Lucide (static SVG, CDN) rendered as a masked box so it inherits currentColor. */
function Icon({
  name,
  size = 'md',
  color = 'currentColor',
  strokeWidth,
  style,
  ...rest
}) {
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md;
  const url = `https://unpkg.com/lucide-static@0.441.0/icons/${name}.svg`;
  return /*#__PURE__*/React.createElement("span", _extends({
    "aria-hidden": "true"
  }, rest, {
    style: {
      display: 'inline-block',
      width: px,
      height: px,
      flex: '0 0 auto',
      background: color,
      WebkitMaskImage: `url(${url})`,
      maskImage: `url(${url})`,
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      ...style
    }
  }));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const badgeTones = {
  neutral: {
    bg: 'var(--gray-100)',
    fg: 'var(--gray-700)',
    bd: 'var(--gray-200)'
  },
  brand: {
    bg: 'var(--brand-50)',
    fg: 'var(--brand-700)',
    bd: 'var(--brand-100)'
  },
  success: {
    bg: 'var(--state-success-soft)',
    fg: 'var(--state-success)',
    bd: 'var(--state-success-soft)'
  },
  warning: {
    bg: 'var(--state-warning-soft)',
    fg: 'var(--state-warning)',
    bd: 'var(--state-warning-soft)'
  },
  danger: {
    bg: 'var(--state-danger-soft)',
    fg: 'var(--state-danger)',
    bd: 'var(--state-danger-soft)'
  },
  live: {
    bg: 'var(--state-danger)',
    fg: 'var(--white)',
    bd: 'var(--state-danger)'
  }
};
function Badge({
  tone = 'neutral',
  icon,
  dot,
  children,
  style,
  ...rest
}) {
  const t = badgeTones[tone] || badgeTones.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({}, rest, {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 24,
      padding: '0 10px',
      background: t.bg,
      color: t.fg,
      border: `1px solid ${t.bd}`,
      borderRadius: 'var(--radius-full)',
      font: 'var(--text-label)',
      whiteSpace: 'nowrap',
      ...style
    }
  }), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'currentColor'
    }
  }), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 12
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const buttonSizes = {
  sm: {
    height: 'var(--control-h-sm)',
    padding: '0 12px',
    font: 'var(--text-label)',
    radius: 'var(--radius-sm)',
    gap: 6,
    icon: 'sm'
  },
  md: {
    height: 'var(--control-h-md)',
    padding: '0 16px',
    font: 'var(--text-button)',
    radius: 'var(--radius-md)',
    gap: 8,
    icon: 'md'
  },
  lg: {
    height: 'var(--control-h-lg)',
    padding: '0 24px',
    font: '600 17px/1 var(--font-sans)',
    radius: 'var(--radius-md)',
    gap: 10,
    icon: 'md'
  }
};
const buttonVariants = {
  primary: {
    background: 'var(--surface-brand)',
    color: 'var(--text-inverse)',
    border: '1px solid var(--brand-700)',
    hover: 'var(--brand-600)'
  },
  secondary: {
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
    hover: 'var(--gray-50)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
    hover: 'var(--gray-100)'
  },
  danger: {
    background: 'var(--state-danger)',
    color: 'var(--text-inverse)',
    border: '1px solid var(--state-danger)',
    hover: '#A83126'
  },
  inverse: {
    background: 'rgba(255,255,255,.14)',
    color: 'var(--stage-ink)',
    border: '1px solid rgba(255,255,255,.28)',
    hover: 'rgba(255,255,255,.22)'
  }
};
function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  block,
  disabled,
  children,
  style,
  ...rest
}) {
  const s = buttonSizes[size] || buttonSizes.md;
  const v = buttonVariants[variant] || buttonVariants.primary;
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false)
  }, rest, {
    style: {
      display: block ? 'flex' : 'inline-flex',
      width: block ? '100%' : undefined,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.gap,
      height: s.height,
      padding: s.padding,
      font: s.font,
      letterSpacing: '-0.005em',
      borderRadius: s.radius,
      border: v.border,
      background: disabled ? 'var(--gray-100)' : hover ? v.hover : v.background,
      color: disabled ? 'var(--text-muted)' : v.color,
      borderColor: disabled ? 'var(--border-subtle)' : undefined,
      boxShadow: press ? 'var(--shadow-inset-press)' : variant === 'ghost' || variant === 'inverse' ? 'none' : 'var(--shadow-1)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
      transform: press && !disabled ? 'translateY(1px)' : 'none',
      ...style
    }
  }), icon && (typeof icon === 'string' ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.icon
  }) : icon), children, iconRight && (typeof iconRight === 'string' ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: s.icon
  }) : iconRight));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const iconButtonSizes = {
  sm: 32,
  md: 40,
  lg: 52
};
function IconButton({
  icon,
  label,
  variant = 'secondary',
  size = 'md',
  disabled,
  style,
  ...rest
}) {
  const px = iconButtonSizes[size] || iconButtonSizes.md;
  const [hover, setHover] = React.useState(false);
  const tone = {
    secondary: {
      bg: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      color: 'var(--text-secondary)',
      hoverBg: 'var(--gray-50)'
    },
    ghost: {
      bg: 'transparent',
      border: '1px solid transparent',
      color: 'var(--text-secondary)',
      hoverBg: 'var(--gray-100)'
    },
    primary: {
      bg: 'var(--surface-brand)',
      border: '1px solid var(--brand-700)',
      color: 'var(--text-inverse)',
      hoverBg: 'var(--brand-600)'
    },
    inverse: {
      bg: 'rgba(255,255,255,.14)',
      border: '1px solid rgba(255,255,255,.28)',
      color: 'var(--stage-ink)',
      hoverBg: 'rgba(255,255,255,.24)'
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, rest, {
    style: {
      width: px,
      height: px,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-md)',
      border: tone.border,
      background: disabled ? 'var(--gray-100)' : hover ? tone.hoverBg : tone.bg,
      color: disabled ? 'var(--text-muted)' : tone.color,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background var(--dur-fast) var(--ease-out)',
      ...style
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'sm' ? 'sm' : 'md'
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tag({
  children,
  onRemove,
  selected,
  onClick,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({}, rest, {
    onClick: onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 28,
      padding: onRemove ? '0 6px 0 10px' : '0 10px',
      borderRadius: 'var(--radius-sm)',
      background: selected ? 'var(--brand-50)' : 'var(--surface-card)',
      border: `1px solid ${selected ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
      color: selected ? 'var(--text-brand)' : 'var(--text-secondary)',
      font: 'var(--text-body-sm)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background var(--dur-fast) var(--ease-out)',
      ...style
    }
  }), children, onRemove && /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Retirer",
    onClick: e => {
      e.stopPropagation();
      onRemove(e);
    },
    style: {
      display: 'inline-flex',
      border: 0,
      background: 'transparent',
      padding: 2,
      cursor: 'pointer',
      color: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 12
  })));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open = true,
  title,
  description,
  footer,
  onClose,
  width = 480,
  children,
  style
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--overlay-scrim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-8)',
      zIndex: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    style: {
      width,
      maxWidth: '100%',
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-3)',
      overflow: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-5)',
      padding: 'var(--space-7) var(--space-7) var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--text-h2)',
      letterSpacing: 'var(--tracking-tight)'
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body)',
      color: 'var(--text-secondary)',
      marginTop: 6
    }
  }, description)), onClose && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    label: "Fermer",
    variant: "ghost",
    size: "sm",
    onClick: onClose
  })), children && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--space-7) var(--space-7)'
    }
  }, children), footer && /*#__PURE__*/React.createElement("footer", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 'var(--space-4)',
      padding: 'var(--space-5) var(--space-7)',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--gray-50)'
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-10) var(--space-7)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 'var(--radius-full)',
      background: 'var(--surface-brand-soft)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-brand)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: "lg"
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--text-h3)'
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body)',
      color: 'var(--text-secondary)',
      maxWidth: 380
    }
  }, description), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-2)'
    }
  }, action));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ProgressBar.jsx
try { (() => {
function ProgressBar({
  value = 0,
  max = 100,
  tone = 'brand',
  size = 'md',
  label,
  style
}) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  const h = size === 'sm' ? 4 : size === 'lg' ? 12 : 8;
  const fill = {
    brand: 'var(--surface-brand)',
    success: 'var(--state-success)',
    warning: 'var(--state-warning)',
    danger: 'var(--state-danger)',
    inverse: 'var(--brand-300)'
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      font: 'var(--text-label)',
      color: 'var(--text-secondary)',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-numeric)',
      fontSize: 13
    }
  }, Math.round(pct), "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: h,
      borderRadius: 'var(--radius-full)',
      background: tone === 'inverse' ? 'rgba(255,255,255,.18)' : 'var(--gray-200)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: pct + '%',
      height: '100%',
      background: fill,
      borderRadius: 'var(--radius-full)',
      transition: 'width var(--dur-slow) var(--ease-out)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Timer.jsx
try { (() => {
function Timer({
  seconds = 20,
  total = 20,
  size = 'md',
  tone = 'auto',
  style
}) {
  const px = size === 'lg' ? 148 : size === 'sm' ? 56 : 96;
  const stroke = size === 'lg' ? 10 : size === 'sm' ? 5 : 7;
  const r = (px - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, seconds / total));
  const color = tone === 'auto' ? frac > 0.5 ? 'var(--state-success)' : frac > 0.2 ? 'var(--state-warning)' : 'var(--state-danger)' : tone === 'brand' ? 'var(--brand-500)' : 'var(--stage-ink)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: px,
      height: px,
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: px,
    height: px,
    style: {
      transform: 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: px / 2,
    cy: px / 2,
    r: r,
    fill: "none",
    stroke: "var(--gray-200)",
    strokeWidth: stroke
  }), /*#__PURE__*/React.createElement("circle", {
    cx: px / 2,
    cy: px / 2,
    r: r,
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c * (1 - frac),
    style: {
      transition: 'stroke-dashoffset 1s linear, stroke var(--dur-slow) var(--ease-out)'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: 'var(--text-numeric)',
      fontSize: size === 'lg' ? 44 : size === 'sm' ? 16 : 28,
      color: 'inherit'
    }
  }, seconds));
}
Object.assign(__ds_scope, { Timer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Timer.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: description ? 'flex-start' : 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.55 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked, e),
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-xs)',
      marginTop: description ? 2 : 0,
      background: checked ? 'var(--surface-brand)' : 'var(--surface-card)',
      border: '1px solid ' + (checked ? 'var(--brand-700)' : 'var(--border-default)'),
      color: 'var(--white)',
      transition: 'background var(--dur-fast) var(--ease-out)'
    }
  }, checked && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 13
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body)',
      display: 'block'
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body-sm)',
      color: 'var(--text-muted)'
    }
  }, description)));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: htmlFor,
    style: {
      font: 'var(--text-label)',
      color: 'var(--text-primary)',
      display: 'flex',
      gap: 4
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--state-danger)'
    }
  }, "*")), children, (error || hint) && /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body-sm)',
      color: error ? 'var(--state-danger)' : 'var(--text-muted)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  icon,
  error,
  disabled,
  size = 'md',
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const h = size === 'lg' ? 'var(--control-h-lg)' : size === 'sm' ? 'var(--control-h-sm)' : 'var(--control-h-md)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      width: '100%'
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 12,
      display: 'flex',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: "sm"
  })), /*#__PURE__*/React.createElement("input", _extends({
    disabled: disabled,
    onFocus: e => {
      setFocus(true);
      rest.onFocus && rest.onFocus(e);
    },
    onBlur: e => {
      setFocus(false);
      rest.onBlur && rest.onBlur(e);
    }
  }, rest, {
    style: {
      width: '100%',
      height: h,
      padding: icon ? '0 12px 0 34px' : '0 12px',
      font: size === 'lg' ? 'var(--text-body-lg)' : 'var(--text-body)',
      color: 'var(--text-primary)',
      background: disabled ? 'var(--gray-100)' : 'var(--surface-card)',
      border: '1px solid ' + (error ? 'var(--state-danger)' : focus ? 'var(--border-brand)' : 'var(--border-default)'),
      borderRadius: 'var(--radius-md)',
      boxShadow: focus ? 'var(--focus-ring)' : 'none',
      outline: 'none',
      transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
      ...style
    }
  })));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function Radio({
  options = [],
  value,
  onChange,
  name,
  direction = 'column',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    style: {
      display: 'flex',
      flexDirection: direction,
      gap: direction === 'row' ? 'var(--space-6)' : 'var(--space-4)',
      ...style
    }
  }, options.map(o => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? o : o.label;
    const on = value === v;
    return /*#__PURE__*/React.createElement("label", {
      key: v,
      style: {
        display: 'flex',
        gap: 'var(--space-4)',
        alignItems: 'center',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "radio",
      name: name,
      checked: on,
      onChange: () => onChange && onChange(v),
      style: {
        position: 'absolute',
        opacity: 0,
        width: 0,
        height: 0
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 20,
        height: 20,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid ' + (on ? 'var(--brand-700)' : 'var(--border-default)'),
        background: 'var(--surface-card)',
        transition: 'border-color var(--dur-fast) var(--ease-out)'
      }
    }, on && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: 'var(--surface-brand)'
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        font: 'var(--text-body)'
      }
    }, l));
  }));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  options = [],
  error,
  disabled,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false)
  }, rest, {
    style: {
      width: '100%',
      height: 'var(--control-h-md)',
      padding: '0 34px 0 12px',
      font: 'var(--text-body)',
      color: 'var(--text-primary)',
      appearance: 'none',
      background: disabled ? 'var(--gray-100)' : 'var(--surface-card)',
      border: '1px solid ' + (error ? 'var(--state-danger)' : focus ? 'var(--border-brand)' : 'var(--border-default)'),
      borderRadius: 'var(--radius-md)',
      boxShadow: focus ? 'var(--focus-ring)' : 'none',
      outline: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style
    }
  }), options.map(o => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 11,
      pointerEvents: 'none',
      color: 'var(--text-muted)',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: "sm"
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  checked,
  onChange,
  label,
  disabled,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.55 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    role: "switch",
    checked: !!checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 24,
      borderRadius: 'var(--radius-full)',
      padding: 3,
      flex: '0 0 auto',
      background: checked ? 'var(--surface-brand)' : 'var(--gray-300)',
      transition: 'background var(--dur-base) var(--ease-out)',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: 'var(--white)',
      boxShadow: 'var(--shadow-1)',
      transform: checked ? 'translateX(16px)' : 'translateX(0)',
      transition: 'transform var(--dur-base) var(--ease-out)'
    }
  })), label && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body)'
    }
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea({
  error,
  disabled,
  rows = 4,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("textarea", _extends({
    rows: rows,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false)
  }, rest, {
    style: {
      width: '100%',
      padding: '10px 12px',
      font: 'var(--text-body)',
      color: 'var(--text-primary)',
      background: disabled ? 'var(--gray-100)' : 'var(--surface-card)',
      border: '1px solid ' + (error ? 'var(--state-danger)' : focus ? 'var(--border-brand)' : 'var(--border-default)'),
      borderRadius: 'var(--radius-md)',
      boxShadow: focus ? 'var(--focus-ring)' : 'none',
      outline: 'none',
      resize: 'vertical',
      fontFamily: 'var(--font-sans)',
      transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
      ...style
    }
  }));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SideNav.jsx
try { (() => {
function SideNav({
  items = [],
  value,
  onChange,
  header,
  footer,
  width = 232,
  style
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      width,
      flex: '0 0 auto',
      background: 'var(--surface-card)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: 'var(--space-6) var(--space-4)',
      gap: 'var(--space-6)',
      ...style
    }
  }, header && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--space-3)'
    }
  }, header), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      flex: 1
    }
  }, items.map(it => {
    const on = value === it.value;
    return /*#__PURE__*/React.createElement("li", {
      key: it.value
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => onChange && onChange(it.value),
      style: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        height: 36,
        padding: '0 var(--space-4)',
        border: 0,
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        textAlign: 'left',
        background: on ? 'var(--surface-brand-soft)' : 'transparent',
        color: on ? 'var(--text-brand)' : 'var(--text-secondary)',
        font: on ? '500 14px/1 var(--font-sans)' : 'var(--text-body)',
        transition: 'background var(--dur-fast) var(--ease-out)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: "sm"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, it.label), it.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        font: 'var(--text-numeric)',
        fontSize: 12,
        color: 'var(--text-muted)'
      }
    }, it.count)));
  })), footer);
}
Object.assign(__ds_scope, { SideNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SideNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Stepper.jsx
try { (() => {
function Stepper({
  steps = [],
  current = 0,
  style
}) {
  return /*#__PURE__*/React.createElement("ol", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      listStyle: 'none',
      margin: 0,
      padding: 0,
      ...style
    }
  }, steps.map((s, i) => {
    const done = i < current,
      on = i === current;
    return /*#__PURE__*/React.createElement("li", {
      key: s,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 22,
        height: 22,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: done ? 'var(--surface-brand)' : on ? 'var(--surface-card)' : 'var(--gray-100)',
        border: '1px solid ' + (done ? 'var(--brand-700)' : on ? 'var(--border-brand)' : 'var(--border-subtle)'),
        color: done ? 'var(--white)' : on ? 'var(--text-brand)' : 'var(--text-muted)',
        font: 'var(--text-numeric)',
        fontSize: 11
      }
    }, done ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "check",
      size: 12
    }) : i + 1), /*#__PURE__*/React.createElement("span", {
      style: {
        font: on ? '600 14px/1 var(--font-sans)' : 'var(--text-body-sm)',
        color: on ? 'var(--text-primary)' : 'var(--text-muted)'
      }
    }, s)), i < steps.length - 1 && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 28,
        height: 1,
        background: 'var(--border-default)'
      }
    }));
  }));
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  tabs = [],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'flex',
      gap: 'var(--space-6)',
      borderBottom: '1px solid var(--border-subtle)',
      ...style
    }
  }, tabs.map(t => {
    const v = typeof t === 'string' ? t : t.value;
    const l = typeof t === 'string' ? t : t.label;
    const on = value === v;
    return /*#__PURE__*/React.createElement("button", {
      key: v,
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(v),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 0 10px',
        border: 0,
        background: 'transparent',
        font: on ? '600 15px/1 var(--font-sans)' : 'var(--text-body)',
        color: on ? 'var(--text-primary)' : 'var(--text-muted)',
        borderBottom: '2px solid ' + (on ? 'var(--brand-600)' : 'transparent'),
        marginBottom: -1,
        cursor: 'pointer',
        transition: 'color var(--dur-fast) var(--ease-out)'
      }
    }, t.icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: t.icon,
      size: "sm"
    }), l, t.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        font: 'var(--text-numeric)',
        fontSize: 12,
        color: 'var(--text-muted)'
      }
    }, t.count));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/quiz/AnswerOption.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* No per-option colour. Question phase: proposition | selected. Answer phase: correct | wrong | muted. */
const answerStates = {
  default: {
    bg: 'var(--answer-rest-bg, #FFFFFF)',
    border: 'var(--answer-rest-border, #C6CBD1)',
    width: 1,
    tile: 'var(--answer-rest-tile, #EFF1F3)',
    tileInk: 'var(--answer-rest-tile-ink, #3A4048)',
    ink: 'var(--text-primary)'
  },
  selected: {
    bg: 'var(--answer-selected-bg, #F5F1FA)',
    border: 'var(--answer-selected-border, #4A2E6B)',
    width: 2,
    tile: 'var(--brand-700, #4A2E6B)',
    tileInk: 'var(--white, #FFFFFF)',
    ink: 'var(--text-primary)'
  },
  correct: {
    bg: 'var(--answer-correct-bg, #DCF1E7)',
    border: 'var(--answer-correct-border, #1B8A5A)',
    width: 2,
    tile: 'var(--green-600, #1B8A5A)',
    tileInk: 'var(--white, #FFFFFF)',
    ink: 'var(--text-primary)'
  },
  wrong: {
    bg: 'var(--answer-wrong-bg, #F8E3E0)',
    border: 'var(--answer-wrong-border, #BE3A2B)',
    width: 2,
    tile: 'var(--red-600, #BE3A2B)',
    tileInk: 'var(--white, #FFFFFF)',
    ink: 'var(--text-primary)'
  },
  muted: {
    bg: 'var(--gray-50, #F7F8F9)',
    border: 'var(--border-subtle, #E2E5E9)',
    width: 1,
    tile: 'var(--gray-200, #E2E5E9)',
    tileInk: 'var(--text-muted, #6A7280)',
    ink: 'var(--text-secondary)'
  }
};
function AnswerOption({
  letter = 'A',
  children,
  state = 'default',
  size = 'md',
  distribution,
  onClick,
  style,
  ...rest
}) {
  const s = answerStates[state] || answerStates.default;
  const [hover, setHover] = React.useState(false);
  const minH = size === 'lg' ? 96 : size === 'sm' ? 52 : 68;
  const barFill = state === 'correct' ? 'var(--green-600)' : state === 'wrong' ? 'var(--red-600)' : 'var(--gray-400)';
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    disabled: state === 'muted',
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, rest, {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: size === 'lg' ? 'var(--space-6)' : 'var(--space-5)',
      width: '100%',
      minHeight: minH,
      padding: size === 'lg' ? 'var(--space-6)' : 'var(--space-5)',
      background: hover && state === 'default' ? 'var(--gray-50)' : s.bg,
      border: `${s.width}px solid ${s.border}`,
      borderRadius: 'var(--radius-lg)',
      textAlign: 'left',
      color: s.ink,
      cursor: onClick && state !== 'muted' ? 'pointer' : 'default',
      opacity: state === 'muted' ? 0.7 : 1,
      boxShadow: hover && state === 'default' ? 'var(--shadow-2)' : 'var(--shadow-1)',
      transform: hover && state === 'default' ? 'translateY(-1px)' : 'none',
      transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)',
      overflow: 'hidden',
      ...style
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: size === 'lg' ? 48 : 36,
      height: size === 'lg' ? 48 : 36,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-md)',
      background: s.tile,
      color: s.tileInk,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: 'var(--text-numeric)',
      fontSize: size === 'lg' ? 22 : 17,
      transition: 'background var(--dur-base) var(--ease-out)'
    }
  }, letter), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: size === 'lg' ? '500 24px/1.3 var(--font-sans)' : 'var(--text-body-lg)'
    }
  }, children), distribution != null && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: size === 'lg' ? 160 : 96,
      height: 8,
      borderRadius: 'var(--radius-full)',
      background: 'var(--gray-200)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      width: distribution + '%',
      height: '100%',
      background: barFill,
      transition: 'width var(--dur-slow) var(--ease-out)'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-numeric)',
      color: 'var(--text-secondary)',
      minWidth: 46,
      textAlign: 'right'
    }
  }, distribution, "%")), state === 'correct' && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: "lg",
    color: "var(--green-600)"
  }), state === 'wrong' && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: "lg",
    color: "var(--red-600)"
  }));
}
Object.assign(__ds_scope, { AnswerOption });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/quiz/AnswerOption.jsx", error: String((e && e.message) || e) }); }

// components/quiz/JoinCode.jsx
try { (() => {
function JoinCode({
  code = '482 913',
  label = 'Code de session',
  tone = 'dark',
  size = 'lg',
  style
}) {
  const dark = tone === 'dark';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      alignItems: 'flex-start',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-overline)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: dark ? 'rgba(239,234,246,.66)' : 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-numeric-xl)',
      fontSize: size === 'lg' ? 72 : size === 'md' ? 40 : 26,
      letterSpacing: 'var(--tracking-code)',
      color: dark ? 'var(--stage-ink)' : 'var(--text-primary)'
    }
  }, code));
}
Object.assign(__ds_scope, { JoinCode });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/quiz/JoinCode.jsx", error: String((e && e.message) || e) }); }

// components/quiz/LeaderboardRow.jsx
try { (() => {
function LeaderboardRow({
  rank = 1,
  name = 'Participant',
  score = 0,
  delta,
  tone = 'light',
  highlight,
  style
}) {
  const dark = tone === 'dark';
  const medal = rank <= 3;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-5)',
      height: 56,
      padding: '0 var(--space-5)',
      borderRadius: 'var(--radius-md)',
      background: highlight ? dark ? 'rgba(179,159,208,.16)' : 'var(--surface-brand-soft)' : dark ? 'rgba(255,255,255,.06)' : 'var(--surface-card)',
      border: '1px solid ' + (highlight ? dark ? 'rgba(179,159,208,.4)' : 'var(--border-brand)' : dark ? 'rgba(255,255,255,.12)' : 'var(--border-subtle)'),
      color: dark ? 'var(--stage-ink)' : 'var(--text-primary)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 28,
      textAlign: 'center',
      font: 'var(--text-numeric)',
      color: medal ? dark ? 'var(--brand-300)' : 'var(--text-brand)' : dark ? 'rgba(239,234,246,.6)' : 'var(--text-muted)'
    }
  }, rank), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: 'var(--text-body-lg)',
      fontWeight: highlight ? 600 : 400
    }
  }, name), delta != null && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      font: 'var(--text-body-sm)',
      color: delta >= 0 ? 'var(--state-success)' : 'var(--state-danger)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: delta >= 0 ? 'arrow-up' : 'arrow-down',
    size: 12
  }), Math.abs(delta)), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-numeric)',
      minWidth: 64,
      textAlign: 'right'
    }
  }, score.toLocaleString('fr-FR')));
}
Object.assign(__ds_scope, { LeaderboardRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/quiz/LeaderboardRow.jsx", error: String((e && e.message) || e) }); }

// components/quiz/PlayerChip.jsx
try { (() => {
function initials(name) {
  return name.split(/[\s-]+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
const chipTints = ['var(--brand-700)', 'var(--brand-500)', 'var(--gray-600)', 'var(--brand-800)', 'var(--gray-800)'];
function PlayerChip({
  name = 'Participant',
  tone = 'light',
  seed = 0,
  style
}) {
  const dark = tone === 'dark';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      height: 36,
      padding: '0 12px 0 4px',
      borderRadius: 'var(--radius-full)',
      background: dark ? 'rgba(255,255,255,.10)' : 'var(--surface-card)',
      border: '1px solid ' + (dark ? 'rgba(255,255,255,.18)' : 'var(--border-subtle)'),
      color: dark ? 'var(--stage-ink)' : 'var(--text-primary)',
      font: 'var(--text-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: chipTints[seed % chipTints.length],
      color: 'var(--white)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '600 12px/1 var(--font-sans)'
    }
  }, initials(name)), name);
}
Object.assign(__ds_scope, { PlayerChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/quiz/PlayerChip.jsx", error: String((e && e.message) || e) }); }

// components/quiz/QuestionDisplay.jsx
try { (() => {
function QuestionDisplay({
  index,
  total,
  children,
  media,
  tone = 'light',
  meta,
  style
}) {
  const dark = tone === 'dark';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)',
      textAlign: 'center',
      ...style
    }
  }, (index != null || meta) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-5)',
      font: 'var(--text-overline)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: dark ? 'rgba(239,234,246,.7)' : 'var(--text-muted)'
    }
  }, index != null && /*#__PURE__*/React.createElement("span", null, "Question ", index, total ? ` / ${total}` : ''), meta), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--text-question)',
      letterSpacing: 'var(--tracking-tight)',
      textWrap: 'pretty',
      color: dark ? 'var(--stage-ink)' : 'var(--text-primary)',
      margin: 0
    }
  }, children), media);
}
Object.assign(__ds_scope, { QuestionDisplay });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/quiz/QuestionDisplay.jsx", error: String((e && e.message) || e) }); }

// components/quiz/StatTile.jsx
try { (() => {
function StatTile({
  label,
  value,
  unit,
  icon,
  tone = 'light',
  trend,
  style
}) {
  const dark = tone === 'dark';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      padding: 'var(--space-6)',
      background: dark ? 'rgba(255,255,255,.06)' : 'var(--surface-card)',
      border: '1px solid ' + (dark ? 'rgba(255,255,255,.12)' : 'var(--border-subtle)'),
      borderRadius: 'var(--radius-lg)',
      color: dark ? 'var(--stage-ink)' : 'var(--text-primary)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      font: 'var(--text-overline)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: dark ? 'rgba(239,234,246,.7)' : 'var(--text-muted)'
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 12
  }), label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-numeric)',
      fontSize: 32
    }
  }, value), unit && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body-sm)',
      color: dark ? 'rgba(239,234,246,.7)' : 'var(--text-muted)'
    }
  }, unit)), trend && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body-sm)',
      color: dark ? 'rgba(239,234,246,.7)' : 'var(--text-secondary)'
    }
  }, trend));
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/quiz/StatTile.jsx", error: String((e && e.message) || e) }); }

// ui_kits/participant/Screens.jsx
try { (() => {
const {
  Button,
  Field,
  Input,
  Badge,
  AnswerOption,
  QuestionDisplay,
  Timer,
  ProgressBar,
  LeaderboardRow,
  StatTile,
  PlayerChip,
  Icon
} = window.QuizDesignSystem_2d5b8b;
function Phone({
  children,
  tone = 'light'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 390,
      height: 780,
      borderRadius: 'var(--radius-2xl)',
      overflow: 'hidden',
      background: tone === 'dark' ? 'var(--stage-bg)' : 'var(--surface-page)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-3)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 22px',
      font: 'var(--text-numeric)',
      fontSize: 12,
      color: tone === 'dark' ? 'rgba(239,234,246,.8)' : 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", null, "quiz.app")), children);
}
function JoinScreen({
  onJoin
}) {
  const [code, setCode] = React.useState('482 913');
  const [name, setName] = React.useState('');
  return /*#__PURE__*/React.createElement(Phone, null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 'var(--space-8)',
      padding: 'var(--space-8) var(--space-7)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 22px/1 var(--font-display)',
      letterSpacing: '-0.03em'
    }
  }, "Quiz"), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--text-h1)',
      letterSpacing: 'var(--tracking-tight)'
    }
  }, "Rejoindre une session"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body)',
      color: 'var(--text-secondary)'
    }
  }, "Saisissez le code affich\xE9 \xE0 l'\xE9cran.")), /*#__PURE__*/React.createElement(Field, {
    label: "Code de session"
  }, /*#__PURE__*/React.createElement(Input, {
    size: "lg",
    value: code,
    onChange: e => setCode(e.target.value),
    inputMode: "numeric",
    style: {
      font: 'var(--text-numeric)',
      fontSize: 26,
      letterSpacing: 'var(--tracking-code)',
      textAlign: 'center',
      height: 'var(--control-h-xl)'
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Votre pseudonyme",
    hint: "Visible par les autres participants"
  }, /*#__PURE__*/React.createElement(Input, {
    size: "lg",
    placeholder: "Camille",
    value: name,
    onChange: e => setName(e.target.value),
    style: {
      height: 'var(--control-h-lg)'
    }
  })), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    block: true,
    iconRight: "arrow-right",
    onClick: () => onJoin(name || 'Camille'),
    style: {
      height: 'var(--control-h-xl)'
    }
  }, "Rejoindre")));
}
function WaitingScreen({
  name
}) {
  return /*#__PURE__*/React.createElement(Phone, {
    tone: "dark"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-7)',
      padding: 'var(--space-8)',
      color: 'var(--stage-ink)'
    }
  }, /*#__PURE__*/React.createElement(PlayerChip, {
    name: name,
    tone: "dark"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--text-h1)',
      letterSpacing: 'var(--tracking-tight)'
    }
  }, "Vous \xEAtes dans la salle"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body-lg)',
      color: 'rgba(239,234,246,.75)'
    }
  }, "Culture g\xE9n\xE9rale \u2014 niveau 2", /*#__PURE__*/React.createElement("br", null), "12 questions \xB7 20 s par question")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      font: 'var(--text-body-sm)',
      color: 'rgba(239,234,246,.7)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--brand-300)'
    }
  }), "En attente du pr\xE9sentateur")));
}
function QuestionScreen({
  onAnswer
}) {
  const [sec, setSec] = React.useState(14);
  const [picked, setPicked] = React.useState(null);
  React.useEffect(() => {
    const t = setInterval(() => setSec(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(t);
  }, []);
  return /*#__PURE__*/React.createElement(Phone, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-5) var(--space-6)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-5)',
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: 7,
    max: 12,
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Timer, {
    seconds: sec,
    total: 20,
    size: "sm"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)',
      padding: 'var(--space-7) var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement(QuestionDisplay, {
    index: 7,
    total: 12,
    style: {
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 26px/1.25 var(--font-display)'
    }
  }, "Quel est le plus long fleuve de France ?")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, [['A', 'La Seine'], ['B', 'La Loire'], ['C', 'Le Rhône'], ['D', 'La Garonne']].map(([l, v]) => /*#__PURE__*/React.createElement(AnswerOption, {
    key: l,
    letter: l,
    state: picked === l ? 'selected' : picked ? 'muted' : 'default',
    onClick: () => {
      setPicked(l);
      setTimeout(() => onAnswer(l), 450);
    }
  }, v)))));
}
function FeedbackScreen({
  picked,
  onNext
}) {
  const right = picked === 'B';
  return /*#__PURE__*/React.createElement(Phone, {
    tone: "dark"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-7)',
      padding: 'var(--space-8)',
      color: 'var(--stage-ink)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 88,
      height: 88,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: right ? 'var(--state-success)' : 'var(--state-danger)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: right ? 'check' : 'x',
    size: 44,
    color: "var(--white)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--text-display-2)',
      fontSize: 40,
      letterSpacing: 'var(--tracking-tight)'
    }
  }, right ? 'Bonne réponse' : 'Raté'), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body-lg)',
      color: 'rgba(239,234,246,.78)'
    }
  }, "La Loire mesure 1 006 km, contre 777 km pour la Seine.")), right && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-numeric)',
      fontSize: 32,
      color: 'var(--brand-300)'
    }
  }, "+ 940"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    tone: "dark",
    label: "Score",
    value: "5 100",
    style: {
      minWidth: 120
    }
  }), /*#__PURE__*/React.createElement(StatTile, {
    tone: "dark",
    label: "Rang",
    value: "7",
    unit: "/ 24",
    style: {
      minWidth: 120
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "inverse",
    iconRight: "arrow-right",
    onClick: onNext
  }, "Voir le classement")));
}
function RankScreen({
  onRestart
}) {
  const rows = [['Camille', 8420, 2], ['Théo', 7980, -1], ['Nour', 7310, 1], ['Alex', 6890, -2], ['Inès', 6120, 0]];
  return /*#__PURE__*/React.createElement(Phone, null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)',
      padding: 'var(--space-7) var(--space-6)',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--text-h1)',
      letterSpacing: 'var(--tracking-tight)',
      flex: 1
    }
  }, "Classement"), /*#__PURE__*/React.createElement(Badge, {
    tone: "live",
    dot: true
  }, "Question 7")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, rows.map(([n, s, d], i) => /*#__PURE__*/React.createElement(LeaderboardRow, {
    key: n,
    rank: i + 1,
    name: n,
    score: s,
    delta: d
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--border-subtle)',
      margin: '6px 0'
    }
  }), /*#__PURE__*/React.createElement(LeaderboardRow, {
    rank: 7,
    name: "Vous",
    score: 5100,
    delta: 1,
    highlight: true
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    block: true,
    icon: "rotate-ccw",
    onClick: onRestart
  }, "Recommencer la d\xE9mo")));
}
Object.assign(window, {
  Phone,
  JoinScreen,
  WaitingScreen,
  QuestionScreen,
  FeedbackScreen,
  RankScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/participant/Screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/presenter/EditorScreen.jsx
try { (() => {
const {
  Button,
  IconButton,
  Badge,
  Card,
  Field,
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  Tabs,
  Stepper,
  AnswerOption
} = window.QuizDesignSystem_2d5b8b;
const QS = ['Quel est le plus long fleuve de France ?', 'En quelle année la tour Eiffel a-t-elle été inaugurée ?', 'Combien de régions compte la France métropolitaine ?'];
function EditorScreen({
  onLaunch,
  onBack
}) {
  const [sel, setSel] = React.useState(0);
  const [tab, setTab] = React.useState('q');
  const [correct, setCorrect] = React.useState('B');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-5)',
      padding: 'var(--space-5) var(--gutter-page)',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "arrow-left",
    label: "Retour",
    variant: "ghost",
    onClick: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-h3)'
    }
  }, "Culture g\xE9n\xE9rale \u2014 niveau 2"), /*#__PURE__*/React.createElement(Badge, {
    tone: "warning"
  }, "Non enregistr\xE9"))), /*#__PURE__*/React.createElement(Stepper, {
    steps: ['Informations', 'Questions', 'Lancement'],
    current: 1
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: "eye"
  }, "Aper\xE7u"), /*#__PURE__*/React.createElement(Button, {
    icon: "play",
    onClick: onLaunch
  }, "Lancer la session")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '280px 1fr 300px',
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      borderRight: '1px solid var(--border-subtle)',
      background: 'var(--surface-card)',
      padding: 'var(--space-5)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-overline)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Questions"), /*#__PURE__*/React.createElement(IconButton, {
    icon: "plus",
    label: "Ajouter une question",
    variant: "ghost",
    size: "sm"
  })), QS.map((q, i) => /*#__PURE__*/React.createElement(Card, {
    key: q,
    padding: "sm",
    interactive: true,
    selected: sel === i,
    elevation: 0,
    onClick: () => setSel(i)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-numeric)',
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, String(i + 1).padStart(2, '0')), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body-sm)',
      color: 'var(--text-primary)'
    }
  }, q)))), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: "plus",
    block: true
  }, "Ajouter")), /*#__PURE__*/React.createElement("main", {
    style: {
      padding: 'var(--space-8)',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-7)'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    tabs: [{
      value: 'q',
      label: 'Question'
    }, {
      value: 'm',
      label: 'Média'
    }, {
      value: 'e',
      label: 'Explication'
    }]
  }), /*#__PURE__*/React.createElement(Field, {
    label: "\xC9nonc\xE9",
    required: true
  }, /*#__PURE__*/React.createElement(Input, {
    size: "lg",
    defaultValue: QS[sel]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-label)'
    }
  }, "Propositions \u2014 cochez la bonne r\xE9ponse"), [['A', 'La Seine'], ['B', 'La Loire'], ['C', 'Le Rhône'], ['D', 'La Garonne']].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(AnswerOption, {
    letter: l,
    size: "sm",
    state: correct === l ? 'correct' : 'default',
    onClick: () => setCorrect(l)
  }, v), /*#__PURE__*/React.createElement(IconButton, {
    icon: "trash-2",
    label: "Supprimer la proposition",
    variant: "ghost",
    size: "sm"
  })))), /*#__PURE__*/React.createElement(Field, {
    label: "Explication affich\xE9e apr\xE8s la r\xE9ponse"
  }, /*#__PURE__*/React.createElement(Textarea, {
    rows: 2,
    defaultValue: "La Loire mesure 1 006 km, contre 777 km pour la Seine."
  }))), /*#__PURE__*/React.createElement("aside", {
    style: {
      borderLeft: '1px solid var(--border-subtle)',
      background: 'var(--surface-card)',
      padding: 'var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-overline)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "R\xE9glages de la question"), /*#__PURE__*/React.createElement(Field, {
    label: "Dur\xE9e"
  }, /*#__PURE__*/React.createElement(Select, {
    defaultValue: "20",
    options: [{
      value: '15',
      label: '15 secondes'
    }, {
      value: '20',
      label: '20 secondes'
    }, {
      value: '30',
      label: '30 secondes'
    }]
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Points"
  }, /*#__PURE__*/React.createElement(Select, {
    defaultValue: "1000",
    options: [{
      value: '500',
      label: '500 points'
    }, {
      value: '1000',
      label: '1 000 points'
    }]
  })), /*#__PURE__*/React.createElement(Checkbox, {
    label: "M\xE9langer les propositions"
  }), /*#__PURE__*/React.createElement(Checkbox, {
    label: "R\xE9ponses multiples",
    description: "Plusieurs propositions cochables"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--border-subtle)'
    }
  }), /*#__PURE__*/React.createElement(Switch, {
    checked: true,
    label: "Bonus de rapidit\xE9"
  }))));
}
Object.assign(window, {
  EditorScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/presenter/EditorScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/presenter/LibraryScreen.jsx
try { (() => {
const {
  Button,
  IconButton,
  Badge,
  Card,
  Tag,
  Input,
  Tabs,
  EmptyState
} = window.QuizDesignSystem_2d5b8b;
const QUIZZES = [{
  title: 'Culture générale — niveau 2',
  q: 12,
  dur: '20 s',
  tags: ['Histoire', 'Géographie'],
  state: 'Prêt',
  sessions: 4
}, {
  title: 'Onboarding produit',
  q: 8,
  dur: '30 s',
  tags: ['Interne'],
  state: 'Prêt',
  sessions: 11
}, {
  title: 'Sécurité informatique',
  q: 15,
  dur: '20 s',
  tags: ['Formation'],
  state: 'Brouillon',
  sessions: 0
}, {
  title: 'Quiz de fin de trimestre',
  q: 20,
  dur: '25 s',
  tags: ['Scolaire'],
  state: 'Prêt',
  sessions: 2
}];
function QuizRow({
  q,
  onLaunch,
  onEdit
}) {
  return /*#__PURE__*/React.createElement(Card, {
    padding: "sm",
    interactive: true,
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-h3)'
    }
  }, q.title), /*#__PURE__*/React.createElement(Badge, {
    tone: q.state === 'Prêt' ? 'success' : 'warning'
  }, q.state)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      font: 'var(--text-body-sm)',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", null, q.q, " questions"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, q.dur, " par question"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, q.sessions, " session", q.sessions === 1 ? '' : 's'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, q.tags.map(t => /*#__PURE__*/React.createElement(Tag, {
    key: t
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "pencil",
    label: "Modifier",
    onClick: onEdit
  }), /*#__PURE__*/React.createElement(Button, {
    icon: "play",
    onClick: onLaunch
  }, "Lancer"))));
}
function LibraryScreen({
  onLaunch,
  onEdit
}) {
  const [tab, setTab] = React.useState('tous');
  const list = tab === 'brouillons' ? QUIZZES.filter(q => q.state === 'Brouillon') : tab === 'archives' ? [] : QUIZZES;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-7)',
      padding: 'var(--space-8) var(--gutter-page)',
      maxWidth: 'var(--max-content)'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--text-h1)',
      letterSpacing: 'var(--tracking-tight)'
    }
  }, "Mes quiz"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body)',
      color: 'var(--text-secondary)',
      marginTop: 4
    }
  }, "4 quiz \xB7 derni\xE8re session il y a 2 jours")), /*#__PURE__*/React.createElement(Input, {
    icon: "search",
    placeholder: "Rechercher",
    style: {
      width: 220
    }
  }), /*#__PURE__*/React.createElement(Button, {
    icon: "plus",
    onClick: onEdit
  }, "Nouveau quiz")), /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    tabs: [{
      value: 'tous',
      label: 'Tous',
      count: 4
    }, {
      value: 'brouillons',
      label: 'Brouillons',
      count: 1
    }, {
      value: 'archives',
      label: 'Archivés'
    }]
  }), list.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: "archive",
    title: "Aucun quiz archiv\xE9",
    description: "Les quiz archiv\xE9s restent consultables mais ne peuvent plus \xEAtre lanc\xE9s."
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, list.map(q => /*#__PURE__*/React.createElement(QuizRow, {
    key: q.title,
    q: q,
    onLaunch: onLaunch,
    onEdit: onEdit
  }))));
}
Object.assign(window, {
  LibraryScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/presenter/LibraryScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/presenter/StageScreens.jsx
try { (() => {
const {
  Button,
  IconButton,
  Badge,
  JoinCode,
  PlayerChip,
  QuestionDisplay,
  AnswerOption,
  Timer,
  ProgressBar,
  LeaderboardRow,
  StatTile
} = window.QuizDesignSystem_2d5b8b;
const PLAYERS = ['Camille', 'Théo', 'Nour', 'Alex', 'Inès', 'Mehdi', 'Léa', 'Jonas', 'Sarah', 'Yann', 'Chloé', 'Rémi'];
function StageFrame({
  children,
  footer
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--stage-bg)',
      color: 'var(--stage-ink)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      padding: 'var(--space-10) var(--space-12)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid rgba(255,255,255,.12)',
      padding: 'var(--space-5) var(--space-12)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-6)'
    }
  }, footer));
}
function LobbyStage({
  onStart,
  onQuit
}) {
  return /*#__PURE__*/React.createElement(StageFrame, {
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Badge, {
      tone: "live",
      dot: true
    }, "Salle ouverte"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        font: 'var(--text-body-sm)',
        color: 'rgba(239,234,246,.7)'
      }
    }, "Les participants rejoignent depuis quiz.app avec le code affich\xE9."), /*#__PURE__*/React.createElement(Button, {
      variant: "inverse",
      icon: "x",
      onClick: onQuit
    }, "Annuler"), /*#__PURE__*/React.createElement(Button, {
      icon: "play",
      size: "lg",
      onClick: onStart
    }, "D\xE9marrer le quiz"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '380px 1fr',
      gap: 'var(--space-12)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-7)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-overline)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'rgba(239,234,246,.66)'
    }
  }, "Culture g\xE9n\xE9rale \u2014 niveau 2"), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--text-h1)',
      marginTop: 6,
      letterSpacing: 'var(--tracking-tight)'
    }
  }, "Rejoignez la session")), /*#__PURE__*/React.createElement(JoinCode, {
    code: "482 913"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-5)',
      font: 'var(--text-body)',
      color: 'rgba(239,234,246,.8)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 'var(--radius-md)',
      background: 'rgba(255,255,255,.12)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      width: 30,
      height: 30,
      background: 'var(--stage-ink)',
      WebkitMask: 'url(https://unpkg.com/lucide-static@0.441.0/icons/qr-code.svg) center/contain no-repeat',
      mask: 'url(https://unpkg.com/lucide-static@0.441.0/icons/qr-code.svg) center/contain no-repeat'
    }
  })), /*#__PURE__*/React.createElement("span", null, "Ou scannez le code \u2014", /*#__PURE__*/React.createElement("br", null), "quiz.app/482913"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-numeric)',
      fontSize: 40
    }
  }, PLAYERS.length), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body-lg)',
      color: 'rgba(239,234,246,.75)'
    }
  }, "participants connect\xE9s")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      flexWrap: 'wrap'
    }
  }, PLAYERS.map((p, i) => /*#__PURE__*/React.createElement(PlayerChip, {
    key: p,
    name: p,
    seed: i,
    tone: "dark"
  }))))));
}
function QuestionStage({
  revealed,
  onNext,
  onReveal
}) {
  const [sec, setSec] = React.useState(14);
  React.useEffect(() => {
    if (revealed) return;
    const t = setInterval(() => setSec(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(t);
  }, [revealed]);
  const dist = {
    A: 12,
    B: 58,
    C: 21,
    D: 9
  };
  const answers = [['A', 'La Seine'], ['B', 'La Loire'], ['C', 'Le Rhône'], ['D', 'La Garonne']];
  return /*#__PURE__*/React.createElement(StageFrame, {
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ProgressBar, {
      value: 7,
      max: 12,
      tone: "inverse",
      style: {
        width: 240
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: 'var(--text-body-sm)',
        color: 'rgba(239,234,246,.7)'
      }
    }, "18 / 24 r\xE9ponses re\xE7ues"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }), revealed ? /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      iconRight: "arrow-right",
      onClick: onNext
    }, "Question suivante") : /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      variant: "inverse",
      icon: "eye",
      onClick: onReveal
    }, "R\xE9v\xE9ler la r\xE9ponse"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-9)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-10)'
    }
  }, /*#__PURE__*/React.createElement(QuestionDisplay, {
    index: 7,
    total: 12,
    tone: "dark",
    style: {
      flex: 1,
      textAlign: 'left'
    }
  }, "Quel est le plus long fleuve de France ?"), /*#__PURE__*/React.createElement(Timer, {
    seconds: revealed ? 0 : sec,
    total: 20,
    size: "lg",
    tone: revealed ? 'inverse' : 'auto',
    style: {
      color: 'var(--stage-ink)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-5)'
    }
  }, answers.map(([l, v]) => /*#__PURE__*/React.createElement(AnswerOption, {
    key: l,
    letter: l,
    size: "md",
    state: revealed ? l === 'B' ? 'correct' : 'muted' : 'default',
    distribution: revealed ? dist[l] : undefined
  }, v)))));
}
function ResultsStage({
  onRestart
}) {
  const rows = [['Camille', 8420, 2], ['Théo', 7980, -1], ['Nour', 7310, 1], ['Alex', 6890, -2], ['Inès', 6120, 0]];
  return /*#__PURE__*/React.createElement(StageFrame, {
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral",
      style: {
        background: 'rgba(255,255,255,.12)',
        color: 'var(--stage-ink)',
        borderColor: 'rgba(255,255,255,.2)'
      }
    }, "Session termin\xE9e"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "inverse",
      icon: "download"
    }, "Exporter les r\xE9sultats"), /*#__PURE__*/React.createElement(Button, {
      icon: "rotate-ccw",
      onClick: onRestart
    }, "Retour \xE0 la biblioth\xE8que"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 420px',
      gap: 'var(--space-12)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--text-display-2)',
      letterSpacing: 'var(--tracking-tight)'
    }
  }, "Classement final"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, rows.map(([n, s, d], i) => /*#__PURE__*/React.createElement(LeaderboardRow, {
    key: n,
    rank: i + 1,
    name: n,
    score: s,
    delta: d,
    tone: "dark",
    highlight: i === 0
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    tone: "dark",
    icon: "users",
    label: "Participants",
    value: "24"
  }), /*#__PURE__*/React.createElement(StatTile, {
    tone: "dark",
    icon: "check",
    label: "R\xE9ussite",
    value: "68",
    unit: "%"
  }), /*#__PURE__*/React.createElement(StatTile, {
    tone: "dark",
    icon: "timer",
    label: "Temps moyen",
    value: "6,4",
    unit: "s"
  }), /*#__PURE__*/React.createElement(StatTile, {
    tone: "dark",
    icon: "circle-help",
    label: "Question la plus rat\xE9e",
    value: "Q9",
    trend: "31 % de bonnes r\xE9ponses"
  }))));
}
Object.assign(window, {
  LobbyStage,
  QuestionStage,
  ResultsStage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/presenter/StageScreens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Timer = __ds_scope.Timer;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.SideNav = __ds_scope.SideNav;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.AnswerOption = __ds_scope.AnswerOption;

__ds_ns.JoinCode = __ds_scope.JoinCode;

__ds_ns.LeaderboardRow = __ds_scope.LeaderboardRow;

__ds_ns.PlayerChip = __ds_scope.PlayerChip;

__ds_ns.QuestionDisplay = __ds_scope.QuestionDisplay;

__ds_ns.StatTile = __ds_scope.StatTile;

})();
