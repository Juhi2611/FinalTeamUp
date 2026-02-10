import { useNavigate } from "react-router-dom";

const DemoLockModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const navigate = useNavigate();

  if (!open) return null;

  const handleSignup = () => {
    onClose();
    navigate("/auth");
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-scale-in max-w-md text-center">
        <h2 className="font-display text-xl font-bold mb-2">
          You are in Guest Mode
        </h2>

        <p className="text-muted-foreground mb-6">
          Sign up to unlock this feature and start collaborating.
        </p>

        <div className="flex justify-center gap-3">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>

          <button className="btn-primary" onClick={handleSignup}>
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoLockModal;
