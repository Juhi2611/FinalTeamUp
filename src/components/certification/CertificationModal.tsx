import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { Team, UserProfile, getUserTeams } from "@/services/firestore";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { QRCodeSVG } from "qrcode.react";

interface CertificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userProfile: UserProfile;
}

const STATUS_MAP: Record<string, string> = {
  forming: "Ideation Phase",
  active: "Development Phase",
  complete: "Launched / Completed",
};

export default function CertificationModal({ open, onOpenChange, userProfile }: CertificationModalProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [success, setSuccess] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);

  const verificationUrl = `${window.location.origin}/verify-portfolio/${userProfile.id || "user"}`;

  useEffect(() => {
    if (open && userProfile.id) {
      setLoading(true);
      getUserTeams(userProfile.id)
        .then((userTeams) => {
          setTeams(userTeams);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, userProfile.id]);

  const generatePDF = async () => {
    if (!certificateRef.current) return;
    setIsGenerating(true);
    try {
      const pages = Array.from(certificateRef.current.querySelectorAll('.certificate-page'));
      if (pages.length === 0) return;

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(pages[i] as HTMLElement, {
          scale: 2,
          useCORS: true,
        });
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      pdf.save(`${userProfile.fullName || "Student"}_Verified_Portfolio.pdf`);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
      }, 3000);
    } catch (err) {
      console.error("Failed to generate PDF", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Chunking logic
  const CHUNK_SIZE = 3;
  const teamChunks: Team[][] = [];
  for (let i = 0; i < teams.length; i += CHUNK_SIZE) {
    teamChunks.push(teams.slice(i, i + CHUNK_SIZE));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Verified Project Portfolio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Generate your official multi-team PDF portfolio. This document compiles all the teams you are a part of, their current status, and testimonials written by your Team Leaders.
          </p>

          {loading ? (
            <div className="flex justify-center items-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : teams.length === 0 ? (
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-700">You are not part of any teams yet. Join a team and contribute to generate your portfolio!</p>
            </div>
          ) : (
            <button
              onClick={generatePDF}
              disabled={isGenerating || success}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating PDF...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Downloaded Successfully!
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download Portfolio
                </>
              )}
            </button>
          )}
        </div>
      </DialogContent>

      {/* Hidden Certificate DOM for html2canvas */}
      {teams.length > 0 && (
        <div className="fixed top-[200vh] pointer-events-none opacity-0">
          <div ref={certificateRef} className="flex flex-col gap-10">
            {teamChunks.map((chunk, pageIndex) => (
              <div
                key={pageIndex}
                className="certificate-page bg-white relative overflow-hidden"
                style={{ width: "210mm", height: "297mm", fontFamily: "sans-serif" }}
              >
                {/* Subtle Cyan Watermark/Background Pattern */}
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-50 rounded-full blur-3xl opacity-60"></div>
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-100/50 rounded-full blur-3xl opacity-60"></div>
                
                <div className="relative z-10 w-full h-full p-12 flex flex-col">
                  {/* Header (Only full on Page 1) */}
                  {pageIndex === 0 ? (
                    <>
                      <div className="border-b-[4px] border-cyan-500 pb-8 mb-8 flex justify-between items-start">
                        <div>
                          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter mb-2">
                            VERIFIED PROJECT PORTFOLIO
                          </h1>
                          <p className="text-xl text-cyan-600 font-bold bg-cyan-50 px-3 py-1 inline-block rounded-md">
                            Official TeamUp Certification
                          </p>
                        </div>
                        <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-200">
                          <span className="text-white font-black text-2xl tracking-wider">TU</span>
                        </div>
                      </div>

                      {/* Student Info */}
                      <div className="mb-10">
                        <h2 className="text-3xl font-black text-slate-800 mb-1">{userProfile.fullName || "Student Name"}</h2>
                        <p className="text-lg text-slate-600 font-semibold">{userProfile.primaryRole || "Team Member"}</p>
                        <p className="text-sm text-cyan-600 font-medium mt-2 bg-cyan-50 px-2.5 py-1 inline-block rounded border border-cyan-100">
                          Certified across {teams.length} project(s)
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="border-b-[2px] border-cyan-200 pb-4 mb-8 flex justify-between items-center">
                      <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">VERIFIED PROJECT PORTFOLIO</h1>
                        <p className="text-sm text-cyan-600 font-semibold">{userProfile.fullName || "Student Name"} • Continued</p>
                      </div>
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">TU</span>
                      </div>
                    </div>
                  )}

                  {/* Project Timelines */}
                  <div className="flex-1 space-y-8">
                    {pageIndex === 0 && (
                      <h3 className="text-lg font-bold text-slate-800 mb-6 uppercase tracking-widest border-b-2 border-slate-100 pb-2">
                        Project Journey & Testimonials
                      </h3>
                    )}

                    {chunk.map((team, idx) => {
                      const memberData = team.members.find(m => m.userId === userProfile.id);
                      const testimonial = (memberData as any)?.testimonial;

                      return (
                        <div key={team.id || idx} className="pl-5 border-l-2 border-cyan-200 relative mb-8">
                          <div className="absolute w-3.5 h-3.5 bg-cyan-500 rounded-full -left-[9px] top-[6px] ring-4 ring-cyan-100 shadow-sm" />

                          <div className="mb-2 flex justify-between items-start gap-4">
                            <h4 className="text-xl font-bold text-slate-800">{team.name}</h4>
                            <span className="px-3 py-1 bg-cyan-50 text-cyan-700 text-[11px] font-bold uppercase tracking-wider rounded-full border border-cyan-100 whitespace-nowrap shadow-sm">
                              {STATUS_MAP[team.status || "forming"] || team.status}
                            </span>
                          </div>

                          <p className="text-slate-600 font-medium mb-1.5 text-sm">
                            Role: <span className="text-cyan-600 font-bold">{memberData?.role || "Member"}</span>
                          </p>

                          <p className="text-sm text-slate-500 leading-relaxed max-w-[95%] mb-4">
                            {team.description}
                          </p>

                          {testimonial ? (
                            <div className="bg-gradient-to-r from-cyan-50/80 to-transparent p-4 border-l-[3px] border-cyan-500 rounded-r-xl mt-3">
                              <p className="text-[11px] text-cyan-600 font-black uppercase tracking-widest mb-2 flex items-center gap-1">
                                Team Leader Testimonial ({team.leaderName || "Leader"})
                              </p>
                              <p className="text-sm text-slate-700 italic font-medium leading-relaxed">
                                "{testimonial}"
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic bg-slate-50/50 p-2 border-l-[3px] border-slate-200 rounded-r-md mt-2 inline-block">
                              No testimonial provided by the leader yet.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer & QR Code */}
                  <div className="mt-auto pt-6 border-t-[2px] border-cyan-100 flex justify-between items-end relative z-20">
                    <div>
                      <p className="text-sm text-slate-500 mb-1 font-medium">Verify authenticity and view real-time status online by scanning the QR code</p>
                      <p className="text-xs text-cyan-600/80 font-mono font-medium bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100 inline-block">{verificationUrl}</p>
                    </div>
                    <div className="p-2 bg-white rounded-xl shadow-md border-[2px] border-cyan-200">
                      <QRCodeSVG value={verificationUrl} size={90} level="M" />
                    </div>
                  </div>
                  
                  {/* Page Number Indicator */}
                  <div className="absolute bottom-6 right-12 text-xs font-bold text-slate-300">
                    Page {pageIndex + 1} of {teamChunks.length}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}
