import { CheckCircle } from "lucide-react";

const features = [
  {
    title: "Quick Setup",
    description: "Get started in minutes with a simple, intuitive setup that fits seamlessly into your existing workflow.",
  },
  {
    title: "Focused Workflows",
    description: "Everything is organized around tasks and teams, helping you stay focused and avoid unnecessary distractions.",
  },
  {
    title: "Designed for Collaboration",
    description: "Work together smoothly with shared spaces, clear communication, and tools built for teamwork.",
  },
  {
    title: "Privacy First",
    description: "Your data is handled responsibly with strong privacy controls, ensuring your work stays secure and yours.",
  },
];

const WhyChooseUs = () => {
  return (
    <section id="about" className="w-full bg-background py-20 lg:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-20">
        {/* Left Column - Content */}
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Why Teams Choose TeamUp
            </h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              We build TeamUp to remove friction from collaboration. Everything is designed to help teams stay organized, move faster, and work better together—without complexity.
            </p>
          </div>

          {/* Feature Points Grid */}
          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((feature, index) => (
              <div key={index} className="flex gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - AVIF Image Placeholder */}
        <div className="flex items-center justify-center">
            <div className="h-[600px] w-full max-w-[800px] lg:h-[600px]">
                <img
                src="/images/landing/team-illustration.avif"
                alt="Team collaboration illustration"
                className="h-full w-full object-contain"
                loading="lazy"
                decoding="async"
                />
            </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
