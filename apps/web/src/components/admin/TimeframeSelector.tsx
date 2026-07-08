import { CalendarDays } from "lucide-react";

export type Preset = "today" | "3d" | "7d" | "30d" | "custom";

export const PRESETS: { key: Preset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "3d", label: "Last 3 Days" },
    { key: "7d", label: "Last Week" },
    { key: "30d", label: "Last 30 Days" },
    { key: "custom", label: "Custom" },
];

export interface TimeframeSelectorProps {
    value: Preset;
    customFrom: string;
    customTo: string;
    onChange: (preset: Preset, from?: string, to?: string) => void;
}

export function TimeframeSelector({ value, customFrom, customTo, onChange }: TimeframeSelectorProps) {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-surface2/50 border border-border rounded-xl p-1">
                {PRESETS.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => onChange(key, customFrom, customTo)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${value === key
                                ? "bg-accent/10 text-accent"
                                : "text-secondary hover:text-primary"
                            }`}
                    >
                        {key === "custom" && <CalendarDays size={13} />}
                        {label}
                    </button>
                ))}
            </div>

            {value === "custom" && (
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => onChange("custom", e.target.value, customTo)}
                        className="bg-surface2/50 border border-border rounded-xl px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent/50 transition-colors [color-scheme:dark]"
                    />
                    <span className="text-secondary text-sm">→</span>
                    <input
                        type="date"
                        value={customTo}
                        onChange={(e) => onChange("custom", customFrom, e.target.value)}
                        className="bg-surface2/50 border border-border rounded-xl px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent/50 transition-colors [color-scheme:dark]"
                    />
                </div>
            )}
        </div>
    );
}
