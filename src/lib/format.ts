/** Display helpers. These format values that ALWAYS come from official sources. */

/** Format a dollar amount compactly, e.g. 500000 -> "$500K", 2000000 -> "$2M". */
export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${trimZero(m)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `$${trimZero(k)}K`;
  }
  return `$${n.toLocaleString("en-US")}`;
}

function trimZero(x: number): string {
  // 2.0 -> "2", 1.5 -> "1.5"
  return x % 1 === 0 ? String(x) : x.toFixed(1);
}

/**
 * Format an award range as "$500K – $2M". Never collapses to a single
 * "potential value" — a range is always shown when we have bounds.
 */
export function formatRange(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  const hasMin = min !== null && min !== undefined;
  const hasMax = max !== null && max !== undefined;
  if (hasMin && hasMax) {
    if (min === max) return formatMoney(min);
    return `${formatMoney(min)} – ${formatMoney(max)}`;
  }
  if (hasMax) return `Up to ${formatMoney(max)}`;
  if (hasMin) return `From ${formatMoney(min)}`;
  return "Not specified";
}

/** Format an ISO-ish date string to a readable date, or return the raw value. */
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  // Grants.gov often returns MMDDYYYY; try to normalize common shapes.
  const mmddyyyy = /^(\d{2})(\d{2})(\d{4})$/.exec(value.trim());
  let date: Date | null = null;
  if (mmddyyyy) {
    const [, mm, dd, yyyy] = mmddyyyy;
    date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  } else {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date || Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Describe an award using ONLY the opportunity's own official floor/ceiling.
 * Returns which label to use and the money string. Never infers a figure.
 *   both  -> range   "$500K – $2M"
 *   ceil  -> ceiling  "$2M"
 *   floor -> floor    "$500K"
 *   none  -> none     (UI shows "Not specified")
 */
export function awardParts(
  floor: number | null | undefined,
  ceiling: number | null | undefined
): { kind: "range" | "ceiling" | "floor" | "none"; value: string } {
  const hasFloor = floor !== null && floor !== undefined;
  const hasCeil = ceiling !== null && ceiling !== undefined;
  if (hasFloor && hasCeil) {
    return {
      kind: "range",
      value: floor === ceiling ? formatMoney(floor) : `${formatMoney(floor)} – ${formatMoney(ceiling)}`,
    };
  }
  if (hasCeil) return { kind: "ceiling", value: formatMoney(ceiling) };
  if (hasFloor) return { kind: "floor", value: formatMoney(floor) };
  return { kind: "none", value: "" };
}

/** Today's date, formatted for the "Last checked" footer. */
export function todayFormatted(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
