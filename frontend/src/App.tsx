import { useEffect, useRef, useState } from "react";

type Feedback = { reply: string; positive: string; improvement: string; correction: string; practice: string };
type Turn = { id: string; transcript: string; feedback?: Feedback };
type Phase = "idle" | "starting" | "recording" | "transcribing" | "coaching";
type Payload = Record<string, unknown>;
const API = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
function read(payload: Payload, ...keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
function feedbackFrom(payload: Payload): Feedback {
  const reply = read(payload, "reply_text", "response");
  if (!reply) throw new Error("Coach Ron returned an incomplete reply. Please retry coaching.");
  return {
    reply,
    positive: read(payload, "positive_observation", "positive_observations"),
    improvement: read(payload, "area_for_improvement", "focus_area", "areas_for_improvement"),
    correction: read(payload, "immediate_action", "immediate_correction"),
    practice: read(payload, "practise_prompt", "practice_prompt", "practise_statement"),
  };
}

function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [retryTurn, setRetryTurn] = useState<Turn | null>(null);
  const [retryAudio, setRetryAudio] = useState<Blob | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const bottom = useRef<HTMLDivElement | null>(null);

  function changePhase(value: Phase) { phaseRef.current = value; setPhase(value); }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controllerRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        recorder.onerror = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, phase]);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    // Bound turn length for local inference and the coaching API's text limit.
    const limit = window.setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        changePhase("transcribing");
        recorderRef.current.stop();
      }
    }, 45_000);
    return () => { window.clearInterval(timer); window.clearTimeout(limit); };
  }, [phase]);

  async function request(path: string, options: RequestInit, timeout: number): Promise<Payload> {
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(API + path, { ...options, signal: controller.signal });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(typeof data?.detail === "string" ? data.detail : "Request failed. Please try again.");
      }
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Unexpected response. Please try again.");
      return data as Payload;
    } catch (failure) {
      if (controller.signal.aborted) throw new Error("This request took too long. Please try again.");
      if (failure instanceof TypeError) throw new Error("Cannot reach Coach Ron. Check that the backend is running.");
      throw failure;
    } finally {
      window.clearTimeout(timer);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  async function coach(turn: Turn) {
    setRetryTurn(turn);
    changePhase("coaching");
    const result = await request("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: turn.transcript }),
    }, 180_000);
    if (!mounted.current) return;
    const feedback = feedbackFrom(result);
    setTurns((previous) => previous.map((item) => item.id === turn.id ? { ...item, feedback } : item));
    setRetryTurn(null);
  }

  async function processRecording(audio: Blob) {
    setError("");
    setRetryAudio(audio);
    changePhase("transcribing");
    try {
      if (!audio.size) throw new Error("No audio was captured. Please record again.");
      if (audio.size > 15 * 1024 * 1024) throw new Error("Recording exceeds 15 MB. Please record a shorter turn.");
      const type = audio.type.split(";")[0];
      const extension = type === "audio/mp4" ? "mp4" : type === "audio/ogg" ? "ogg" : "webm";
      const form = new FormData();
      form.append("audio", audio, "recording." + extension);
      const result = await request("/api/transcribe", { method: "POST", body: form }, 390_000);
      if (!mounted.current) return;
      const transcript = read(result, "transcript");
      if (!transcript) throw new Error("No speech was recognized. Please record again.");
      const turn = { id: crypto.randomUUID(), transcript };
      setTurns((previous) => [...previous, turn]);
      setRetryAudio(null);
      if (transcript.length > 1000) throw new Error("Your transcript is shown above, but it exceeds the coaching limit. Please record a shorter turn.");
      await coach(turn);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : "Audio processing failed.");
    } finally { if (mounted.current) changePhase("idle"); }
  }

  async function retryCoaching() {
    if (!retryTurn || phaseRef.current !== "idle") return;
    setError("");
    try { await coach(retryTurn); }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "Coaching failed."); }
    finally { if (mounted.current) changePhase("idle"); }
  }

  async function toggleRecording() {
    if (phaseRef.current === "recording") {
      changePhase("transcribing");
      recorderRef.current?.stop();
      return;
    }
    if (phaseRef.current !== "idle") return;
    setError("");
    changePhase("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Recording is unavailable. Use a supported browser on localhost or HTTPS.");
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("This browser does not support a compatible recording format.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (mounted.current) void processRecording(new Blob(chunks, { type: recorder.mimeType }));
      };
      recorder.onerror = () => {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (mounted.current) { setError("Recording failed. Please try again."); changePhase("idle"); }
      };
      recorder.start(1000);
      setRetryAudio(null);
      setRetryTurn(null);
      setSeconds(0);
      changePhase("recording");
    } catch (failure) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (mounted.current) {
        setError(failure instanceof Error ? failure.message : "Microphone access is needed.");
        changePhase("idle");
      }
    }
  }

  const busy = phase !== "idle" && phase !== "recording";
  const status = phase === "recording" ? "Recording " + seconds + "s"
    : phase === "transcribing" ? "Transcribing your words"
    : phase === "coaching" ? "Coach Ron is thinking"
    : phase === "starting" ? "Opening microphone" : "Ready when you are";

  return (
    <main className="app-shell chat-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Coach Ron home"><span className="wordmark-mark">R</span><span>Coach Ron</span></a>
        <span className={"status " + (phase === "recording" ? "status-live" : "")} role="status">{status}</span>
      </header>
      <section className="hero chat-hero">
        <p className="eyebrow">Your space to practise</p>
        <h1>Find your words. Keep your flow.</h1>
        <p className="hero-copy">Speak freely. See your words, then get one useful cue.</p>
      </section>
      <section className="chat-thread" aria-label="Conversation with Coach Ron" aria-live="polite" aria-relevant="additions text">
        <article className="chat-message coach-message welcome-message">
          <p className="message-author">Coach Ron</p>
          <p>What happened in your day? Tap the microphone, tell me a little, then tap stop. I will take it from there.</p>
        </article>
        {turns.map((turn) => (
          <div className="chat-turn" key={turn.id}>
            <article className="chat-message learner-message">
              <p className="message-author">You <span>Recognized transcript</span></p>
              <p>{turn.transcript}</p>
            </article>
            {turn.feedback && <article className="chat-message coach-message">
              <p className="message-author">Coach Ron</p>
              <p className="coach-reply">{turn.feedback.reply}</p>
              <div className="coaching-cues">
                {turn.feedback.positive && <div><span>What worked</span><p>{turn.feedback.positive}</p></div>}
                {turn.feedback.improvement && <div><span>Try next</span><p>{turn.feedback.improvement}</p></div>}
                {turn.feedback.correction && !/^no correction needed[.!]?$/i.test(turn.feedback.correction) && <div><span>Grammar cue</span><p>{turn.feedback.correction}</p></div>}
                {turn.feedback.practice && <div className="practice-cue"><span>Practise</span><p>{turn.feedback.practice}</p></div>}
              </div>
            </article>}
          </div>
        ))}
        {(phase === "transcribing" || phase === "coaching") && <p className="chat-pending"><span className="thinking-dot" />{status}...</p>}
        <div ref={bottom} />
      </section>
      <footer className="voice-composer">
        {error && <div className="chat-error" role="alert"><p>{error}</p>
          {phase === "idle" && retryTurn && <button type="button" onClick={() => void retryCoaching()}>Retry coaching</button>}
          {phase === "idle" && retryAudio && <button type="button" onClick={() => void processRecording(retryAudio)}>Retry transcription</button>}
        </div>}
        <div className={"recorder-bar " + (phase === "recording" ? "is-recording" : "")}>
          <div><p className="recorder-title">{phase === "recording" ? "Your turn. Take your time." : busy ? status : "Your next thought starts here."}</p>
          <p className="recorder-hint">{phase === "recording" ? seconds + "s / 45s - tap stop when you finish" : "Tap to record. Coaching follows automatically."}</p></div>
          <button className="record-button" type="button" disabled={busy} onClick={() => void toggleRecording()} aria-pressed={phase === "recording"} aria-label={phase === "recording" ? "Stop recording and get coaching" : "Start recording"}>
            {phase === "recording" ? <span className="stop-icon" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" /></svg>}
          </button>
        </div>
        <p className="transcript-note">Transcripts show what was recognized and may contain mistakes. They are not pronunciation scores. Chat stays on this page until you reload.</p>
      </footer>
    </main>
  );
}
export default App;
