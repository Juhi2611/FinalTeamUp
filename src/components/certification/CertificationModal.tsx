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
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
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
          <div
            ref={certificateRef}
            className="bg-white text-black p-12 relative"
            style={{ width: "210mm", minHeight: "297mm", fontFamily: "sans-serif" }}
          >
            {/* Header */}
            <div className="border-b-[4px] border-primary pb-8 mb-8 flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter mb-2">
                  VERIFIED PROJECT PORTFOLIO
                </h1>
                <p className="text-xl text-slate-600 font-medium">Official TeamUp Certification</p>
              </div>
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center border-2 border-primary">
                <span className="text-primary font-bold text-2xl">TU</span>
              </div>
            </div>

            {/* Student Info */}
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-slate-800 mb-1">{userProfile.fullName || "Student Name"}</h2>
              <p className="text-lg text-slate-600 font-medium">{userProfile.primaryRole || "Team Member"}</p>
              <p className="text-sm text-slate-500 mt-2">Certified across {teams.length} project(s)</p>
            </div>

            {/* Project Timelines */}
            <div className="mb-10 flex-1 space-y-8">
              <h3 className="text-xl font-bold text-slate-800 mb-6 uppercase tracking-wider border-b border-slate-200 pb-2">
                Project Journey & Testimonials
              </h3>

              {teams.map((team, idx) => {
                const memberData = team.members.find(m => m.userId === userProfile.id);
                const testimonial = (memberData as any)?.testimonial;

                return (
                  <div key={team.id || idx} className="pl-4 border-l-2 border-slate-200 relative">
                    <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-[6px] ring-4 ring-primary/20" />

                    <div className="mb-2 flex justify-between items-start gap-4">
                      <h4 className="text-2xl font-bold text-slate-800">{team.name}</h4>
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wide rounded-full whitespace-nowrap">
                        {STATUS_MAP[team.status || "forming"] || team.status}
                      </span>
                    </div>

                    <p className="text-slate-600 font-medium mb-1">
                      Role: <span className="text-primary">{memberData?.role || "Member"}</span>
                    </p>

                    <p className="text-sm text-slate-500 leading-relaxed max-w-[90%] mb-4">
                      {team.description}
                    </p>

                    {testimonial ? (
                      <div className="bg-slate-50/80 p-4 border-l-4 border-primary rounded-r-lg mt-2">
                        <p className="text-xs text-primary font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                          Team Leader Testimonial ({team.leaderName || "Leader"})
                        </p>
                        <p className="text-sm text-slate-700 italic font-medium leading-relaxed">
                          "{testimonial}"
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No testimonial provided by the leader yet.</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer & QR Code */}
            <div className="absolute bottom-12 left-12 right-12 pt-8 border-t-[2px] border-slate-200 flex justify-between items-end">
              <div>
                <p className="text-sm text-slate-500 mb-1">Verify authenticity and view completed tasks by scanning the QR code</p>
                <p className="text-xs text-slate-400 font-mono">{verificationUrl}</p>
              </div>
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                <QRCodeSVG value={verificationUrl} size={100} level="M" />
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
