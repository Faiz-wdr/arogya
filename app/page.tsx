"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Activity } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (profile) {
        if (profile.role === "staff") {
          router.push("/staff/schedule");
        } else if (profile.role === "designer") {
          router.push("/designer");
        }
      } else {
        // Fallback if user is logged in but profile hasn't loaded/created
        router.push("/login");
      }
    }
  }, [user, profile, loading, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Activity className="h-10 w-10 text-teal-600 animate-pulse" />
        <span className="text-sm font-medium text-slate-500">Redirecting...</span>
      </div>
    </div>
  );
}
