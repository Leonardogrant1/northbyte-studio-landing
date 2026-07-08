export interface SparklineProps {
    data: number[];
    color?: string;
    width?: number;
    height?: number;
}

export function SparklineChart({ data, color = "#5EE7FF", width = 80, height = 40 }: SparklineProps) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = 2;

    const points = data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (width - pad * 2);
        const y = pad + ((max - v) / range) * (height - pad * 2);
        return `${x},${y}`;
    });

    const polylinePoints = points.join(" ");
    const firstX = pad;
    const lastX = width - pad;
    const bottomY = height - pad;
    const areaPath = `M ${points[0]} L ${points.join(" L ")} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <path d={areaPath} fill={color} fillOpacity={0.15} />
            <polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}
