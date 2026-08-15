/**
 * Feature flags.
 *
 * SHOW_HISTORICAL_EVIDENCE: the USAspending historical-evidence section is
 * DISABLED. The award-type/relevance filtering isn't reliable enough (it surfaced
 * large state-government grants as "SBIR historical recipients"), and a wrong
 * number destroys trust. The code path is kept intact; flip this to re-enable
 * once the results can be guaranteed to be (a) genuinely SBIR/STTR and (b) topic-
 * relevant to the startup.
 */
export const SHOW_HISTORICAL_EVIDENCE = false;
