import { Route, Routes } from "react-router-dom";
import DemoControls from "../components/DemoControls";
import Home from "./Home";
import Reminder from "./Reminder";
import Medicines from "./Medicines";
import Checkin from "./Checkin";

const Shell = ({ title }: { title: string }) => (
  <h1 className="p-6 text-3xl">{title}</h1>
);

export default function PatientApp() {
  return (
    <div className="mx-auto min-h-dvh max-w-[440px]">
      <DemoControls />

      <Routes>
        <Route index element={<Home />} />

        <Route
          path="language"
          element={<Shell title="Patient: Language" />}
        />

        <Route path="medicines" element={<Medicines />} />

        <Route path="reminder" element={<Reminder />} />

        <Route path="checkin" element={<Checkin />} />

        <Route
          path="done"
          element={<Shell title="Patient: Done" />}
        />
      </Routes>
    </div>
  );
}