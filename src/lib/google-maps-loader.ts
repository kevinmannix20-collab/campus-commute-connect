// Loads the Google Maps JavaScript API (with the Places library) once per
// page load, no matter how many components ask for it. Resolves to false —
// never throws — when there's no API key or the script fails to load, so
// callers can fall back to plain text inputs instead of breaking the form.

let loadPromise: Promise<boolean> | null = null;

export function loadGoogleMaps(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  if (window.google?.maps?.places) return Promise.resolve(true);

  if (loadPromise) return loadPromise;

  const apiKey = import.meta.env["VITE_GOOGLE_MAPS_API_KEY"];
  if (!apiKey) {
    console.warn(
      "[google-maps] VITE_GOOGLE_MAPS_API_KEY is not set — falling back to plain text location inputs. See README for setup.",
    );
    loadPromise = Promise.resolve(false);
    return loadPromise;
  }

  loadPromise = new Promise((resolve) => {
    const callbackName = "__commuteMateGoogleMapsLoaded__";
    (window as unknown as Record<string, () => void>)[callbackName] = () => resolve(true);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      console.error(
        "[google-maps] Failed to load the Google Maps script — check the API key and network access.",
      );
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
