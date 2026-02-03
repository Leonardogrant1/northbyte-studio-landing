"use client";

import { useState, useRef, forwardRef, useImperativeHandle, DragEvent, ChangeEvent } from "react";
import { Upload, X } from "lucide-react";

interface AssetDropperProps {
    onFileSelected?: (file: File) => void;
    aspectRatio?: "16:9" | "4:3";
}

export interface AssetDropperRef {
    getSelectedFile: () => File | null;
    clearSelection: () => void;
}

export const AssetDropper = forwardRef<AssetDropperRef, AssetDropperProps>(
    ({ onFileSelected, aspectRatio }, ref) => {
        const [isDragging, setIsDragging] = useState(false);
        const [previewUrl, setPreviewUrl] = useState<string | null>(null);
        const [selectedFile, setSelectedFile] = useState<File | null>(null);
        const [error, setError] = useState<string | null>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);

        // Expose methods to parent component via ref
        useImperativeHandle(ref, () => ({
            getSelectedFile: () => selectedFile,
            clearSelection: handleRemove,
        }));

        const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragging(true);
        };

        const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragging(false);
        };

        const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragging(false);

            const files = Array.from(e.dataTransfer.files);
            const videoFile = files.find((file) => file.type.startsWith("video/"));

            if (videoFile) {
                handleFileSelect(videoFile);
            } else {
                setError("Please drop a video file");
            }
        };

        const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                handleFileSelect(file);
            }
        };

        const handleFileSelect = (file: File) => {
            setError(null);
            setSelectedFile(file);
            onFileSelected?.(file);
            // Create local preview URL
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        };


        const handleRemove = () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(null);
            setSelectedFile(null);
            setError(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        };

        const handleClick = () => {
            fileInputRef.current?.click();
        };

        return (
            <div className="w-full max-w-64">
                {!previewUrl ? (
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleClick}
                        className={`
                        relative border-2 border-dashed rounded-xl p-6
                        transition-all duration-200 cursor-pointer aspect-[9/16]
                        flex flex-col items-center justify-center
                        ${isDragging
                                ? "border-accent bg-accent/10 scale-[1.02]"
                                : "border-border hover:border-accent/50 hover:bg-surface2/50"
                            }
                    `}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/*"
                            onChange={handleFileInput}
                            className="hidden"
                        />

                        <div className="flex flex-col items-center gap-3">
                            <div className="p-3 bg-surface2 rounded-full">
                                <Upload className="w-6 h-6 text-accent" />
                            </div>
                            <div className="text-center px-4">
                                <p className="text-sm font-medium text-primary mb-1">
                                    Drop video here or click to upload
                                </p>
                                <p className="text-xs text-muted">
                                    MP4, MOV, AVI, WebM
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-sm text-red-500 text-center">{error}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="relative border border-border rounded-xl overflow-hidden bg-surface2">
                        <button
                            onClick={handleRemove}
                            className="absolute top-3 right-3 z-10 p-2 bg-background/80 backdrop-blur-sm rounded-lg hover:bg-background transition-all"
                        >
                            <X className="w-5 h-5 text-primary" />
                        </button>

                        <video
                            src={previewUrl}
                            controls
                            preload="metadata"
                            className="w-full h-auto"
                        />
                    </div>
                )}
            </div>
        );
    }
);

AssetDropper.displayName = "AssetDropper";
