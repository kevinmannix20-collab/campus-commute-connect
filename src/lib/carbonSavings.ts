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
