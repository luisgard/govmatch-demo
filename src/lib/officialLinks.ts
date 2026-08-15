/**
 * SOURCE OF TRUTH for official U.S. government base-registration URLs.
 *
 * CORE DESIGN PRINCIPLE: Claude EXPLAINS; official sources DETERMINE.
 * These three URLs are hardcoded here and used DIRECTLY by the code for the
 * base registrations that every federal-grant applicant needs. Claude never
 * generates them and never receives-then-echoes them.
 *
 * Opportunity-specific links use ONLY the `sourceUrl` returned by the
 * Grants.gov API. If the API returns no sourceUrl, the UI shows no link.
 */
export const OFFICIAL_LINKS = {
  loginGov: "https://www.login.gov/",
  samGov: "https://sam.gov/",
  grantsGov: "https://www.grants.gov/",
} as const;

export type OfficialLinkKey = keyof typeof OFFICIAL_LINKS;
