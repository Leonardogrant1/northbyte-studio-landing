import Link from "next/link";
import Image from "next/image";

export function Footer() {
    return (
        <footer className="bg-surface border-t border-border py-12">
            <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                    <Image src="/logo.svg" alt="NorthByte Studio" width={180} height={60} className="h-8 w-auto mb-2" />
                    <p className="text-sm text-muted">© {new Date().getFullYear()} NorthByte Studio. All rights reserved.</p>
                </div>

                <div className="flex bg-surface2/50 rounded-full px-6 py-2 gap-6">
                    <Link href="/#contact" className="text-sm text-secondary hover:text-accent transition-colors">Contact</Link>
                    <Link href="/privacy-policy" className="text-sm text-secondary hover:text-accent transition-colors">Privacy Policy</Link>
                    <Link href="/terms-of-use" className="text-sm text-secondary hover:text-accent transition-colors">Terms of Use</Link>
                </div>
            </div>
        </footer>
    );
}
