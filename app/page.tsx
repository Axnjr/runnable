"use client";

import { WebsiteEditor } from "@/components/WebsiteEditor";

const sampleSource = `<section className="rounded-3xl border border-zinc-200 bg-white p-12 shadow-sm overflow-hidden relative group">
  <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[80px] -mr-32 -mt-32" />
  
  <div className="relative z-10">
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent mb-4 font-bold">
      Concept v1.0
    </p>
    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900 mb-6 leading-[1.1]">
      Better tools for <br /> modern interfaces.
    </h1>
    <p className="text-neutral-500 text-lg max-w-md mb-8 leading-relaxed">
      A minimalist JSX editor designed for speed and precision. Edit visually, export instantly.
    </p>
    <button className="bg-accent text-white px-8 py-3 rounded-full font-bold text-sm tracking-tight hover:brightness-110 active:scale-95 transition-all shadow-sm shadow-accent/20">
      Get Started
    </button>
  </div>
</section>`;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col items-center">
      <main className="w-full max-w-7xl px-6 py-12 space-y-12 animate-minimal-in">
        <WebsiteEditor
          initialSource={sampleSource}
          onSave={(serializedComponent) => {
            console.log("onSaveSerialized:\n", serializedComponent);
          }}
        />
      </main>
    </div>
  );
}
