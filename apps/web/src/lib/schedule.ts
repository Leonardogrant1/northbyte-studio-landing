/**
 * Port of the n8n scheduling logic.
 * Picks the next available posting slot for an account based on its postingTimes
 * and the last scheduled post. All slot times are interpreted in the account's timezone.
 */

function parseTimeSlotInTz(dateStr: string, timeSlot: string, timezone: string): Date {
    const [hoursStr, minutesStr] = timeSlot.split(":");
    // Build an ISO-like string in the target timezone using Intl, then parse
    const base = new Date(dateStr + "T00:00:00");
    // Use the date parts from dateStr, apply HH:mm in the given timezone
    const [year, month, day] = dateStr.split("-").map(Number);
    const hours = parseInt(hoursStr);
    const minutes = parseInt(minutesStr);

    // Construct via Intl trick: find the UTC offset at the target date in that timezone
    const sample = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
        timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(sample);
    const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
    const offsetMatch = offsetPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
    let offsetMinutes = 0;
    if (offsetMatch) {
        const sign = offsetMatch[1] === "+" ? 1 : -1;
        offsetMinutes = sign * (parseInt(offsetMatch[2]) * 60 + parseInt(offsetMatch[3] ?? "0"));
    }

    // Build the UTC time that corresponds to HH:mm in the target timezone on that date
    const utc = Date.UTC(year, month - 1, day, hours - Math.floor(offsetMinutes / 60), minutes - (offsetMinutes % 60), 0, 0);
    void base;
    return new Date(utc);
}

function getDateStringInTz(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date); // en-CA gives YYYY-MM-DD
}

function getTimeStringInTz(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date).replace(/^24:/, "00:");
}

export interface ScheduledPost {
    scheduledAt?: number;
}

/**
 * Returns the next ISO datetime string to schedule a post for this account.
 * Returns null if the account has no postingTimes configured.
 */
export function getNextScheduleTime(
    account: { postingTimes?: string[]; timezone?: string },
    last10Posts: ScheduledPost[]
): string | null {
    const postSlots = [...(account.postingTimes ?? [])].sort();
    if (postSlots.length === 0) return null;

    const timezone = account.timezone ?? "UTC";
    const now = new Date();
    const todayStr = getDateStringInTz(now, timezone);

    let startDateStr: string;
    let startSlotIndex: number;

    const sortedPosts = last10Posts
        .filter((p) => p.scheduledAt != null)
        .sort((a, b) => b.scheduledAt! - a.scheduledAt!);

    if (sortedPosts.length === 0) {
        startDateStr = todayStr;
        startSlotIndex = postSlots.findIndex(
            (slot) => parseTimeSlotInTz(todayStr, slot, timezone) > now
        );
        if (startSlotIndex === -1) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            startDateStr = getDateStringInTz(tomorrow, timezone);
            startSlotIndex = 0;
        }
    } else {
        const lastPost = sortedPosts[0];
        const lastDate = new Date(lastPost.scheduledAt!);
        const lastDateStr = getDateStringInTz(lastDate, timezone);
        const lastTimeStr = getTimeStringInTz(lastDate, timezone);
        const lastSlotIndex = postSlots.indexOf(lastTimeStr);

        if (lastSlotIndex !== -1 && lastSlotIndex < postSlots.length - 1) {
            startDateStr = lastDateStr;
            startSlotIndex = lastSlotIndex + 1;
        } else {
            const nextDay = new Date(lastDate);
            nextDay.setDate(nextDay.getDate() + 1);
            startDateStr = getDateStringInTz(nextDay, timezone);
            startSlotIndex = 0;
        }

        // Ensure the candidate is in the future
        let candidate = parseTimeSlotInTz(startDateStr, postSlots[startSlotIndex], timezone);
        if (candidate <= now) {
            let foundFuture = false;
            if (startDateStr === todayStr) {
                for (let i = startSlotIndex; i < postSlots.length; i++) {
                    const slotTime = parseTimeSlotInTz(todayStr, postSlots[i], timezone);
                    if (slotTime > now) {
                        startDateStr = todayStr;
                        startSlotIndex = i;
                        foundFuture = true;
                        break;
                    }
                }
            }
            if (!foundFuture) {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                startDateStr = getDateStringInTz(tomorrow, timezone);
                startSlotIndex = 0;
            }
        }
        void candidate;
    }

    const finalDate = parseTimeSlotInTz(startDateStr, postSlots[startSlotIndex], timezone);
    if (finalDate <= now) return null;
    return finalDate.toISOString();
}
