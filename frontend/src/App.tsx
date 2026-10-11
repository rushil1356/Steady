import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import PatientApp from "./patient/PatientApp";
import CaregiverApp from "./caregiver/CaregiverApp";
import ErrorBoundary from "./components/ErrorBoundary";
import SplashScreen from "./components/SplashScreen";

export default function App() {
  // Show the splash once per browser tab, not on every reload (a reload during the demo shouldn't cost 4 seconds).
  const [showSplash, setShowSplash] = useState(() => {
    try {
      if (sessionStorage.getItem("steady.splash") === "1") return false;
      sessionStorage.setItem("steady.splash", "1");
    } catch {
      /* storage blocked: just show it */
    }
    return true;
  });

  useEffect(() => {
    if (!showSplash) return;
    const timer = window.setTimeout(() => {
      setShowSplash(false);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [showSplash]);

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Navigate to="/patient" replace />} />
        <Route path="/patient/*" element={<PatientApp />} />
        <Route path="/caregiver/*" element={<CaregiverApp />} />
      </Routes>

      {showSplash && <SplashScreen />}
    </ErrorBoundary>
  );
}