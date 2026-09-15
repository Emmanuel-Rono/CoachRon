import { FormEvent, type CSSProperties, useEffect, useRef, useState } from "react";

type CoachFeedback = {
  replyText: string;
  positiveObservation: string;
  improvementArea: string;
  immediateAction: string | null;
  practicePrompt: string;
};

type ApiFeedback = Record<string, unknown>;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

function readText(payload: ApiFeedback, ...keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function normalizeFeedback(payload: ApiFeedback): CoachFeedback {
  return {
    replyText: readText(payload, "reply_text", "response"),
    positiveObservation: readText(payload, "positive_observation", "positive_observations"),
    improvementArea: readText(payload, "focus_area", "area_for_improvement", "areas_for_improvement"),
    immediateAction:
      readText(payload, "immediate_correction", "immediate_action") || null,
    practicePrompt: readText(payload, "practice_prompt", "practise_prompt", "practise_statement"),
  };
}

function App() {
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<CoachFeedback | null>(null);
  const [error, setError] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isRecording) return undefined;

    const timer = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    return () => stopRecording();
  }, []);

  function stopRecording() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);
  }

  async function toggleRecording() {
    if (isRecording) {
      stopRecording();
      return;
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingSeconds(0);
      setError("");
      setIsRecording(true);
    } catch {
      setError("Microphone access is needed to begin a voice session.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const learnerMessage = message.trim();
    if (!learnerMessage || isThinking) return;

    setIsThinking(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: learnerMessage }),
      });

      if (!response.ok) {
        throw new Error("Coach Ron is unavailable right now. Please try again.");
      }

      setFeedback(normalizeFeedback((await response.json()) as ApiFeedback));
      setMessage("");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Something went wrong.",
      );
    } finally {
      setIsThinking(false);
    }
  }

  const status = isThinking
    ? "Coach Ron is thinking"
    : isRecording
      ? `Listening ${recordingSeconds}s`
      : "Ready when you are";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Coach Ron home">
          <span className="wordmark-mark">R</span>
          <span>Coach Ron</span>
        </a>
        <span className={`status ${isRecording ? "status-live" : ""}`}>{status}</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Private speaking practice</p>
        <h1 id="page-title">Find your words.<br />Keep your flow.</h1>
        <p className="hero-copy">
          One calm, useful cue at a time for clearer English conversations.
        </p>
      </section>

      <section className={`voice-stage ${isRecording ? "is-recording" : ""} ${isThinking ? "is-thinking" : ""}`}>
        <div className="voice-dial" aria-hidden="true">
          <div className="dial-progress" />
          <div className="dial-ticks">
            {Array.from({ length: 12 }, (_, index) => (
              <span key={index} style={{ "--tick": index } as CSSProperties} />
            ))}
          </div>
          <div className="dial-center">
            <button
              className="record-button"
              type="button"
              onClick={toggleRecording}
              aria-pressed={isRecording}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="8" y="3" width="8" height="12" rx="4" />
                <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" />
              </svg>
            </button>
            <p>{isRecording ? "Tap to finish" : "Tap to speak"}</p>
          </div>
        </div>
        <p className="voice-note">
          {isRecording ? "Coach Ron is listening locally." : "Voice transcription is the next Coach Ron milestone."}
        </p>
      </section>

      <section className="conversation-panel" aria-label="Message Coach Ron">
        <form onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="message">Write an English sentence</label>
          <textarea
            id="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write a sentence to Coach Ron..."
            maxLength={1_000}
            rows={2}
          />
          <button className="send-button" type="submit" disabled={!message.trim() || isThinking}>
            <span>{isThinking ? "Thinking" : "Send"}</span>
            <span aria-hidden="true">&#8599;</span>
          </button>
        </form>
      </section>

      {error && <p className="error-message" role="alert">{error}</p>}

      {feedback && (
        <section className="feedback-card" aria-live="polite">
          <p className="eyebrow">Coach Ron&apos;s cue</p>
          <h2>{feedback.replyText || "Let&apos;s keep the conversation moving."}</h2>
          <div className="feedback-grid">
            <article>
              <span>What worked</span>
              <p>{feedback.positiveObservation || "You took time to express your idea."}</p>
            </article>
            <article>
              <span>Try next</span>
              <p>{feedback.improvementArea || "Keep your next sentence simple and clear."}</p>
            </article>
            {feedback.immediateAction && (
              <article className="feedback-correction">
                <span>Quick correction</span>
                <p>{feedback.immediateAction}</p>
              </article>
            )}
          </div>
          <p className="practice-line"><strong>Practice:</strong> {feedback.practicePrompt || "Tell Coach Ron one more detail."}</p>
        </section>
      )}
    </main>
  );
}

export default App;
