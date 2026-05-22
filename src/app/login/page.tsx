"use client";

import { signIn } from "next-auth/react";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const T = {
  purple: "#8b18e8",
  gradPM: "linear-gradient(135deg,#8b18e8,#e010c8)",
};

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8ff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: T.gradPM, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 auto 14px" }}>H</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0a0a0f", letterSpacing: "-0.02em" }}>Hexa SmartLedger</div>
          <div style={{ fontSize: 14, color: "rgba(10,10,15,0.45)", marginTop: 4 }}>Sign in to continue</div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(10,10,15,0.07)", borderRadius: 20, padding: "32px 28px", backdropFilter: "blur(14px)" }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#0a0a0f", marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{ width: "100%", padding: "10px 14px", border: "1px solid rgba(10,10,15,0.12)", borderRadius: 10, fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#0a0a0f", marginBottom: 6 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ width: "100%", padding: "10px 14px", border: "1px solid rgba(10,10,15,0.12)", borderRadius: 10, fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" }}
              />
            </div>
            {error && (
              <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991b1b", marginBottom: 16 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "11px 0", background: T.gradPM, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
