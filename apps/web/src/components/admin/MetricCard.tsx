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
    valueColor?: string;
    secondaryValue?: string;
    secondaryLabel?: string;
}

export function MetricCard({ label, value, sparkline, badge, subtitle, sparklineColor, valueColor, secondaryValue, secondaryLabel }: MetricCardProps) {
    return (
        <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-6 flex flex-col gap-3 min-w-0">
            <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-secondary font-medium">{label}</span>
                <SparklineChart data={sparkline} color={sparklineColor} />
            </div>
            <div className="flex flex-col gap-2">
                <div className={`text-3xl font-bold tracking-tight ${valueColor ?? ""}`}>{value}</div>
                {secondaryValue && (
                    <div className="flex items-center gap-2 border-t border-border pt-2">
                        <div className="w-1 h-4 rounded-full bg-accent/40 shrink-0" />
                        <div className="flex flex-col min-w-0">
                            {secondaryLabel && <span className="text-[10px] uppercase tracking-wider text-secondary font-medium leading-none mb-0.5">{secondaryLabel}</span>}
                            <span className="text-xl font-bold tracking-tight">{secondaryValue}</span>
                        </div>
                    </div>
                )}
                {badge && (
                    <span className={`text-xs font-semibold inline-block ${BADGE_COLORS[badge] ?? "text-secondary"}`}>
                        {badge}
                    </span>
                )}
            </div>
            <p className="text-xs text-secondary">{subtitle}</p>
        </div>
    );
}
