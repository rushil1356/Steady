import { useEffect, useState } from "react";
import { api, type Today, type MedInfo } from "../api/client";

export default function Medicines() {
  const [today, setToday] = useState<Today | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMed, setSelectedMed] = useState<MedInfo | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    api.today()
      .then(setToday)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function openMedicine(medId: string) {
    setDetailsLoading(true);
    setDetailsError(null);
    setSelectedMed(null);

    try {
      const info = await api.medInfo(medId);
      setSelectedMed(info);
    } catch (err) {
      setDetailsError((err as Error).message);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function confirmMedicine(doseId: number) {
    setConfirmingId(doseId);
    setConfirmError(null);

    try {
      await api.confirmDose(doseId, false);
      const updatedToday = await api.today();
      setToday(updatedToday);
    } catch (err) {
      setConfirmError((err as Error).message);
    } finally {
      setConfirmingId(null);
    }
  }

  function listen() {
    if (!selectedMed) return;

    const text = [
      selectedMed.med_name,
      selectedMed.what_for,
      selectedMed.how_to_take,
      selectedMed.side_effects,
      selectedMed.call_doctor_if,
    ]
      .filter(Boolean)
      .join(". ");

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;

    window.speechSynthesis.speak(utterance);
  }

  function closeDetails() {
    window.speechSynthesis.cancel();
    setSelectedMed(null);
    setDetailsError(null);
    setDetailsLoading(false);
  }

  if (loading) {
    return (
      <p className="p-6 text-xl">
        Loading medicines...
      </p>
    );
  }

  if (error) {
    return (
      <p className="p-6 text-xl text-red">
        {error}
      </p>
    );
  }

  if (!today) {
    return (
      <p className="p-6 text-xl">
        No medication data available.
      </p>
    );
  }

  const groups = today.doses.reduce<
    Record<string, Today["doses"]>
  >((acc, dose) => {
    if (!acc[dose.time]) {
      acc[dose.time] = [];
    }

    acc[dose.time].push(dose);
    return acc;
  }, {});

  const statusStyles: Record<string, string> = {
    taken: "bg-green-100 text-green-800",
    upcoming: "bg-slate-100 text-slate-700",
    due: "bg-amber-100 text-amber-800",
    missed: "bg-red-100 text-red-800",
  };

  return (
    <main className="min-h-dvh px-5 pb-10 pt-8">
      <h1 className="text-4xl font-bold">
        My Medicines
      </h1>

      <p className="mt-3 text-xl text-slate-soft">
        {today.taken_count} of {today.total_count} doses taken today
      </p>

      {confirmError && (
        <p role="alert" className="mt-3 text-lg text-red">
          {confirmError}
        </p>
      )}

      <div className="mt-8 space-y-8">
        {Object.entries(groups)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([time, doses]) => (
            <section key={time}>
              <h2 className="mb-4 text-2xl font-bold">
                {time}
              </h2>

              <div className="space-y-4">
                {doses.map((dose) => (
                  <article
                    key={dose.dose_id}
                    className="rounded-3xl bg-white p-5 shadow-card"
                  >
                    <button
                      type="button"
                      onClick={() => openMedicine(dose.med_id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className="h-14 w-14 shrink-0 rounded-full border-2 border-slate-300"
                          style={{
                            backgroundColor:
                              dose.color ?? "#FFFFFF",
                          }}
                          aria-hidden="true"
                        />

                        <div className="min-w-0 flex-1">
                          <h3 className="text-2xl font-bold">
                            {dose.name}
                          </h3>

                          <p className="mt-1 text-lg text-slate-soft">
                            {dose.dose} · {dose.look}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span
                          className={`rounded-full px-4 py-2 text-lg font-bold capitalize ${
                            statusStyles[dose.status] ??
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {dose.status === "taken"
                            ? "✓ Taken"
                            : dose.status}
                        </span>

                        <span className="text-lg font-bold text-indigo">
                          Know more →
                        </span>
                      </div>
                    </button>

                    {dose.status !== "taken" && (
                      <button
                        type="button"
                        disabled={confirmingId !== null}
                        onClick={() =>
                          confirmMedicine(dose.dose_id)
                        }
                        className="mt-4 min-h-14 w-full rounded-2xl bg-indigo px-5 text-xl font-bold text-white disabled:opacity-50"
                      >
                        {confirmingId === dose.dose_id
                          ? "Confirming..."
                          : "I took it"}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
      </div>

      {(selectedMed || detailsLoading || detailsError) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Medication information"
            className="max-h-[90dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl"
          >
            <button
              type="button"
              onClick={closeDetails}
              className="mb-5 min-h-12 text-xl font-bold text-indigo"
            >
              ← Close
            </button>

            {detailsLoading && (
              <p className="text-xl">
                Loading information...
              </p>
            )}

            {detailsError && (
              <p role="alert" className="text-xl text-red">
                {detailsError}
              </p>
            )}

            {selectedMed && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold">
                  {selectedMed.med_name}
                </h2>

                <button
                  type="button"
                  onClick={listen}
                  className="min-h-16 w-full rounded-2xl bg-indigo px-6 text-xl font-bold text-white"
                >
                  🔊 Listen
                </button>

                <section>
                  <h3 className="text-xl font-bold">
                    What is it for?
                  </h3>
                  <p className="mt-2 text-xl">
                    {selectedMed.what_for}
                  </p>
                </section>

                <section>
                  <h3 className="text-xl font-bold">
                    How to take it
                  </h3>
                  <p className="mt-2 text-xl">
                    {selectedMed.how_to_take}
                  </p>
                </section>

                <section>
                  <h3 className="text-xl font-bold">
                    Possible side effects
                  </h3>
                  <p className="mt-2 text-xl">
                    {selectedMed.side_effects}
                  </p>
                </section>

                <section>
                  <h3 className="text-xl font-bold">
                    Call your doctor if
                  </h3>
                  <p className="mt-2 text-xl">
                    {selectedMed.call_doctor_if}
                  </p>
                </section>

                {selectedMed.source_url && (
                  <a
                    href={selectedMed.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-base text-indigo underline"
                  >
                    Source: {selectedMed.source}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}