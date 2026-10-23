import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, LayoutDashboard, Menu, X } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Brand, BrandMark } from './Brand.jsx';
import { PUBLIC_NAV } from './nav-config.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button, IconButton } from '../ui/primitives.jsx';

export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className="flex min-h-screen flex-col bg-base">
      <header className="sticky top-0 z-40 border-b border-line bg-base/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Brand />

          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Sections">
            {PUBLIC_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                    isActive ? 'bg-overlay text-ink' : 'text-ink-faint hover:text-ink-dim',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link to="/app">
                <Button size="sm" variant="primary" icon={LayoutDashboard}>
                  Open dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-dim transition-colors hover:text-ink sm:block"
                >
                  Sign in
                </Link>
                <Link to="/register">
                  <Button size="sm" variant="primary" iconRight={ArrowRight}>
                    Create account
                  </Button>
                </Link>
              </>
            )}
            <IconButton
              icon={open ? X : Menu}
              label="Toggle navigation"
              size="sm"
              className="lg:hidden"
              onClick={() => setOpen((v) => !v)}
            />
          </div>
        </div>

        {open && (
          <nav className="border-t border-line bg-surface px-4 py-2 lg:hidden" aria-label="Sections">
            {PUBLIC_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-2.5 py-2 text-xs font-medium transition-colors',
                    isActive ? 'bg-overlay text-ink' : 'text-ink-faint hover:text-ink-dim',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            {!user && (
              <Link to="/login" className="block rounded-md px-2.5 py-2 text-xs font-medium text-ink-dim">
                Sign in
              </Link>
            )}
          </nav>
        )}
      </header>

      <main className="min-w-0 flex-1">
        {isLanding ? (
          <Outlet />
        ) : (
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-surface/60">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-2">
          <Brand />
          <p className="max-w-md text-xs leading-relaxed text-ink-faint">
            Satellite tracking, observation planning, mission records, space weather and private
            research workspaces in one platform. Predictions are computed from orbital element sets
            by a documented, testable engine, and every value on screen carries its source and age.
          </p>
          <p className="max-w-md text-2xs leading-relaxed text-ink-faint">
            SpaceNova is not certified for operational, navigational or safety-critical use. It
            performs no conjunction screening or collision assessment.
          </p>
        </div>

        <div className="space-y-2.5">
          <p className="label-caps">Platform</p>
          <ul className="space-y-1.5">
            {PUBLIC_NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-xs text-ink-faint transition-colors hover:text-ink-dim">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2.5">
          <p className="label-caps">Data sources</p>
          <ul className="space-y-1.5 text-xs text-ink-faint">
            <li>Celestrak and Space-Track element sets</li>
            <li>Launch schedule provider</li>
            <li>Space weather indices and alerts</li>
            <li>Solar system ephemeris</li>
            <li>Cloud cover forecast</li>
          </ul>
          <p className="pt-1 text-2xs leading-relaxed text-ink-faint">
            Phase 1 runs on bundled fixtures. Live providers are connected in Phase 2.
          </p>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-2xs text-ink-faint">
            <BrandMark size={13} className="text-ink-faint" />
            SpaceNova &middot; front end build, no back end connected
          </p>
          <p className="text-2xs text-ink-faint">All timestamps are UTC unless stated otherwise.</p>
        </div>
      </div>
    </footer>
  );
}
