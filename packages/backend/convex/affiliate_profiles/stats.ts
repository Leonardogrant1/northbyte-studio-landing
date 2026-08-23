import { Doc } from "../_generated/dataModel";

export interface StatsFilter {
  fromMs?: number;
  toMs?: number;
  environment?: string;
}

export interface AffiliateStats {
  earned: number | null; // null bei "flat" — Pauschale hat keine Provisionsberechnung
  revenue: number;       // voller Umsatz (Summe price) über konvertierte Referrals — nur Admin-Sicht
  proceeds: number;      // Umsatz nach Store-Abzug (price * takehomePercentage) — nur Admin-Sicht
  net: number;           // Proceeds minus Affiliate-Cut (bei "flat": minus Deal-Betrag, kann negativ sein) — nur Admin-Sicht
  linkViews: number;     // Landing-Page-Views über /c/[code] (Summe viewCount aller Leads)
  storeClicks: number;   // Sessions, die danach Richtung App/Play Store gegangen sind
  clickThroughRate: number; // Views → Store-Klicks in %
  referredUsers: number;
  activeTrials: number;  // Referrals aktuell in der Testphase (status "on_trial")
  convertedUsers: number;
  conversionRate: number;
  trialConversionRate: number; // konvertierte Trials ÷ gestartete Trials — wie viele Tester werden Zahler
  cancelRate: number;    // Kündigungen von Zahlern ÷ Zahler — Trial-Abbrüche zählen nicht
  refundRate: number;
}

// Gemeinsame Stats-Berechnung für das Affiliate-Dashboard (getMyStats)
// und die Admin-Übersicht (getAllWithStats), damit beide identisch rechnen.
export function computeStats(
  profile: Doc<"affiliate_profiles">,
  allReferrals: Doc<"affiliate_referral">[],
  allLeads: Doc<"affiliate_lead">[],
  filter: StatsFilter,
): AffiliateStats {
  const referrals = allReferrals.filter((r) => {
    if (filter.fromMs !== undefined && r.createdAt < filter.fromMs) return false;
    if (filter.toMs !== undefined && r.createdAt > filter.toMs) return false;
    if (filter.environment !== undefined && (r.environment ?? "PRODUCTION") !== filter.environment) return false;
    return true;
  });

  // Leads haben kein Environment — nur der Datumsfilter greift.
  const leads = allLeads.filter((l) => {
    if (filter.fromMs !== undefined && l.createdAt < filter.fromMs) return false;
    if (filter.toMs !== undefined && l.createdAt > filter.toMs) return false;
    return true;
  });

  const converted = referrals.filter((r) => r.convertedAt !== undefined);
  // Nur Kündigungen von Zahlern — Trial-Abbrecher haben cancelledAt, aber nie
  // convertedAt, und würden die Rate sonst über 100 % treiben.
  const cancelled = referrals.filter((r) => r.cancelledAt !== undefined && r.convertedAt !== undefined);
  const refunded = referrals.filter((r) => r.refundedAt !== undefined);
  const trialsStarted = referrals.filter((r) => r.trialStartedAt !== undefined);
  const trialsConverted = trialsStarted.filter((r) => r.convertedAt !== undefined);
  // hasConverted=true: first payment received and not refunded — affiliate is owed commission
  const earnedReferrals = referrals.filter((r) => r.hasConverted === true);

  // Earnings: commission on developer takehome (after store cut), only for non-refunded conversions.
  // takehome = price * takehomePercentage (e.g. 58.93 * 0.85 = 50.09 USD)
  let earned: number | null = null;
  if (profile.commissionType !== "flat") {
    earned = earnedReferrals.reduce((sum, r) => {
      if (!r.price) return sum;
      const takehome = r.price * (r.takehomePercentage ?? 1);
      if (profile.commissionType === "percentage") {
        return sum + (takehome * profile.commissionAmount) / 100;
      }
      return sum + profile.commissionAmount;
    }, 0);
  }

  // Business-Sicht: voller Umsatz und Proceeds über dieselben Referrals wie earned.
  const revenue = earnedReferrals.reduce((sum, r) => sum + (r.price ?? 0), 0);
  const proceeds = earnedReferrals.reduce(
    (sum, r) => sum + (r.price ?? 0) * (r.takehomePercentage ?? 1),
    0,
  );
  const net =
    profile.commissionType === "flat"
      ? proceeds - profile.commissionAmount
      : proceeds - (earned ?? 0);

  const referredCount = referrals.length;
  const convertedCount = converted.length;

  const linkViews = leads.reduce((sum, l) => sum + l.viewCount, 0);
  const storeClicks = leads.filter((l) => l.status === "store_clicked").length;

  return {
    earned,
    revenue,
    proceeds,
    net,
    linkViews,
    storeClicks,
    clickThroughRate: linkViews > 0 ? (storeClicks / linkViews) * 100 : 0,
    referredUsers: referredCount,
    activeTrials: referrals.filter((r) => r.status === "on_trial").length,
    convertedUsers: convertedCount,
    conversionRate: referredCount > 0 ? (convertedCount / referredCount) * 100 : 0,
    trialConversionRate: trialsStarted.length > 0 ? (trialsConverted.length / trialsStarted.length) * 100 : 0,
    cancelRate: convertedCount > 0 ? (cancelled.length / convertedCount) * 100 : 0,
    refundRate: convertedCount > 0 ? (refunded.length / convertedCount) * 100 : 0,
  };
}
