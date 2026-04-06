import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import emailjs from "@emailjs/browser";
import { useRef, useState } from "react";

const ContactUs = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);

  const sendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;

    setLoading(true);

    emailjs
      .sendForm(
        "service_ga46jnw",
        "template_l6xkuaj",
        formRef.current,
        "NTQ_HSkYjufQlVakK"
      )
      .then(() => {
        alert("Message sent successfully!");
        formRef.current?.reset();
      })
      .catch((error) => {
        console.error(error);
        alert("Failed to send message. Please try again.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <section id="contact" className="w-full py-20 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#1f73e8]">
          <div className="grid items-center gap-12 px-8 py-14 lg:grid-cols-2 lg:px-16 lg:py-20">

            {/* Left */}
            <div className="flex flex-col gap-6 text-white">
              <h2 className="text-3xl font-bold sm:text-4xl">
                Contact Us
              </h2>

              <p className="max-w-md text-lg text-white/80">
                Have a question or feedback? Drop us a message.
              </p>

              <form
                ref={formRef}
                onSubmit={sendEmail}
                className="flex max-w-md flex-col gap-4"
              >
                <Input
                  name="user_name"
                  placeholder="Your name"
                  required
                  className="bg-white/10 text-white placeholder:text-white/60"
                />

                <Input
                  name="user_email"
                  type="email"
                  placeholder="Your email"
                  required
                  className="bg-white/10 text-white placeholder:text-white/60"
                />

                <Textarea
                  name="message"
                  placeholder="Your message"
                  rows={4}
                  required
                  className="bg-white/10 text-white placeholder:text-white/60 resize-none"
                />

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="mt-2 w-fit rounded-full bg-orange-500 px-8 text-white disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Send Message →"}
                </Button>
              </form>
            </div>

            {/* Right Illustration */}
            <div className="relative flex items-center justify-center">
              {/* Soft curved background */}
              <div className="absolute right-[-20%] top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-white/10" />

              <img
                src="/images/landing/team-illustration.avif"
                alt="Contact TeamUp illustration"
                className="relative z-10 w-full max-w-[420px] object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactUs;
