"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface UserProfile {
  name: string;
  email: string;
  role: "staff" | "designer";
  isActive: boolean;
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (firebaseUser) {
        // Fetch and listen to user profile in Firestore
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          let userDoc = await getDoc(userDocRef);

          if (!userDoc.exists()) {
            // Auto-provision user as staff during development/testing
            const defaultProfile: UserProfile = {
              name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Hospital Staff",
              email: firebaseUser.email || "",
              role: "staff",
              isActive: true,
              createdAt: serverTimestamp(),
            };
            await setDoc(userDocRef, defaultProfile);
          }

          // Real-time listener for user profile changes
          unsubscribeDoc = onSnapshot(
            userDocRef,
            (snapshot) => {
              if (snapshot.exists()) {
                setProfile(snapshot.data() as UserProfile);
              } else {
                setProfile(null);
              }
              setLoading(false);
            },
            (error) => {
              console.error("Error listening to profile changes:", error);
              setLoading(false);
            }
          );
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setProfile(null);
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
