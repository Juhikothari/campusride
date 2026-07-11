import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Navbar from "./components/Navbar.jsx";
import LoginPage        from "./pages/LoginPage.jsx";
import RegisterPage     from "./pages/RegisterPage.jsx";
import Dashboard        from "./pages/Dashboard.jsx";
import CreateRide       from "./pages/CreateRide.jsx";
import SearchRides      from "./pages/SearchRides.jsx";
import RideDetail       from "./pages/RideDetail.jsx";
import MyBookings       from "./pages/MyBookings.jsx";
import ProviderBookings from "./pages/ProviderBookings.jsx";
import KYCPage          from "./pages/KYCPage.jsx";
import AdminDashboard   from "./pages/AdminDashboard.jsx";
import RatingsPage      from "./pages/RatingsPage.jsx";
import LiveTracking     from "./pages/LiveTracking.jsx";
import CommunityPage    from "./pages/CommunityPage.jsx";
import RouteAlerts      from "./pages/RouteAlerts.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import IncidentReport   from "./pages/IncidentReport.jsx";
import AdminSettings    from "./pages/AdminSettings.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

const PAGE_MAP = {
  login:               LoginPage,
  register:            RegisterPage,
  dashboard:           Dashboard,
  "create-ride":       CreateRide,
  "search-rides":      SearchRides,
  "ride-detail":       RideDetail,
  "my-bookings":       MyBookings,
  "provider-bookings": ProviderBookings,
  "kyc":               KYCPage,
  "admin":             AdminDashboard,
  "ratings":           RatingsPage,
  "live-tracking":     LiveTracking,
  "community":         CommunityPage,
  "route-alerts":      RouteAlerts,
  "notifications": NotificationsPage,
  "incident-report":   IncidentReport,
  "admin-settings":    AdminSettings,
  "reset-password":    ResetPassword,
};
const PUBLIC_PAGES = ["login", "register","reset-password"];

function Router() {
  const { user } = useAuth();
  const [page,      setPage]      = useState(user ? "dashboard" : "login");
  const [pageProps, setPageProps] = useState({});

 useEffect(() => {
  if (window.location.search.includes("testreset")) {

  setPage("reset-password");

  setPageProps({
    token: "test-token"
  });

  }
  if (
  window.location.pathname ===
  "/reset-password"
) {

  setPage(
    "reset-password"
  );

}
}, []);


  const navigate = (to, props = {}) => {
    setPage(to);
    setPageProps(props);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isPublic = PUBLIC_PAGES.includes(page);
  if (!user && !isPublic) return <LoginPage navigate={navigate} />;
  if (user  &&  isPublic) return (
    <>
      <Navbar navigate={navigate} currentPage="dashboard" />
      <main className="with-nav"><Dashboard navigate={navigate} /></main>
    </>
  );

  const PageComponent = PAGE_MAP[page] || Dashboard;
  const showNav = !isPublic;

  return (
    <div className="app-shell">
      {showNav && <Navbar navigate={navigate} currentPage={page} />}
      <main className={showNav ? "with-nav" : ""}>
        <PageComponent navigate={navigate} {...pageProps} />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
