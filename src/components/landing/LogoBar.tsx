const LogoBar = () => {
  const logos = [
    "Dhairya Jain",
    "Juhi Vanjara",
    "Snehi Patel",
    "Nandish Patel",
    "Yashvi Sanghvi",
  ];

  return (
    <section className="w-full border-y border-border bg-muted/50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Built & Maintained By
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
          {logos.map((logo, index) => (
            <div
              key={index}
              className="flex h-8 items-center justify-center text-lg font-semibold text-muted-foreground/60"
            >
              {logo}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LogoBar;
