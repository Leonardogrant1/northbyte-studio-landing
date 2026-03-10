import { SparklineChart } from "./SparklineChart";

const BADGE_COLORS: Record<string, string> = {
    "Good": "text-emerald-400",
    "Average": "text-yellow-400",
    "Below Avg": "text-orange-400",
    "Poor": "text-red-400",
};

export interface MetricCardProps {
    label: string;
    value: string;
    sparkline: number[];
    badge?: string | null;
    subtitle: string;
    sparklineColor?: string;
}

export function MetricCard({ label, value, sparkline, badge, subtitle, sparklineColor }: MetricCardProps) {
    return (
        <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-6 flex flex-col gap-3 min-w-0">
            <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-secondary font-medium">{label}</span>
                <SparklineChart data={sparkline} color={sparklineColor} />
            </div>
            <div>
                <div className="text-3xl font-bold tracking-tight">{value}</div>
                {badge && (
                    <span className={`text-xs font-semibold mt-1 inline-block ${BADGE_COLORS[badge] ?? "text-secondary"}`}>
                        {badge}
                    </span>
                )}
            </div>
            <p className="text-xs text-secondary">{subtitle}</p>
        </div>
    );
}
