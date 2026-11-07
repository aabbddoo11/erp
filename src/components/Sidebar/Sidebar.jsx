
import {
  Home,
  ShoppingCart,
  FileText,
  Package,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Sidebar.css";

const menuItems = [
  {
    label: "لوحة التحكم",
    icon: Home,
    path: "/",
  },
  {
    label: "نقطة البيع",
    icon: ShoppingCart,
    path: "/pos",
  },
  {
    label: "الفواتير",
    icon: FileText,
    path: "/sales",
  },
  {
    label: "المنتجات",
    icon: Package,
    path: "/products",
  },
 
  {
    label: "التقارير",
    icon: BarChart3,
    path: "/reports",
  },
  {
    label: "الإعدادات",
    icon: Settings,
    path: "/settings",
  },
];

function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="sidebar">
      <nav className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-icon">
                <Icon size={20} strokeWidth={2} />
              </span>

              <span className="sidebar-label">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <button
          type="button"
          className="sidebar-item sidebar-logout"
          onClick={handleLogout}
        >
          <span className="sidebar-icon">
            <LogOut size={20} strokeWidth={2} />
          </span>

          <span className="sidebar-label">
            تسجيل الخروج
          </span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
