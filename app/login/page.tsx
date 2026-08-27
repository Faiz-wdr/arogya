"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Activity, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Debug log to check if Env variables are loaded in client browser
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    console.log("Loaded API Key prefix:", key ? `${key.substring(0, 5)}... (len: ${key.length})` : "undefined");
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === "staff") {
        router.push("/staff/schedule");
      } else if (profile.role === "designer") {
        router.push("/designer");
      }
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center gap-3">
          <img src="/favicon.svg" alt="Arogya Logo" className="h-12 w-12 animate-pulse object-contain" />
          <span className="text-sm font-medium text-slate-500">Checking session...</span>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthLoading(true);

    if (!email || !password) {
      setError("Please fill in all fields.");
      setAuthLoading(false);
      return;
    }

    try {
      // Sign In only
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Login error details:", err);
      let errMsg = "Authentication failed. Please check your credentials.";
      if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        errMsg = "Invalid email or password.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Please enter a valid email address.";
      } else if (err.message && err.message.includes("api-key-not-valid")) {
        errMsg = "Firebase configuration error: The API key provided is not valid in Google Services. Please check your .env.local file or Firebase console.";
      }
      setError(errMsg);
      setAuthLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-teal-50/8 p-4 font-sans">
      <main className="w-full max-w-md bg-white rounded-2xl border border-slate-100 p-6 sm:p-8">
        {/* Hospital Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-teal-50 overflow-hidden mb-3">
            <img src="/favicon.svg" alt="Arogya Logo" className="h-7 w-7 object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Arogya Hospital</h1>
          <p className="text-sm text-slate-500 mt-1">Poster Management System</p>
        </div>

        {/* Form Title */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700">Sign In to Your Account</h2>
          <p className="text-xs text-slate-400 mt-0.5">Enter your staff credentials below</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-xs font-medium text-red-600 leading-relaxed">
            {error}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
              <input
                id="email"
                type="email"
                placeholder="staff@arogya.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 placeholder:text-slate-400 h-12"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 placeholder:text-slate-400 h-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4.5 w-4.5" />
                ) : (
                  <Eye className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold text-sm rounded-xl py-3 mt-4 transition-all duration-150 active:scale-[0.98] flex items-center justify-center h-12 cursor-pointer"
          >
            {authLoading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
