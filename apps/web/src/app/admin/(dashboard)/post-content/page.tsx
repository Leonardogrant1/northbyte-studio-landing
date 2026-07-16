"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useConvexAuth, useConvex } from "convex/react";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { Calendar, Loader2, X, Zap } from "lucide-react";
import { normalizeVideoFile } from "@/lib/video";
import { toast } from "sonner";
import { R2_BUCKETS } from "@/lib/r2-constants";
import { MediaDropzone } from "@/components/admin/MediaDropzone";
import { getNextScheduleTime } from "@/lib/schedule";

const inputClass =
    "w-full rounded-xl bg-surface2 border border-border px-4 py-2.5 text-primary text-sm outline-none focus:border-accent transition-colors";

interface TikTokSettings {
    privacy_level: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";
    duet: boolean;
    stitch: boolean;
    comment: boolean;
    autoAddMusic: "yes" | "no";
    brand_content_toggle: boolean;
    brand_organic_toggle: boolean;
    content_posting_method: "DIRECT_POST" | "UPLOAD";
    video_made_with_ai: boolean;
    title: string;
}

const defaultTikTokSettings: TikTokSettings = {
    privacy_level: "PUBLIC_TO_EVERYONE",
    duet: true,
    stitch: true,
    comment: true,
    autoAddMusic: "no",
    brand_content_toggle: false,
    brand_organic_toggle: false,
    content_posting_method: "DIRECT_POST",
    video_made_with_ai: false,
    title: "",
};

interface InstagramSettings {
    type: "instagram" | "instagram-standalone";
    is_trial_reel: boolean;
    graduation_strategy: "MANUAL" | "SS_PERFORMANCE";
    collaborators: string[];
}

const defaultInstagramSettings: InstagramSettings = {
    type: "instagram-standalone",
    is_trial_reel: false,
    graduation_strategy: "MANUAL",
    collaborators: [],
};

interface XSettings {
    who_can_reply_post: "everyone" | "following" | "mentionedUsers" | "verified" | "subscribers";
    includeMedia: boolean;
}

const defaultXSettings: XSettings = {
    who_can_reply_post: "everyone",
    includeMedia: true,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-accent" : "bg-border"
                }`}
        >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-1"
                }`} />
        </button>
    );
}

async function uploadToR2(
    file: File,
    onProgress?: (pct: number) => void
): Promise<string> {
    const res = await fetch("/api/r2/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            bucket: R2_BUCKETS.n8n,
            fileName: file.name,
            fileType: file.type,
        }),
    });
    if (!res.ok) throw new Error("Presigned URL konnte nicht abgerufen werden.");
    const { uploadUrl, downloadUrl } = await res.json();

    await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load", () =>
            xhr.status >= 200 && xhr.status < 300
                ? resolve()
                : reject(new Error(`Upload fehlgeschlagen (${xhr.status})`))
        );
        xhr.addEventListener("error", () => reject(new Error("Netzwerkfehler beim Upload")));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
    });

    return downloadUrl;
}

export default function PostContentPage() {
    const { isAuthenticated } = useConvexAuth();
    const convex = useConvex();
    const accounts = useQuery(
        api.social_accounts.queries.getMyAccounts,
        isAuthenticated ? {} : "skip"
    );
    const createPost = useMutation(api.posts.mutations.create);

    const [selectedAccountIds, setSelectedAccountIds] = useState<Set<Id<"social_accounts">>>(
        new Set()
    );
    const [mediaFiles, setMediaFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [hashtagInput, setHashtagInput] = useState("");
    const [isScheduling, setIsScheduling] = useState(false);
    const [uploadStatus, setUploadStatus] = useState("");
    const [tiktokSettings, setTiktokSettings] = useState<TikTokSettings>(defaultTikTokSettings);
    const [instagramSettings, setInstagramSettings] = useState<InstagramSettings>(defaultInstagramSettings);
    const [xSettings, setXSettings] = useState<XSettings>(defaultXSettings);
    const [igCollabInput, setIgCollabInput] = useState("");
    const [postNow, setPostNow] = useState(false);

    const previewsRef = useRef<string[]>([]);
    previewsRef.current = previews;
    useEffect(() => () => { previewsRef.current.forEach(URL.revokeObjectURL); }, []);

    const selectedAccounts = accounts?.filter((a) => selectedAccountIds.has(a._id)) ?? [];
    const hasTikTok = selectedAccounts.some((a) => a.platform === "tiktok");
    const hasInstagram = selectedAccounts.some((a) => a.platform === "instagram");
    const hasX = selectedAccounts.some((a) => a.platform === "x");

    const mediaHasVideo = mediaFiles.some((f) => f.type.startsWith("video/"));
    const mediaHasImage = mediaFiles.some((f) => f.type.startsWith("image/"));
    const mediaVideoCount = mediaFiles.filter((f) => f.type.startsWith("video/")).length;
    const tiktokMediaInvalid =
        hasTikTok &&
        mediaFiles.length > 0 &&
        ((mediaHasVideo && mediaHasImage) || mediaVideoCount > 1);

    const content =
        description.trim() +
        (hashtags.length > 0
            ? (description.trim() ? "\n" : "") + hashtags.map((t) => `#${t}`).join(" ")
            : "");
    const X_CHAR_LIMIT = 280;
    const xOverLimit = hasX && content.length > X_CHAR_LIMIT;

    const canSubmit = selectedAccountIds.size > 0 && !tiktokMediaInvalid && !xOverLimit;

    const setTt = <K extends keyof TikTokSettings>(key: K, value: TikTokSettings[K]) =>
        setTiktokSettings((prev) => ({ ...prev, [key]: value }));

    const toggleAccount = (id: Id<"social_accounts">) => {
        setSelectedAccountIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const addFiles = (files: File[]) => {
        const newPreviews = files.map((f) => URL.createObjectURL(f));
        setMediaFiles((prev) => [...prev, ...files]);
        setPreviews((prev) => [...prev, ...newPreviews]);
    };

    const removeFile = (index: number) => {
        URL.revokeObjectURL(previews[index]);
        setMediaFiles((prev) => prev.filter((_, i) => i !== index));
        setPreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const tag = hashtagInput.trim().replace(/^#/, "");
            if (tag && !hashtags.includes(tag)) {
                setHashtags((h) => [...h, tag]);
                setHashtagInput("");
            }
        }
    };

    const handleSchedule = async () => {
        console.log("postNow", postNow);
        const mediaRequired = selectedAccounts.some(
            (a) => a.platform !== "x" || xSettings.includeMedia
        );
        if (mediaRequired && mediaFiles.length === 0) {
            toast.error("Bitte mindestens eine Datei auswählen.");
            return;
        }
        if (selectedAccountIds.size === 0) {
            toast.error("Bitte mindestens einen Account auswählen.");
            return;
        }
        if (!title.trim()) {
            toast.error("Bitte einen Titel eingeben.");
            return;
        }

        const accountArray = selectedAccounts;
        for (const account of accountArray) {
            if (!account.postizId) {
                toast.error(`Account @${account.username} hat keine Postiz-ID konfiguriert.`);
                return;
            }
        }

        setIsScheduling(true);

        try {
            const r2Urls: string[] = [];
            for (let i = 0; i < mediaFiles.length; i++) {
                const file = mediaFiles[i];
                setUploadStatus(`R2: Datei ${i + 1}/${mediaFiles.length} hochladen…`);
                const normalized = file.type.startsWith("video/")
                    ? await normalizeVideoFile(file)
                    : file;
                const url = await uploadToR2(normalized, (pct) => {
                    setUploadStatus(`R2: Datei ${i + 1}/${mediaFiles.length}: ${pct}%`);
                });
                r2Urls.push(url);
            }

            const postizMedia: { id: string; path: string }[] = [];
            for (let i = 0; i < r2Urls.length; i++) {
                setUploadStatus(`Postiz: Medium ${i + 1}/${r2Urls.length} hochladen…`);
                const uploadRes = await fetch("/api/postiz/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: r2Urls[i] }),
                });
                if (!uploadRes.ok) throw new Error(`Postiz-Upload fehlgeschlagen für Medium ${i + 1}.`);
                const { id, path } = await uploadRes.json();
                postizMedia.push({ id, path });
            }

            for (const account of accountArray) {
                setUploadStatus(`Post für @${account.username} erstellen…`);

                // Compute next schedule time unless posting immediately
                let scheduledAt: string | undefined;
                if (!postNow) {
                    const last10 = await convex.query(
                        api.posts.queries.getLastScheduledByAccount,
                        { accountId: account._id, limit: 10 }
                    );
                    const nextTime = getNextScheduleTime(account, last10);
                    if (!nextTime) {
                        toast.error(`@${account.username} hat keine Posting-Zeiten konfiguriert. Post wird sofort veröffentlicht.`);
                    } else {
                        scheduledAt = nextTime;
                    }
                }

                let settings: Record<string, unknown>;
                if (account.platform === "tiktok") {
                    settings = {
                        __type: "tiktok",
                        ...tiktokSettings,
                        ...(tiktokSettings.title.trim() ? {} : { title: undefined }),
                    };
                } else if (account.platform === "instagram") {
                    settings = {
                        __type: instagramSettings.type,
                        post_type: "post",
                        ...(instagramSettings.is_trial_reel && {
                            is_trial_reel: true,
                            graduation_strategy: instagramSettings.graduation_strategy,
                        }),
                        ...(instagramSettings.collaborators.length > 0 && {
                            collaborators: instagramSettings.collaborators.map((label) => ({ label })),
                        }),
                    };
                } else if (account.platform === "x") {
                    settings = {
                        __type: "x",
                        who_can_reply_post: xSettings.who_can_reply_post,
                        community: "",
                    };
                } else {
                    settings = { __type: account.platform };
                }

                const excludeMedia = account.platform === "x" && !xSettings.includeMedia;
                const accountPostizMedia = excludeMedia ? [] : postizMedia;
                const accountMediaUrls = excludeMedia ? [] : r2Urls;

                const postRes = await fetch("/api/postiz/posts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        integrationId: account.postizId,
                        postizMedia: accountPostizMedia,
                        content,
                        settings,
                        scheduledAt,
                    }),
                });
                if (!postRes.ok) throw new Error(`Postiz-Post für @${account.username} fehlgeschlagen.`);
                const data = await postRes.json();
                const postizPostId: string | undefined = data?.id ?? data?.[0]?.id;

                await createPost({
                    title: title.trim(),
                    description: description.trim() || undefined,
                    hashtags: hashtags.length > 0 ? hashtags : undefined,
                    mediaUrls: accountMediaUrls,
                    accountId: account._id,
                    postizPostId,
                    scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : undefined,
                });
            }

            toast.success(
                accountArray.length > 1
                    ? `${accountArray.length} Posts erfolgreich geplant!`
                    : "Post erfolgreich geplant!"
            );

            setTitle("");
            setDescription("");
            setHashtags([]);
            setSelectedAccountIds(new Set());
            setTiktokSettings(defaultTikTokSettings);
            setInstagramSettings(defaultInstagramSettings);
            setXSettings(defaultXSettings);
            setIgCollabInput("");
            previews.forEach((url) => URL.revokeObjectURL(url));
            setMediaFiles([]);
            setPreviews([]);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Planen.");
        } finally {
            setIsScheduling(false);
            setUploadStatus("");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold mb-0.5">Post Content</h1>
                <p className="text-sm text-secondary">
                    Medien hochladen und für Social-Media-Accounts planen.
                </p>
            </div>

            <div className="flex gap-8 items-start">
                {/* Left column */}
                <div className="flex-1 min-w-0 space-y-6 max-w-xl">
                    {/* Accounts */}
                    <section className="space-y-2">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                            Accounts
                        </h2>
                        {accounts === undefined ? (
                            <div className="flex gap-2">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="h-7 w-28 rounded-full bg-surface2 animate-pulse" />
                                ))}
                            </div>
                        ) : accounts.length === 0 ? (
                            <p className="text-sm text-secondary">Keine Accounts zugewiesen.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {accounts.map((acc) => {
                                    const selected = selectedAccountIds.has(acc._id);
                                    return (
                                        <button
                                            key={acc._id}
                                            onClick={() => toggleAccount(acc._id)}
                                            className={`px-3 py-1 rounded-full border text-xs transition-all capitalize ${selected
                                                    ? "bg-accent border-accent text-background font-medium"
                                                    : "bg-surface2 border-border text-secondary hover:border-accent/50"
                                                }`}
                                        >
                                            {acc.platform}: @{acc.username}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Media picker */}
                    <section className="space-y-2">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                            Medien
                        </h2>
                        <MediaDropzone
                            files={mediaFiles}
                            previews={previews}
                            onAdd={addFiles}
                            onRemove={removeFile}
                            onReorder={(newFiles, newPreviews) => {
                                setMediaFiles(newFiles);
                                setPreviews(newPreviews);
                            }}
                            disabled={isScheduling}
                        />
                    </section>

                    {/* Details */}
                    <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                            Details
                        </h2>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-secondary">Titel *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="z.B. Summer Hook DE"
                                className={inputClass}
                                disabled={isScheduling}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-secondary">Caption</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Caption schreiben…"
                                rows={3}
                                className={inputClass + " resize-none"}
                                disabled={isScheduling}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-secondary">
                                Hashtags (Enter zum Hinzufügen)
                            </label>
                            <div className="w-full rounded-xl bg-surface2 border border-border p-2 focus-within:border-accent transition-colors flex flex-wrap gap-1.5 items-center min-h-[40px]">
                                {hashtags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="flex items-center gap-1 bg-surface border border-border px-2.5 py-0.5 rounded-full text-xs text-primary"
                                    >
                                        #{tag}
                                        <button
                                            onClick={() => setHashtags((h) => h.filter((t) => t !== tag))}
                                            className="text-secondary hover:text-red-400 transition-colors"
                                        >
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    value={hashtagInput}
                                    onChange={(e) => setHashtagInput(e.target.value)}
                                    onKeyDown={handleHashtagKeyDown}
                                    placeholder={hashtags.length === 0 ? "Hashtags hinzufügen…" : ""}
                                    className="flex-1 bg-transparent min-w-[100px] outline-none px-1 py-0.5 text-xs"
                                    disabled={isScheduling}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Submit */}
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={postNow}
                                onChange={(e) => setPostNow(e.target.checked)}
                                disabled={isScheduling}
                                className="w-3.5 h-3.5 accent-accent"
                            />
                            <span className="flex items-center gap-1.5 text-xs text-secondary">
                                <Zap size={11} />
                                Sofort posten
                            </span>
                        </label>
                        <button
                            onClick={handleSchedule}
                            disabled={isScheduling || !canSubmit}
                            className="flex items-center gap-2 min-w-[150px] justify-center bg-accent hover:opacity-90 text-background px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isScheduling ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    <span className="text-xs max-w-[140px] truncate">
                                        {uploadStatus || "Wird gespeichert…"}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Calendar size={15} />
                                    <span>
                                        {postNow
                                            ? selectedAccountIds.size > 1
                                                ? `${selectedAccountIds.size}× sofort`
                                                : "Sofort posten"
                                            : selectedAccountIds.size > 1
                                                ? `${selectedAccountIds.size}× planen`
                                                : "Post planen"}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right column: TikTok Settings */}
                {hasTikTok && (
                    <div className="w-72 flex-shrink-0 sticky top-6 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                                TikTok
                            </h2>
                            <span className="text-xs text-secondary/60">Alle TikTok-Accounts</span>
                        </div>
                        {tiktokMediaInvalid && (
                            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-500">
                                TikTok unterstützt entweder <strong>1 Video</strong> oder <strong>mehrere Bilder</strong> — keine Kombination.
                            </div>
                        )}

                        <div className="rounded-xl border border-border bg-surface2 p-3 space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-secondary">Datenschutz</label>
                                <select
                                    value={tiktokSettings.privacy_level}
                                    onChange={(e) =>
                                        setTt("privacy_level", e.target.value as TikTokSettings["privacy_level"])
                                    }
                                    className={inputClass}
                                    disabled={isScheduling}
                                >
                                    <option value="PUBLIC_TO_EVERYONE">Öffentlich</option>
                                    <option value="MUTUAL_FOLLOW_FRIENDS">Gegenseitige Follower</option>
                                    <option value="FOLLOWER_OF_CREATOR">Follower</option>
                                    <option value="SELF_ONLY">Nur ich</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-secondary">Posting-Methode</label>
                                <select
                                    value={tiktokSettings.content_posting_method}
                                    onChange={(e) =>
                                        setTt(
                                            "content_posting_method",
                                            e.target.value as TikTokSettings["content_posting_method"]
                                        )
                                    }
                                    className={inputClass}
                                    disabled={isScheduling}
                                >
                                    <option value="DIRECT_POST">Direct Post</option>
                                    <option value="UPLOAD">Upload</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-secondary">Auto-Musik</label>
                                <select
                                    value={tiktokSettings.autoAddMusic}
                                    onChange={(e) =>
                                        setTt("autoAddMusic", e.target.value as TikTokSettings["autoAddMusic"])
                                    }
                                    className={inputClass}
                                    disabled={isScheduling}
                                >
                                    <option value="no">Nein</option>
                                    <option value="yes">Ja</option>
                                </select>
                            </div>

                            <div className="space-y-2.5 pt-1">
                                {(
                                    [
                                        ["duet", "Duet"],
                                        ["stitch", "Stitch"],
                                        ["comment", "Kommentare"],
                                        ["video_made_with_ai", "KI-Video"],
                                        ["brand_content_toggle", "Branded Content"],
                                        ["brand_organic_toggle", "Brand Organic"],
                                    ] as [keyof TikTokSettings, string][]
                                ).map(([key, label]) => (
                                    <div key={key} className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-primary">{label}</span>
                                        <Toggle
                                            checked={tiktokSettings[key] as boolean}
                                            onChange={(v) => setTt(key, v as TikTokSettings[typeof key])}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-1 pt-1">
                                <label className="text-xs font-medium text-secondary">
                                    Titel <span className="text-secondary/50">(max. 90)</span>
                                </label>
                                <input
                                    type="text"
                                    value={tiktokSettings.title}
                                    onChange={(e) => setTt("title", e.target.value)}
                                    maxLength={90}
                                    placeholder="TikTok-Titel…"
                                    className={inputClass}
                                    disabled={isScheduling}
                                />
                            </div>
                        </div>
                    </div>
                )}
                {/* Instagram Settings */}
                {hasInstagram && (
                    <div className="w-72 flex-shrink-0 sticky top-6 space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                            Instagram
                        </h2>
                        <div className="rounded-xl border border-border bg-surface2 p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-primary">Trial Reel</span>
                                <Toggle
                                    checked={instagramSettings.is_trial_reel}
                                    onChange={(v) =>
                                        setInstagramSettings((s) => ({ ...s, is_trial_reel: v }))
                                    }
                                />
                            </div>

                            {instagramSettings.is_trial_reel && (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-secondary">
                                        Graduation-Strategie
                                    </label>
                                    <select
                                        value={instagramSettings.graduation_strategy}
                                        onChange={(e) =>
                                            setInstagramSettings((s) => ({
                                                ...s,
                                                graduation_strategy: e.target.value as InstagramSettings["graduation_strategy"],
                                            }))
                                        }
                                        className={inputClass}
                                    >
                                        <option value="MANUAL">Manual</option>
                                        <option value="SS_PERFORMANCE">Auto (Performance)</option>
                                    </select>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-secondary">
                                    Collaborators
                                </label>
                                <div className="w-full rounded-xl bg-surface border border-border p-2 focus-within:border-accent transition-colors flex flex-wrap gap-1.5 items-center min-h-[40px]">
                                    {instagramSettings.collaborators.map((username) => (
                                        <span
                                            key={username}
                                            className="flex items-center gap-1 bg-surface2 border border-border px-2.5 py-0.5 rounded-full text-xs text-primary"
                                        >
                                            @{username}
                                            <button
                                                onClick={() =>
                                                    setInstagramSettings((s) => ({
                                                        ...s,
                                                        collaborators: s.collaborators.filter((u) => u !== username),
                                                    }))
                                                }
                                                className="text-secondary hover:text-red-400 transition-colors"
                                            >
                                                <X size={10} />
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        type="text"
                                        value={igCollabInput}
                                        onChange={(e) => setIgCollabInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                const u = igCollabInput.trim().replace(/^@/, "");
                                                if (u && !instagramSettings.collaborators.includes(u)) {
                                                    setInstagramSettings((s) => ({
                                                        ...s,
                                                        collaborators: [...s.collaborators, u],
                                                    }));
                                                    setIgCollabInput("");
                                                }
                                            }
                                        }}
                                        placeholder={
                                            instagramSettings.collaborators.length === 0
                                                ? "@username…"
                                                : ""
                                        }
                                        className="flex-1 bg-transparent min-w-[80px] outline-none px-1 py-0.5 text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* X Settings */}
                {hasX && (
                    <div className="w-72 flex-shrink-0 sticky top-6 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                                X
                            </h2>
                            <span className="text-xs text-secondary/60">Alle X-Accounts</span>
                        </div>
                        {xOverLimit && (
                            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                                Caption + Hashtags überschreiten das X-Limit von <strong>280 Zeichen</strong>.
                            </div>
                        )}
                        <div className="rounded-xl border border-border bg-surface2 p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-primary">Zeichen</span>
                                <span className={`text-xs ${xOverLimit ? "text-red-400 font-semibold" : "text-secondary"}`}>
                                    {content.length}/{X_CHAR_LIMIT}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-primary">Medien anhängen</span>
                                <Toggle
                                    checked={xSettings.includeMedia}
                                    onChange={(v) => setXSettings((s) => ({ ...s, includeMedia: v }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-secondary">Wer kann antworten</label>
                                <select
                                    value={xSettings.who_can_reply_post}
                                    onChange={(e) =>
                                        setXSettings((s) => ({
                                            ...s,
                                            who_can_reply_post: e.target.value as XSettings["who_can_reply_post"],
                                        }))
                                    }
                                    className={inputClass}
                                    disabled={isScheduling}
                                >
                                    <option value="everyone">Alle</option>
                                    <option value="following">Follower</option>
                                    <option value="mentionedUsers">Erwähnte Nutzer</option>
                                    <option value="verified">Verifizierte</option>
                                    <option value="subscribers">Abonnenten</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
