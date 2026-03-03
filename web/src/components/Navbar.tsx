import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./UI/Button";
import { Leaf, User, LogOut, Settings, MessageSquare } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link
            to="/"
            className="flex items-center gap-2 text-primary font-black text-xl tracking-tight"
          >
            <Leaf className="w-8 h-8 rotate-12" />
            <span>
              Farmers<span className="text-primary/70">Mark</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/chat"
                  className="flex items-center gap-2 text-muted hover:text-primary font-bold transition-colors"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="hidden sm:inline">Chat</span>
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-2 text-muted hover:text-primary font-bold transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  <span className="hidden sm:inline">Settings</span>
                </Link>
                <div className="h-4 w-px bg-gray-200" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-muted flex items-center gap-2"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                  <User className="w-4 h-4 text-primary" />
                  <span className="text-xs font-black text-primary truncate max-w-[120px]">
                    {user.email}
                  </span>
                </div>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
