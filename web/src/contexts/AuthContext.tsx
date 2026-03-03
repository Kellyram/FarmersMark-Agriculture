import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signOut,
  updatePassword,
  updateProfile,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "../firebase.config";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  updateUserProfile: (displayName: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  const updateUserPassword = async (password: string) => {
    if (user) {
      await updatePassword(user, password);
    }
  };

  const updateUserProfile = async (displayName: string) => {
    if (user) {
      await updateProfile(user, { displayName });
    }
  };

  const deleteAccount = async () => {
    if (user) {
      await deleteUser(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        updateUserPassword,
        updateUserProfile,
        deleteAccount,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
