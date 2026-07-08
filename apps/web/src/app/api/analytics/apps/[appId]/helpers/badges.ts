export function ltvBadge(v: number): string {
    if (v >= 40) return "Good";
    if (v >= 20) return "Average";
    if (v >= 10) return "Below Avg";
    return "Poor";
}

export function rpiBadge(v: number): string {
    if (v >= 0.20) return "Good";
    if (v >= 0.10) return "Average";
    return "Below Avg";
}

export function d2tBadge(v: number): string {
    if (v >= 10) return "Good";
    if (v >= 5) return "Average";
    return "Poor";
}

export function t2pBadge(v: number): string {
    if (v >= 20) return "Good";
    if (v >= 10) return "Average";
    return "Poor";
}
