export const SCHOOL_OPTIONS = [
  "The College (Undergraduate)",
  "Anderson School of Management",
  "David Geffen School of Medicine",
  "Fielding School of Public Health",
  "Henry Samueli School of Engineering and Applied Science",
  "Herb Alpert School of Music",
  "Luskin School of Public Affairs",
  "School of Dentistry",
  "School of Education & Information Studies",
  "School of Law",
  "School of Nursing",
  "School of the Arts and Architecture",
  "School of Theater, Film and Television",
  "Other / Staff",
] as const;

export const DEGREE_PURSUIT_OPTIONS = [
  "Undergraduate",
  "Master's",
  "MBA",
  "PhD",
  "Other",
  "Alumni",
] as const;

// Copy shown near the school field at signup — kept as a single named
// constant since the exact wording is expected to change independently
// of the form logic around it.
export const SIGNUP_MISSION_MESSAGE = {
  headline: "Built by Bruins, for Bruins.",
  subline: "Your school helps us keep this community real. Verified identity is next.",
};
