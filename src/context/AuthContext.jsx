import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../api/index.js';
import { ROLES } from '../mock/people.js';

const AuthContext = createContext(null);

/** Capabilities per role, mirroring the privilege table in SRS section 2.6. */
const CAPABILITIES = {
  guest: ['public'],
  user: ['public', 'observe'],
  researcher: ['public', 'observe', 'research'],
  engineer: ['public', 'observe', 'engineering'],
  // An administrator runs the platform; they do not get another role's private
  // work. SRS section 2.6 gives every account exactly one role, and the Admin
  // privilege list names account, catalogue, source and threshold management,
  // never research workspaces or element-set diagnostics.
  admin: ['public', 'observe', 'admin'],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    auth
      .current()
      .then(({ data }) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await auth.login(credentials);
    setUser(data);
    return data;
  }, []);

  const loginAs = useCallback(async (role) => {
    const { data } = await auth.loginAs(role);
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => {
    const role = user?.role ?? 'guest';
    const capabilities = CAPABILITIES[role] ?? CAPABILITIES.guest;
    return {
      user,
      ready,
      role,
      roleLabel: ROLES[role]?.label ?? 'Guest',
      isGuest: !user,
      capabilities,
      can: (capability) => capabilities.includes(capability),
      login,
      loginAs,
      logout,
      setUser,
    };
  }, [user, ready, login, loginAs, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export { CAPABILITIES };
