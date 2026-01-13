import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: 'swap' });

export const metadata: Metadata = {
    title: "NorthByte Studio - Simplicity & Marketability",
    description: "We build and launch high-quality digital products — fast. AI leveraged development for sustainable businesses.",
    openGraph: {
        title: "NorthByte Studio",
        description: "Simplicity & Marketability. We build and launch high-quality digital products.",
        type: "website",
        locale: "en_US",
        siteName: "NorthByte Studio",
    }
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark scroll-smooth">
            <body className={`${inter.variable} font-sans bg-background text-primary antialiased selection:bg-accent selection:text-surface`}>
                {children}
            </body>
        </html>
    );
}
