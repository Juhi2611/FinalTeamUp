import { Zap, Shield, BarChart3, Users } from "lucide-react";

const Features = () => {
  return (
    <section id="features" className="w-full bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
            Everything You Need
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
            Tools built for modern teams to move faster and collaborate better.
          </p>
        </div>

        {/* ================= ROW 1 ================= */}
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          {/* BOX 1 — RECTANGLE */}
          <div className="relative flex h-[260px] overflow-hidden rounded-3xl bg-[#FDBA2D] p-8">
            <div className="z-10 max-w-sm text-black">
              <Zap className="mb-4 h-6 w-6" />
              <h3 className="mb-2 text-xl font-semibold">
                Faster Execution
              </h3>
              <p className="text-sm">
                Plan, assign, and complete tasks without friction. TeamUp helps teams move from ideas to execution quickly by keeping workflows simple, organized, and distraction-free.
              </p>
            </div>

            {/* IMAGE */}
            <img
              src="/images/landing/hero-character.avif"
              alt="Team working"
              className="absolute right-6 top-2/3 h-[270px] -translate-y-1/2 object-contain"
            />
          </div>

          {/* BOX 2 — SQUARE */}
          <div className="flex h-[260px] flex-col justify-center rounded-3xl bg-[#1F6FFF] p-8 text-white">
            <Shield className="mb-4 h-6 w-6" />
            <h3 className="mb-2 text-xl font-semibold">
              Built-In Security
            </h3>
            <p className="text-sm opacity-90">
              Security isn’t an add-on. With protected authentication, role-based access, and safe data handling, your work stays secure at every step—right from the start.
            </p>
          </div>
        </div>

        {/* ================= ROW 2 ================= */}
        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_2fr]">
          {/* BOX 3 — SQUARE */}
          <div className="flex h-[260px] flex-col justify-center rounded-3xl bg-[#FF4D00] p-8 text-white">
            <BarChart3 className="mb-4 h-6 w-6" />
            <h3 className="mb-2 text-xl font-semibold">
              Smart Progress Tracking
            </h3>
            <p className="text-sm opacity-90">
              Stay informed with real-time visibility into tasks, milestones, and team performance. Track progress clearly, identify blockers early, and make decisions with confidence.
            </p>
          </div>

          {/* BOX 4 — RECTANGLE */}
          <div className="relative flex h-[260px] overflow-hidden rounded-3xl bg-[#1F2E6E] p-8 text-white">
            <div className="z-10 max-w-sm">
              <Users className="mb-4 h-6 w-6" />
              <h3 className="mb-2 text-xl font-semibold">
                Team-First Collaboration
              </h3>
              <p className="text-sm opacity-90">
                Built around how teams actually work. Share tasks, communicate easily, and collaborate in one unified space designed to keep everyone aligned and productive.
              </p>
            </div>

            {/* IMAGE */}
            <img
              src="/images/landing/team-illustration.avif"
              alt="Collaboration"
              className="absolute -bottom-6 -right-8 h-[270px] object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
