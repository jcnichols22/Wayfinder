import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { username, login, loading } = useAuth();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && username) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(user, pass);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm">
        <div className="mb-1 flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
          <h1 className="text-2xl font-bold">Wayfinder</h1>
        </div>
        <p className="mb-6 text-sm text-slate-400">Sign in to your self-hosted instance.</p>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-slate-300">Username</span>
          <input
            className="input"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoCapitalize="none"
            autoFocus
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm text-slate-300">Password</span>
          <input
            className="input"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </label>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
