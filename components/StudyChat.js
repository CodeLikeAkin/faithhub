"use client";

import { useEffect, useRef, useState, Fragment, isValidElement, cloneElement } from "react";
import { Play, Send, Loader2, Sparkles } from "lucide-react";
import { cleanTitle } from "@/lib/titles";
import ReactMarkdown from "react-markdown";
import VideoModal from "@/components/VideoModal";

/**
 * StudyChat — the grounded study thread used by both the series studio
 * (whole-series scope) and the message page (single-sermon scope, since
 * /api/series-chat lets sermonId win). Owns the streaming, the answer
 * anatomy (quick answer → cited teaching → watch-the-moment cards →
 * follow-ups) and the docked composer. The parent controls the height:
 * render inside a flex column with min-h-0 and StudyChat fills it.
 */

const fmtTime = (secs) => {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

const THINKING_MESSAGES = [
  "Searching the sermons...",
  "Reading Rev. Peter's teaching...",
  "Finding the right moment...",
  "Preparing your answer...",
];

// [N] as a clickable YouTube-timestamp link that opens the watch modal.
const CitationBadge = ({ num, segmentMap, onWatch }) => {
  const seg = segmentMap?.[num];
  if (!seg?.video_id)
    return <sup className="text-gray-400 text-[9px]">[{num}]</sup>;

  return (
    <button
      type="button"
      onClick={() => onWatch(seg)}
      title={`"${seg.text}" — ${seg.sermon_title}`}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-navy/10 border border-brand-navy/20 text-[9px] font-bold text-brand-navy hover:text-white hover:border-brand-navy hover:bg-brand-navy transition-all ml-0.5 -translate-y-0.5 cursor-pointer"
    >
      {num}
    </button>
  );
};

// Markdown + [N] citations.
const RichAIResponse = ({ text, segmentMap, onWatch }) => {
  const processCitations = (content) =>
    content.replace(/(\[\d+\](?:\[\d+\])*|\[\d+(?:,\s*\d+)+\])/g, (match) => {
      const nums = [...match.matchAll(/\d+/g)].map((m) => m[0]);
      return nums.map((n) => `[[CIT:${n}]]`).join("");
    });

  const processedText = processCitations(text);

  const renderWithCitations = (str) => {
    const parts = str.split(/(\[\[CIT:\d+\]\])/g);
    return parts.map((part, i) => {
      const citMatch = part.match(/\[\[CIT:(\d+)\]\]/);
      if (citMatch) {
        return (
          <CitationBadge
            key={i}
            num={citMatch[1]}
            segmentMap={segmentMap}
            onWatch={onWatch}
          />
        );
      }
      return part;
    });
  };

  // Walk any markdown children — strings, arrays, or nested elements like
  // <strong>/<em> — and turn every [[CIT:N]] token into a badge. The per-node
  // renderers only pass a plain string when a block has no inline formatting;
  // a list item with a bold lead-in arrives as an array (and citations can sit
  // inside a bolded span), so we recurse instead of only handling strings.
  const renderChildren = (children) => {
    if (typeof children === "string") return renderWithCitations(children);
    if (Array.isArray(children))
      return children.map((child, i) => (
        <Fragment key={i}>{renderChildren(child)}</Fragment>
      ));
    if (isValidElement(children) && children.props?.children != null)
      return cloneElement(
        children,
        undefined,
        renderChildren(children.props.children)
      );
    return children;
  };

  return (
    <div className="text-[15px] leading-[1.75] text-brand-ink/90">
      <ReactMarkdown
        components={{
          strong: ({ node, children, ...props }) => (
            <strong className="text-brand-ink font-semibold" {...props}>
              {children}
            </strong>
          ),
          em: ({ node, children, ...props }) => (
            <em className="text-brand-ink/70 italic" {...props}>
              {children}
            </em>
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 space-y-1.5 my-3" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 space-y-1.5 my-3" {...props} />
          ),
          li: ({ node, children, ...props }) => (
            <li {...props}>{renderChildren(children)}</li>
          ),
          p: ({ node, children, ...props }) => (
            <p className="mb-3 last:mb-0" {...props}>
              {renderChildren(children)}
            </p>
          ),
          h1: ({ node, children, ...props }) => (
            <h1 className="text-brand-ink text-lg font-bold mt-5 mb-2" {...props}>
              {renderChildren(children)}
            </h1>
          ),
          h2: ({ node, children, ...props }) => (
            <h2 className="text-brand-ink text-base font-bold mt-4 mb-2" {...props}>
              {renderChildren(children)}
            </h2>
          ),
          h3: ({ node, children, ...props }) => (
            <h3 className="text-brand-ink text-sm font-bold mt-3 mb-1.5" {...props}>
              {renderChildren(children)}
            </h3>
          ),
          a: ({ node, children, href, ...props }) => {
            if (typeof children?.[0] === "string" && children[0].startsWith("CIT:")) {
              return null;
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-navy font-medium hover:underline"
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
};

// The cited segments behind an answer, as small watch cards.
const MomentCards = ({ text, segmentMap, onWatch }) => {
  if (!segmentMap || !text) return null;
  const citedNums = [...text.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
  const seen = new Set();
  const moments = [];
  for (const n of citedNums) {
    const seg = segmentMap[n];
    if (!seg?.video_id) continue;
    const key = `${seg.video_id}-${seg.start_seconds}`;
    if (seen.has(key)) continue;
    seen.add(key);
    moments.push(seg);
    if (moments.length >= 3) break;
  }
  if (!moments.length) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2.5">
      {moments.map((seg, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onWatch(seg)}
          className="flex items-center gap-2.5 rounded-xl border border-brand-navy/10 bg-white px-2.5 py-2 hover:border-brand-navy/40 hover:shadow-md hover:shadow-brand-navy/5 transition-all min-w-0 text-left"
        >
          <span className="relative w-[62px] aspect-video rounded-lg overflow-hidden bg-brand-sky flex-shrink-0">
            <img
              src={`https://img.youtube.com/vi/${seg.video_id}/mqdefault.jpg`}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-5 h-5 rounded-full bg-white/90 text-brand-navy flex items-center justify-center">
                <Play size={8} fill="currentColor" className="translate-x-px" />
              </span>
            </span>
          </span>
          <span className="min-w-0 pr-1">
            <span className="block text-[11.5px] font-bold text-brand-ink leading-tight truncate max-w-[180px]">
              {cleanTitle(seg.sermon_title)}
            </span>
            <span className="block text-[10.5px] text-brand-gray tabular-nums">
              Watch at {fmtTime(seg.start_seconds)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
};

export default function StudyChat({
  seriesId = null,
  sermonId = null,
  openers = [],
  openersLabel = "Start studying",
  emptyNote = "Ask anything — the exact moments behind each answer come with it.",
  placeholder = "Ask a question…",
  hint = "Every claim is cited to the exact moment it was preached.",
}) {
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [activeVideo, setActiveVideo] = useState(null);
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const userMessageRefs = useRef({});

  const handleSendMessage = async (textToSubmit) => {
    const actualText =
      typeof textToSubmit === "string" ? textToSubmit : chatInput;
    if (!actualText.trim() || chatLoading) return;

    const messageId = Date.now();
    const userMessage = { id: messageId, role: "user", text: actualText };

    if (typeof textToSubmit !== "string" || textToSubmit === chatInput) {
      setChatInput("");
    }

    const aiMessageId = messageId + 1;
    const aiMessage = {
      id: aiMessageId,
      role: "ai",
      text: "",
      isThinking: true,
      segmentMap: {},
    };

    setChatHistory((prev) => [...prev, userMessage, aiMessage]);
    setChatLoading(true);
    setThinkingStep(0);

    const thinkingInterval = setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % THINKING_MESSAGES.length);
    }, 2000);

    setTimeout(() => {
      const el = userMessageRefs.current[messageId];
      const c = threadRef.current;
      if (el && c)
        c.scrollTo({ top: el.offsetTop - c.offsetTop - 8, behavior: "smooth" });
    }, 100);

    try {
      const historyToSend = chatHistory.map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch("/api/series-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId,
          sermonId,
          message: userMessage.text,
          chatHistory: historyToSend,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "I encountered an error.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      let segmentMap = {};
      let headerParsed = false;
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        aiText += chunk;

        if (firstChunk) {
          firstChunk = false;
          clearInterval(thinkingInterval);
        }

        // The SEGMENT_MAP header may arrive split across multiple reads, so
        // keep trying until the full "SEGMENT_MAP:{...}\n" line is present.
        if (!headerParsed) {
          const mapMatch = aiText.match(/^SEGMENT_MAP:(.+)\n/);
          if (mapMatch) {
            headerParsed = true;
            try {
              segmentMap = JSON.parse(mapMatch[1]);
            } catch (e) {
              console.error("Failed to parse segment map", e);
            }
            aiText = aiText.replace(/^SEGMENT_MAP:.+\n/, "");
          }
        }

        let displayText = aiText;
        let aiSuggestions = [];
        const suggestionsIndex = aiText.lastIndexOf("SUGGESTIONS:");
        if (suggestionsIndex !== -1) {
          displayText = aiText.substring(0, suggestionsIndex).trim();
          const suggestionsStr = aiText
            .substring(suggestionsIndex + "SUGGESTIONS:".length)
            .trim();
          try {
            aiSuggestions = JSON.parse(suggestionsStr);
          } catch (e) {}
        }

        setChatHistory((prev) =>
          prev.map((m) =>
            m.id === aiMessageId
              ? {
                  ...m,
                  text: displayText,
                  suggestions: aiSuggestions,
                  isThinking: false,
                  segmentMap,
                }
              : m
          )
        );
      }
    } catch (err) {
      console.error("Chat error:", err);
      setChatHistory((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          text: `I encountered an error: ${err.message}`,
          segmentMap: {},
        },
      ]);
    } finally {
      setChatLoading(false);
      clearInterval(thinkingInterval);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <VideoModal seg={activeVideo} onClose={() => setActiveVideo(null)} />

      {/* Thread */}
      <div
        ref={threadRef}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 sm:px-7 py-5"
      >
        <div className="max-w-2xl mx-auto">
          {chatHistory.length === 0 && (
            <div className="pt-2">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-gray mb-3">
                <Sparkles size={13} className="text-brand-navy" />
                {openersLabel}
              </p>
              {openers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {openers.map((question, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(question)}
                      className="text-left text-[13px] font-medium text-brand-navy bg-white border border-brand-navy/10 rounded-full px-4 py-2 hover:bg-brand-sky hover:border-brand-navy/25 transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-brand-gray">{emptyNote}</p>
              )}
            </div>
          )}

          {(() => {
            let lastUserIdx = -1;
            let lastAiIdx = -1;
            chatHistory.forEach((m, idx) => {
              if (m.role === "user") lastUserIdx = idx;
              if (m.role === "ai" && !m.isThinking) lastAiIdx = idx;
            });

            return chatHistory.map((msg, i) => {
            if (msg.role === "user") {
              const isLatestQuestion = i === lastUserIdx;
              return (
                <div
                  key={msg.id || i}
                  ref={(el) => {
                    userMessageRefs.current[msg.id] = el;
                  }}
                  className="mt-7 first:mt-0"
                >
                  <p
                    className={`text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5 ${
                      isLatestQuestion ? "text-brand-navy/60" : "text-brand-navy/35"
                    }`}
                  >
                    You asked
                  </p>
                  <h3
                    className={`tracking-tight leading-snug ${
                      isLatestQuestion
                        ? "text-lg sm:text-xl font-bold text-brand-ink"
                        : "text-base sm:text-lg font-medium text-brand-ink/65"
                    }`}
                  >
                    {msg.text}
                  </h3>
                </div>
              );
            }

            if (msg.isThinking) {
              return (
                <div
                  key={msg.id || i}
                  className="mt-4 flex items-center gap-3 text-brand-gray"
                >
                  <Loader2 size={14} className="animate-spin text-brand-navy" />
                  <span className="text-sm italic font-medium">
                    {THINKING_MESSAGES[thinkingStep]}
                  </span>
                </div>
              );
            }

            const paras = (msg.text || "").split(/\n{2,}/).filter((p) => p.trim());
            const lead = paras[0] || "";
            const rest = paras.slice(1).join("\n\n");
            const hasSources = Object.keys(msg.segmentMap || {}).length > 0;

            return (
              <div key={msg.id || i} className="mt-4">
                {hasSources && lead ? (
                  <>
                    <div className="rounded-r-2xl rounded-l-md border border-brand-navy/10 border-l-[3px] border-l-brand-navy bg-gradient-to-br from-brand-sky/60 to-white px-4 sm:px-5 py-3.5">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-brand-navy mb-1">
                        Quick answer
                      </p>
                      <RichAIResponse
                        text={lead}
                        segmentMap={msg.segmentMap}
                        onWatch={setActiveVideo}
                      />
                    </div>
                    {rest && (
                      <div className="mt-4">
                        <RichAIResponse
                          text={rest}
                          segmentMap={msg.segmentMap}
                          onWatch={setActiveVideo}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <RichAIResponse
                    text={msg.text}
                    segmentMap={msg.segmentMap || {}}
                    onWatch={setActiveVideo}
                  />
                )}

                <MomentCards
                  text={msg.text}
                  segmentMap={msg.segmentMap}
                  onWatch={setActiveVideo}
                />

                {i === lastAiIdx && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gray mb-2.5">
                      Keep exploring
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {msg.suggestions.map((question, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(question)}
                          className="text-left text-[13px] font-medium text-brand-navy bg-white border border-brand-navy/10 rounded-full px-4 py-2 hover:bg-brand-sky hover:border-brand-navy/25 transition-colors"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
            });
          })()}
        </div>
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-brand-navy/10 bg-white px-4 sm:px-7 pt-3 pb-3.5">
        <div className="max-w-2xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 bg-brand-light rounded-2xl border border-brand-navy/15 focus-within:border-brand-navy/40 shadow-sm p-1.5 pl-4 transition-colors"
          >
            <Sparkles size={17} className="text-brand-navy/50 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              className="flex-1 bg-transparent py-2 text-[15px] text-brand-ink placeholder:text-brand-gray/60 focus:outline-none min-w-0"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              aria-label="Send"
              className="w-10 h-10 rounded-xl bg-brand-navy text-white flex items-center justify-center flex-shrink-0 hover:bg-brand-deep transition-colors disabled:opacity-40"
            >
              {chatLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </button>
          </form>
          <p className="mt-1.5 text-center text-[11px] text-brand-gray">{hint}</p>
        </div>
      </div>
    </div>
  );
}
