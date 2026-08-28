// Blends rating quality with driving volume into a single ~0-5 score, used
// to sort the browse list and to surface frequent drivers' own ride
// requests. The 70/30 weighting, RIDES_CAP, and the tier thresholds below
// are initial estimates, not calibrated against real usage — expect to
// retune all of these once there's actual data to look at.

export const RIDES_CAP = 20;
const RATING_WEIGHT = 0.7;
const VOLUME_WEIGHT = 0.3;

export function priorityScore(averageRating: number | null, ridesGiven: number): number {
  const rating = averageRating ?? 0;
  const volume = Math.min(ridesGiven, RIDES_CAP) / RIDES_CAP;
  return rating * RATING_WEIGHT + volume * 5 * VOLUME_WEIGHT;
}

export type DriverTier = "gold" | "silver" | "bronze" | null;

const GOLD_MIN_RIDES = 15;
const GOLD_MIN_RATING = 4.5;
const SILVER_MIN_RIDES = 5;
const SILVER_MIN_RATING = 4.0;
const BRONZE_MIN_RIDES = 1;

export function driverTier(averageRating: number | null, ridesGiven: number): DriverTier {
  const rating = averageRating ?? 0;
  if (ridesGiven >= GOLD_MIN_RIDES && rating >= GOLD_MIN_RATING) return "gold";
  if (ridesGiven >= SILVER_MIN_RIDES && rating >= SILVER_MIN_RATING) return "silver";
  if (ridesGiven >= BRONZE_MIN_RIDES) return "bronze";
  return null;
}
