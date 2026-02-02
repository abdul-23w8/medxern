import LoginCard from "@/components/auth/LoginCard";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050609]">
      {/* Background (blurred gradient like reference) */}
      <div className="pointer-events-none absolute inset-0">
        {/* Color wash */}
        <div className="absolute -top-40 left-[-140px] h-[520px] w-[520px] rounded-full bg-medx-teal/35 blur-3xl" />
        <div className="absolute -top-32 right-[-160px] h-[560px] w-[560px] rounded-full bg-medx-gold/25 blur-3xl" />
        <div className="absolute -bottom-48 left-1/3 h-[620px] w-[620px] rounded-full bg-medx-orange/25 blur-3xl" />

        {/* Soft vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-black/45" />

        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:18px_18px]" />
      </div>

      {/* Centered glass window */}
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
        <LoginCard />
      </div>
    </main>
  );
}
