"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { Loader2, ArrowLeft, Send, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function TicketDetailPage() {
    const params = useParams();
    const router = useRouter();
    const ticketId = params.ticketId as Id<"tickets">;

    const currentUser = useCurrentUser();
    const isAllowed = currentUser?.type === "admin" || currentUser?.type === "support";

    const ticket  = useQuery(api.tickets.queries.getById,              isAllowed ? { ticketId } : "skip");
    const messages = useQuery(api.ticket_messages.queries.getForTicket, isAllowed ? { ticketId } : "skip");
    const closeMutation  = useMutation(api.tickets.mutations.close);
    const reopenMutation = useMutation(api.tickets.mutations.reopen);
    const sendAction     = useAction(api.ticket_messages.actions.sendWithNotification);

    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);
    const [closing, setClosing] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to newest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages?.length]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim()) return;
        setSending(true);
        try {
            await sendAction({ ticketId, body: body.trim() });
            setBody("");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Senden.");
        } finally {
            setSending(false);
        }
    };

    const handleClose = async () => {
        setClosing(true);
        try {
            await closeMutation({ ticketId });
            toast.success("Ticket geschlossen.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler.");
        } finally {
            setClosing(false);
        }
    };

    const handleReopen = async () => {
        setClosing(true);
        try {
            await reopenMutation({ ticketId });
            toast.success("Ticket wieder geöffnet.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler.");
        } finally {
            setClosing(false);
        }
    };

    const formatTime = (ts: number) =>
        new Date(ts).toLocaleString("de-DE", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });

    if (ticket === undefined || messages === undefined) {
        return (
            <div className="flex items-center gap-2 text-secondary text-sm">
                <Loader2 size={14} className="animate-spin" /> Wird geladen…
            </div>
        );
    }

    if (ticket === null) {
        return <p className="text-secondary text-sm">Ticket nicht gefunden.</p>;
    }

    return (
        <div className="max-w-3xl space-y-6">
            {/* Back */}
            <button
                onClick={() => router.push("/admin/support")}
                className="flex items-center gap-2 text-secondary hover:text-primary text-sm transition-colors"
            >
                <ArrowLeft size={16} /> Zurück zur Übersicht
            </button>

            {/* Ticket Header */}
            <div className="bg-surface2/50 border border-border rounded-2xl p-6 space-y-3">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs text-secondary font-mono mb-1">#{ticket.ticketNumber}</p>
                        <h1 className="text-xl font-bold">{ticket.title}</h1>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {ticket.status === "closed" ? (
                            <>
                                <span className="text-xs font-medium px-2 py-1 rounded-full bg-border/50 text-secondary">
                                    Geschlossen
                                </span>
                                <button
                                    onClick={handleReopen}
                                    disabled={closing}
                                    className="px-4 py-2 text-sm border border-border rounded-xl text-secondary hover:text-primary hover:border-accent/50 transition-all disabled:opacity-50"
                                >
                                    Wieder öffnen
                                </button>
                            </>
                        ) : (
                            <>
                                {ticket.waitingOn === "support" ? (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">
                                        Warten auf uns
                                    </span>
                                ) : (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                                        Warten auf User
                                    </span>
                                )}
                                <button
                                    onClick={handleClose}
                                    disabled={closing}
                                    className="px-4 py-2 text-sm border border-border rounded-xl text-secondary hover:text-primary hover:border-accent/50 transition-all disabled:opacity-50"
                                >
                                    Schließen
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm pt-2 border-t border-border">
                    <div>
                        <p className="text-xs text-secondary mb-0.5">App</p>
                        <p className="text-primary">{ticket.appName}</p>
                    </div>
                    <div>
                        <p className="text-xs text-secondary mb-0.5">User ID</p>
                        <p className="text-primary font-mono text-xs">{ticket.externalUserId}</p>
                    </div>
                    {ticket.email && (
                        <div>
                            <p className="text-xs text-secondary mb-0.5">E-Mail</p>
                            <p className="text-primary">{ticket.email}</p>
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t border-border">
                    <p className="text-xs text-secondary mb-1">Beschreibung</p>
                    <p className="text-sm text-primary whitespace-pre-wrap">{ticket.description}</p>
                </div>
            </div>

            {/* Chat */}
            <div className="border border-border rounded-2xl overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-border bg-surface2/30">
                    <p className="text-sm font-medium">Verlauf</p>
                </div>

                {/* Messages */}
                <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                    {messages.length === 0 ? (
                        <p className="text-secondary text-sm text-center py-4">Noch keine Nachrichten.</p>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg._id} className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-accent">{msg.authorName}</span>
                                    <span className="text-xs text-secondary">{formatTime(msg.createdAt)}</span>
                                </div>
                                <p className="text-sm text-primary bg-surface2/50 rounded-xl px-3 py-2 whitespace-pre-wrap">
                                    {msg.body}
                                </p>
                                {msg.assets && msg.assets.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {msg.assets.map((asset) => {
                                            const fileName = asset.split("/").pop() ?? asset;
                                            const href = `/api/tickets/asset?key=${encodeURIComponent(asset)}`;
                                            return (
                                                <a
                                                    key={asset}
                                                    href={href}
                                                    download
                                                    className="flex items-center gap-1.5 text-xs text-accent hover:underline bg-surface2/50 border border-border rounded-lg px-2.5 py-1.5 transition-colors hover:border-accent/50"
                                                >
                                                    <Paperclip size={11} />
                                                    {fileName}
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Send form — only shown when ticket is open */}
                {ticket.status === "open" && (
                    <form
                        onSubmit={handleSend}
                        className="flex items-end gap-2 p-4 border-t border-border bg-surface2/20"
                    >
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Nachricht schreiben…"
                            disabled={sending}
                            rows={2}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e as unknown as React.FormEvent);
                                }
                            }}
                            className="flex-1 bg-surface2 border border-border rounded-xl px-4 py-2 text-primary text-sm resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={sending || !body.trim()}
                            className="p-2.5 bg-accent text-background rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        >
                            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
