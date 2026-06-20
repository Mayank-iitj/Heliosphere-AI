import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import LiveStrip from "@/components/landing/LiveStrip";
import Capabilities from "@/components/landing/Capabilities";
import AdityaL1Section from "@/components/landing/AdityaL1Section";
import ForecastPreview from "@/components/landing/ForecastPreview";
import TwinPreview from "@/components/landing/TwinPreview";
import Closing from "@/components/landing/Closing";

export default function Home() {
  return (
    <main className="relative">
      <Nav />
      <Hero />
      <LiveStrip />
      <Capabilities />
      <AdityaL1Section />
      <ForecastPreview />
      <TwinPreview />
      <Closing />
    </main>
  );
}
