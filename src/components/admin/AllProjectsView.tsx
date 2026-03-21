"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "./MetricCard";
import { OverviewResult } from "@/app/api/analytics/overview/route";
import { ExpensesResult, ExpenseItem } from "@/app/api/analytics/expenses/route";
import { ProfitResult } from "@/app/api/analytics/profit/route";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
    range: string;
    currency: string;
    customFrom?: string;
    customTo?: string;
}

export function AllProjectsView({ range, currency, customFrom, customTo }: Props) {
    const [data, setData] = useState<OverviewResult | null>(null);
    const [expensesData, setExpensesData] = useState<ExpensesResult | null>(null);
    const [profitData, setProfitData] = useState<ProfitResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [expensesLoading, setExpensesLoading] = useState(true);
    const [profitLoading, setProfitLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams({ range, currency });
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
        console.log(`/api/analytics/overview?${params}`)
        fetch(`/api/analytics/overview?${params}`)
            .then((r) => r.json())
            .then((d) => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [range, currency, customFrom, customTo]);

    useEffect(() => {
        setExpensesLoading(true);
        const params = new URLSearchParams({ range, currency });
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);

        fetch(`/api/analytics/expenses?${params}`)
            .then((r) => r.json())
            .then((d) => { setExpensesData(d); setExpensesLoading(false); })
            .catch(() => setExpensesLoading(false));
    }, [range, currency, customFrom, customTo]);

    useEffect(() => {
        setProfitLoading(true);
        const params = new URLSearchParams({ range, currency });
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);

        fetch(`/api/analytics/profit?${params}`)
            .then((r) => r.json())
            .then((d) => { setProfitData(d); setProfitLoading(false); })
            .catch(() => setProfitLoading(false));
    }, [range, currency, customFrom, customTo]);

    const handleDeleteExpense = async (id: string) => {
        if (!confirm("Are you sure you want to delete this expense?")) return;

        try {
            const res = await fetch(`/api/expenses/delete-expense?id=${id}`, {
                method: "DELETE",
            });
            const result = await res.json();

            if (res.ok) {
                toast.success("Expense deleted successfully");
                setExpensesData(prev => prev ? {
                    ...prev,
                    expenses: prev.expenses.filter(e => e._id !== id)
                } : null);
            } else {
                toast.error(result.error || "Failed to delete expense");
            }
        } catch (error) {
            toast.error("Failed to delete expense");
            console.error("Delete error:", error);
        }
    };

    const formatRevenue = (value: number) =>
        `${currency === "USD" ? "$" : ""}${value.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${currency !== "USD" ? currency : ""}`.trim();

    const formatUsd = (value: number) =>
        `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

    const sortedExpenses = expensesData?.expenses
        ? [...expensesData.expenses].sort((a, b) => b.date.localeCompare(a.date))
        : [];


    return (
        <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricCard
                    label="Total Revenue"
                    value={loading ? "—" : formatRevenue(data?.totalRevenue ?? 0)}
                    sparkline={[0]}
                    secondaryLabel="Proceeds"
                    secondaryValue={loading ? undefined : formatRevenue(data?.totalProceeds ?? 0)}
                    subtitle={loading ? "Loading…" : `across ${data?.appCount ?? 0} app${data?.appCount !== 1 ? "s" : ""}`}
                    sparklineColor="#5EE7FF"
                />
                <MetricCard
                    label="Total Expenses"
                    value={expensesLoading ? "—" : formatRevenue(expensesData?.total ?? 0)}
                    sparkline={[0]}
                    subtitle={expensesLoading ? "Loading…" : `${sortedExpenses.length} expense${sortedExpenses.length !== 1 ? "s" : ""} in period`}
                    sparklineColor="#FF6B6B"
                />
                <MetricCard
                    label="Profit"
                    value={profitLoading ? "—" : formatRevenue(profitData?.profit ?? 0)}
                    sparkline={[0]}
                    subtitle={profitLoading ? "Loading…" : ((profitData?.profit ?? 0) >= 0 ? "Revenue minus expenses" : "Net loss")}
                    sparklineColor={profitLoading || (profitData?.profit ?? 0) >= 0 ? "#4ADE80" : "#FF6B6B"}
                    valueColor={profitLoading ? undefined : (profitData?.profit ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
                />
            </div>

            {/* Expenses list */}
            <div>
                <h2 className="text-lg font-semibold mb-4">Expenses</h2>
                {expensesLoading ? (
                    <p className="text-secondary text-sm">Loading…</p>
                ) : sortedExpenses.length === 0 ? (
                    <p className="text-secondary text-sm">No expenses in this period.</p>
                ) : (
                    <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-secondary">
                                    <th className="text-left px-6 py-3 font-medium">Date</th>
                                    <th className="text-left px-6 py-3 font-medium">Description</th>
                                    <th className="text-left px-6 py-3 font-medium">Vendor</th>
                                    <th className="text-left px-6 py-3 font-medium">Category</th>
                                    <th className="text-right px-6 py-3 font-medium">Amount (USD)</th>
                                    <th className="text-right px-6 py-3 font-medium">Original</th>
                                    <th className="text-center px-6 py-3 font-medium w-16"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedExpenses.map((expense: ExpenseItem, i) => (
                                    <tr
                                        key={expense._id}
                                        className={`transition-colors hover:bg-surface2 ${i < sortedExpenses.length - 1 ? "border-b border-border" : ""}`}
                                    >
                                        <td className="px-6 py-3 text-secondary">{expense.date}</td>
                                        <td className="px-6 py-3">{expense.description}</td>
                                        <td className="px-6 py-3 text-secondary">{expense.vendorName}</td>
                                        <td className="px-6 py-3 text-secondary">{expense.categoryName}</td>
                                        <td className="px-6 py-3 text-right font-mono">{formatUsd(expense.amount_usd)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-secondary">
                                            {expense.original_currency === "USD"
                                                ? "—"
                                                : `${expense.original_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${expense.original_currency}`}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <button
                                                onClick={() => handleDeleteExpense(expense._id)}
                                                className="text-secondary hover:text-red-500 transition-colors"
                                                title="Delete expense"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
