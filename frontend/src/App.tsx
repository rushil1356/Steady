import { Navigate, Route, Routes } from "react-router-dom";
import PatientApp from "./patient/PatientApp";
import CaregiverApp from "./caregiver/CaregiverApp";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/" element={<Navigate to="/patient" replace />} />
      <Route path="/patient/*" element={<PatientApp />} />
      <Route path="/caregiver/*" element={<CaregiverApp />} />
    </Routes>
    </ErrorBoundary>
  );
}