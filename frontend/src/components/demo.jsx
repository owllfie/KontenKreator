import React, { useState } from "react";
import { AnimatedMarqueeHero } from "@/components/ui/hero-3";
import { LoginModal } from "@/components/ui/login-modal";

const DEMO_IMAGES = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&auto=format&fit=crop&q=80",
];

const AnimatedHeroDemo = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <>
      <AnimatedMarqueeHero
        tagline="Trusted Content Creator Agency #1"
        title={
          <>
            Manage & Grow
            <br />
            Your Content Creator Agency
          </>
        }
        description="The most complete Content Creator Agency Management System to manage talents, brand campaigns, video performance, and automated creator payouts."
        ctaText="Get Started"
        images={DEMO_IMAGES}
        onCtaClick={() => setIsLoginOpen(true)}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />
    </>
  );
};

export default AnimatedHeroDemo;