"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "presets" | "days" | "weeks" | "months" | "range"

export interface DateRangePickerProps {
    from: string   // YYYY-MM-DD
    to: string     // YYYY-MM-DD
    onChange: (from: string, to: string) => void
}

// ─── Date utilities ───────────────────────────────────────────────────────────

const MONTH_FULL = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WD_LABELS = ["M", "T", "W", "T", "F", "S", "S"]

function pad(n: number) { return String(n).padStart(2, "0") }

function mkIso(y: number, m: number, d: number) {
    return `${y}-${pad(m + 1)}-${pad(d)}`
}

function parseIso(s: string): [number, number, number] {
    const [y, m, d] = s.split("-").map(Number)
    return [y, m - 1, d]
}

function todayIso() {
    const d = new Date()
    return mkIso(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(s: string, n: number): string {
    const [y, m, d] = parseIso(s)
    const dt = new Date(y, m, d + n)
    return mkIso(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

function diffDays(a: string, b: string): number {
    const [y1, m1, d1] = parseIso(a)
    const [y2, m2, d2] = parseIso(b)
    return Math.round((+new Date(y2, m2, d2) - +new Date(y1, m1, d1)) / 86400000)
}

function mondayOf(s: string): string {
    const [y, m, d] = parseIso(s)
    const dt = new Date(y, m, d)
    const wd = (dt.getDay() + 6) % 7
    dt.setDate(dt.getDate() - wd)
    return mkIso(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

function daysInMonth(y: number, m: number): number {
    return new Date(y, m + 1, 0).getDate()
}

function firstWeekdayOfMonth(y: number, m: number): number {
    return (new Date(y, m, 1).getDay() + 6) % 7 // Mon=0
}

function displayDate(iso: string): string {
    if (!iso) return "—"
    const [y, m, d] = parseIso(iso)
    const cy = new Date().getFullYear()
    return `${d}. ${MONTH_SHORT[m]}${y !== cy ? ` ${y}` : ""}`
}

function toMMDDYYYY(iso: string): string {
    if (!iso) return ""
    const [y, m, d] = parseIso(iso)
    return `${pad(m + 1)}/${pad(d)}/${y}`
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

interface Cell {
    iso: string
    inCurrentMonth: boolean
}

function buildGrid(y: number, m: number): Cell[][] {
    const fw = firstWeekdayOfMonth(y, m)
    const dim = daysInMonth(y, m)
    const pm = m === 0 ? 11 : m - 1
    const py = m === 0 ? y - 1 : y
    const nm = m === 11 ? 0 : m + 1
    const ny = m === 11 ? y + 1 : y
    const dipm = daysInMonth(py, pm)

    const cells: Cell[] = []
    for (let i = fw - 1; i >= 0; i--) cells.push({ iso: mkIso(py, pm, dipm - i), inCurrentMonth: false })
    for (let d = 1; d <= dim; d++) cells.push({ iso: mkIso(y, m, d), inCurrentMonth: true })
    let nd = 1
    while (cells.length % 7 !== 0) cells.push({ iso: mkIso(ny, nm, nd++), inCurrentMonth: false })

    const weeks: Cell[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    return weeks
}

// ─── Presets ──────────────────────────────────────────────────────────────────

function buildPresets() {
    const t = todayIso()
    const [y, m] = parseIso(t)
    const lm = m === 0 ? 11 : m - 1
    const ly = m === 0 ? y - 1 : y
    const mon = mondayOf(t)
    return [
        { label: "Last 7 Days",   from: addDays(t, -6),                    to: t },
        { label: "Last 30 Days",  from: addDays(t, -29),                   to: t },
        { label: "Last 90 Days",  from: addDays(t, -89),                   to: t },
        { label: "Last Week",     from: addDays(mon, -7),                  to: addDays(mon, -1) },
        { label: "Last Month",    from: mkIso(ly, lm, 1),                  to: mkIso(ly, lm, daysInMonth(ly, lm)) },
        { label: "Year to Date",  from: `${y}-01-01`,                      to: t },
        { label: "All Time",      from: "2024-01-01",                      to: t },
    ]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
    const [open, setOpen] = useState(false)
    const [tab, setTab] = useState<Tab>("presets")

    // Calendar navigation (shared by Days, Weeks, Range)
    const [calY, setCalY] = useState(() => { try { return parseIso(to || todayIso())[0] } catch { return new Date().getFullYear() } })
    const [calM, setCalM] = useState(() => { try { return parseIso(to || todayIso())[1] } catch { return new Date().getMonth() } })

    // Months tab year
    const [mYear, setMYear] = useState(() => { try { return parseIso(to || todayIso())[0] } catch { return new Date().getFullYear() } })

    // Range tab state
    const [rFrom, setRFrom] = useState(from)
    const [rTo, setRTo] = useState(to)
    const [picking, setPicking] = useState<"start" | "end">("start")
    const [hovered, setHovered] = useState<string | null>(null)

    // Weeks tab hover
    const [hovWeek, setHovWeek] = useState<string | null>(null)

    const containerRef = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const h = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", h)
        return () => document.removeEventListener("mousedown", h)
    }, [open])

    // Sync range inputs when props change
    useEffect(() => { setRFrom(from); setRTo(to) }, [from, to])

    function navMonth(dir: 1 | -1) {
        let m = calM + dir, y = calY
        if (m < 0) { m = 11; y-- }
        if (m > 11) { m = 0; y++ }
        setCalM(m); setCalY(y)
    }

    const span = (from && to) ? Math.max(diffDays(from, to) + 1, 1) : 30

    function shiftPrev(e: React.MouseEvent) {
        e.stopPropagation()
        if (!from || !to) return
        onChange(addDays(from, -span), addDays(to, -span))
    }

    function shiftNext(e: React.MouseEvent) {
        e.stopPropagation()
        if (!from || !to) return
        onChange(addDays(from, span), addDays(to, span))
    }

    function select(f: string, t: string) {
        onChange(f, t)
        setOpen(false)
    }

    const grid = buildGrid(calY, calM)
    const presets = buildPresets()

    // Range tab: effective range for highlight preview
    const effFrom = rFrom
    const effTo = (picking === "end" && hovered)
        ? (hovered >= rFrom ? hovered : rFrom)
        : rTo
    const rangeMin = effFrom && effTo ? (effFrom < effTo ? effFrom : effTo) : effFrom
    const rangeMax = effFrom && effTo ? (effFrom < effTo ? effTo : effFrom) : effTo

    // ── Shared sub-elements ──

    const calHeader = (
        <div className="flex items-center justify-between mb-3">
            <button
                onClick={() => navMonth(-1)}
                className="p-1 rounded-lg hover:bg-white/5 text-secondary hover:text-primary transition-colors"
            >
                <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-medium text-primary">{MONTH_FULL[calM]} {calY}</span>
            <button
                onClick={() => navMonth(1)}
                className="p-1 rounded-lg hover:bg-white/5 text-secondary hover:text-primary transition-colors"
            >
                <ChevronRight size={15} />
            </button>
        </div>
    )

    const wdHeader = (
        <div className="grid grid-cols-7 mb-0.5">
            {WD_LABELS.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-medium text-secondary/60 py-1">{d}</div>
            ))}
        </div>
    )

    return (
        <div ref={containerRef} className="relative inline-flex items-center">
            {/* ── Trigger ── */}
            <div className="flex items-center bg-accent rounded-full text-white text-sm font-medium select-none overflow-hidden">
                <button
                    onClick={shiftPrev}
                    className="px-2.5 py-1.5 hover:bg-white/15 transition-colors"
                    aria-label="Previous period"
                >
                    <ChevronLeft size={14} strokeWidth={2.5} />
                </button>
                <button
                    onClick={() => setOpen(o => !o)}
                    className="px-1.5 py-1.5 whitespace-nowrap"
                >
                    {displayDate(from)} – {displayDate(to)}
                </button>
                <button
                    onClick={shiftNext}
                    className="px-2.5 py-1.5 hover:bg-white/15 transition-colors"
                    aria-label="Next period"
                >
                    <ChevronRight size={14} strokeWidth={2.5} />
                </button>
            </div>

            {/* ── Popover ── */}
            {open && (
                <div className="absolute top-full right-0 mt-2 z-50 bg-surface2 border border-border rounded-2xl shadow-2xl overflow-hidden w-72">

                    {/* Tab bar */}
                    <div className="flex border-b border-border">
                        {(["presets", "days", "weeks", "months", "range"] as Tab[]).map(t => (
                            <button
                                key={t}
                                onClick={() => {
                                    setTab(t)
                                    if (t === "range") { setRFrom(from); setRTo(to); setPicking("start") }
                                }}
                                className={`flex-1 py-2.5 text-[11px] font-medium transition-colors relative
                                    ${tab === t ? "text-accent" : "text-secondary hover:text-primary"}`}
                            >
                                {t === "presets" ? "Presets" :
                                 t === "days"    ? "Days"    :
                                 t === "weeks"   ? "Weeks"   :
                                 t === "months"  ? "Months"  : "Range"}
                                {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
                            </button>
                        ))}
                    </div>

                    <div className="p-3">

                        {/* ─── PRESETS ─── */}
                        {tab === "presets" && (
                            <div className="space-y-0.5">
                                {presets.map(p => {
                                    const active = from === p.from && to === p.to
                                    return (
                                        <button
                                            key={p.label}
                                            onClick={() => select(p.from, p.to)}
                                            className={`w-full flex justify-between items-center px-2.5 py-2 rounded-xl text-sm transition-colors
                                                ${active ? "bg-accent text-white" : "hover:bg-white/5 text-primary"}`}
                                        >
                                            <span className="font-medium text-left">{p.label}</span>
                                            <span className={`text-[11px] ml-3 shrink-0 ${active ? "text-white/70" : "text-secondary"}`}>
                                                {displayDate(p.from)} – {displayDate(p.to)}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* ─── DAYS ─── */}
                        {tab === "days" && (
                            <>
                                {calHeader}
                                {wdHeader}
                                {grid.map((week, wi) => (
                                    <div key={wi} className="grid grid-cols-7">
                                        {week.map(cell => {
                                            const sel = cell.iso === from && cell.iso === to
                                            return (
                                                <button
                                                    key={cell.iso}
                                                    onClick={() => select(cell.iso, cell.iso)}
                                                    className={`h-8 flex items-center justify-center text-xs rounded-full transition-colors
                                                        ${sel ? "bg-accent text-white font-semibold" :
                                                          cell.inCurrentMonth ? "text-primary hover:bg-white/5" :
                                                          "text-secondary/30"}`}
                                                >
                                                    {parseIso(cell.iso)[2]}
                                                </button>
                                            )
                                        })}
                                    </div>
                                ))}
                            </>
                        )}

                        {/* ─── WEEKS ─── */}
                        {tab === "weeks" && (
                            <>
                                {calHeader}
                                {wdHeader}
                                {grid.map((week, wi) => {
                                    const wMon = week[0].iso
                                    const wSun = week[6].iso
                                    const sel = from === wMon && to === wSun
                                    const hov = hovWeek === wMon
                                    return (
                                        <div
                                            key={wi}
                                            className={`grid grid-cols-7 rounded-xl cursor-pointer overflow-hidden transition-colors
                                                ${sel ? "bg-accent/15" : hov ? "bg-white/5" : ""}`}
                                            onMouseEnter={() => setHovWeek(wMon)}
                                            onMouseLeave={() => setHovWeek(null)}
                                            onClick={() => select(wMon, wSun)}
                                        >
                                            {week.map(cell => (
                                                <div
                                                    key={cell.iso}
                                                    className={`h-8 flex items-center justify-center text-xs
                                                        ${sel ? "text-accent font-semibold" :
                                                          cell.inCurrentMonth ? "text-primary" :
                                                          "text-secondary/30"}`}
                                                >
                                                    {parseIso(cell.iso)[2]}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })}
                            </>
                        )}

                        {/* ─── MONTHS ─── */}
                        {tab === "months" && (
                            <>
                                <div className="flex items-center justify-between mb-3">
                                    <button
                                        onClick={() => setMYear(y => y - 1)}
                                        className="p-1 rounded-lg hover:bg-white/5 text-secondary hover:text-primary transition-colors"
                                    >
                                        <ChevronLeft size={15} />
                                    </button>
                                    <span className="text-sm font-medium text-primary">{mYear}</span>
                                    <button
                                        onClick={() => setMYear(y => y + 1)}
                                        className="p-1 rounded-lg hover:bg-white/5 text-secondary hover:text-primary transition-colors"
                                    >
                                        <ChevronRight size={15} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {MONTH_SHORT.map((mn, mi) => {
                                        const mFrom = mkIso(mYear, mi, 1)
                                        const mTo   = mkIso(mYear, mi, daysInMonth(mYear, mi))
                                        const sel   = from === mFrom && to === mTo
                                        return (
                                            <button
                                                key={mi}
                                                onClick={() => select(mFrom, mTo)}
                                                className={`flex flex-col items-center px-2 py-2.5 rounded-xl transition-colors
                                                    ${sel ? "bg-accent text-white" : "hover:bg-white/5 text-primary"}`}
                                            >
                                                <span className="text-xs font-medium mb-1.5">{mn}</span>
                                                {/* Decorative dot grid (like ASC) */}
                                                <div className="grid grid-cols-7 gap-[2px]">
                                                    {Array.from({ length: 35 }).map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className={`w-[2px] h-[2px] rounded-full ${sel ? "bg-white/50" : "bg-secondary/25"}`}
                                                        />
                                                    ))}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </>
                        )}

                        {/* ─── RANGE ─── */}
                        {tab === "range" && (
                            <>
                                {/* Date input display */}
                                <div className="flex gap-2 mb-3">
                                    <div className="flex-1">
                                        <p className="text-[10px] text-secondary mb-1">Start Date</p>
                                        <div className={`border rounded-lg px-2 py-1.5 text-xs bg-surface2/50 transition-colors
                                            ${picking === "start" ? "border-accent text-primary" : "border-border text-primary"}`}
                                        >
                                            {rFrom ? toMMDDYYYY(rFrom) : <span className="text-secondary/40">MM/DD/YYYY</span>}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] text-secondary mb-1">End Date</p>
                                        <div className={`border rounded-lg px-2 py-1.5 text-xs bg-surface2/50 transition-colors
                                            ${picking === "end" ? "border-accent text-primary" : "border-border text-primary"}`}
                                        >
                                            {rTo ? toMMDDYYYY(rTo) : <span className="text-secondary/40">MM/DD/YYYY</span>}
                                        </div>
                                    </div>
                                </div>

                                {calHeader}
                                {wdHeader}

                                {grid.map((week, wi) => (
                                    <div key={wi} className="grid grid-cols-7">
                                        {week.map((cell) => {
                                            const isStart = rangeMin && cell.iso === rangeMin
                                            const isEnd   = rangeMax && cell.iso === rangeMax && rangeMin !== rangeMax
                                            const inRange = !!(rangeMin && rangeMax && rangeMin !== rangeMax && cell.iso > rangeMin && cell.iso < rangeMax)

                                            return (
                                                <div
                                                    key={cell.iso}
                                                    className={`h-8 flex items-center justify-center ${inRange ? "bg-accent/15" : ""}`}
                                                >
                                                    <button
                                                        onClick={() => {
                                                            if (picking === "start") {
                                                                setRFrom(cell.iso)
                                                                setRTo("")
                                                                setPicking("end")
                                                            } else {
                                                                const [newFrom, newTo] = cell.iso >= rFrom
                                                                    ? [rFrom, cell.iso]
                                                                    : [cell.iso, rFrom]
                                                                setRFrom(newFrom)
                                                                setRTo(newTo)
                                                                setPicking("start")
                                                                setHovered(null)
                                                            }
                                                        }}
                                                        onMouseEnter={() => picking === "end" && setHovered(cell.iso)}
                                                        onMouseLeave={() => picking === "end" && setHovered(null)}
                                                        className={`h-8 w-8 flex items-center justify-center text-xs rounded-full transition-colors
                                                            ${isStart || isEnd
                                                                ? "bg-accent text-white font-semibold"
                                                                : inRange
                                                                ? "text-primary"
                                                                : cell.inCurrentMonth
                                                                ? "text-primary hover:bg-white/5"
                                                                : "text-secondary/30"}`}
                                                    >
                                                        {parseIso(cell.iso)[2]}
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}

                                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                                    <button
                                        onClick={() => { setRFrom(from); setRTo(to); setPicking("start"); setHovered(null); setOpen(false) }}
                                        className="flex-1 py-1.5 text-xs text-secondary border border-border rounded-lg hover:text-primary transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => { if (rFrom && rTo) { onChange(rFrom, rTo); setOpen(false) } }}
                                        disabled={!rFrom || !rTo}
                                        className="flex-1 py-1.5 text-xs bg-accent text-white rounded-lg disabled:opacity-40 hover:bg-accent/90 transition-colors font-medium"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            )}
        </div>
    )
}
