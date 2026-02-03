import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { AdminFloatingButtons } from "@/components/layout/AdminFloatingButtons";
import { ConvexClientProvider } from "@/lib/convex/client";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { Providers } from "@/components/Providers";

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
        <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
            <ConvexClientProvider>

                <html lang="en" className="dark scroll-smooth">
                    <link rel="icon" href="/favicon.svg" sizes="any" />
                    <body className={`${inter.variable} font-sans bg-background text-primary antialiased selection:bg-accent selection:text-surface`}>
                        <Providers>
                            {children}
                        </Providers>
                        <AdminFloatingButtons />
                    </body>
                </html>
            </ConvexClientProvider>
        </ClerkProvider>
    );
}
