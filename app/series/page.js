import { BookOpen, Sparkles } from "lucide-react";

export default function Series() {
  return (
    <main className="min-h-screen bg-brand-navy pt-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-green/10 text-brand-green rounded-full text-xs font-bold mb-4 border border-brand-green/20">
              <Sparkles className="w-3 h-3" />
              <span>Series Study</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white">Sermon <span className="text-brand-green">Series</span></h1>
            <p className="text-gray-400 mt-4 max-w-xl font-light">
              Dive deeper into the teachings of the Heritage of Faith Church. Explore transcripts, summaries, and personalized study guides.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="group bg-brand-dark rounded-3xl overflow-hidden border border-white/5 hover:border-brand-green/30 transition-all hover:translate-y-[-4px]">
              <div className="aspect-video bg-gray-800 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy to-transparent opacity-60" />
                <div className="absolute bottom-4 left-4">
                  <span className="px-3 py-1 bg-brand-green text-white text-[10px] font-bold rounded-full">LATEST SERIES</span>
                </div>
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-brand-green transition-colors">Walking in Faith</h3>
                <p className="text-gray-400 text-sm font-light mb-6 line-clamp-2">
                  Explore the fundamental principles of faith and how to apply them in your everyday life...
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <BookOpen className="w-4 h-4" />
                    <span>12 Messages</span>
                  </div>
                  <button className="text-brand-green font-bold text-sm hover:underline">Start Study</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
