import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Plan from "./pages/Plan";
import Dashboard from "./pages/Dashboard";
import DailyReport from "./pages/DailyReport";
import MonthlyReport from "./pages/MonthlyReport";
import Locations from "./pages/Locations";
import BottomNav from "./components/BottomNav";
import SyncBanner from "./components/SyncBanner";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { username, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">Loading…</div>
    );
  }
  if (!username) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen pb-20">
      <SyncBanner />
      <div className="mx-auto max-w-lg px-4 pt-6">{children}</div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedLayout>
              <Home />
            </ProtectedLayout>
          }
        />
        <Route
          path="/plan"
          element={
            <ProtectedLayout>
              <Plan />
            </ProtectedLayout>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          }
        />
        <Route
          path="/reports/daily"
          element={
            <ProtectedLayout>
              <DailyReport />
            </ProtectedLayout>
          }
        />
        <Route
          path="/reports/monthly"
          element={
            <ProtectedLayout>
              <MonthlyReport />
            </ProtectedLayout>
          }
        />
        <Route
          path="/locations"
          element={
            <ProtectedLayout>
              <Locations />
            </ProtectedLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
