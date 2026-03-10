export type Range = "today" | "3d" | "7d" | "30d" | "custom";

export function toIsoDate(d: Date): string {
    return d.toISOString().split("T")[0];
}

export function getRangeDates(range: Range, fromParam?: string, toParam?: string) {
    const now = new Date();
    const todayStr = toIsoDate(now);

    if (range === "custom" && fromParam && toParam) {
        return { startDate: fromParam, endDate: toParam, phFrom: fromParam, phTo: toParam };
    }

    const daysMap: Record<string, number> = { today: 1, "3d": 3, "7d": 7, "30d": 30 };
    const days = daysMap[range] ?? 7;
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return {
        startDate: toIsoDate(start),
        endDate: todayStr,
        phFrom: `-${days}d`,
        phTo: todayStr,
    };
}
