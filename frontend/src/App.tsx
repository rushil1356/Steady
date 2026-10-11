import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import PatientApp from "./patient/PatientApp";
import CaregiverApp from "./caregiver/CaregiverApp";
import ErrorBoundary from "./components/ErrorBoundary";
import SplashScreen from "./components/SplashScreen";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSplash(false);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, []);

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