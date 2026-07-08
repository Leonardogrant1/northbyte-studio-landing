"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Content } from "@/types";


interface ContentDropdownProps {
    contents: Content[];
    selectedContent: Content | null;
    onSelectContent: (content: Content) => void;
    isLoading?: boolean;
}

export function ContentDropdown({
    contents,
    selectedContent,
    onSelectContent,
    isLoading = false
}: ContentDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleSelectContent = (content: Content) => {
        onSelectContent(content);
        setIsOpen(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-surface2/50 backdrop-blur-xl border border-border rounded-xl">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted">Loading contents...</span>
            </div>
        );
    }

    if (contents.length === 0) {
        return (
            <div className="px-4 py-2.5 bg-surface2/50 border border-border rounded-xl">
                <p className="text-sm text-muted">No contents found</p>
            </div>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2.5 bg-surface2/50 backdrop-blur-xl border border-border rounded-xl hover:bg-surface2 transition-all duration-200 min-w-[300px] w-full"
            >
                <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-primary">
                        {selectedContent?.["Title"] || "Select a content"}
                    </div>

                    <div className="text-xs text-muted truncate">
                        {selectedContent?.["Created At"] ? new Date(selectedContent?.["Created At"]).toLocaleDateString() : ""}
                    </div>

                </div>
                <ChevronDown
                    className={`w-4 h-4 text-secondary transition-transform duration-200 ${isOpen ? "rotate-180" : ""
                        }`}
                />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[400px] overflow-y-auto p-2">
                        {contents.map((content) => (
                            <button
                                key={content.id}
                                onClick={() => handleSelectContent(content)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 ${selectedContent?.id === content.id
                                    ? "bg-accent/10 border border-accent/20"
                                    : "hover:bg-surface2 border border-transparent"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-primary">
                                            {content["Title"]}
                                        </div>
                                        {content["Unedited Media"] && (
                                            <div className="text-xs text-muted truncate">
                                                {content["Unedited Media"]}
                                            </div>
                                        )}
                                    </div>
                                    {selectedContent?.id === content.id && (
                                        <Check className="w-4 h-4 text-accent" />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
