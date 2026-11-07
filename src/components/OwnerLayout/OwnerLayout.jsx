
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Shirt,
  LogOut,
  ShieldCheck,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./OwnerLayout.css";

const menuItems = [
  {
    label: "لوحة التحكم",
    path: "/owner",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "إدارة الحسابات",
    path: "/owner/accounts",
    icon: Users,
  },
];

function OwnerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="owner-layout" dir="rtl">
      <aside className="owner-sidebar">
        <div className="owner-brand">
          <div className="owner-brand-icon">
            <Shirt size={24} />
          </div>
          <div className="owner-brand-text">
            <strong>ERP الملابس</strong>
            <span>لوحة الإدارة</span>
          </div>
        </div>

        <div className="owner-admin-card">
          <div className="owner-admin-avatar">
            <ShieldCheck size={22} />
          </div>
          <div className="owner-admin-info">
            <strong>{user?.name || "المالك"}</strong>
            <span>مدير النظام</span>
          </div>
        </div>

        <div className="owner-nav-label">القائمة الرئيسية</div>

        <nav className="owner-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `owner-nav-link${isActive ? " active" : ""}`
                }
              >
                <Icon size={19} />
                <span>{item.label}</span>
                <ChevronLeft size={16} className="owner-nav-arrow" />
              </NavLink>
            );
          })}
        </nav>

        <div className="owner-sidebar-footer">
          <div className="owner-security-note">
            <ShieldCheck size={18} />
            <span>صلاحيات إدارة المالك</span>
          </div>

          <button
            type="button"
            className="owner-logout-button"
            onClick={handleLogout}
          >
            <LogOut size={19} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      <div className="owner-main">
        <header className="owner-topbar">
          <div>
            <span className="owner-topbar-eyebrow">مساحة الإدارة</span>
            <h1>لوحة المالك</h1>
          </div>

          <div className="owner-topbar-user">
            <div className="owner-topbar-avatar">
              {(user?.name || "م").trim().charAt(0)}
            </div>
            <div>
              <strong>{user?.name || "المالك"}</strong>
              <span>مالك النظام</span>
            </div>
          </div>
        </header>

        <main className="owner-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default OwnerLayout;
