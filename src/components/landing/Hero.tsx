const Hero = () => {
  return (
    <section className="relative w-full py-20 lg:py-32 overflow-hidden">
      
      {/* BACKGROUND CIRCLE */}
      <div className="absolute -left-32 top-1/5 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-teal-400/30 z-0" />


      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
        
        {/* Right Column - Image */}
        <div className="flex items-center justify-center">
          <div className="h-[600px] w-full max-w-[800px] -translate-y-20">
            <img
              src="/images/landing/hero-character.avif"
              alt="TeamUp collaboration illustration"
              className="h-full w-full object-contain"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>

        {/* Left Column - Text */}
        <div className="flex flex-col gap-6">
          <h1 className="text-6xl font-bold sm:text-7xl lg:text-7xl">
            Work <br></br>Smarter, Together
          </h1>

          <p className="max-w-lg text-lg text-muted-foreground">
            Streamline your workflow. Collaborate seamlessly, track progress effortlessly,
            and achieve more as a team.
          </p>
        </div>

      </div>
    </section>
  );
};

export default Hero;
