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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

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

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = { role: "user", text: chatInput };
    setChatHistory(prev => [...prev, userMessage]);
    setChatInput("");
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
      if (data.error) throw new Error(data.error);

      setChatHistory(prev => [...prev, { role: "ai", text: data.text }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatHistory(prev => [...prev, { role: "ai", text: "I'm sorry, I encountered an error. Please try again." }]);
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

    const parts = mainContent.split(/(\[\d+\])/g);
    
    return (
      <div className="space-y-6">
        <div className="text-sm md:text-base leading-relaxed text-gray-200 whitespace-pre-wrap">
          {parts.map((part, i) => {
            const citeMatch = part.match(/\[(\d+)\]/);
            if (citeMatch) {
              const citeId = citeMatch[1];
              const citeData = citationsMap[citeId];
              return (
                <a 
                  key={i}
                  href={citeData?.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#D4AF37] hover:text-[#e5c158] font-bold text-xs align-top ml-0.5"
                >
                  [{citeId}]
                </a>
              );
            }
            return part;
          })}
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

        {/* Small Hero Header */}
        <div className="relative h-48 md:h-56 shrink-0 overflow-hidden border-b border-white/5">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm"
            style={{ backgroundImage: `url(${heroThumb ? `https://img.youtube.com/vi/${heroThumb}/maxresdefault.jpg` : ""})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#121424]" />
          
          <div className="relative z-10 h-full flex flex-col justify-end p-8">
            <div className="flex items-center gap-3 mb-3">
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
            <h1 className="text-2xl md:text-4xl font-black tracking-tight">{series.title}</h1>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30">
              <Sparkles size={48} className="mb-4 text-[#D4AF37]" />
              <h3 className="text-xl font-bold text-white mb-2">AI Study Assistant</h3>
              <p className="text-sm font-medium max-w-sm">
                Ask anything about the teachings in this series. I've analyzed all transcripts and segments for you.
              </p>
            </div>
          ) : (
            chatHistory.map((msg, i) => (
              <div 
                key={i} 
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[90%] md:max-w-[80%] ${msg.role === "user" ? "" : "flex gap-4"}`}>
                  {msg.role === "ai" && (
                    <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex-shrink-0 flex items-center justify-center mt-1">
                      <MessageSquare size={14} className="text-[#D4AF37]" />
                    </div>
                  )}
                  <div className={`
                    p-6 rounded-2xl border
                    ${msg.role === "user" 
                      ? "bg-[#489e3e]/10 border-[#489e3e]/20 rounded-tr-none text-white" 
                      : "bg-white/[0.03] border-white/10 rounded-tl-none shadow-xl"}
                  `}>
                    {msg.role === "ai" ? renderRichAIResponse(msg.text) : msg.text}
                  </div>
                </div>
              </div>
            ))
          )}
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

      {/* RIGHT PANEL - Overview & Declarations */}
      <aside className="hidden lg:flex w-[260px] flex-col border-l border-white/5 bg-[#0f1129] overflow-y-auto custom-scrollbar">
        <div className="p-6 space-y-8">
          {/* Overview */}
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
              <BookOpen size={12} className="text-[#489e3e]" />
              Series Overview
            </h3>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#489e3e]" />
              <p className="text-xs text-gray-400 leading-relaxed italic">
                {summaryLoading ? "Generating..." : summary || "No summary available."}
              </p>
            </div>
          </section>

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
