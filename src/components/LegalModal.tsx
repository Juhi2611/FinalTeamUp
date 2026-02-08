interface LegalModalProps {
  onClose: () => void;
}

const LegalModal = ({ onClose }: LegalModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-xl shadow-xl p-6 relative">
        
        {/* Title */}
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Legal Information
        </h2>

        {/* Content */}
        <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
          <p>
            <strong>TeamUp</strong> is a collaborative platform designed to help
            individuals connect, build teams, and work together on projects.
          </p>

          <p>
            © 2026 TeamUp. All rights reserved.
          </p>

          <p>
            Unauthorized reproduction, distribution, or misuse of any part of
            this platform, including content, branding, and functionality, is
            strictly prohibited.
          </p>

          <p>
            TeamUp is provided “as is” without warranties of any kind. We are not
            responsible for user-generated content or team outcomes.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm bg-secondary hover:bg-secondary/80 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
