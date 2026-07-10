"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, List, ChevronDown, Filter } from "lucide-react";
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
    <main className="min-h-screen bg-white">
      {/* Page heading */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pt-28 sm:pt-36 pb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-brand-navy">
            Study
          </p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold text-brand-ink tracking-tight">
            Series Study
          </h1>
          <p className="mt-3 text-brand-gray max-w-lg">
            Explore Rev. Peter&apos;s teaching series by series — then ask
            questions, grounded in the messages themselves.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-sky rounded-full border border-brand-navy/10 self-start sm:self-auto">
          <List size={14} className="text-brand-navy" />
          <span className="text-xs font-bold text-brand-navy">
            {series.length} series available
          </span>
        </div>
      </section>

      {/* Filter bar */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-8">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-brand-sky/60 border border-brand-navy/10 p-4 sm:p-5 rounded-3xl">
          <div className="flex items-center gap-3">
            <Filter size={18} className="text-brand-navy flex-shrink-0" />
            <div className="flex p-1 bg-white rounded-2xl border border-brand-navy/10">
              {serviceTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-5 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    filterType === type
                      ? "bg-brand-navy text-white shadow-lg shadow-brand-navy/20"
                      : "text-brand-gray hover:text-brand-ink"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <span className="text-sm font-medium text-brand-gray">Year</span>
            <div className="relative flex-1 md:w-40">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full appearance-none bg-white border border-brand-navy/10 rounded-2xl px-5 py-3 text-sm font-bold text-brand-ink focus:outline-none focus:border-brand-navy/40 transition-colors cursor-pointer"
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-gray pointer-events-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="aspect-[16/10] bg-brand-sky rounded-3xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredSeries.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSeries.map((s) => {
              const thumbId =
                s.series_sermons?.find((ss) => ss.part_number === 1)?.sermons
                  ?.youtube_video_id ||
                s.series_sermons?.[0]?.sermons?.youtube_video_id;

              return (
                <Link
                  key={s.id}
                  href={`/series/${s.id}`}
                  className="group relative flex flex-col bg-white rounded-3xl overflow-hidden border border-brand-navy/10 hover:border-brand-navy/25 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-navy/10"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[16/10] relative overflow-hidden">
                    <img
                      src={
                        thumbId
                          ? `https://img.youtube.com/vi/${thumbId}/hqdefault.jpg`
                          : "/church-hero.jpg"
                      }
                      alt={s.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                    {/* Part count badge */}
                    <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full flex items-center gap-1.5">
                      <List size={12} className="text-white" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                        {s.total_parts || s.series_sermons?.length || 0} Parts
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5 sm:p-6 flex flex-col flex-1">
                    <h3 className="text-lg font-bold text-brand-ink mb-2 line-clamp-2 group-hover:text-brand-navy transition-colors leading-tight">
                      {s.title}
                    </h3>
                    <div className="mt-auto flex items-center gap-2 text-brand-gray">
                      <Calendar size={14} className="text-brand-navy" />
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
            <div className="w-20 h-20 bg-brand-sky rounded-full flex items-center justify-center mb-6 border border-brand-navy/10">
              <Filter size={32} className="text-brand-navy" />
            </div>
            <h2 className="text-2xl font-bold text-brand-ink mb-2">
              No series found for this filter.
            </h2>
            <p className="text-brand-gray max-w-md mx-auto">
              Try adjusting your selections or resetting the filters.
            </p>
            <button
              onClick={() => {
                setFilterType("All");
                setFilterYear("All");
              }}
              className="mt-8 text-brand-navy font-bold text-sm hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
