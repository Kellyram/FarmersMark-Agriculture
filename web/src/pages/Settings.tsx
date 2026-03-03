import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/UI/Button";
import { Input } from "../components/UI/Input";
import {
  User,
  Trash2,
  Key,
  Info,
  ShieldAlert,
  Save,
  Edit2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase.config";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const SettingsPage: React.FC = () => {
  const { user, updateUserPassword, deleteAccount } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();

  // Profile State
  const [profile, setProfile] = useState({
    fullName: "",
    farmName: "",
    location: "",
    primaryCrops: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);

  React.useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as any);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setFetchingProfile(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    setMessage(null);
    try {
      await setDoc(doc(db, "users", user.uid), profile);
      setMessage({ type: "success", text: "Profile updated successfully!" });
      setIsEditing(false);
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Failed to save profile",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      await updateUserPassword(newPassword);
      setMessage({ type: "success", text: "Password updated successfully!" });
      setNewPassword("");
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Failed to update password",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setMessage(null);
    setLoading(true);
    try {
      await deleteAccount();
      navigate("/login");
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Failed to delete account",
      });
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-primary/10 rounded-2xl">
          <User className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Account Settings
          </h1>
          <p className="text-muted font-medium">
            Manage your profile and security preferences.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border-l-4 ${
            message.type === "success"
              ? "bg-green-50 border-green-500 text-green-700"
              : "bg-red-50 border-danger text-danger"
          } font-bold text-sm animate-in fade-in slide-in-from-top-2`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {/* Profile Info */}
        <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-primary">
              <Info className="w-5 h-5" />
              <h2 className="text-xl font-bold">Profile Information</h2>
            </div>
            {!isEditing ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                disabled={fetchingProfile}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveProfile}
                isLoading={loading}
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            )}
          </div>

          {fetchingProfile ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-muted uppercase tracking-widest mb-1 block">
                  Full Name
                </label>
                {isEditing ? (
                  <Input
                    value={profile.fullName}
                    onChange={(e) =>
                      setProfile({ ...profile, fullName: e.target.value })
                    }
                    placeholder="Enter full name"
                  />
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-700 font-medium">
                    {profile.fullName || (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-black text-muted uppercase tracking-widest mb-1 block">
                  Farm Name
                </label>
                {isEditing ? (
                  <Input
                    value={profile.farmName}
                    onChange={(e) =>
                      setProfile({ ...profile, farmName: e.target.value })
                    }
                    placeholder="Enter farm name"
                  />
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-700 font-medium">
                    {profile.farmName || (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-black text-muted uppercase tracking-widest mb-1 block">
                  Location (Province/District)
                </label>
                {isEditing ? (
                  <Input
                    value={profile.location}
                    onChange={(e) =>
                      setProfile({ ...profile, location: e.target.value })
                    }
                    placeholder="e.g. Lusaka, Chongwe"
                  />
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-700 font-medium">
                    {profile.location || (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-black text-muted uppercase tracking-widest mb-1 block">
                  Primary Crops
                </label>
                {isEditing ? (
                  <Input
                    value={profile.primaryCrops}
                    onChange={(e) =>
                      setProfile({ ...profile, primaryCrops: e.target.value })
                    }
                    placeholder="e.g. Maize, Soybeans"
                  />
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-700 font-medium">
                    {profile.primaryCrops || (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-black text-muted uppercase tracking-widest mb-1 block">
                  Email Address
                </label>
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-400 font-medium italic">
                  {user?.email}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Security / Password */}
        <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <Key className="w-5 h-5" />
            <h2 className="text-xl font-bold">Security</h2>
          </div>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              placeholder="Min 6 characters"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button type="submit" className="w-full" isLoading={loading}>
              Update Password
            </Button>
          </form>
        </section>

        {/* Danger Zone */}
        <section className="md:col-span-2 bg-red-50/50 rounded-3xl p-8 border border-red-100 space-y-6">
          <div className="flex items-center gap-3 text-danger">
            <ShieldAlert className="w-6 h-6" />
            <h2 className="text-xl font-bold">Danger Zone</h2>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="font-bold text-gray-900">Delete Account</p>
              <p className="text-sm text-red-700/70 font-medium">
                Once deleted, your account and data cannot be recovered.
              </p>
            </div>
            {!showDeleteConfirm ? (
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Delete My Account
              </Button>
            ) : (
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2">
                <Button
                  variant="ghost"
                  className="text-red-700"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteAccount}
                  isLoading={loading}
                >
                  Yes, Delete Forever
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
