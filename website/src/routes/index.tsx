import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/heatwise/Navbar";
import { Footer } from "@/components/heatwise/Footer";
import { Hero } from "@/components/heatwise/Hero";
import { SocialProof } from "@/components/heatwise/SocialProof";
import { Problem } from "@/components/heatwise/Problem";
import { HowItWorks } from "@/components/heatwise/HowItWorks";
import { Features } from "@/components/heatwise/Features";
import { BeforeAfter } from "@/components/heatwise/BeforeAfter";
import { Species } from "@/components/heatwise/Species";
import { Testimonials } from "@/components/heatwise/Testimonials";
import { HeatMap } from "@/components/heatwise/HeatMap";
import { Pricing } from "@/components/heatwise/Pricing";
import { FAQ } from "@/components/heatwise/FAQ";
import { FinalCTA } from "@/components/heatwise/FinalCTA";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "HeatWise — Turn Urban Heat Into Living Green Canopies" },
      {
        name: "description",
        content:
          "AI-matched plants. Climate-aware layouts. Real cooling — measured in degrees. Scan your rooftop, balcony or terrace and get a custom green plan in minutes.",
      },
    ],
  }),
});

function Index() {
  return (
    <main className="relative">
      <Navbar />
      <Hero />
      <SocialProof />
      <Problem />
      <HowItWorks />
      <Features />
      <BeforeAfter />
      <Species />
      <Testimonials />
      <HeatMap />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
