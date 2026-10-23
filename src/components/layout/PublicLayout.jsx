import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, LayoutDashboard, Menu, X } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Brand, BrandMark } from './Brand.jsx';
import { PUBLIC_NAV } from './nav-config.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button, IconButton } from '../ui/primitives.jsx';

/** Nav items are 13px bold capitals; the current page carries a white rule. */
const navLinkClass = ({ isActive }) =>
  cn(
    'border-b-2 pb-1 text-[0.8125rem] font-bold uppercase tracking-cap transition-colors',
    isActive ? 'border-ink text-ink' : 'border-transparent text-ink-dim hover:text-ink',
  );

export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === '/';

  // The header floats over the hero on the landing page, with no background of
  // its own, and turns solid once the page has scrolled out from under it.
  useEffect(() => {
    if (!isLanding) return undefined;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isLanding]);

  const overlay = isLanding && !scrolled && !open;

  return (
    <div className="flex min-h-screen flex-col bg-base">
      <header
        className={cn(
          'z-40 w-full border-b transition-colors',
          isLanding ? 'fixed inset-x-0 top-0' : 'sticky top-0',
          overlay ? 'border-transparent bg-transparent' : 'border-line-strong bg-base',
        )}
      >
        <div className="flex h-[4.5rem] w-full items-center gap-6 px-6 lg:px-8">
          <Brand size={24} />

          <nav className="ml-6 hidden items-center gap-8 lg:flex" aria-label="Sections">
            {PUBLIC_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            {user ? (
              <Link to="/app" className="hidden sm:block">
                <Button size="sm" variant="outline" icon={LayoutDashboard}>
                  Open dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden border-b-2 border-transparent pb-1 text-[0.8125rem] font-bold uppercase tracking-cap text-ink-dim transition-colors hover:text-ink sm:block"
                >
                  Sign in
                </Link>
                <Link to="/register" className="hidden sm:block">
                  <Button size="sm" variant="outline" iconRight={ArrowRight}>
                    Create account
                  </Button>
                </Link>
              </>
            )}
            <IconButton
              icon={open ? X : Menu}
              label="Toggle navigation"
              size="md"
              className="lg:hidden"
              onClick={() => setOpen((v) => !v)}
            />
          </div>
        </div>

        {open && (
          <nav className="flex flex-col gap-1 border-t border-line-strong bg-base px-6 py-4 lg:hidden" aria-label="Sections">
            {PUBLIC_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'py-3 text-[0.8125rem] font-bold uppercase tracking-cap transition-colors',
                    isActive ? 'text-ink' : 'text-ink-dim hover:text-ink',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user && (
              <Link to="/app" onClick={() => setOpen(false)} className="pt-3">
                <Button size="md" variant="outline" icon={LayoutDashboard} className="w-full">
                  Open dashboard
                </Button>
              </Link>
            )}
            {!user && (
              <>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="py-3 text-[0.8125rem] font-bold uppercase tracking-cap text-ink-dim hover:text-ink"
                >
                  Sign in
                </Link>
                <Link to="/register" onClick={() => setOpen(false)} className="pt-3">
                  <Button size="md" variant="outline" iconRight={ArrowRight} className="w-full">
                    Create account
                  </Button>
                </Link>
              </>
            )}
          </nav>
        )}
      </header>

      <main className="min-w-0 flex-1">
        {isLanding ? (
          <Outlet />
        ) : (
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
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
    <footer className="border-t border-line-strong bg-base">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-12 lg:grid-cols-4 lg:px-8">
        <div className="space-y-4 lg:col-span-2">
          <Brand />
          <p className="max-w-md text-[0.8125rem] leading-relaxed text-ink-dim">
            Satellite tracking, observation planning, mission records, space weather and private
            research workspaces in one platform. Predictions are computed from orbital element sets
            by a documented, testable engine, and every value on screen carries its source and age.
          </p>
          <p className="max-w-md text-2xs leading-relaxed text-ink-faint">
            SpaceNova is not certified for operational, navigational or safety-critical use. It
            performs no conjunction screening or collision assessment.
          </p>
        </div>

        <div className="space-y-4">
          <p className="label-caps">Platform</p>
          <ul className="space-y-3">
            {PUBLIC_NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="text-2xs font-semibold uppercase tracking-micro text-ink-dim transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <p className="label-caps">Data sources</p>
          <ul className="space-y-2 text-[0.8125rem] text-ink-dim">
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
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-5 lg:px-8">
          <p className="flex items-center gap-2 text-2xs uppercase tracking-micro text-ink-faint">
            <BrandMark size={13} className="text-ink-faint" />
            SpaceNova &middot; front end build, no back end connected
          </p>
          <p className="text-2xs uppercase tracking-micro text-ink-faint">
            All timestamps are UTC unless stated otherwise.
          </p>
        </div>
      </div>
    </footer>
  );
}
