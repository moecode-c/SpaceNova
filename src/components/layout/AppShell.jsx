import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Check, ChevronDown, LogOut, MapPin, Menu, Moon, PanelLeftClose,
  PanelLeftOpen, RefreshCw, Ruler, Sun, UserCog, X,
} from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Brand } from './Brand.jsx';
import { NAV_GROUPS } from './nav-config.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useApi, useClock, useLocalState } from '../../hooks/useApi.js';
import { admin, events as eventsApi } from '../../api/index.js';
import { Badge, Button, IconButton, Avatar, StatusDot } from '../ui/primitives.jsx';
import { Dropdown, MenuItem, MenuLabel, MenuSeparator, Tooltip } from '../ui/overlay.jsx';
import { useToast, LoadingState } from '../ui/feedback.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { clockUTC, deg, timeShort } from '../../lib/format.js';
import { ROLES } from '../../mock/people.js';

/** Routes that take over the whole frame rather than sitting in the page column. */
const WORKSPACE_PATHS = [/^\/app\/engineering\/vehicles/];

export function AppShell() {
  const location = useLocation();
  const { can, ready } = useAuth();
  const [collapsed, setCollapsed] = useLocalState('spacenova.sidebarCollapsed', false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Until the session resolves the role is unknown, so the shell would briefly
  // render the guest navigation and then swap it. Hold the frame instead.
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <LoadingState label="Restoring your session" />
      </div>
    );
  }

  const groups = NAV_GROUPS.filter((group) => can(group.capability));

  /*
   * A workspace screen takes the whole frame instead of sitting in the page
   * column. The vehicle builder is a canvas you work on rather than a document
   * you scroll, so it gets the full height and manages its own scrolling.
   */
  const workspace = WORKSPACE_PATHS.some((pattern) => pattern.test(location.pathname));

  return (
    <div className={cn('flex bg-base', workspace ? 'h-screen overflow-hidden' : 'min-h-screen')}>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-void/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        groups={groups}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onOpenMobile={() => setMobileOpen(true)}
          collapsed={collapsed}
        />
        <main className={cn('min-w-0 flex-1', workspace && 'min-h-0 overflow-hidden')}>
          <div
            className={cn(
              workspace
                ? 'h-full'
                : 'mx-auto w-full max-w-[112rem] px-4 py-5 sm:px-6 sm:py-6',
            )}
          >
            {/* Keyed on the path so a failed screen recovers on navigation
                rather than staying broken until a reload. */}
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ groups, collapsed, mobileOpen, onCloseMobile }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-line bg-surface transition-[width,transform] duration-200',
        collapsed ? 'lg:w-[4.25rem]' : 'lg:w-60',
        'w-64 lg:static lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-line',
          collapsed ? 'lg:justify-center lg:px-0' : 'px-4',
        )}
      >
        <Brand compact={collapsed} />
        <IconButton icon={X} label="Close navigation" size="sm" className="ml-auto lg:hidden" onClick={onCloseMobile} />
      </div>

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 py-4" aria-label="Main">
        {groups.map((group) => (
          <div key={group.id} className="space-y-1">
            {!collapsed && <p className="label-caps px-2 pb-1">{group.label}</p>}
            {collapsed && <div className="mx-auto mb-1 h-px w-5 bg-line" aria-hidden />}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-2.5 rounded-md py-2 text-xs font-medium transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-2.5',
                    isActive
                      ? 'bg-primary-soft/50 text-primary-bright'
                      : 'text-ink-faint hover:bg-overlay/60 hover:text-ink-dim',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && !collapsed && (
                      <span className="absolute -left-2.5 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" aria-hidden />
                    )}
                    <item.icon size={15} className="shrink-0" aria-hidden />
                    {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <FixtureFooter collapsed={collapsed} />
    </aside>
  );
}

/**
 * The build-state footer. It is here, on every screen, because Phase 1 runs on
 * fixture data and nobody should have to remember that.
 */
function FixtureFooter({ collapsed }) {
  const toast = useToast();
  const [resetting, setResetting] = useState(false);

  const reset = async () => {
    setResetting(true);
    try {
      await admin.resetFixtures();
      toast.success('Fixtures rebuilt', 'Reload the page to see the regenerated data.');
    } finally {
      setResetting(false);
    }
  };

  if (collapsed) {
    return (
      <div className="hidden shrink-0 border-t border-line p-2 lg:block">
        <Tooltip label="Phase 1 fixture data. Rebuild the fixtures." side="right">
          <IconButton icon={RefreshCw} label="Rebuild fixtures" size="sm" onClick={reset} disabled={resetting} />
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="shrink-0 space-y-2 border-t border-line p-3">
      <div className="flex items-center gap-2">
        <StatusDot tone="warn" />
        <p className="text-2xs font-medium text-ink-dim">Phase 1, fixture data</p>
      </div>
      <p className="text-2xs leading-relaxed text-ink-faint">
        No back end is connected. Orbital figures are computed locally from synthetic element sets.
      </p>
      <Button size="xs" variant="ghost" icon={RefreshCw} loading={resetting} onClick={reset} className="w-full">
        Rebuild fixtures
      </Button>
    </div>
  );
}

function TopBar({ onToggleSidebar, onOpenMobile, collapsed }) {
  const now = useClock(1000);
  const { user, role, roleLabel, logout, loginAs } = useAuth();
  const { activeLocation, locations, setActiveLocationId, preferences, setPreference } = useSettings();
  const navigate = useNavigate();

  const sky = useApi(() => eventsApi.skyNow(activeLocation?.id), [activeLocation?.id], {
    enabled: !!activeLocation,
  });

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-base/90 px-3 backdrop-blur sm:px-4">
      <IconButton icon={Menu} label="Open navigation" size="sm" className="lg:hidden" onClick={onOpenMobile} />
      <IconButton
        icon={collapsed ? PanelLeftOpen : PanelLeftClose}
        label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        size="sm"
        className="hidden lg:inline-flex"
        onClick={onToggleSidebar}
      />

      {/* Sky conditions at the active location: the single most useful thing an
          observer wants to know before anything else loads. */}
      {sky.data && (
        <div className="hidden items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 md:flex">
          {sky.data.dark ? (
            <Moon size={13} className="text-info" aria-hidden />
          ) : (
            <Sun size={13} className="text-warn" aria-hidden />
          )}
          <span className="text-2xs text-ink-dim">{sky.data.condition.label}</span>
          <span className="tnum font-mono text-2xs text-ink-faint">
            sun {deg(sky.data.sunElevation, 0)}
          </span>
          {sky.data.nextChangeAt && (
            <span className="tnum hidden font-mono text-2xs text-ink-faint lg:inline">
              &rarr; {timeShort(sky.data.nextChangeAt)}
            </span>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Tooltip label="Coordinated Universal Time. Every stored timestamp is UTC.">
          <span className="tnum hidden items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-xs text-ink-dim sm:flex">
            {clockUTC(now)}
            <span className="text-2xs text-ink-faint">UTC</span>
          </span>
        </Tooltip>

        {/* Active observer location. Every look angle and pass on screen is
            relative to this, so it belongs in the chrome and not in a form. */}
        {locations.length > 0 && (
          <Dropdown
            width="w-64"
            trigger={
              <Button size="sm" variant="secondary" icon={MapPin} iconRight={ChevronDown}>
                <span className="max-w-[9rem] truncate">{activeLocation?.name ?? 'No location'}</span>
              </Button>
            }
          >
            <MenuLabel>Observer location</MenuLabel>
            {locations.map((item) => (
              <MenuItem
                key={item.id}
                icon={item.id === activeLocation?.id ? Check : MapPin}
                active={item.id === activeLocation?.id}
                onClick={() => setActiveLocationId(item.id)}
                hint={`${item.latitude.toFixed(1)}, ${item.longitude.toFixed(1)}`}
              >
                {item.name}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem icon={MapPin} onClick={() => navigate('/app/locations')}>
              Manage locations
            </MenuItem>
          </Dropdown>
        )}

        {/* Units and time display. These two were the only settings on the old
            preferences screen that anybody changed often enough to deserve
            being one click from every screen. */}
        <Dropdown
          width="w-56"
          trigger={<IconButton icon={Ruler} label="Display settings" size="md" variant="secondary" />}
        >
          <MenuLabel>Units</MenuLabel>
          {[
            ['metric', 'Metric', 'Kilometres and km/s'],
            ['imperial', 'Imperial', 'Miles and mph'],
          ].map(([value, label, hint]) => (
            <MenuItem
              key={value}
              icon={preferences.units === value ? Check : undefined}
              active={preferences.units === value}
              hint={hint}
              onClick={() => setPreference('units', value)}
            >
              {label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuLabel>Time display</MenuLabel>
          {[
            ['utc', 'UTC', 'What element sets use'],
            ['local', 'Local time', 'The browser timezone'],
          ].map(([value, label, hint]) => (
            <MenuItem
              key={value}
              icon={preferences.timeFormat === value ? Check : undefined}
              active={preferences.timeFormat === value}
              hint={hint}
              onClick={() => setPreference('timeFormat', value)}
            >
              {label}
            </MenuItem>
          ))}
        </Dropdown>

        <Dropdown
          width="w-72"
          trigger={
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-line-strong bg-overlay px-2 py-1.5 transition-colors hover:bg-line-strong"
            >
              <Avatar name={user?.name} size="sm" />
              <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
                <span className="max-w-[8rem] truncate text-2xs font-medium text-ink">{user?.name}</span>
                <span className="text-[0.6rem] text-ink-faint">{roleLabel}</span>
              </span>
              <ChevronDown size={13} className="text-ink-faint" aria-hidden />
            </button>
          }
        >
          <div className="px-3 py-2">
            <p className="truncate text-xs font-medium text-ink">{user?.name}</p>
            <p className="truncate text-2xs text-ink-faint">{user?.email}</p>
            <Badge tone="primary" size="sm" className="mt-2">
              {roleLabel}
            </Badge>
          </div>
          <MenuSeparator />
          <MenuItem icon={UserCog} onClick={() => navigate('/app/profile')}>
            Profile and account
          </MenuItem>
          <MenuSeparator />
          {/* Phase 1 affordance: the five user classes exist but there is no
              back end to sign in against, so each one can be inspected here. */}
          <MenuLabel>Review as another role</MenuLabel>
          {['user', 'researcher', 'engineer', 'admin'].map((key) => (
            <MenuItem
              key={key}
              icon={role === key ? Check : undefined}
              active={role === key}
              onClick={async () => {
                await loginAs(key);
                navigate('/app');
              }}
            >
              {ROLES[key].label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem
            icon={LogOut}
            danger
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            Sign out
          </MenuItem>
        </Dropdown>
      </div>
    </header>
  );
}
