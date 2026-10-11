// If a screen crashes, show what happened and a way back instead of a blank white page (audio may still be
// playing in that case, which is confusing). The message helps us debug from a screenshot.
import { Component, type ReactNode } from "react";
import { stopSpeaking } from "../audio";

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    stopSpeaking();
    console.error("Steady screen crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center gap-4 p-6">
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        <p className="text-lg text-slate-soft">Steady hit a problem on this screen.</p>
        <pre className="overflow-auto rounded-2xl bg-white p-4 text-sm whitespace-pre-wrap text-red">{this.state.error.message}</pre>
        <button onClick={() => window.location.assign(window.location.pathname.startsWith("/caregiver") ? "/caregiver" : "/patient")}
          className="min-h-16 rounded-2xl bg-navy text-xl font-bold text-white">
          Back to start
        </button>
      </main>
    );
  }
}
