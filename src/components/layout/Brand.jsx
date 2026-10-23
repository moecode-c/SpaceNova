import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn.js';

/**
 * Brand mark: a body with an inclined orbit and a spacecraft on it. Drawn as
 * inline SVG so it inherits the text colour and stays crisp at any size. No
 * raster assets and no icon fonts anywhere in the product.
 */
export function BrandMark({ size = 24, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="novaBody" x1="8" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7db6ff" />
          <stop offset="1" stopColor="#2e5f9e" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="6.2" fill="url(#novaBody)" />
      <path
        d="M16 9.8a6.2 6.2 0 0 0 0 12.4 6.2 6.2 0 0 0 0-12.4Z"
        fill="#04121f"
        fillOpacity="0.22"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="14"
        ry="6.6"
        transform="rotate(-28 16 16)"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.3"
      />
      <circle cx="27.1" cy="10.1" r="2.1" fill="#e8edf6" />
    </svg>
  );
}

export function Brand({ to = '/', compact, className, size = 22 }) {
  return (
    <Link
      to={to}
      className={cn('group inline-flex items-center gap-2.5 text-primary', className)}
      aria-label="SpaceNova home"
    >
      <BrandMark size={size} />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
            Space<span className="text-primary">Nova</span>
          </span>
          <span className="mt-0.5 text-[0.5rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
            Space data platform
          </span>
        </span>
      )}
    </Link>
  );
}
