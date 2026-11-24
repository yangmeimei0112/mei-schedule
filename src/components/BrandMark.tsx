import React from 'react';
import {
  Activity,
  AlignLeft,
  Apple,
  AppWindow,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Bell,
  BellOff,
  BellRing,
  Blocks,
  BookOpen,
  Bot,
  Box,
  BrainCircuit,
  Briefcase,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Camera,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CirclePlay,
  Clock,
  Cloud,
  Code2,
  Columns3,
  Command,
  Compass,
  Copy,
  CornerDownLeft,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode,
  FileJson,
  FileText,
  Film,
  Filter,
  Fingerprint,
  Flag,
  Flame,
  Folder,
  FolderGit2,
  Gamepad2,
  GitCommitHorizontal,
  Globe,
  GripVertical,
  HardDrive,
  Heart,
  History,
  Home,
  Hourglass,
  Image,
  Inbox,
  Info,
  KeyRound,
  Laptop,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  List,
  ListTodo,
  Loader2,
  Lock,
  LockOpen,
  LogOut,
  Mail,
  MapPin,
  Maximize2,
  Menu,
  MessageSquare,
  MessageSquareCode,
  Mic,
  Milestone,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  Move,
  Music,
  Orbit,
  Package,
  Palette,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Pause,
  Pencil,
  PieChart,
  Pin,
  PinOff,
  Play,
  Plus,
  QrCode,
  Radio,
  Redo2,
  RefreshCw,
  Repeat,
  Rocket,
  RotateCcw,
  ScanFace,
  ScanLine,
  Search,
  Send,
  Server,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Square,
  Star,
  Sun,
  Tag,
  Target,
  Terminal,
  Timer,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Undo2,
  Upload,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Video,
  Volume2,
  VolumeX,
  WandSparkles,
  Wifi,
  WifiOff,
  Workflow,
  Wrench,
  X,
  Zap
} from 'lucide-react';

// ============================================================================
// Candidate F Cloud x Infinity Brand Geometry & 7-Tier Scale
// ============================================================================

export type LogoSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const LOGO_SIZES: readonly LogoSize[] = [
  '2xs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl'
] as const;

export const CANDIDATE_F_CLOUD_PATH =
  'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z';

export const CANDIDATE_F_INFINITY_PATH =
  'M12 14.5c-1.2-1.2-2.4-1.8-3.6-1.8a1.8 1.8 0 1 0 0 3.6c1.2 0 2.4-.6 3.6-1.8Zm0 0c1.2 1.2 2.4 1.8 3.6 1.8a1.8 1.8 0 0 0 0-3.6c-1.2 0-2.4.6-3.6 1.8Z';

export function normalizeLucideIconName(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return 'cloud';
  const normalized = rawName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Za-z])([0-9]+)/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  return normalized || 'cloud';
}

export interface LucideIconSvgProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'strokeWidth'> {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
  className?: string;
}

/**
 * Android Vector Icon (Zero Emoji, Lucide 1.75 linear style)
 */
export function AndroidIcon({
  size = 20,
  color = 'currentColor',
  strokeWidth = 1.75,
  className = '',
  absoluteStrokeWidth: _absoluteStrokeWidth,
  ...props
}: LucideIconSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      data-lucide-name="android"
      {...props}
    >
      <path d="M5 14a7 7 0 0 1 14 0Z" />
      <path d="M8.5 6L10 8.5" />
      <path d="M15.5 6L14 8.5" />
      <line x1="9" y1="11" x2="9.01" y2="11" />
      <line x1="15" y1="11" x2="15.01" y2="11" />
      <path d="M6 14v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LUCIDE_ICON_MAP: Record<string, React.ComponentType<any>> = {
  activity: Activity,
  'align-left': AlignLeft,
  android: AndroidIcon,
  apple: Apple,
  'app-window': AppWindow,
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'arrow-up-right': ArrowUpRight,
  'bar-chart-3': BarChart3,
  bell: Bell,
  'bell-off': BellOff,
  'bell-ring': BellRing,
  blocks: Blocks,
  'book-open': BookOpen,
  bot: Bot,
  box: Box,
  'brain-circuit': BrainCircuit,
  briefcase: Briefcase,
  calendar: Calendar,
  'calendar-check': CalendarCheck,
  'calendar-days': CalendarDays,
  'calendar-plus': CalendarPlus,
  'calendar-range': CalendarRange,
  camera: Camera,
  check: Check,
  'check-square': CheckSquare,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  circle: Circle,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  'circle-dot': CircleDot,
  'circle-play': CirclePlay,
  clock: Clock,
  cloud: Cloud,
  'code-2': Code2,
  'columns-3': Columns3,
  command: Command,
  compass: Compass,
  copy: Copy,
  'corner-down-left': CornerDownLeft,
  cpu: Cpu,
  database: Database,
  download: Download,
  'external-link': ExternalLink,
  eye: Eye,
  'eye-off': EyeOff,
  'file-code': FileCode,
  'file-json': FileJson,
  'file-text': FileText,
  film: Film,
  filter: Filter,
  fingerprint: Fingerprint,
  flag: Flag,
  flame: Flame,
  folder: Folder,
  'folder-git-2': FolderGit2,
  'gamepad-2': Gamepad2,
  'git-commit-horizontal': GitCommitHorizontal,
  globe: Globe,
  'grip-vertical': GripVertical,
  'hard-drive': HardDrive,
  heart: Heart,
  history: History,
  home: Home,
  hourglass: Hourglass,
  image: Image,
  inbox: Inbox,
  info: Info,
  'key-round': KeyRound,
  laptop: Laptop,
  layers: Layers,
  'layout-dashboard': LayoutDashboard,
  'layout-grid': LayoutGrid,
  'link-2': Link2,
  list: List,
  'list-todo': ListTodo,
  'loader-2': Loader2,
  lock: Lock,
  'lock-open': LockOpen,
  'log-out': LogOut,
  mail: Mail,
  'map-pin': MapPin,
  'maximize-2': Maximize2,
  menu: Menu,
  'message-square': MessageSquare,
  'message-square-code': MessageSquareCode,
  mic: Mic,
  milestone: Milestone,
  minus: Minus,
  monitor: Monitor,
  moon: Moon,
  'more-horizontal': MoreHorizontal,
  move: Move,
  music: Music,
  orbit: Orbit,
  package: Package,
  palette: Palette,
  'panel-left': PanelLeft,
  'panel-left-close': PanelLeftClose,
  'panel-left-open': PanelLeftOpen,
  'panel-right-open': PanelRightOpen,
  pause: Pause,
  pencil: Pencil,
  'pie-chart': PieChart,
  pin: Pin,
  'pin-off': PinOff,
  play: Play,
  plus: Plus,
  'qr-code': QrCode,
  radio: Radio,
  'redo-2': Redo2,
  'refresh-cw': RefreshCw,
  repeat: Repeat,
  rocket: Rocket,
  'rotate-ccw': RotateCcw,
  'scan-face': ScanFace,
  'scan-line': ScanLine,
  search: Search,
  send: Send,
  server: Server,
  settings: Settings,
  'share-2': Share2,
  'shield-check': ShieldCheck,
  'sliders-horizontal': SlidersHorizontal,
  smartphone: Smartphone,
  sparkles: Sparkles,
  square: Square,
  star: Star,
  sun: Sun,
  tag: Tag,
  target: Target,
  terminal: Terminal,
  timer: Timer,
  'trash-2': Trash2,
  'trending-up': TrendingUp,
  'triangle-alert': TriangleAlert,
  'undo-2': Undo2,
  upload: Upload,
  user: User,
  'user-check': UserCheck,
  'user-cog': UserCog,
  'user-plus': UserPlus,
  users: Users,
  video: Video,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  'wand-sparkles': WandSparkles,
  wifi: Wifi,
  'wifi-off': WifiOff,
  workflow: Workflow,
  wrench: Wrench,
  x: X,
  zap: Zap
};

export interface LucideIconProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'strokeWidth'> {
  name?: string;
  size?: number | string;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
  className?: string;
}

/**
 * Unified Lucide Vector Icon Renderer
 * Defaults strictly to strokeWidth=1.75 & absoluteStrokeWidth=true
 */
export function LucideIcon({
  name = 'cloud',
  size = 20,
  strokeWidth = 1.75,
  absoluteStrokeWidth = true,
  className = '',
  ...rest
}: LucideIconProps) {
  const normalizedName = normalizeLucideIconName(name);
  const IconComponent = LUCIDE_ICON_MAP[normalizedName] || Cloud;

  return (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth={absoluteStrokeWidth}
      className={`lucide-icon-token shrink-0 ${className}`.trim()}
      data-lucide-name={normalizedName}
      {...rest}
    />
  );
}

const SIZE_MAP: Record<LogoSize, { box: string; icon: number }> = {
  '2xs': { box: 'w-5 h-5 rounded-[6px]', icon: 11 },
  xs: { box: 'w-6 h-6 rounded-[8px]', icon: 13 },
  sm: { box: 'w-9 h-9 rounded-[12px]', icon: 18 },
  md: { box: 'w-[44px] h-[44px] rounded-[14px]', icon: 22 },
  lg: { box: 'w-[56px] h-[56px] rounded-[18px]', icon: 28 },
  xl: { box: 'w-20 h-20 sm:w-24 sm:h-24 rounded-[26px] sm:rounded-[30px]', icon: 46 },
  '2xl': { box: 'w-28 h-28 sm:w-32 sm:h-32 rounded-[32px] sm:rounded-[36px]', icon: 58 }
};

function normalizeLogoSize(size?: LogoSize | string | null): LogoSize {
  if (size && typeof size === 'string' && size in SIZE_MAP) {
    return size as LogoSize;
  }
  return 'md';
}

export interface SquircleIconBadgeProps {
  name?: string;
  size?: LogoSize | string | null;
  iconSize?: number;
  className?: string;
  children?: React.ReactNode;
}

export function SquircleIconBadge({
  name = 'cloud',
  size = 'md',
  iconSize,
  className = '',
  children
}: SquircleIconBadgeProps) {
  const selected = SIZE_MAP[normalizeLogoSize(size)];
  const resolvedIconSize = iconSize || selected.icon;

  return (
    <div
      className={`squircle-icon-badge inline-flex items-center justify-center shrink-0 transition-transform duration-300 ${selected.box} ${className}`.trim()}
    >
      {children || (
        <LucideIcon
          name={name}
          size={resolvedIconSize}
          strokeWidth={1.75}
          absoluteStrokeWidth={true}
        />
      )}
    </div>
  );
}

export interface StudioLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: LogoSize | string | null;
  className?: string;
  badgeClassName?: string;
  'data-testid'?: string;
  frameless?: boolean;
}

/**
 * 咩創意工作室 / 咩時光統一品牌標誌徽章 (Candidate F: Cloud x Infinity)
 * 7-tier size matrix: 2xs, xs, sm, md, lg, xl, 2xl
 */
export function StudioLogo({
  size = 'md',
  className = '',
  badgeClassName = '',
  'data-testid': testId = 'studio-brand-logo',
  frameless = false,
  ...rest
}: StudioLogoProps) {
  const normalizedSize = normalizeLogoSize(size);
  const current = SIZE_MAP[normalizedSize];

  const brandSvg = (
    <svg
      data-lucide-name="cloud"
      xmlns="http://www.w3.org/2000/svg"
      width={current.icon}
      height={current.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-sky-500 dark:text-sky-400 studio-infinity-cloud ${frameless ? 'drop-shadow-md' : ''}`.trim()}
    >
      <path d={CANDIDATE_F_CLOUD_PATH} />
      <path d={CANDIDATE_F_INFINITY_PATH} />
    </svg>
  );

  return (
    <div
      className={`studio-brand-logo relative inline-flex items-center justify-center shrink-0 ${className}`.trim()}
      data-testid={testId}
      data-logo-size={normalizedSize}
      {...rest}
    >
      {frameless ? (
        brandSvg
      ) : (
        <div
          className={`squircle-icon-badge inline-flex items-center justify-center shrink-0 transition-transform duration-300 border border-sky-400/25 dark:border-sky-500/25 bg-sky-500/10 dark:bg-sky-400/10 ${current.box} ${badgeClassName}`.trim()}
        >
          {brandSvg}
        </div>
      )}
    </div>
  );
}

export const MeiScheduleLogo = StudioLogo;
export const BrandMark = StudioLogo;
export default StudioLogo;
