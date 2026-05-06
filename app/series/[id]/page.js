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

const CitationGroup = ({ nums, citationsMap }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (nums.length <= 1) {
    const num = nums[0];
    const data = citationsMap[num];
    if (!data) return null;
    return (
      <a 
        href={data.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10 border border-white/10 text-[9px] font-bold text-gray-400 hover:text-white hover:border-[#D4AF37] transition-all ml-1 -translate-y-0.5 cursor-pointer"
      >
        {num}
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 ml-1 -translate-y-0.5">
      {/* Always show first one */}
      <a 
        href={citationsMap[nums[0]]?.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10 border border-white/10 text-[9px] font-bold text-gray-400 hover:text-white hover:border-[#D4AF37] transition-all cursor-pointer"
      >
        {nums[0]}
      </a>

      {isExpanded ? (
        <>
          {nums.slice(1).map(num => (
            <a 
              key={num}
              href={citationsMap[num]?.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10 border border-white/10 text-[9px] font-bold text-gray-400 hover:text-white hover:border-[#D4AF37] transition-all animate-in fade-in slide-in-from-left-1 duration-200 cursor-pointer"
            >
              {num}
            </a>
          ))}
          <button 
            onClick={(e) => { e.preventDefault(); setIsExpanded(false); }}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 border border-[#D4AF37]/50 text-[9px] font-black text-[#D4AF37] hover:bg-white/30 transition-all cursor-pointer"
          >
            <ArrowLeft size={10} />
          </button>
        </>
      ) : (
        <button 
          onClick={(e) => { e.preventDefault(); setIsExpanded(true); }}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10 border border-white/10 text-[9px] font-bold text-gray-500 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
        >
          ...
        </button>
      )}
    </span>
  );
};

export default function SeriesDetailPage() {
  const { id } = useParams();
  const [series, setSeries] = useState(null);
  const [sermons, setSermons] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summarySuggestions, setSummarySuggestions] = useState([]);

  const [summarySuggestionsHidden, setSummarySuggestionsHidden] = useState(false);
  const [showSources, setShowSources] = useState({}); // Map of messageId -> boolean

  // Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);
  const userMessageRefs = useRef({});
  const [thinkingStep, setThinkingStep] = useState(0);

  const thinkingMessages = [
    "Searching the sermons...",
    "Reading Rev. Peter's teaching...",
    "Finding the right moment...",
    "Preparing your answer..."
  ];

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
      if (data.suggestions) {
        setSummarySuggestions(data.suggestions);
      }
    } catch (err) {
      console.error("Error generating summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSendMessage = async (textToSubmit, sourceMessageId = null) => {
    const actualText = typeof textToSubmit === 'string' ? textToSubmit : chatInput;
    if (!actualText.trim() || chatLoading) return;

    const messageId = Date.now();
    const userMessage = { id: messageId, role: "user", text: actualText };
    
    // Fix 1 & 6: Hide suggestions instantly with fade out
    if (sourceMessageId === 'summary') {
      // Create fade out effect by setting a state
      setSummarySuggestionsHidden(true);
      setTimeout(() => setSummarySuggestions([]), 200);
    } else if (sourceMessageId) {
      setChatHistory(prev => prev.map(m => m.id === sourceMessageId ? { ...m, suggestionsHidden: true } : m));
      setTimeout(() => {
        setChatHistory(prev => prev.map(m => m.id === sourceMessageId ? { ...m, suggestions: [] } : m));
      }, 200);
    }

    // Fix 3: Input clears immediately before API responds
    if (typeof textToSubmit !== 'string' || textToSubmit === chatInput) {
      setChatInput("");
    }

    const aiMessageId = messageId + 1;
    const aiMessage = { id: aiMessageId, role: "ai", text: "", isThinking: true };

    setChatHistory(prev => [...prev, userMessage, aiMessage]);
    setChatLoading(true);
    setThinkingStep(0);

    const thinkingInterval = setInterval(() => {
      setThinkingStep(prev => (prev + 1) % thinkingMessages.length);
    }, 2000);

    // Fix 2: Scroll to new user message instantly and pin to top
    setTimeout(() => {
      userMessageRefs.current[messageId]?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);

    try {
      const historyToSend = chatHistory.map(m => ({ role: m.role, text: m.text }));
      const res = await fetch("/api/series-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: id,
          message: userMessage.text,
          chatHistory: historyToSend
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "I encountered an error.");
      }

      // Fix 4: Stream processing
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        aiText += chunk;

        let displayAiText = aiText;
        let aiSuggestions = [];

        const suggestionsIndex = aiText.lastIndexOf("SUGGESTIONS:");
        if (suggestionsIndex !== -1) {
          displayAiText = aiText.substring(0, suggestionsIndex).trim();
          const suggestionsStr = aiText.substring(suggestionsIndex + "SUGGESTIONS:".length).trim();
          try {
            aiSuggestions = JSON.parse(suggestionsStr);
          } catch(e) {}
        }

        setChatHistory(prev => prev.map(m => 
          m.id === aiMessageId 
            ? { ...m, text: displayAiText, suggestions: aiSuggestions, isThinking: false } 
            : m
        ));
        
        // Clear interval on first chunk
        if (typeof thinkingInterval !== 'undefined') clearInterval(thinkingInterval);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setChatHistory(prev => [...prev, { id: Date.now() + 1, role: "ai", text: `Error: ${err.message}` }]);

      setTimeout(() => {
        userMessageRefs.current[messageId]?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    } finally {
      setChatLoading(false);
      if (typeof thinkingInterval !== 'undefined') clearInterval(thinkingInterval);
    }
  };

  const handleSuggestionClick = (question, sourceMessageId) => {
    handleSendMessage(question, sourceMessageId);
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
    
    // Extract source count for the button
    const sourceCount = (citationsContent.match(/\[\d+\]/g) || []).length;
    console.log('Detected sourceCount:', sourceCount);

    const citationsMap = {};
    const citationRegex = /\[(\d+)\]\s+"(.*?)"\s+—\s+(.*?)\s+—\s+(https?:\/\/\S+)/g;
    let match;
    while ((match = citationRegex.exec(citationsContent)) !== null) {
      citationsMap[match[1]] = { preview: match[2], title: match[3], url: match[4] };
    }

    let processedContent = mainContent;
    
    // Pattern to catch citation groups like [1][2] or [1] [2]
    const citationGroupRegex = /(?:\[(\d+)\]\s*)+/g;
    processedContent = processedContent.replace(citationGroupRegex, (match) => {
      const nums = [...match.matchAll(/\[(\d+)\]/g)].map(m => m[1]);
      const validNums = nums.filter(n => citationsMap[n]);
      if (validNums.length === 0) return match;
      
      // We return a special markdown link that the component will pick up
      return `[CITATIONS:${validNums.join(',')}](${citationsMap[validNums[0]].url})`;
    });

    return (
      <div className="space-y-6 w-full">
        <div className="text-[15px] leading-relaxed text-gray-200">
          <ReactMarkdown
            components={{
              strong: ({ node, ...props }) => <strong className="text-white font-semibold" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1 my-2" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1 my-2" {...props} />,
              p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
              h1: ({ node, ...props }) => <h1 className="text-white text-xl font-bold mt-4 mb-2" {...props} />,
              h2: ({ node, ...props }) => <h2 className="text-white text-lg font-bold mt-4 mb-2" {...props} />,
              h3: ({ node, ...props }) => <h3 className="text-white text-base font-bold mt-3 mb-2" {...props} />,
              a: ({ node, ...props }) => {
                const textContent = props.children?.[0];
                console.log('Rendering link/citation:', textContent);
                if (typeof textContent === 'string' && textContent.startsWith('CITATIONS:')) {
                  const nums = textContent.replace('CITATIONS:', '').split(',');
                  return <CitationGroup nums={nums} citationsMap={citationsMap} />;
                }
                return (
                  <sup className="text-xs text-gray-400 ml-0.5">
                    <a className="hover:text-white" target="_blank" rel="noopener noreferrer" {...props} />
                  </sup>
                );
              }
            }}
          >
            {processedContent}
          </ReactMarkdown>
        </div>

        {sourceCount > 0 && (
          <div className="mt-4">
            <div className="flex justify-end">
              <button 
                onClick={() => setShowSources(prev => ({ ...prev, [text]: !prev[text] }))}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-gray-400 hover:bg-white/10 hover:text-white transition-all"
              >
                {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
                <ArrowLeft size={10} className={`transition-transform duration-300 ${showSources[text] ? 'rotate-90' : 'rotate-180'}`} />
              </button>
            </div>
            
            {showSources[text] && (
              <div className="mt-3 p-4 bg-black/20 border border-white/5 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Sources Referenced</h4>
                {Object.entries(citationsMap).map(([num, data]) => (
                  <div key={num} className="text-[11px] leading-relaxed group">
                    <span className="text-[#D4AF37] font-bold mr-2">[{num}]</span>
                    <span className="text-gray-300 italic">"{data.preview}"</span>
                    <span className="text-gray-500 mx-2">—</span>
                    <span className="text-gray-400 font-medium">{data.title}</span>
                    <a 
                      href={data.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-[#D4AF37] hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      View moment
                    </a>
                  </div>
                ))}
              </div>
            )}
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
        <div className="relative shrink-0 overflow-hidden border-b border-white/5 h-28">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm"
            style={{ backgroundImage: `url(${heroThumb ? `https://img.youtube.com/vi/${heroThumb}/maxresdefault.jpg` : ""})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#121424]" />

          <div className="relative z-10 h-full flex flex-col justify-end px-8 py-4">
            <div className="flex items-center gap-3 mb-2">
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
            <h1 className="text-2xl font-black tracking-tight">{series.title}</h1>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Series Overview as First AI Message */}
          <div className="flex flex-col items-start mb-6 w-full">
            <div className="flex justify-start w-full">
              <div className="flex gap-4 max-w-[90%] md:max-w-[80%]">
                <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex-shrink-0 flex items-center justify-center mt-1">
                  <Sparkles size={14} className="text-[#D4AF37]" />
                </div>
                <div className="w-full text-[15px] text-gray-200 leading-relaxed">
                  {summaryLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-[#D4AF37]" />
                      Generating series insights...
                    </span>
                  ) : (
                    <ReactMarkdown
                      components={{
                        strong: ({ node, ...props }) => <strong className="text-white font-semibold" {...props} />
                      }}
                    >
                      {summary || "Explore the deep teachings of this series through transcripts and AI study."}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            </div>

            {!summaryLoading && summarySuggestions && summarySuggestions.length > 0 && (
              <div className={`flex flex-col gap-2 mt-4 w-full pl-0 md:pl-12 transition-opacity duration-200 ${summarySuggestionsHidden ? 'opacity-0' : 'opacity-100'}`}>
                {summarySuggestions.map((question, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(question, 'summary')}
                    className="w-fit max-w-[90%] md:max-w-[80%] text-left text-sm px-4 py-2 rounded-xl bg-[#1e2235] text-gray-200 hover:bg-[#2a3050] transition-colors cursor-pointer"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>

          {chatHistory.map((msg, i) => {
            return (
              <div
                key={msg.id || i}
                ref={el => { if (msg.role === 'user') userMessageRefs.current[msg.id] = el; }}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} mb-6`}
              >
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} w-full`}>
                  <div className={`w-full ${msg.role === "user" ? "flex justify-end" : "flex gap-4 max-w-[90%] md:max-w-[80%]"}`}>
                    {msg.role === "ai" && (
                      <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex-shrink-0 flex items-center justify-center mt-1">
                        <MessageSquare size={14} className="text-[#D4AF37]" />
                      </div>
                    )}
                    <div className={
                      msg.role === "user"
                        ? "bg-[#1e2235] text-sm text-gray-300 rounded-2xl px-4 py-2 max-w-[70%]"
                        : "w-full text-[15px] text-gray-200 leading-relaxed"
                    }>
                      {msg.role === "ai" && msg.isThinking ? (
                        <div className="flex items-center gap-3 text-gray-400 bg-white/5 rounded-2xl px-4 py-2 border border-white/5 animate-in fade-in slide-in-from-bottom-1 duration-500">
                          <Loader2 size={14} className="animate-spin text-[#D4AF37]" />
                          <span className="text-sm italic font-medium">
                            {thinkingMessages[thinkingStep]}
                          </span>
                        </div>
                      ) : (
                        msg.role === "ai" ? renderRichAIResponse(msg.text) : msg.text
                      )}
                    </div>
                  </div>
                </div>

                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className={`flex flex-col gap-2 mt-4 w-full pl-0 md:pl-12 transition-opacity duration-200 ${msg.suggestionsHidden ? 'opacity-0' : 'opacity-100'}`}>
                    {msg.suggestions.map((question, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(question, msg.id)}
                        className="w-fit max-w-[90%] md:max-w-[80%] text-left text-sm px-4 py-2 rounded-xl bg-[#1e2235] text-gray-200 hover:bg-[#2a3050] transition-colors cursor-pointer"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <div ref={chatBottomRef} />
        </div>

        {/* Chat Input */}
        <div className="p-8 shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-center bg-[#181b31] border border-[#2d3452] rounded-3xl focus-within:border-gray-500 transition-all px-4 py-2">
              <input
                type="text"
                placeholder="Start typing..."
                className="w-full bg-transparent border-none outline-none py-2 px-2 text-sm text-white placeholder:text-gray-500"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || chatLoading}
                className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-gray-400"
              >
                <Send size={16} />
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
