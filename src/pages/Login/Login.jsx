import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Login.css";

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <p>جارٍ التحقق من الجلسة...</p>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login({ email, password });
    } catch (err) {
      setError(err.message || "تعذر تسجيل الدخول");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="auth-page">
      <div className="auth-brand">
        <img
          src="/logo/logo.png"
          alt="شعار حلول"
          className="auth-logo"
        />
      </div>

      <section className="auth-card">
        <h1>تسجيل الدخول</h1>
        <p>أدخل بيانات حسابك للوصول إلى نظام حلول الاداري.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">البريد الإلكتروني</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <p role="alert">{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? "جارٍ الدخول..." : "تسجيل الدخول"}
          </button>
        </form>
      </section>
    </main>
  );
}