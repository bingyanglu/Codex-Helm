export type IconName =
  | "overview"
  | "runmode"
  | "provider"
  | "monitor"
  | "refresh"
  | "check"
  | "x"
  | "warn"
  | "info"
  | "plus"
  | "more"
  | "external"
  | "play"
  | "lock"
  | "spark"
  | "chart"
  | "download"
  | "chevron";

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 16, color = "currentColor", strokeWidth = 1.7 }: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { display: "block" }
  };

  switch (name) {
    case "overview":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "runmode":
      return (
        <svg {...props}>
          <path d="M3 6h18M3 12h12M3 18h7" />
          <circle cx="19" cy="16" r="3" />
          <path d="M17.5 16h3M19 14.5v3" strokeWidth={1.4} />
        </svg>
      );
    case "provider":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="6" rx="2" />
          <rect x="3" y="14" width="18" height="6" rx="2" />
          <circle cx="7" cy="7" r="0.6" fill="currentColor" />
          <circle cx="7" cy="17" r="0.6" fill="currentColor" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...props}>
          <path d="M3 18l5-7 4 4 5-8 4 6" />
          <path d="M3 21h18" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...props}>
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      );
    case "x":
      return (
        <svg {...props}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "warn":
      return (
        <svg {...props}>
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      );
    case "info":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M11 12h1v5h1" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "more":
      return (
        <svg {...props}>
          <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "external":
      return (
        <svg {...props}>
          <path d="M10 14L20 4" />
          <path d="M14 4h6v6" />
          <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
        </svg>
      );
    case "play":
      return (
        <svg {...props}>
          <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "lock":
      return (
        <svg {...props}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case "spark":
      return (
        <svg {...props}>
          <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3.5 3.5M15.5 15.5 19 19M5 19l3.5-3.5M15.5 8.5 19 5" />
        </svg>
      );
    case "chart":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v9l6 3" />
        </svg>
      );
    case "download":
      return (
        <svg {...props}>
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...props}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    default:
      return null;
  }
}
