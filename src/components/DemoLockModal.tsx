import { useNavigate } from "react-router-dom";

const DemoLockModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-scale-in max-w-md text-center">
        <h2 className="font-display text-xl font-bold mb-2">
          Sign up to continue
        </h2>

        <p className="text-muted-foreground mb-6">
          This feature is available after creating an account.
        </p>

        <div className="flex justify-center gap-3">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>

          <button
            className="btn-primary"
            onClick={() => navigate("/signup")}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoLockModal;
