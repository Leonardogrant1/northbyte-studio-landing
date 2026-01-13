import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { Principles } from "@/components/sections/Principles";
import { AppsGrid } from "@/components/sections/AppsGrid";
import { Manifesto } from "@/components/sections/Manifesto";
import { ContactSection } from "@/components/sections/ContactSection";

export default function Home() {
    return (
        <main className="flex flex-col min-h-screen">
            <Header />
            <Hero />
            <Principles />
            <AppsGrid />
            <Manifesto />
            <ContactSection />
            <Footer />
        </main>
    );
}
