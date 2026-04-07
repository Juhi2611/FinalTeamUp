const DemoLockModal = ({
  open,
  onClose,
  onSignup,
}: {
  open: boolean;
  onClose: () => void;
  onSignup: () => void;
}) => {
  if (!open) return null;

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

          <button
            className="btn-primary"
            onClick={() => {
              onClose();
              onSignup(); // 🔥 ONLY THIS
            }}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoLockModal;
