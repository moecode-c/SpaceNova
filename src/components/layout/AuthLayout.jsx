import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Brand } from './Brand.jsx';

/**
 * Split layout for the authentication screens: the form on the left, and on
 * the right a short statement of what the product does and the honesty rules it
 * holds itself to.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-base">
      <div className="flex w-full flex-col lg:w-[27rem] xl:w-[30rem]">
        <header className="flex h-14 shrink-0 items-center justify-between px-6">
          <Brand />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-2xs text-ink-faint transition-colors hover:text-ink-dim"
          >
            <ArrowLeft size={12} aria-hidden />
            Back to site
          </Link>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </div>
        <footer className="shrink-0 px-6 py-5">
          <p className="text-2xs leading-relaxed text-ink-faint">
            Phase 1 build. No credentials are transmitted or stored, and no account on this screen
            is real.
          </p>
        </footer>
      </div>

      <aside className="relative hidden min-w-0 flex-1 overflow-hidden border-l border-line bg-surface lg:block">
        <div className="starfield absolute inset-0 bg-radial-fade" aria-hidden />
        <div className="absolute inset-0 bg-grid-faint bg-grid opacity-40" aria-hidden />
        <div className="relative flex h-full flex-col justify-center gap-8 px-12 xl:px-16">
          <div className="space-y-4">
            <h2 className="max-w-md text-2xl font-semibold leading-snug tracking-[-0.02em] text-ink">
              Predictions you can check, with the working shown.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-ink-dim">
              SpaceNova propagates orbital element sets itself rather than reading a number off
              someone else&rsquo;s page. Every pass is scored on maximum elevation, duration,
              illumination, sky darkness and element-set confidence, and every term is visible.
            </p>
          </div>

          <ul className="max-w-md space-y-3.5">
            {[
              [
                'Four visibility clauses, evaluated separately',
                'Elevation, Earth shadow, sky darkness and your own horizon mask. When a pass is rejected you are told which clause failed.',
              ],
              [
                'Freshness on every element set',
                'Fresh, usable, stale or expired. Past the propagation horizon the engine refuses to predict rather than guessing.',
              ],
              [
                'Nothing estimated is presented as measured',
                'Computed values are labelled computed. Magnitudes are labelled estimates. Cached figures carry their age.',
              ],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-xs font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
