"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { CheckCircle2, Plus } from "lucide-react";

// ─── App Selection Pills ─────────────────────────────────────────────────────

function AppsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedAppId = searchParams.get("app") as Id<"apps"> | null;

    const apps = useQuery(api.apps.queries.getAll);

    // Auto-select first app once apps load and nothing is selected
    useEffect(() => {
        if (apps && apps.length > 0 && !selectedAppId) {
            router.replace(`/admin/apps?app=${apps[0]._id}`);
        }
    }, [apps, selectedAppId, router]);

    if (!apps) {
        return <div className="text-secondary">Loading...</div>;
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Apps</h1>
                <p className="text-secondary">App-Einstellungen verwalten</p>
            </div>

            {/* Pills row */}
            <div className="flex items-center gap-2 mb-8 flex-wrap">
                {apps.map((app) => (
                    <button
                        key={app._id}
                        onClick={() => router.push(`/admin/apps?app=${app._id}`)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                            selectedAppId === app._id
                                ? "bg-accent/10 border-accent text-accent"
                                : "border-border text-secondary hover:border-accent/50 hover:text-primary"
                        }`}
                    >
                        {app.name}
                    </button>
                ))}
                <button
                    onClick={() => router.push("/admin/create-app")}
                    className="flex items-center justify-center w-9 h-9 rounded-xl border border-border text-secondary hover:border-accent/50 hover:text-accent transition-all"
                    title="New App"
                >
                    <Plus size={18} />
                </button>
            </div>

            {/* Form */}
            {selectedAppId && (
                <AppSettingsForm key={selectedAppId} appId={selectedAppId} />
            )}
        </div>
    );
}

// ─── Analytics Config Form ────────────────────────────────────────────────────

type AppDoc = {
    revenueCatProjectId?:       string;
    revenueCatApiKeyEncrypted?: string;
    postHogProjectId?:          string;
    postHogApiKeyEncrypted?:    string;
    postHogInstallEvent?:       string;
    postHogTrialEvent?:         string;
};

function AnalyticsConfigForm({ appId, app }: { appId: Id<"apps">; app: AppDoc | null | undefined }) {
    const [config, setConfig] = useState({
        revenueCatProjectId: "",
        revenueCatApiKey:    "",
        postHogProjectId:    "",
        postHogApiKey:       "",
        postHogInstallEvent: "",
        postHogTrialEvent:   "",
    });
    const [saving, setSaving] = useState(false);
    const [saved,  setSaved]  = useState(false);
    const [err,    setErr]    = useState("");

    useEffect(() => {
        if (app) {
            setConfig((prev) => ({
                ...prev,
                revenueCatProjectId: app.revenueCatProjectId  ?? "",
                postHogProjectId:    app.postHogProjectId      ?? "",
                postHogInstallEvent: app.postHogInstallEvent   ?? "",
                postHogTrialEvent:   app.postHogTrialEvent     ?? "",
            }));
        }
    }, [app]);

    const field = (key: keyof typeof config) => ({
        value: config[key],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, [key]: e.target.value }),
    });

    const handleSave = async () => {
        setSaving(true);
        setErr("");
        try {
            const res = await fetch(`/api/admin/apps/${appId}/analytics-config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (!res.ok) throw new Error(await res.text());
            setSaved(true);
            // Clear plaintext key fields after save
            setConfig((prev) => ({ ...prev, revenueCatApiKey: "", postHogApiKey: "" }));
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed to save analytics config");
        } finally {
            setSaving(false);
        }
    };

    const Configured = () => (
        <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <CheckCircle2 size={13} /> Key configured
        </span>
    );

    return (
        <div className="mt-8 bg-surface border border-border rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-1">Analytics Configuration</h2>
            <p className="text-secondary text-sm mb-6">Connect RevenueCat and PostHog to show real metrics on the analytics dashboard.</p>

            {err && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{err}</div>}
            {saved && <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">Analytics config saved.</div>}

            <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-1.5">RevenueCat Project ID</label>
                        <input type="text" {...field("revenueCatProjectId")} placeholder="proj_xxxxx" className="w-full px-4 py-2.5 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-sm" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-medium text-secondary">RevenueCat API Key</label>
                            {app?.revenueCatApiKeyEncrypted && !config.revenueCatApiKey && <Configured />}
                        </div>
                        <input type="password" {...field("revenueCatApiKey")} placeholder={app?.revenueCatApiKeyEncrypted ? "Leave blank to keep existing" : "sk_xxxxx"} className="w-full px-4 py-2.5 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-sm" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-1.5">PostHog Project ID</label>
                        <input type="text" {...field("postHogProjectId")} placeholder="12345" className="w-full px-4 py-2.5 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-sm" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-medium text-secondary">PostHog Personal API Key</label>
                            {app?.postHogApiKeyEncrypted && !config.postHogApiKey && <Configured />}
                        </div>
                        <input type="password" {...field("postHogApiKey")} placeholder={app?.postHogApiKeyEncrypted ? "Leave blank to keep existing" : "phx_xxxxx"} className="w-full px-4 py-2.5 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-sm" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-1.5">Install Event Name</label>
                        <input type="text" {...field("postHogInstallEvent")} placeholder="Application Installed" className="w-full px-4 py-2.5 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-1.5">Trial Event Name</label>
                        <input type="text" {...field("postHogTrialEvent")} placeholder="Trial Started" className="w-full px-4 py-2.5 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-sm" />
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="mt-6 px-6 py-2.5 bg-accent text-background rounded-xl font-medium text-sm hover:bg-accent/90 transition-all disabled:opacity-50"
            >
                {saving ? "Saving..." : "Save Analytics Config"}
            </button>
        </div>
    );
}

// ─── Settings Form ────────────────────────────────────────────────────────────

function AppSettingsForm({ appId }: { appId: Id<"apps"> }) {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: "",
        domain: "",
        tagline: "",
        description: "",
        status: "live",
        slug: "",
        termsOfUse: "",
        privacyPolicy: "",
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [logoDragOver, setLogoDragOver] = useState(false);
    const [thumbnailDragOver, setThumbnailDragOver] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const logoInputRef = useRef<HTMLInputElement>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    const app = useQuery(api.apps.queries.getById, { appId });
    const logoUrl = useQuery(api.storage.queries.getUrl, app?.logoStorageId ? { storageId: app.logoStorageId } : "skip");
    const thumbnailUrl = useQuery(api.storage.queries.getUrl, app?.thumbnailStorageId ? { storageId: app.thumbnailStorageId } : "skip");

    const updateApp = useMutation(api.apps.mutations.update);
    const deleteApp = useMutation(api.apps.mutations.remove);
    const uploadFiles = useAction(api.storage.actions.uploadFiles);

    useEffect(() => {
        if (app) {
            setFormData({
                name: app.name || "",
                domain: app.domain || "",
                tagline: app.tagline || "",
                description: app.description || "",
                status: app.status || "live",
                slug: app.slug || "",
                termsOfUse: app.termsOfUse || "",
                privacyPolicy: app.privacyPolicy || "",
            });
            if (logoUrl && !logoPreview) setLogoPreview(logoUrl);
            if (thumbnailUrl && !thumbnailPreview) setThumbnailPreview(thumbnailUrl);
        }
    }, [app, logoUrl, thumbnailUrl]);

    const processLogoFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        setLogoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setLogoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const processThumbnailFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        setThumbnailFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setThumbnailPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!formData.name.trim()) { setError("App name is required"); return; }
        if (!formData.domain.trim()) { setError("Domain is required"); return; }
        if (!formData.tagline.trim()) { setError("Tagline is required"); return; }
        if (!formData.description.trim()) { setError("Description is required"); return; }

        setIsSubmitting(true);
        try {
            let logoStorageId: Id<"_storage"> | undefined;
            let thumbnailStorageId: Id<"_storage"> | undefined;

            const filesToUpload: Array<{ data: string; mimeType: string }> = [];
            if (logoFile) {
                const data = await new Promise<string>((res, rej) => {
                    const r = new FileReader();
                    r.onloadend = () => res(r.result as string);
                    r.onerror = rej;
                    r.readAsDataURL(logoFile);
                });
                filesToUpload.push({ data, mimeType: logoFile.type });
            }
            if (thumbnailFile) {
                const data = await new Promise<string>((res, rej) => {
                    const r = new FileReader();
                    r.onloadend = () => res(r.result as string);
                    r.onerror = rej;
                    r.readAsDataURL(thumbnailFile);
                });
                filesToUpload.push({ data, mimeType: thumbnailFile.type });
            }

            if (filesToUpload.length > 0) {
                const ids = await uploadFiles({ files: filesToUpload });
                if (logoFile && ids[0]) logoStorageId = ids[0];
                if (thumbnailFile) thumbnailStorageId = logoFile ? ids[1] : ids[0];
            } else {
                logoStorageId = app?.logoStorageId;
                thumbnailStorageId = app?.thumbnailStorageId;
            }

            await updateApp({
                appId,
                name: formData.name.trim(),
                domain: formData.domain.trim(),
                tagline: formData.tagline.trim(),
                description: formData.description.trim(),
                status: formData.status,
                slug: formData.slug.trim() || undefined,
                logoStorageId: logoFile ? logoStorageId : app?.logoStorageId,
                thumbnailStorageId: thumbnailFile ? thumbnailStorageId : app?.thumbnailStorageId,
                termsOfUse: formData.termsOfUse,
                privacyPolicy: formData.privacyPolicy,
            });

            router.refresh();
            setIsSubmitting(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update app.");
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (deleteConfirm !== "DELETE") { setError("Please type 'DELETE' to confirm deletion"); return; }
        setIsSubmitting(true);
        try {
            await deleteApp({ appId });
            router.push("/admin/apps");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete app.");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl">
            <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">{error}</div>
                )}

                <div className="space-y-6">
                    {/* Logo */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">Logo</label>
                        {logoPreview ? (
                            <div className="relative aspect-square max-w-32">
                                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover rounded-xl border border-border" />
                                <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = ""; }} disabled={isSubmitting}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ) : (
                            <label htmlFor="logo"
                                onDragOver={(e) => { e.preventDefault(); setLogoDragOver(true); }}
                                onDragLeave={() => setLogoDragOver(false)}
                                onDrop={(e) => { e.preventDefault(); setLogoDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) processLogoFile(f); }}
                                className={`flex flex-col items-center justify-center w-full max-w-32 aspect-square border-2 border-dashed rounded-xl cursor-pointer transition-colors ${logoDragOver ? "border-accent bg-accent/10" : "border-border hover:border-accent/50 bg-surface2"}`}>
                                <div className="flex flex-col items-center p-3">
                                    <svg className="w-6 h-6 mb-1 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <p className="text-xs text-secondary text-center"><span className="font-semibold">Upload</span></p>
                                    <p className="text-[10px] text-muted text-center">PNG, JPG</p>
                                </div>
                                <input ref={logoInputRef} id="logo" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) processLogoFile(f); }} disabled={isSubmitting} className="hidden" />
                            </label>
                        )}
                    </div>

                    {/* Thumbnail */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">Thumbnail</label>
                        {thumbnailPreview ? (
                            <div className="relative aspect-[4/2]">
                                <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover rounded-xl border border-border" />
                                <button type="button" onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); if (thumbnailInputRef.current) thumbnailInputRef.current.value = ""; }} disabled={isSubmitting}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ) : (
                            <label htmlFor="thumbnail"
                                onDragOver={(e) => { e.preventDefault(); setThumbnailDragOver(true); }}
                                onDragLeave={() => setThumbnailDragOver(false)}
                                onDrop={(e) => { e.preventDefault(); setThumbnailDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) processThumbnailFile(f); }}
                                className={`flex flex-col items-center justify-center w-full aspect-[4/2] border-2 border-dashed rounded-xl cursor-pointer transition-colors ${thumbnailDragOver ? "border-accent bg-accent/10" : "border-border hover:border-accent/50 bg-surface2"}`}>
                                <div className="flex flex-col items-center p-4">
                                    <svg className="w-8 h-8 mb-2 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <p className="text-sm text-secondary text-center"><span className="font-semibold">Click to upload</span> thumbnail</p>
                                    <p className="text-xs text-muted text-center">PNG, JPG, GIF or WEBP</p>
                                </div>
                                <input ref={thumbnailInputRef} id="thumbnail" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) processThumbnailFile(f); }} disabled={isSubmitting} className="hidden" />
                            </label>
                        )}
                    </div>

                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-secondary mb-2">App Name *</label>
                        <input type="text" id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={isSubmitting} className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50" placeholder="My Awesome App" />
                    </div>

                    <div>
                        <label htmlFor="domain" className="block text-sm font-medium text-secondary mb-2">Domain *</label>
                        <input type="text" id="domain" value={formData.domain} onChange={(e) => setFormData({ ...formData, domain: e.target.value })} disabled={isSubmitting} className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50" placeholder="myapp.com" />
                    </div>

                    <div>
                        <label htmlFor="slug" className="block text-sm font-medium text-secondary mb-2">Slug</label>
                        <input type="text" id="slug" value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') })}
                            disabled={isSubmitting} className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50" placeholder="my-app-slug" />
                        <p className="mt-1 text-xs text-muted">URL-friendly identifier (lowercase, hyphens only). Must be unique.</p>
                    </div>

                    <div>
                        <label htmlFor="tagline" className="block text-sm font-medium text-secondary mb-2">Tagline *</label>
                        <input type="text" id="tagline" value={formData.tagline} onChange={(e) => setFormData({ ...formData, tagline: e.target.value })} disabled={isSubmitting} className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50" placeholder="A brief, catchy description" />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-secondary mb-2">Description *</label>
                        <textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={isSubmitting} rows={6} className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-none disabled:opacity-50" placeholder="Detailed description of your app..." />
                    </div>

                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-secondary mb-2">Status</label>
                        <select id="status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} disabled={isSubmitting} className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50">
                            <option value="live">Live</option>
                            <option value="coming soon">Coming Soon</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="termsOfUse" className="block text-sm font-medium text-secondary mb-2">
                            Terms of Use <span className="text-muted font-normal">(Markdown)</span>
                        </label>
                        <textarea
                            id="termsOfUse"
                            value={formData.termsOfUse}
                            onChange={(e) => setFormData({ ...formData, termsOfUse: e.target.value })}
                            disabled={isSubmitting}
                            rows={15}
                            placeholder="Enter Markdown content..."
                            className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-y font-mono text-sm disabled:opacity-50"
                        />
                        <p className="mt-1 text-xs text-muted">Leave empty to use the default boilerplate. Markdown only — not HTML.</p>
                    </div>

                    <div>
                        <label htmlFor="privacyPolicy" className="block text-sm font-medium text-secondary mb-2">
                            Privacy Policy <span className="text-muted font-normal">(Markdown)</span>
                        </label>
                        <textarea
                            id="privacyPolicy"
                            value={formData.privacyPolicy}
                            onChange={(e) => setFormData({ ...formData, privacyPolicy: e.target.value })}
                            disabled={isSubmitting}
                            rows={15}
                            placeholder="Enter Markdown content..."
                            className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-y font-mono text-sm disabled:opacity-50"
                        />
                        <p className="mt-1 text-xs text-muted">Leave empty to use the default boilerplate. Markdown only — not HTML.</p>
                    </div>
                </div>

                <div className="flex gap-4 mt-8">
                    <button type="button" onClick={() => router.refresh()} disabled={isSubmitting} className="flex-1 px-6 py-3 bg-surface2 border border-border rounded-xl text-secondary hover:bg-surface hover:text-primary transition-all disabled:opacity-50">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-medium hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>

            {/* Analytics Config */}
            <AnalyticsConfigForm appId={appId} app={app} />

            {/* Danger Zone */}
            <div className="mt-8 bg-surface border border-red-500/20 rounded-2xl p-8">
                <h2 className="text-2xl font-bold mb-2 text-red-400">Danger Zone</h2>
                <p className="text-secondary mb-6">Once you delete an app, there is no going back. Please be certain.</p>

                {!showDeleteConfirm ? (
                    <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={isSubmitting} className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-medium hover:bg-red-500/20 transition-all disabled:opacity-50">
                        Delete App
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="deleteConfirm" className="block text-sm font-medium text-secondary mb-2">
                                Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
                            </label>
                            <input type="text" id="deleteConfirm" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} disabled={isSubmitting} className="w-full px-4 py-3 bg-surface2 border border-red-500/20 rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all disabled:opacity-50" placeholder="DELETE" />
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirm(""); }} disabled={isSubmitting} className="px-6 py-3 bg-surface2 border border-border rounded-xl text-secondary hover:bg-surface hover:text-primary transition-all disabled:opacity-50">Cancel</button>
                            <button type="button" onClick={handleDelete} disabled={isSubmitting || deleteConfirm !== "DELETE"} className="px-6 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSubmitting ? "Deleting..." : "Delete App"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function AppsPage() {
    return (
        <Suspense fallback={<div className="text-secondary">Loading...</div>}>
            <AppsContent />
        </Suspense>
    );
}
