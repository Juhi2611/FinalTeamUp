import { useState } from "react";
import LegalModal from "./LegalModal";
const Footer = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="w-full py-4 flex items-center justify-center">
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition"
        >
          <span className="font-semibold">TeamUp</span> © 2026 · All rights reserved
        </button>
      </div>

      {open && <LegalModal onClose={() => setOpen(false)} />}
    </>
  );
};

export default Footer;