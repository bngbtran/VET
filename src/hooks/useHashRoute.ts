import { useCallback, useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => decodeURIComponent(window.location.hash.slice(1));

/** The URL hash as a tiny router: "#ve-san-pham" → "ve-san-pham". Back/forward work. */
export function useHashRoute(): [string, (route: string) => void] {
  const route = useSyncExternalStore(subscribe, getHash);
  const navigate = useCallback((next: string) => {
    if (next) window.location.hash = next;
    else history.pushState(null, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);
  return [route, navigate];
}
