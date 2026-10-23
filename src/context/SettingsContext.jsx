import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { locations as locationsApi } from '../api/index.js';
import { useLocalState } from '../hooks/useApi.js';

const SettingsContext = createContext(null);

/**
 * Viewer preferences and the active observer location.
 *
 * Preferences live in localStorage because they are per-viewer conveniences,
 * wrapped so a private window or blocked storage degrades to the defaults
 * rather than throwing. The thresholds that affect computation are NOT here:
 * those are server data, edited from the administration screens.
 */
export function SettingsProvider({ children }) {
  const [preferences, setPreferences] = useLocalState('spacenova.preferences', {
    units: 'metric',
    timeFormat: 'utc',
    reducedMotion: false,
    largeText: false,
    mapMode: 'flat',
    showTerminator: true,
    showGraticule: true,
    showFootprints: true,
    showLabels: true,
  });

  const [activeLocationId, setActiveLocationId] = useLocalState('spacenova.activeLocation', null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    locationsApi
      .list()
      .then(({ data }) => {
        if (cancelled) return;
        setLocations(data);
        setActiveLocationId((current) => {
          if (current && data.some((l) => l.id === current)) return current;
          return (data.find((l) => l.isDefault) ?? data[0])?.id ?? null;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeLocation = useMemo(
    () => locations.find((l) => l.id === activeLocationId) ?? locations[0] ?? null,
    [locations, activeLocationId],
  );

  const observer = useMemo(() => {
    if (!activeLocation) return null;
    return {
      latitude: activeLocation.latitude,
      longitude: activeLocation.longitude,
      altitudeM: activeLocation.altitudeM,
      horizonMask: activeLocation.horizonMask,
      name: activeLocation.name,
      minElevationDeg: activeLocation.minElevationDeg,
    };
  }, [activeLocation]);

  // The large-text and reduced-motion preferences are accessibility settings
  // from SRS section 6.4, so they change the document rather than one screen.
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = preferences.largeText ? '17px' : '';
    root.dataset.reducedMotion = preferences.reducedMotion ? 'true' : 'false';
  }, [preferences.largeText, preferences.reducedMotion]);

  const value = useMemo(
    () => ({
      preferences,
      setPreference: (key, next) => setPreferences((p) => ({ ...p, [key]: next })),
      setPreferences,
      locations,
      setLocations,
      loading,
      activeLocation,
      activeLocationId: activeLocation?.id ?? null,
      setActiveLocationId,
      observer,
      refreshLocations: () =>
        locationsApi.list().then(({ data }) => {
          setLocations(data);
          return data;
        }),
    }),
    [preferences, setPreferences, locations, loading, activeLocation, setActiveLocationId, observer],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
