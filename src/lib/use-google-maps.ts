import { useEffect, useState } from "react";

import { loadGoogleMaps } from "./google-maps-loader";

// True once the Maps JS API + Places library are ready to use; stays false
// forever if there's no key or the script failed, so components can render
// their fallback UI instead of calling into a `google` global that doesn't exist.
export function useGoogleMapsLoaded(): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadGoogleMaps().then((ok) => {
      if (active) setLoaded(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  return loaded;
}
