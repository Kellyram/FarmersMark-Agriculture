import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Navbar } from "./components/Navbar";
import { SignUpPage } from "./pages/SignUp";
import { LogInPage } from "./pages/LogIn";
import { SettingsPage } from "./pages/Settings";
import { ChatPage } from "./pages/Chat";
import { Button } from "./components/UI/Button";
import { Leaf, ArrowRight, ShieldCheck, Zap, Globe } from "lucide-react";

const HomePage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center space-y-8 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 text-primary font-bold text-sm animate-in fade-in slide-in-from-top-4 duration-700">
          <Zap className="w-4 h-4" />
          <span>
            New: AI-Powered Chat bot for all your algricultural queries
          </span>
        </div>

        <h1 className="text-6xl md:text-7xl font-black text-gray-900 tracking-tight leading-[1.05] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          Your Expert AI Agronomist for{" "}
          <span className="text-primary italic font-serif">Zambian</span>{" "}
          Farming
        </h1>

        <p className="text-xl text-muted font-medium max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          Get instant, accurate answers for your farm. Trained directly on
          official Zambian agricultural guidelines, our AI helps you navigate
          crop management, soil health, and compliance—without digging through
          hundreds of pages of manuals.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <Link to="/signup">
            <Button size="lg" className="group h-16 px-10 text-xl">
              Get Started Free
              <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-20 animate-in fade-in zoom-in duration-1000 delay-500">
          <div className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-white border border-gray-100 shadow-sm">
            <div className="p-3 bg-green-50 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold">Instant Expert Advice</h3>
            <p className="text-sm text-center text-muted">
              Ask complex agronomy questions and get immediate, conversational
              answers based on proven agricultural science and local farming
              standards.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-white border border-gray-100 shadow-sm">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-bold">100% Compliance Backed</h3>
            <p className="text-sm text-center text-muted">
              Our AI is strictly trained on official Zambian agricultural
              compliance documents, ensuring your farming practices always meet
              local regulations.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-white border border-gray-100 shadow-sm">
            <div className="p-3 bg-purple-50 rounded-xl">
              <Globe className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-bold">Smart Crop Management</h3>
            <p className="text-sm text-center text-muted">
              Make informed decisions on soil organic matter, conservation
              agriculture, and harvest preparation faster than ever before.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-accent-cream selection:bg-primary/20 selection:text-primary">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/login" element={<LogInPage />} />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>

          <footer className="py-12 text-center text-muted text-sm font-medium">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Leaf className="w-5 h-5 text-primary opacity-50" />
              <span className="font-black text-gray-400">FarmersMark</span>
            </div>
            <p>&copy; 2026 FarmersMark Agriculture. All rights reserved.</p>
          </footer>
        </div>
      </AuthProvider>
    </Router>
  );
};

export default App;
