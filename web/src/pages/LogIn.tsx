import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase.config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { mapAuthCodeToMessage } from "../utils/authHelpers";
import { Button } from "../components/UI/Button";
import { Input } from "../components/UI/Input";
import { Leaf, LogIn } from "lucide-react";

export const LogInPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/settings";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(mapAuthCodeToMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white/70 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/40 shadow-2xl animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl mb-6">
            <Leaf className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
            Welcome Back
          </h2>
          <p className="text-muted font-medium">
            Please sign in to your accounts.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-danger p-4 rounded-lg">
              <p className="text-sm font-bold text-danger">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full group" isLoading={loading}>
            Sign In
            <LogIn className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </form>

        <p className="text-center text-sm font-bold text-muted uppercase tracking-widest mt-8">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="text-primary hover:text-primary-strong underline underline-offset-4 decoration-2"
          >
            Create One
          </Link>
        </p>
      </div>
    </div>
  );
};
