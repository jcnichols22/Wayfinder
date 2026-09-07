import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/plan", label: "Plan", icon: "🗺️" },
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/reports/daily", label: "Daily", icon: "📅" },
  { to: "/reports/monthly", label: "Monthly", icon: "🗓️" },
  { to: "/locations", label: "Places", icon: "📍" },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-borderMuted bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg justify-between px-2 py-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-medium ${
                isActive ? "text-accent" : "text-slate-400"
              }`
            }
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
