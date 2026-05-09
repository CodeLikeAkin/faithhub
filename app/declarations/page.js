"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Send,
  Play,
  BookOpen,
  Loader2,
} from "lucide-react";

const TOPICS = [
  "Mindset",
  "Faith",
  "Healing",
  "Finances",
  "Relationships",
  "Purpose",
  "Fear",
  "Strength",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function DeclarationCard({ declaration, index }) {
  return (
    <div
      className="declaration-card"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Gold accent bar */}
      <div className="declaration-accent" />

      <div className="declaration-body">
        {/* Quote */}
        <p className="declaration-text">
          <span className="declaration-quote">&ldquo;</span>
          {declaration.declaration_text}
          <span className="declaration-quote">&rdquo;</span>
        </p>

        {/* Footer */}
        <div className="declaration-footer">
          <div className="declaration-source">
            <BookOpen size={13} className="declaration-source-icon" />
            <span>{declaration.sermon_title}</span>
          </div>

          {declaration.youtube_url_with_timestamp && (
            <a
              href={declaration.youtube_url_with_timestamp}
              target="_blank"
              rel="noopener noreferrer"
              className="watch-btn"
            >
              <Play size={12} fill="currentColor" />
              Watch Moment
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function AIMessage({ message }) {
  return (
    <div className="msg-ai-wrapper">
      <div className="msg-ai-avatar">
        <Sparkles size={14} />
      </div>
      <div className="msg-ai-bubble">
        {/* AI prose */}
        <p className="msg-ai-text">{message.text}</p>

        {/* Declaration cards */}
        {message.declarations && message.declarations.length > 0 && (
          <div className="declarations-list">
            {message.declarations.map((d, i) => (
              <DeclarationCard key={i} declaration={d} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessage({ message }) {
  return (
    <div className="msg-user-wrapper">
      <div className="msg-user-bubble">{message.text}</div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DeclarationsPage() {
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: "ai",
      text: "Hello! I'm your Faith Declarations companion. Share what you're going through — a challenge, a need, or a topic on your heart — and I'll speak God's Word over your situation from our sermon library.",
      declarations: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState(null);
  const [lastTopic, setLastTopic] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [outOfResults, setOutOfResults] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, fetchingMore]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  const handleTopicClick = (topic) => {
    setActiveTopic(topic);
    startSearch(`I need declarations about ${topic.toLowerCase()}`, topic);
  };

  const startSearch = async (msg, t) => {
    if (!msg.trim() || loading) return;

    setLastQuery(msg.trim());
    setLastTopic(t);
    setOutOfResults(false);
    setHasMore(false);

    const userMsg = { id: Date.now(), role: "user", text: msg.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setActiveTopic(null);
    setLoading(true);

    try {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg.trim(),
          topic: t?.toLowerCase() ?? null,
          shownIds: [],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          text: data.response,
          declarations: data.declarations || [],
        },
      ]);

      if (data.declarations && data.declarations.length >= 10) {
        setHasMore(true);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          text: "I'm sorry, something went wrong. Please try again in a moment.",
          declarations: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    startSearch(input, activeTopic);
  };

  const handleLoadMore = async () => {
    if (fetchingMore || !lastQuery) return;
    setFetchingMore(true);

    const allIds = messages
      .flatMap((m) => m.declarations || [])
      .map((d) => d.id)
      .filter(Boolean);

    try {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: lastQuery,
          topic: lastTopic?.toLowerCase() ?? null,
          shownIds: allIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");

      if (data.declarations && data.declarations.length > 0) {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastAiIdx = [...newMessages]
            .reverse()
            .findIndex((m) => m.role === "ai");
          if (lastAiIdx !== -1) {
            const idx = newMessages.length - 1 - lastAiIdx;
            newMessages[idx] = {
              ...newMessages[idx],
              declarations: [
                ...(newMessages[idx].declarations || []),
                ...data.declarations,
              ],
            };
          }
          return newMessages;
        });
        if (data.declarations.length < 10) {
          setHasMore(false);
          setOutOfResults(true);
        }
      } else {
        setHasMore(false);
        setOutOfResults(true);
      }
    } catch (err) {
      console.error("Load more error:", err);
    } finally {
      setFetchingMore(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <style>{`
        /* ── Layout ────────────────────────────────────────────────────────── */
        .decl-page {
          min-height: 100vh;
          background: #181b31;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        /* Ambient glow orbs */
        .glow-orb-1 {
          position: absolute;
          top: -10%;
          right: -5%;
          width: 45%;
          height: 45%;
          border-radius: 50%;
          background: #D4AF37;
          opacity: 0.06;
          filter: blur(100px);
          pointer-events: none;
        }
        .glow-orb-2 {
          position: absolute;
          bottom: 10%;
          left: -5%;
          width: 35%;
          height: 35%;
          border-radius: 50%;
          background: #D4AF37;
          opacity: 0.05;
          filter: blur(80px);
          pointer-events: none;
        }

        /* ── Header ─────────────────────────────────────────────────────────── */
        .decl-header {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          background: rgba(24, 27, 49, 0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(72, 158, 62, 0.15);
        }
        .back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: #489e3e;
          transition: background 0.2s, transform 0.2s;
          flex-shrink: 0;
        }
        .back-btn:hover {
          background: rgba(72,158,62,0.12);
          transform: translateX(-2px);
        }
        .header-title-group {
          display: flex;
          flex-direction: column;
        }
        .header-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: #489e3e;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .header-subtitle {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.4);
          margin-top: 2px;
        }
        .header-badge {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(72,158,62,0.1);
          border: 1px solid rgba(72,158,62,0.25);
          border-radius: 999px;
          color: #489e3e;
          font-size: 0.72rem;
          font-weight: 600;
        }

        /* ── Topics bar ─────────────────────────────────────────────────────── */
        .topics-bar {
          padding: 14px 16px 10px;
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          flex-shrink: 0;
        }
        .topics-bar::-webkit-scrollbar { display: none; }
        .topic-chip {
          flex-shrink: 0;
          padding: 10px 20px;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 600;
          border: 1px solid rgba(72,158,62,0.25);
          background: rgba(72,158,62,0.06);
          color: rgba(255,255,255,0.65);
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.01em;
        }
        .topic-chip:hover {
          background: rgba(72,158,62,0.15);
          color: #489e3e;
          border-color: rgba(72,158,62,0.5);
        }
        .topic-chip.active {
          background: #489e3e;
          color: #ffffff;
          border-color: #489e3e;
          box-shadow: 0 0 16px rgba(72,158,62,0.35);
        }

        /* ── Chat area ──────────────────────────────────────────────────────── */
        .chat-area {
          flex: 1;
          overflow-y: auto;
          padding: 16px 16px 4px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          scrollbar-width: thin;
          scrollbar-color: rgba(72,158,62,0.2) transparent;
        }
        .chat-area::-webkit-scrollbar { width: 4px; }
        .chat-area::-webkit-scrollbar-track { background: transparent; }
        .chat-area::-webkit-scrollbar-thumb { background: rgba(72,158,62,0.2); border-radius: 4px; }

        /* ── AI message ─────────────────────────────────────────────────────── */
        .msg-ai-wrapper {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          max-width: 90%;
        }
        @media (min-width: 640px) { .msg-ai-wrapper { max-width: 78%; } }
        .msg-ai-avatar {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(72,158,62,0.3), rgba(72,158,62,0.1));
          border: 1px solid rgba(72,158,62,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #489e3e;
          margin-top: 2px;
        }
        .msg-ai-bubble {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .msg-ai-text {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 4px 16px 16px 16px;
          padding: 14px 16px;
          font-size: 0.9rem;
          line-height: 1.65;
          color: rgba(255,255,255,0.85);
          white-space: pre-wrap;
        }

        /* ── User message ───────────────────────────────────────────────────── */
        .msg-user-wrapper {
          display: flex;
          justify-content: flex-end;
        }
        .msg-user-bubble {
          max-width: 80%;
          background: linear-gradient(135deg, rgba(72,158,62,0.22), rgba(72,158,62,0.12));
          border: 1px solid rgba(72,158,62,0.3);
          border-radius: 16px 4px 16px 16px;
          padding: 12px 16px;
          font-size: 0.9rem;
          line-height: 1.6;
          color: rgba(255,255,255,0.9);
        }

        /* ── Declaration cards ──────────────────────────────────────────────── */
        .declarations-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .declaration-card {
          display: flex;
          gap: 0;
          background: rgba(18, 20, 36, 0.7);
          border: 1px solid rgba(72,158,62,0.2);
          border-radius: 14px;
          overflow: hidden;
          animation: slideUp 0.4s ease both;
          backdrop-filter: blur(8px);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .declaration-card:hover {
          border-color: rgba(72,158,62,0.45);
          box-shadow: 0 4px 24px rgba(72,158,62,0.1);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .declaration-accent {
          width: 3px;
          flex-shrink: 0;
          background: linear-gradient(to bottom, #489e3e, rgba(72,158,62,0.3));
          border-radius: 3px 0 0 3px;
        }
        .declaration-body {
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
        }
        .declaration-text {
          font-size: 0.88rem;
          line-height: 1.6;
          color: rgba(255,255,255,0.88);
          font-style: italic;
        }
        .declaration-quote {
          color: #489e3e;
          font-style: normal;
          font-size: 1.1em;
        }
        .declaration-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }
        .declaration-source {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.4);
        }
        .declaration-source-icon {
          color: rgba(72,158,62,0.5);
          flex-shrink: 0;
        }
        .watch-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          background: rgba(72,158,62,0.12);
          border: 1px solid rgba(72,158,62,0.3);
          border-radius: 999px;
          color: #489e3e;
          font-size: 0.7rem;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.2s, box-shadow 0.2s;
        }
        .watch-btn:hover {
          background: rgba(72,158,62,0.22);
          box-shadow: 0 0 12px rgba(72,158,62,0.2);
        }

        /* ── Typing indicator ───────────────────────────────────────────────── */
        .typing-wrapper {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .typing-bubble {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 4px 16px 16px 16px;
          padding: 14px 18px;
          display: flex;
          gap: 5px;
          align-items: center;
        }
        .typing-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(72,158,62,0.6);
          animation: bounce 1.2s infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40%            { transform: translateY(-6px); opacity: 1; }
        }

        /* ── Input bar ──────────────────────────────────────────────────────── */
        .input-bar {
          padding: 12px 16px 16px;
          background: rgba(24, 27, 49, 0.9);
          backdrop-filter: blur(16px);
          border-top: 1px solid rgba(72, 158, 62, 0.12);
          flex-shrink: 0;
        }
        .input-inner {
          display: flex;
          gap: 10px;
          align-items: flex-end;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(72, 158, 62, 0.2);
          border-radius: 16px;
          padding: 10px 12px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-inner:focus-within {
          border-color: rgba(72, 158, 62, 0.45);
          box-shadow: 0 0 0 3px rgba(72, 158, 62, 0.08);
        }
        .chat-textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          color: rgba(255,255,255,0.9);
          font-size: 16px;
          line-height: 1.5;
          min-height: 24px;
          max-height: 120px;
          font-family: inherit;
        }
        .chat-textarea::placeholder {
          color: rgba(255,255,255,0.25);
        }
        .send-btn {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #489e3e;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          align-self: flex-end;
        }
        .send-btn:hover:not(:disabled) {
          background: #3e8a36;
          transform: scale(1.05);
          box-shadow: 0 0 16px rgba(72,158,62,0.4);
        }
        .send-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .input-hint {
          margin-top: 8px;
          text-align: center;
          font-size: 0.68rem;
          color: rgba(255,255,255,0.2);
        }

        /* ── Load More Button ──────────────────────────────────────────────── */
        .load-more-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          max-width: 260px;
          margin: 10px auto 20px;
          padding: 12px 20px;
          background: #D4AF37;
          color: #181b31;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.88rem;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .load-more-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
        }
        .load-more-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .load-more-btn:disabled {
          opacity: 0.8;
          cursor: not-allowed;
        }
        .no-more-text {
          text-align: center;
          padding: 15px 20px 30px;
          font-size: 0.85rem;
          color: rgba(255,255,255,0.4);
          line-height: 1.5;
          max-width: 300px;
          margin: 0 auto;
        }
      `}</style>

      <div className="decl-page">
        {/* Ambient glows */}
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />

        {/* ── Header ── */}
        <header className="decl-header">
          <Link href="/" className="back-btn" aria-label="Back to home">
            <ArrowLeft size={17} />
          </Link>

          <div className="header-title-group">
            <h1 className="header-title">Faith Declarations</h1>
            <span className="header-subtitle">Heritage of Faith Church</span>
          </div>

          <div className="header-badge">
            <Sparkles size={12} />
            AI Powered
          </div>
        </header>

        {/* ── Topic chips ── */}
        <div className="topics-bar" role="list" aria-label="Topic filters">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              role="listitem"
              onClick={() => handleTopicClick(topic)}
              className={`topic-chip${activeTopic === topic ? " active" : ""}`}
              aria-pressed={activeTopic === topic}
            >
              {topic}
            </button>
          ))}
        </div>

        {/* ── Chat messages ── */}
        <div className="chat-area" aria-live="polite" aria-label="Conversation">
          {messages.map((msg) =>
            msg.role === "ai" ? (
              <AIMessage key={msg.id} message={msg} />
            ) : (
              <UserMessage key={msg.id} message={msg} />
            )
          )}

          {/* Load More Section */}
          {!loading && hasMore && (
            <button
              className="load-more-btn"
              onClick={handleLoadMore}
              disabled={fetchingMore}
            >
              {fetchingMore ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>Next 10 Declarations &rarr;</>
              )}
            </button>
          )}

          {!loading && outOfResults && (
            <p className="no-more-text">
              You&apos;ve seen all declarations for this topic.
              Try asking about a different need.
            </p>
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="typing-wrapper">
              <div className="msg-ai-avatar">
                <Sparkles size={14} />
              </div>
              <div className="typing-bubble">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div className="input-bar">
          <div className="input-inner">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Share your situation or need…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
              aria-label="Type your message"
              id="declarations-input"
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              aria-label="Send message"
              id="declarations-send-btn"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="input-hint">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </>
  );
}
