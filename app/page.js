import Link from "next/link";
import { Sparkles, BookOpen, ChevronRight, Play } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-brand-navy flex flex-col">
      {/* Hero Section */}
      <section className="relative h-[100vh] min-h-[700px] flex items-center justify-center overflow-hidden">
        {/* Background Image Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: 'url("https://hofng.org/wp-content/uploads/2022/07/Church-bg.jpg")', // fallback if image exists, or a nice church bg
            filter: 'brightness(0.35)'
          }}
        />
        
        {/* Curved Bottom Divider (HOFNG style) */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] transform rotate-180">
          <svg className="relative block w-[calc(100%+1.3px)] h-[100px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className="fill-brand-navy"></path>
          </svg>
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 flex flex-col items-center text-center">
          {/* Play Button Icon (HOFNG style) */}
          <div className="mb-8 p-6 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-2xl cursor-pointer hover:scale-110 transition-transform">
            <Play className="w-10 h-10 text-white fill-white" />
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-8 text-white leading-tight">
            Raising <br />
            <span className="relative">
              Stronger
              <span className="absolute bottom-2 left-0 w-full h-3 bg-brand-green/40 -z-10 rounded-full" />
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-200 mb-12 max-w-3xl font-light leading-relaxed">
            Your personal AI companion for the Heritage of Faith Church. Explore teachings, generate personalized declarations, and dive deeper into the Word.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl mx-auto justify-center">
            <Link 
              href="/declarations" 
              className="group flex items-center justify-center gap-3 px-10 py-5 bg-brand-green text-white font-bold rounded-full shadow-[0_10px_30px_rgba(72,158,62,0.3)] transition-all hover:scale-105 hover:bg-brand-green/90"
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-lg">Faith Declarations</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link 
              href="/series" 
              className="group flex items-center justify-center gap-3 px-10 py-5 bg-white text-brand-navy font-bold rounded-full shadow-xl transition-all hover:scale-105 hover:bg-gray-50"
            >
              <BookOpen className="w-5 h-5 text-brand-green" />
              <span className="text-lg">Series Study</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats/Feature Grid (HOFNG style) */}
      <section className="bg-brand-navy py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { title: "Daily Declarations", desc: "Start your day with powerful words of faith.", icon: Sparkles },
            { title: "Sermon Insights", desc: "Get deep insights from recent message series.", icon: BookOpen },
            { title: "Personal AI Guide", desc: "Ask questions and grow in your spiritual walk.", icon: ChevronRight },
          ].map((feature, i) => (
            <div key={i} className="p-8 bg-brand-dark rounded-3xl border border-white/5 hover:border-brand-green/30 transition-colors group">
              <div className="w-14 h-14 bg-brand-green/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-brand-green transition-colors">
                <feature.icon className="w-7 h-7 text-brand-green group-hover:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">{feature.title}</h3>
              <p className="text-gray-400 font-light">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-12 border-t border-white/5 text-center text-sm text-gray-500 font-light">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-left">
            <p>&copy; {new Date().getFullYear()} Heritage of Faith Church</p>
            <p className="text-xs mt-1">Faith Hub AI - Empowering your spiritual journey.</p>
          </div>
          <div className="flex gap-8">
            <Link href="#" className="hover:text-white">Messages</Link>
            <Link href="#" className="hover:text-white">Give</Link>
            <Link href="#" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
