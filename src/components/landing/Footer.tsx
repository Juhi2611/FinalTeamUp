import { Linkedin, Instagram, Twitter, Facebook, Zap } from "lucide-react";

const Footer = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <footer className="relative overflow-hidden bg-background">
      
      {/* BIG BACKGROUND BRAND TEXT */}
      <div className="hidden sm:block pointer-events-none absolute bottom-[-90px] left-1/2 -translate-x-1/2 select-none">
        <span className="text-[18rem] font-display font-extrabold tracking-tight text-primary/20">
          TEAMUP
        </span>
      </div>

      {/* FOOTER CONTENT */}
      <div className="relative container mx-auto px-6 pt-16 pb-16 sm:pt-30 sm:pb-60">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">

          {/* BRAND COLUMN */}
          <div className="space-y-4">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => scrollTo("home")}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold">
                TeamUp
              </span>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Build stronger teams, collaborate smarter, and turn ideas into
              real outcomes with TeamUp.
            </p>

            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} TeamUp. All rights reserved.
            </p>
          </div>

          {/* MENU */}
          <div>
            <h4 className="mb-4 text-sm font-semibold">Menu</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <button onClick={() => scrollTo("home")} className="hover:text-foreground">
                  Home
                </button>
              </li>
              <li>
                <button onClick={() => scrollTo("features")} className="hover:text-foreground">
                  Features
                </button>
              </li>
              <li>
                <button onClick={() => scrollTo("about")} className="hover:text-foreground">
                  About
                </button>
              </li>
              <li>
                <button onClick={() => scrollTo("contact")} className="hover:text-foreground">
                  Contact
                </button>
              </li>
            </ul>
          </div>

          {/* SOCIAL */}
          <div>
            <h4 className="mb-4 text-sm font-semibold">Social</h4>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li className="flex items-center gap-3">
                <Linkedin className="h-4 w-4" />
                <span>LinkedIn</span>
              </li>
              <li className="flex items-center gap-3">
                <Instagram className="h-4 w-4" />
                <span>Instagram</span>
              </li>
              <li className="flex items-center gap-3">
                <Twitter className="h-4 w-4" />
                <span>Twitter</span>
              </li>
              <li className="flex items-center gap-3">
                <Facebook className="h-4 w-4" />
                <span>Facebook</span>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
