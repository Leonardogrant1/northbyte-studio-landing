import { ContactSection } from "@/components/sections/ContactSection";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function ContactPage() {
    return (
        <main className="flex flex-col min-h-screen">
            <Header />
            <div className="pt-20 flex-1">
                <ContactSection />
            </div>
            <Footer />
        </main>
    );
}
