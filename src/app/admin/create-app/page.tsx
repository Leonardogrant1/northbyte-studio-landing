"use client";

import { useState, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export default function CreateAppPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: "",
        domain: "",
        tagline: "",
        description: "",
        status: "live",
        slug: "",
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [logoDragOver, setLogoDragOver] = useState(false);
    const [thumbnailDragOver, setThumbnailDragOver] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const logoInputRef = useRef<HTMLInputElement>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    const createApp = useMutation(api.apps.mutations.create);
    const uploadFiles = useAction(api.storage.actions.uploadFiles);

    const processLogoFile = (file: File) => {
        if (file && file.type.startsWith("image/")) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const processThumbnailFile = (file: File) => {
        if (file && file.type.startsWith("image/")) {
            setThumbnailFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setThumbnailPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processLogoFile(file);
        }
    };

    const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processThumbnailFile(file);
        }
    };

    const handleLogoDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLogoDragOver(true);
    };

    const handleLogoDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLogoDragOver(false);
    };

    const handleLogoDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLogoDragOver(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            processLogoFile(file);
        }
    };

    const handleThumbnailDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setThumbnailDragOver(true);
    };

    const handleThumbnailDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setThumbnailDragOver(false);
    };

    const handleThumbnailDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setThumbnailDragOver(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            processThumbnailFile(file);
        }
    };

    const removeLogo = () => {
        setLogoFile(null);
        setLogoPreview(null);
        if (logoInputRef.current) {
            logoInputRef.current.value = "";
        }
    };

    const removeThumbnail = () => {
        setThumbnailFile(null);
        setThumbnailPreview(null);
        if (thumbnailInputRef.current) {
            thumbnailInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validation
        if (!formData.name.trim()) {
            setError("App name is required");
            return;
        }
        if (!formData.domain.trim()) {
            setError("Domain is required");
            return;
        }
        if (!formData.tagline.trim()) {
            setError("Tagline is required");
            return;
        }
        if (!formData.description.trim()) {
            setError("Description is required");
            return;
        }

        setIsSubmitting(true);

        try {
            let logoStorageId: Id<"_storage"> | undefined;
            let thumbnailStorageId: Id<"_storage"> | undefined;

            // Upload images if provided
            const filesToUpload: Array<{ data: string; mimeType: string }> = [];
            if (logoFile) {
                const logoData = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(logoFile);
                });
                filesToUpload.push({ data: logoData, mimeType: logoFile.type });
            }
            if (thumbnailFile) {
                const thumbnailData = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(thumbnailFile);
                });
                filesToUpload.push({ data: thumbnailData, mimeType: thumbnailFile.type });
            }

            // Upload files if any
            if (filesToUpload.length > 0) {
                const storageIds = await uploadFiles({ files: filesToUpload });
                if (logoFile && storageIds[0]) {
                    logoStorageId = storageIds[0];
                }
                if (thumbnailFile) {
                    thumbnailStorageId = logoFile ? storageIds[1] : storageIds[0];
                }
            }

            const appId = await createApp({
                name: formData.name.trim(),
                domain: formData.domain.trim(),
                tagline: formData.tagline.trim(),
                description: formData.description.trim(),
                status: formData.status,
                slug: formData.slug.trim(),
                logoStorageId,
                thumbnailStorageId,
            });

            // Save as selected app
            localStorage.setItem("selectedAppId", appId);

            // Redirect to app-specific dashboard
            router.push(`/admin/apps?app=${appId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create app. Please try again.");
            console.error(err);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-primary p-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push("/admin")}
                        className="flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-6"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span>Back to Dashboard</span>
                    </button>
                    <h1 className="text-4xl font-bold mb-3">Create New App</h1>
                    <p className="text-secondary">
                        Füge eine neue App zu deinem NorthByte Studio hinzu
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="space-y-6">
                        {/* Logo Upload */}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">
                                Logo
                            </label>
                            <div className="space-y-3">
                                {logoPreview ? (
                                    <div className="relative aspect-square max-w-32">
                                        <img
                                            src={logoPreview}
                                            alt="Logo preview"
                                            className="w-full h-full object-cover rounded-xl border border-border"
                                        />
                                        <button
                                            type="button"
                                            onClick={removeLogo}
                                            disabled={isSubmitting}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                            aria-label="Remove logo"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <label
                                        htmlFor="logo"
                                        onDragOver={handleLogoDragOver}
                                        onDragLeave={handleLogoDragLeave}
                                        onDrop={handleLogoDrop}
                                        className={`flex flex-col items-center justify-center w-full max-w-32 aspect-square border-2 border-dashed rounded-xl cursor-pointer transition-colors ${logoDragOver
                                                ? "border-accent bg-accent/10"
                                                : "border-border hover:border-accent/50 bg-surface2"
                                            }`}
                                    >
                                        <div className="flex flex-col items-center justify-center p-3">
                                            <svg className="w-6 h-6 mb-1 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p className="mb-1 text-xs text-secondary text-center">
                                                <span className="font-semibold">Upload</span>
                                            </p>
                                            <p className="text-[10px] text-muted text-center">PNG, JPG</p>
                                        </div>
                                        <input
                                            ref={logoInputRef}
                                            id="logo"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoChange}
                                            disabled={isSubmitting}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Thumbnail Upload */}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">
                                Thumbnail
                            </label>
                            <div className="space-y-3">
                                {thumbnailPreview ? (
                                    <div className="relative aspect-[4/2]">
                                        <img
                                            src={thumbnailPreview}
                                            alt="Thumbnail preview"
                                            className="w-full h-full object-cover rounded-xl border border-border"
                                        />
                                        <button
                                            type="button"
                                            onClick={removeThumbnail}
                                            disabled={isSubmitting}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                            aria-label="Remove thumbnail"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <label
                                        htmlFor="thumbnail"
                                        onDragOver={handleThumbnailDragOver}
                                        onDragLeave={handleThumbnailDragLeave}
                                        onDrop={handleThumbnailDrop}
                                        className={`flex flex-col items-center justify-center w-full aspect-[4/2] border-2 border-dashed rounded-xl cursor-pointer transition-colors ${thumbnailDragOver
                                                ? "border-accent bg-accent/10"
                                                : "border-border hover:border-accent/50 bg-surface2"
                                            }`}
                                    >
                                        <div className="flex flex-col items-center justify-center p-4">
                                            <svg className="w-8 h-8 mb-2 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p className="mb-2 text-sm text-secondary text-center">
                                                <span className="font-semibold">Click to upload</span> thumbnail
                                            </p>
                                            <p className="text-xs text-muted text-center">PNG, JPG, GIF or WEBP</p>
                                        </div>
                                        <input
                                            ref={thumbnailInputRef}
                                            id="thumbnail"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleThumbnailChange}
                                            disabled={isSubmitting}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-secondary mb-2">
                                App Name *
                            </label>
                            <input
                                type="text"
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50"
                                placeholder="My Awesome App"
                            />
                        </div>

                        <div>
                            <label htmlFor="domain" className="block text-sm font-medium text-secondary mb-2">
                                Domain *
                            </label>
                            <input
                                type="text"
                                id="domain"
                                value={formData.domain}
                                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50"
                                placeholder="myapp.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="slug" className="block text-sm font-medium text-secondary mb-2">
                                Slug
                            </label>
                            <input
                                type="text"
                                id="slug"
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') })}
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50"
                                placeholder="my-app-slug"
                            />
                            <p className="mt-1 text-xs text-muted">URL-friendly identifier (lowercase, hyphens only). Must be unique.</p>
                        </div>

                        <div>
                            <label htmlFor="tagline" className="block text-sm font-medium text-secondary mb-2">
                                Tagline *
                            </label>
                            <input
                                type="text"
                                id="tagline"
                                value={formData.tagline}
                                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50"
                                placeholder="A brief, catchy description"
                            />
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-secondary mb-2">
                                Description *
                            </label>
                            <textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                disabled={isSubmitting}
                                rows={6}
                                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-none disabled:opacity-50"
                                placeholder="Detailed description of your app, its features, and purpose..."
                            />
                        </div>

                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-secondary mb-2">
                                Status
                            </label>
                            <select
                                id="status"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50"
                            >
                                <option value="live">Live</option>
                                <option value="coming soon">Coming Soon</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 mt-8">
                        <button
                            type="button"
                            onClick={() => router.push("/admin")}
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-surface2 border border-border rounded-xl text-secondary hover:bg-surface hover:text-primary transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-medium hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Creating..." : "Create App"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
