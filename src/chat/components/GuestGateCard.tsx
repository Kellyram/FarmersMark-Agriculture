type GuestGateCardProps = {
  onSignUp: () => void;
  onSignIn: () => void;
};

export default function GuestGateCard({ onSignUp, onSignIn }: GuestGateCardProps) {
  return (
    <div className="guest-gate-card">
      <p>Create a free account to read the full answer, ask follow-ups, and save your chat history.</p>
      <div className="guest-gate-actions">
        <button type="button" className="cta" onClick={onSignUp}>
          Create Account
        </button>
        <button type="button" className="ghost" onClick={onSignIn}>
          Sign In
        </button>
      </div>
    </div>
  );
}
