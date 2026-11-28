import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      // Sem width/height explícitos o SVG assume o tamanho padrão do navegador
      // (300×150) e é desenhado fora do botão. O spread vem depois para quem
      // precisa de outro tamanho poder sobrescrever.
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const TrophyIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3" />
    <path d="M12 13v4M9 20h6M10 17h4" />
  </Icon>
)

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 6h18M3 12h18M3 18h18" />
    <circle cx="8" cy="6" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="10" cy="18" r="2.2" fill="currentColor" stroke="none" />
  </Icon>
)

export const DiceIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <circle cx="8.5" cy="8.5" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.15" fill="currentColor" stroke="none" />
  </Icon>
)
export const ChecklistIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m3 6 2 2 3-3M3 14l2 2 3-3" />
    <path d="M12 7h9M12 15h9" />
  </Icon>
)

export const TargetIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </Icon>
)

export const CheckIcon =(props: IconProps) => (
  <Icon strokeWidth="3" {...props}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
)

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m15 5-7 7 7 7" />
  </Icon>
)

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

/** Ir para outra página, quando o toque principal da linha já faz outra coisa. */
export const ArrowUpRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Icon>
)

export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const EyeOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3" />
    <path d="M6.6 6.6A16.6 16.6 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3 3 18 18" />
  </Icon>
)

export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
)
