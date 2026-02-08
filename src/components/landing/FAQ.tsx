import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is TeamUp used for?",
    answer:
      "TeamUp helps individuals and teams plan work, collaborate efficiently, and track progress—all in one organized workspace.",
  },
  {
    question: "Who can use TeamUp?",
    answer:
      "TeamUp is designed for students, creators, developers, and growing teams who want a simple and effective way to work together.",
  },
  {
    question: "How do teams collaborate on TeamUp?",
    answer:
      "Teams can create shared spaces, assign tasks, track progress, and stay aligned without switching between multiple tools.",
  },
  {
    question: "Can I manage multiple teams or projects?",
    answer:
      "Yes. You can work with different teams or projects at the same time, keeping everything structured and easy to manage.",
  },
  {
    question: "How is my data handled?",
    answer:
      "Your data is stored securely and handled responsibly. Privacy and data protection are built into the platform to ensure your work remains safe and under your control.",
  },
];

const FAQ = () => {
  return (
    <section className="w-full bg-muted/50 py-20 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left Column - Header */}
          <div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground">
              Find answers to common questions about our platform and services.
            </p>
          </div>

          {/* Right Column - Accordion */}
          <div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-border">
                  <AccordionTrigger className="text-left text-foreground hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
