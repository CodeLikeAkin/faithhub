"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Calendar,
  List,
  Send,
  Loader2,
  ExternalLink,
  MessageSquare,
  BookOpen,
  Sparkles,
  Quote
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";

export default function SeriesDetailPage() {
  const { id } = useParams();
  const [series, setSeries] = useState(null);
  const [sermons, setSermons] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);
  const userMessageRefs = useRef({});

  useEffect(() => {
    const nav = document.querySelector('nav') ||
      document.querySelector('header')
    if (nav) nav.style.display = 'none'
    return () => {
      if (nav) nav.style.display = ''
    }
  }, [])

  useEffect(() => {
    if (id) {
      fetchSeriesData();
    }
  }, [id]);

  useEffect(() => {
    if (series && sermons.length > 0) {
      generateSeriesSummary();
    }
  }, [series, sermons]);



  const fetchSeriesData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("series")
        .select(`
          *,
          series_sermons (
            part_number,
            sermons (
              id, title, sermon_date, youtube_video_id, youtube_url, transcript, summary
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        setSeries(data);
        const sortedSermons = data.series_sermons
          .sort((a, b) => a.part_number - b.part_number)
          .map(ss => ({
            ...ss.sermons,
            part_number: ss.part_number
          }));
        setSermons(sortedSermons);

        // Fetch top 3 declarations for these sermons
        const sermonIds = sortedSermons.map(s => s.id);
        const { data: decls } = await supabase
          .from('declarations')
          .select('*')
          .in('sermon_id', sermonIds)
          .limit(3);
        setDeclarations(decls || []);
      }
    } catch (err) {
      console.error("Error fetching series details:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateSeriesSummary = async () => {
    if (summary) return;
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/series-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: series.title,
          sermonTitles: sermons.map(s => s.title)
        })
      });
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      console.error("Error generating summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSendMessage = async (textToSubmit) => {
    const actualText = typeof textToSubmit === 'string' ? textToSubmit : chatInput;
    if (!actualText.trim() || chatLoading) return;

    const messageId = Date.now();
    const userMessage = { id: messageId, role: "user", text: actualText };
    setChatHistory(prev => [...prev, userMessage]);
    
    // Only clear input if we were sending from the input box
    if (typeof textToSubmit !== 'string' || textToSubmit === chatInput) {
      setChatInput("");
    }
    
    setChatLoading(true);

    try {
      const res = await fetch("/api/series-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: id,
          message: userMessage.text,
          chatHistory: chatHistory
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.message || "I encountered an error.");

      setChatHistory(prev => [...prev, { 
        id: Date.now() + 1, 
        role: "ai", 
        text: data.text,
        suggestions: data.suggestions
      }]);

      setTimeout(() => {
        userMessageRefs.current[messageId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error("Chat error:", err);
      setChatHistory(prev => [...prev, { id: Date.now() + 1, role: "ai", text: `Error: ${err.message}` }]);

      setTimeout(() => {
        userMessageRefs.current[messageId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } finally {
      setChatLoading(false);
    }
  };

  const formatDateRange = (start, end) => {
    if (!start) return "";
    const options = { month: "short", year: "numeric" };
    const s = new Date(start).toLocaleDateString("en-US", options);
    const e = end ? new Date(end).toLocaleDateString("en-US", options) : s;
    return s === e ? s : `${s} – ${e}`;
  };

  const renderRichAIResponse = (text) => {
    const sections = text.split(/CITATIONS:/i);
    const mainContent = sections[0].trim();
    const citationsContent = sections[1]?.trim() || "";

    const citationsMap = {};
    const citationRegex = /\[(\d+)\]\s+"(.*?)"\s+—\s+(.*?)\s+—\s+(https?:\/\/\S+)/g;
    let match;
    while ((match = citationRegex.exec(citationsContent)) !== null) {
      citationsMap[match[1]] = { preview: match[2], title: match[3], url: match[4] };
    }

    let processedContent = mainContent;
    Object.entries(citationsMap).forEach(([num, data]) => {
      processedContent = processedContent.replaceAll(`[${num}]`, `[[${num}]](${data.url})`);
    });

    return (
      <div className="space-y-6 w-full">
        <div className="text-sm md:text-base leading-relaxed text-gray-200">
          <ReactMarkdown
            components={{
              strong: ({node, ...props}) => <strong className="text-white font-bold" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 my-2" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-1 my-2" {...props} />,
              p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
              h1: ({node, ...props}) => <h1 className="text-[#D4AF37] text-xl font-bold mt-4 mb-2" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-[#D4AF37] text-lg font-bold mt-4 mb-2" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-[#D4AF37] text-base font-bold mt-3 mb-2" {...props} />,
              a: ({node, ...props}) => <a className="text-[#D4AF37] hover:text-[#e5c158] font-bold text-xs align-top ml-0.5" target="_blank" rel="noopener noreferrer" {...props} />
            }}
          >
            {processedContent}
          </ReactMarkdown>
        </div>

        {Object.keys(citationsMap).length > 0 && (
          <div className="pt-4 border-t border-white/10">
            <div className="flex flex-wrap gap-2">
              {Object.entries(citationsMap).map(([num, data]) => (
                <a
                  key={num}
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full text-[11px] font-bold text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all"
                  title={`${data.title}: ${data.preview}`}
                >
                  <span className="opacity-70">[{num}]</span>
                  <span>Watch moment</span>
                  <ExternalLink size={10} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1129] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#D4AF37] animate-spin" />
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-[#0f1129] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Series not found</h1>
        <Link href="/series" className="text-[#D4AF37] hover:underline flex items-center gap-2">
          <ArrowLeft size={18} /> Back to Browse
        </Link>
      </div>
    );
  }

  const heroThumb = sermons[0]?.youtube_video_id;

  return (
    <main className="flex flex-col md:flex-row h-screen bg-[#0f1129] text-white selection:bg-[#D4AF37] selection:text-[#0f1129] overflow-hidden">
      {/* LEFT PANEL - Sermon List */}
      <aside className="w-full md:w-[280px] flex flex-col border-r border-white/5 bg-[#0f1129] overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <Link href="/series" className="flex items-center gap-2 text-xs font-bold text-[#489e3e] hover:translate-x-[-2px] transition-all mb-4">
            <ArrowLeft size={14} /> Back to Browse
          </Link>
          <h2 className="text-lg font-black text-white leading-tight">{series.title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {sermons.map((sermon) => (
            <div
              key={sermon.id}
              className="p-4 bg-white/5 border border-white/5 rounded-xl hover:border-[#D4AF37]/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-tighter bg-[#D4AF37]/10 px-2 py-0.5 rounded">
                  Part {sermon.part_number}
                </span>
                <span className="text-[10px] text-gray-500">
                  {new Date(sermon.sermon_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mb-3 line-clamp-2 leading-snug group-hover:text-[#D4AF37] transition-colors">
                {sermon.title}
              </h3>
              <a
                href={sermon.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 bg-white/5 text-[11px] font-bold text-white border border-white/10 rounded-lg hover:bg-white/10 transition-all"
              >
                <Play size={10} fill="currentColor" />
                Watch
              </a>
            </div>
          ))}
        </div>
      </aside>

      {/* CENTER PANEL - Hero & Chat */}
      <section className="flex-1 flex flex-col bg-[#121424] relative overflow-hidden">
        {/* Background Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[10%] -right-[5%] w-[45%] h-[45%] rounded-full bg-[#D4AF37] opacity-[0.02] blur-[100px]" />
          <div className="absolute bottom-[10%] -left-[5%] w-[35%] h-[35%] rounded-full bg-[#D4AF37] opacity-[0.01] blur-[80px]" />
        </div>

        {/* Hero Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-white/5 pb-6">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm"
            style={{ backgroundImage: `url(${heroThumb ? `https://img.youtube.com/vi/${heroThumb}/maxresdefault.jpg` : ""})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#121424]" />

          <div className="relative z-10 h-full flex flex-col justify-end p-8 pt-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-2 py-0.5 bg-[#D4AF37] text-[#0f1129] rounded text-[9px] font-black uppercase tracking-wider">
                {series.service_type || "Series"}
              </span>
              <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                <List size={12} className="text-[#D4AF37]" />
                {sermons.length} Parts
              </span>
              <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                <Calendar size={12} className="text-[#489e3e]" />
                {formatDateRange(series.start_date, series.end_date)}
              </span>
            </div>
            <h1 className="text-2xl md:text-5xl font-black tracking-tight">{series.title}</h1>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Series Overview as First AI Message */}
          <div className="flex justify-start">
            <div className="flex gap-4 max-w-[90%] md:max-w-[80%]">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex-shrink-0 flex items-center justify-center mt-1">
                <Sparkles size={14} className="text-[#D4AF37]" />
              </div>
              <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl rounded-tl-none shadow-xl">
                <p className="text-sm md:text-base text-[#cbd5e1] leading-relaxed">
                  {summaryLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-[#D4AF37]" />
                      Generating series insights...
                    </span>
                  ) : (
                    summary || "Explore the deep teachings of this series through transcripts and AI study."
                  )}
                </p>
              </div>
            </div>
          </div>

          {chatHistory.map((msg, i) => {
            const isLastAiMessage = msg.role === 'ai' && !chatHistory.slice(i + 1).some(m => m.role === 'ai');
            return (
            <div
              key={msg.id || i}
              ref={el => { if (msg.role === 'user') userMessageRefs.current[msg.id] = el; }}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} mb-6`}
            >
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} w-full`}>
                <div className={`max-w-[90%] md:max-w-[80%] ${msg.role === "user" ? "" : "flex gap-4 w-full"}`}>
                  {msg.role === "ai" && (
                    <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex-shrink-0 flex items-center justify-center mt-1">
                      <MessageSquare size={14} className="text-[#D4AF37]" />
                    </div>
                  )}
                  <div className={`
                      p-6 rounded-2xl border
                      ${msg.role === "user"
                      ? "bg-[#489e3e]/10 border-[#489e3e]/20 rounded-tr-none text-white inline-block"
                      : "bg-white/[0.03] border-white/10 rounded-tl-none shadow-xl w-full"}
                    `}>
                    {msg.role === "ai" ? renderRichAIResponse(msg.text) : msg.text}
                  </div>
                </div>
              </div>

              {isLastAiMessage && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 pl-0 md:pl-12 w-full max-w-[90%] md:max-w-[80%]">
                  {msg.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(suggestion)}
                      className="bg-[#1e2235] text-[#cbd5e1] border border-[#2d3452] rounded-full px-4 py-2 text-sm hover:bg-[#2a2f4c] transition-all text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )})}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="flex gap-4 max-w-[80%]">
                <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex-shrink-0 flex items-center justify-center">
                  <Loader2 size={14} className="text-[#D4AF37] animate-spin" />
                </div>
                <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl rounded-tl-none">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#D4AF37]/40 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-[#D4AF37]/40 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 rounded-full bg-[#D4AF37]/40 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Chat Input */}
        <div className="p-8 shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-center bg-[#181b31] border border-white/10 rounded-3xl focus-within:border-[#D4AF37]/50 transition-all px-2 shadow-2xl">
              <input
                type="text"
                placeholder="Ask anything about this series..."
                className="w-full bg-transparent border-none outline-none py-6 px-6 text-base text-white placeholder:text-gray-600"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || chatLoading}
                className="p-4 bg-[#D4AF37] text-[#0f1129] rounded-2xl hover:scale-105 transition-transform disabled:opacity-30 disabled:scale-100 mr-2"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT PANEL - Declarations */}
      <aside className="hidden lg:flex w-[260px] flex-col border-l border-white/5 bg-[#0f1129] overflow-y-auto custom-scrollbar">
        <div className="p-6 space-y-8">
          {/* Declarations */}
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
              <Quote size={12} className="text-[#D4AF37]" />
              Key Declarations
            </h3>
            <div className="space-y-4">
              {declarations.length > 0 ? (
                declarations.map((decl) => (
                  <div key={decl.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl relative group">
                    <div className="absolute -top-2 -left-2 w-6 h-6 bg-[#D4AF37]/20 rounded-lg flex items-center justify-center border border-[#D4AF37]/30">
                      <Quote size={10} className="text-[#D4AF37]" />
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed mb-4 pt-2">
                      "{decl.declaration_text}"
                    </p>
                    <a
                      href={decl.youtube_url_with_timestamp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[9px] font-bold text-[#D4AF37] hover:underline"
                    >
                      <Play size={8} fill="currentColor" />
                      Watch moment
                    </a>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-gray-600 text-center py-4">No specific declarations extracted for this series yet.</p>
              )}
            </div>
          </section>
        </div>
      </aside>
    </main>
  );
}
