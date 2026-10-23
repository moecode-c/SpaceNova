import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn.js';

/**
 * Brand mark: a body with an inclined orbit and a spacecraft on it. Drawn as
 * inline SVG so it inherits the text colour and stays crisp at any size. No
 * raster assets and no icon fonts anywhere in the product. It is a single
 * colour: the design system has no brand hue to put in it.
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
      <circle cx="16" cy="16" r="6.2" fill="currentColor" />
      <path
        d="M16 9.8a6.2 6.2 0 0 0 0 12.4 6.2 6.2 0 0 0 0-12.4Z"
        fill="#000000"
        fillOpacity="0.28"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="14"
        ry="6.6"
        transform="rotate(-28 16 16)"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="1.3"
      />
      <circle cx="27.1" cy="10.1" r="2.1" fill="currentColor" />
    </svg>
  );
}

/** The wordmark: one line of tracked, bold capitals beside the mark. */
export function Brand({ to = '/', compact, className, size = 22 }) {
  return (
    <Link
      to={to}
      className={cn('group inline-flex items-center gap-3 text-ink', className)}
      aria-label="SpaceNova home"
    >
      <BrandMark size={size} />
      {!compact && (
        <span className="font-display text-[1.05rem] font-bold uppercase leading-none tracking-[0.24em]">
          SpaceNova
        </span>
      )}
    </Link>
  );
}
