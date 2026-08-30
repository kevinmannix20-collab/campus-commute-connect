// Carbon savings are an estimate, not a measurement — there's no telemetry
// on what a rider would have driven alone. EPA's average passenger vehicle
// figure is ~404g CO2/mile; we assume a completed shared trip avoids one
// ~5-mile solo campus-commute drive that would otherwise have happened,
// which nets out to a round 5 lbs CO2 avoided per completed trip. Retune
// this once there's real survey data on what riders would have done
// otherwise.
const LBS_CO2_PER_TRIP = 5;
const LBS_CO2_PER_MILE = 404 / 453.6; // ~0.89 lbs/mile

export function carbonSavedLbs(completedTripCount: number): number {
  return completedTripCount * LBS_CO2_PER_TRIP;
}

export function milesNotDrivenEquivalent(lbsSaved: number): number {
  return Math.round(lbsSaved / LBS_CO2_PER_MILE);
}

export const CO2_EXPLANATION =
  "A rough estimate, not a measurement: about 5 lbs CO₂ per completed trip, based on the EPA's ~0.9 lbs/mile average for a passenger vehicle and a typical ~5-mile campus commute avoided by sharing a ride instead of driving solo.";

const ASSUMED_MILES_PER_GALLON = 25;

export function haversineDistanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function estimateGasGallons(distanceMiles: number): number {
  return distanceMiles / ASSUMED_MILES_PER_GALLON;
}
