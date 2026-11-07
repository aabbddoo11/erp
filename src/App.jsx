
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Accounts from "./pages/Owner/Accounts";
import Layout from "./components/Layout/Layout";
import OwnerLayout from "./components/OwnerLayout/OwnerLayout";

import Login from "./pages/Login/Login";
import Products from "./pages/Products/Products";
import Dashboard from "./pages/Dashboard/Dashboard";
import Sales from "./pages/Sales/Sales";
import POS from "./pages/POS/POS";
import Reports from "./pages/Reports/Reports";
import Settings from "./pages/Settings/Settings";
import OwnerDashboard from "./pages/OwnerDashboard/OwnerDashboard";

function ProtectedLayout() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <p dir="rtl">جارٍ تحميل النظام...</p>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === "owner") {
    return <Navigate to="/owner" replace />;
  }

  return <Layout />;
}

function OwnerProtectedLayout() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <p dir="rtl">جارٍ التحقق من صلاحيات المالك...</p>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "owner") {
    return <Navigate to="/" replace />;
  }

  return <OwnerLayout />;
}

function OwnerAccountsPlaceholder() {
  return (
    <div dir="rtl">
      <h2>إدارة الحسابات</h2>
      <p>سنجهز صفحة إدارة الحسابات في الخطوة التالية.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/owner" element={<OwnerProtectedLayout />}>
          <Route index element={<OwnerDashboard />} />
        <Route path="accounts" element={<Accounts />} />
        </Route>

        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="sales" element={<Sales />} />
          <Route path="settings" element={<Settings />} />
          <Route path="pos" element={<POS />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
