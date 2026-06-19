import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import LiveStrip from "@/components/landing/LiveStrip";
import Capabilities from "@/components/landing/Capabilities";
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
      <ForecastPreview />
      <TwinPreview />
      <Closing />
    </main>
  );
}
