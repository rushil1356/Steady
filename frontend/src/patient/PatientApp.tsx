import { Route, Routes } from "react-router-dom";
import Home from "./Home";

const Shell = ({ title }: { title: string }) => (
  <h1 className="p-6 text-3xl">{title}</h1>
);

export default function PatientApp() {
  return (
    <div className="mx-auto min-h-dvh max-w-[440px]">
      <Routes>
        <Route index element={<Home />} />
        <Route path="language" element={<Shell title="Patient: Language" />} />
        <Route path="reminder" element={<Shell title="Patient: Reminder" />} />
        <Route path="checkin" element={<Shell title="Patient: Check-in" />} />
        <Route path="done" element={<Shell title="Patient: Done" />} />
      </Routes>
    </div>
  );
}