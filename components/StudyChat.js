"use client";

import { useEffect, useRef, useState, Fragment, isValidElement, cloneElement } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { useKeyboardInset } from "@/lib/useKeyboardInset";
import ReactMarkdown from "react-markdown";
import VideoModal from "@/components/VideoModal";

/**
 * StudyChat — the grounded study thread used by both the series studio
 * (whole-series scope) and the message page (single-sermon scope, since
 * /api/series-chat lets sermonId win). Owns the streaming, the cited-answer
 * rendering, and the docked composer. The parent controls the height:
 * render inside a flex column with min-h-0 and StudyChat fills it.
 */

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
    return <sup className="text-gray-400 text-xs">[{num}]</sup>;

  return (
    <button
      type="button"
      onClick={() => onWatch(seg)}
      title={`"${seg.text}" — ${seg.sermon_title}`}
      className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-navy/10 border border-brand-navy/20 text-xs font-bold text-brand-navy hover:text-white hover:border-brand-navy hover:bg-brand-navy transition-all ml-0.5 -translate-y-0.5 cursor-pointer before:content-[''] before:absolute before:-inset-3"
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
    <div className="text-base leading-[1.75] text-brand-ink/90">
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

export default function StudyChat({
  seriesId = null,
  sermonId = null,
  summary = "",
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
  const keyboardInset = useKeyboardInset();

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
          {summary && (
            <div className="pt-2 mb-6">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-gray mb-2">
                <Sparkles size={13} className="text-brand-navy" />
                Series summary
              </p>
              <RichAIResponse text={summary} segmentMap={{}} onWatch={() => {}} />
            </div>
          )}

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
                      className="text-left text-sm font-medium text-brand-navy bg-white border border-brand-navy/10 rounded-full px-4 py-2 hover:bg-brand-sky hover:border-brand-navy/25 transition-colors"
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
                  className={`flex justify-end mt-7 first:mt-0 ${
                    isLatestQuestion ? "" : "opacity-65"
                  }`}
                >
                  <p className="text-sm sm:text-base font-medium text-white bg-brand-navy rounded-[20px] rounded-br-[4px] px-4 sm:px-5 py-2.5 max-w-[85%] leading-snug">
                    {msg.text}
                  </p>
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

            return (
              <div key={msg.id || i} className="mt-4">
                <RichAIResponse
                  text={msg.text}
                  segmentMap={msg.segmentMap || {}}
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
                          className="text-left text-sm font-medium text-brand-navy bg-white border border-brand-navy/10 rounded-full px-4 py-2 hover:bg-brand-sky hover:border-brand-navy/25 transition-colors"
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
      <div
        className="flex-shrink-0 border-t border-brand-navy/10 bg-white px-4 sm:px-7 pt-3 pb-3.5 transition-transform duration-150"
        style={{
          transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined,
          paddingBottom: keyboardInset
            ? undefined
            : "calc(0.875rem + env(safe-area-inset-bottom))",
        }}
      >
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
              className="flex-1 bg-transparent py-2 text-base text-brand-ink placeholder:text-brand-gray/60 focus:outline-none min-w-0"
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
          <p className="mt-1.5 text-center text-xs text-brand-gray">{hint}</p>
        </div>
      </div>
    </div>
  );
}
