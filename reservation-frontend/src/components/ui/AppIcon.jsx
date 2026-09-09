/**
 * EEARS UI icons — Phosphor regular，currentColor
 */
import React from 'react';
import {
  Info,
  Warning,
  MagnifyingGlass,
  ClipboardText,
  CalendarBlank,
  Megaphone,
  CheckCircle,
  XCircle,
  Tray,
  GraduationCap,
  ListBullets,
} from '@phosphor-icons/react';

const SIZE = {
  sm: 16,
  md: 20,
  lg: 28,
  xl: 40,
};

const NAME_MAP = {
  info: Info,
  warning: Warning,
  search: MagnifyingGlass,
  clipboard: ClipboardText,
  calendar: CalendarBlank,
  megaphone: Megaphone,
  check: CheckCircle,
  x: XCircle,
  inbox: Tray,
  graduation: GraduationCap,
  list: ListBullets,
  'ℹ️': Info,
  '⚠️': Warning,
  '🔍': MagnifyingGlass,
  '🔎': MagnifyingGlass,
  '📝': ClipboardText,
  '📅': CalendarBlank,
  '📢': Megaphone,
  '✅': CheckCircle,
  '❌': XCircle,
  '📭': Tray,
  '🎓': GraduationCap,
  '📋': ListBullets,
};

/**
 * @param {{ name?: string, size?: string|number, className?: string, weight?: string }} props
 */
export default function AppIcon({
  name = 'info',
  size = 'md',
  className = '',
  weight = 'regular',
  ...rest
}) {
  const Comp = NAME_MAP[name] || Info;
  const px = typeof size === 'number' ? size : (SIZE[size] || 20);
  return (
    <Comp
      size={px}
      weight={weight}
      className={className}
      aria-hidden
      {...rest}
    />
  );
}

export {
  Info as IconInfo,
  Warning as IconWarning,
  MagnifyingGlass as IconSearch,
  ClipboardText as IconClipboard,
  CalendarBlank as IconCalendar,
  Megaphone as IconMegaphone,
  CheckCircle as IconCheck,
  XCircle as IconXCircle,
  Tray as IconInbox,
  GraduationCap as IconGraduationCap,
  ListBullets as IconList,
};
