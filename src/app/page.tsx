import NavbarClient from "@/components/landing/NavbarClient";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import ForDoctors from "@/components/landing/ForDoctors";
import Family from "@/components/landing/Family";
import CTA from "@/components/landing/CTA";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <NavbarClient />
      <Hero />
      <HowItWorks />
      <ForDoctors />
      <Family />
      <CTA />
    </main>
  );
}
