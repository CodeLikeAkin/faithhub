"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Calendar, List, ChevronDown, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SeriesBrowsePage() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("All");
  const [filterYear, setFilterYear] = useState("All");

  // Filter options
  const years = ["All", "2022", "2023", "2024", "2025", "2026"];
  const serviceTypes = ["All", "Sunday", "Wednesday"];

  useEffect(() => {
    fetchSeries();
  }, []);

  const fetchSeries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("series")
        .select(`
          *,
          series_sermons (
            part_number,
            sermons (
              youtube_video_id
            )
          )
        `)
        .order("start_date", { ascending: false });

      if (error) throw error;
      setSeries(data || []);
    } catch (err) {
      console.error("Error fetching series:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSeries = series.filter((s) => {
    const matchesType =
      filterType === "All" ||
      s.service_type?.toLowerCase() === filterType.toLowerCase();
    const matchesYear =
      filterYear === "All" ||
      new Date(s.start_date).getFullYear().toString() === filterYear;
    return matchesType && matchesYear;
  });

  const formatDateRange = (start, end) => {
    if (!start) return "";
    const s = new Date(start);
    const e = end ? new Date(end) : s;
    const options = { month: "short", year: "numeric" };
    
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
      return s.toLocaleDateString("en-US", options);
    }
    
    return `${s.toLocaleDateString("en-US", options)} – ${e.toLocaleDateString("en-US", options)}`;
  };

  return (
    <main className="min-h-screen bg-[#181b31] text-white selection:bg-[#D4AF37] selection:text-[#181b31]">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -right-[5%] w-[45%] h-[45%] rounded-full bg-[#D4AF37] opacity-[0.03] blur-[100px]" />
        <div className="absolute bottom-[10%] -left-[5%] w-[35%] h-[35%] rounded-full bg-[#D4AF37] opacity-[0.02] blur-[80px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#181b31]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link 
              href="/" 
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-[#489e3e] hover:bg-[#489e3e]/10 hover:translate-x-[-2px] transition-all"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Series Study</h1>
              <p className="text-xs text-gray-400 font-light uppercase tracking-widest mt-0.5">Explore Teachings</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
            <Play size={14} className="text-[#D4AF37]" />
            <span className="text-xs font-semibold text-gray-300">{series.length} Series Available</span>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/[0.02] border border-white/5 p-6 rounded-3xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-[#D4AF37] mr-2" />
            <div className="flex p-1 bg-[#121424] rounded-2xl border border-white/5">
              {serviceTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    filterType === type 
                      ? "bg-[#D4AF37] text-[#181b31] shadow-lg shadow-[#D4AF37]/20" 
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <span className="text-sm font-medium text-gray-400">Year</span>
            <div className="relative flex-1 md:w-40">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full appearance-none bg-[#121424] border border-white/10 rounded-2xl px-5 py-3 text-sm font-bold text-white focus:outline-none focus:border-[#D4AF37]/50 transition-colors cursor-pointer"
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-[16/10] bg-white/5 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredSeries.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredSeries.map((s) => {
              const thumbId = s.series_sermons?.find(ss => ss.part_number === 1)?.sermons?.youtube_video_id 
                             || s.series_sermons?.[0]?.sermons?.youtube_video_id;
              
              return (
                <Link 
                  key={s.id}
                  href={`/series/${s.id}`}
                  className="group relative flex flex-col bg-[#121424] rounded-3xl overflow-hidden border border-white/5 hover:border-[#D4AF37]/30 transition-all hover:translate-y-[-4px] hover:shadow-2xl hover:shadow-[#D4AF37]/10"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[16/10] relative overflow-hidden">
                    <img 
                      src={thumbId ? `https://img.youtube.com/vi/${thumbId}/hqdefault.jpg` : "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=1000&auto=format&fit=crop"}
                      alt={s.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#121424] via-transparent to-transparent opacity-60" />
                    
                    {/* Part Count Badge */}
                    <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-1.5">
                      <List size={12} className="text-[#D4AF37]" />
                      <span className="text-[10px] font-black uppercase tracking-wider">{s.total_parts || s.series_sermons?.length || 0} Parts</span>
                    </div>

                    {/* Service Type Badge */}
                    <div className="absolute top-4 left-4 px-3 py-1 bg-[#D4AF37] text-[#181b31] rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg">
                      {s.service_type || "Series"}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-[#D4AF37] transition-colors leading-tight">
                      {s.title}
                    </h3>
                    <div className="mt-auto flex items-center gap-2 text-gray-400">
                      <Calendar size={14} className="text-[#489e3e]" />
                      <span className="text-xs font-medium">
                        {formatDateRange(s.start_date, s.end_date)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
              <Filter size={32} className="text-gray-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No series found for this filter.</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Try adjusting your selections or resetting the filters.
            </p>
            <button 
              onClick={() => { setFilterType("All"); setFilterYear("All"); }}
              className="mt-8 text-[#D4AF37] font-bold text-sm hover:underline"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </section>

      {/* CSS for custom scrollbar and animations */}
      <style jsx global>{`
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #121424;
        }
        ::-webkit-scrollbar-thumb {
          background: #2a2e4a;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #D4AF37;
        }
      `}</style>
    </main>
  );
}
