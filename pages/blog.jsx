import MarketingLayout from "@/components/marketing/MarketingLayout";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function FadeUp({ children, delay = 0, style = {} }) {
  const [ref, visible] = useInView();
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)", transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`, ...style }}>
      {children}
    </div>
  );
}

const posts = [
  {
    slug: "urban-heat-island-india-2025",
    tag: "Urban Climate",
    tagColor: "#FB923C",
    date: "Apr 28, 2025",
    title: "Why Indian cities are heating up 3× faster than the global average",
    excerpt: "Urban heat island intensity has accelerated dramatically in Tier-1 and Tier-2 Indian cities. Here's what's driving it and what residents can do.",
    readTime: "6 min read",
    featured: true,
  },
  {
    slug: "top-10-cooling-plants-terrace",
    tag: "Plant Science",
    tagColor: "#52B788",
    date: "Apr 19, 2025",
    title: "10 best plants for terrace cooling in Indian summers",
    excerpt: "Not all plants cool equally. We ranked the top performers by transpiration rate, canopy density, and maintenance need — with specific variety recommendations.",
    readTime: "8 min read",
    featured: false,
  },
  {
    slug: "society-greening-guide",
    tag: "For RWAs",
    tagColor: "#38BDF8",
    date: "Apr 10, 2025",
    title: "A practical guide to greening your entire society — from proposal to installation",
    excerpt: "Step-by-step: how to get your RWA committee aligned, calculate ROI, shortlist installers, and measure results. Includes a template proposal.",
    readTime: "12 min read",
    featured: false,
  },
  {
    slug: "ai-plant-placement-explained",
    tag: "Technology",
    tagColor: "#A78BFA",
    date: "Mar 31, 2025",
    title: "How AI optimises plant placement for maximum cooling — explained simply",
    excerpt: "A plain-English walkthrough of the layout optimizer: what data it uses, how it calculates shade, and why placement order matters more than species choice.",
    readTime: "7 min read",
    featured: false,
  },
  {
    slug: "before-after-noida-case-study",
    tag: "Case Study",
    tagColor: "#F472B6",
    date: "Mar 20, 2025",
    title: "Case study: 4.8°C reduction on a Noida rooftop terrace in 6 weeks",
    excerpt: "Follow along as a Noida family uses HeatWise to plan, plant, and measure the cooling effect on their 800 sq ft terrace. Real numbers, real timeline.",
    readTime: "10 min read",
    featured: false,
  },
  {
    slug: "monsoon-gardening-tips",
    tag: "Seasonal",
    tagColor: "#52B788",
    date: "Mar 8, 2025",
    title: "Monsoon prep: what to do with your green space before the rains hit",
    excerpt: "Waterlogging, overwatering, and root rot are the top killers of newly planted green spaces in the monsoon. Here's how to prepare and protect your investment.",
    readTime: "5 min read",
    featured: false,
  },
];

const tags = ["All", "Urban Climate", "Plant Science", "For RWAs", "Technology", "Case Study", "Seasonal"];

function PostCard({ post, index, featured = false }) {
  const [ref, visible] = useInView(0.05);
  const [hovered, setHovered] = useState(false);

  if (featured) {
    return (
      <div ref={ref} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(32px)", transition: "opacity 0.6s ease, transform 0.6s ease, box-shadow 0.3s", background: hovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${hovered ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`, borderRadius: 24, padding: "40px 36px", cursor: "pointer", boxShadow: hovered ? "0 20px 60px rgba(0,0,0,0.3)" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: post.tagColor, background: `${post.tagColor}18`, border: `1px solid ${post.tagColor}33`, borderRadius: 100, padding: "4px 12px", letterSpacing: 1 }}>{post.tag.toUpperCase()}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", fontFamily: "'JetBrains Mono',monospace" }}>FEATURED</span>
        </div>
        <h2 style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 800, color: "#fff", letterSpacing: -0.5, lineHeight: 1.25, marginBottom: 16 }}>{post.title}</h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.8, marginBottom: 24, maxWidth: 640 }}>{post.excerpt}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)" }}>{post.date}</span>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)" }}>{post.readTime}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: post.tagColor, marginLeft: "auto" }}>Read article →</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)", transition: `opacity 0.5s ease ${(index % 3) * 0.08}s, transform 0.5s ease ${(index % 3) * 0.08}s, box-shadow 0.3s`, background: hovered ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "28px 24px", cursor: "pointer", boxShadow: hovered ? "0 12px 40px rgba(0,0,0,0.25)" : "none" }}>
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: post.tagColor, background: `${post.tagColor}18`, border: `1px solid ${post.tagColor}33`, borderRadius: 100, padding: "4px 12px", letterSpacing: 1 }}>{post.tag.toUpperCase()}</span>
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.45, marginBottom: 10 }}>{post.title}</h3>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.75, marginBottom: 20 }}>{post.excerpt}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{post.date}</span>
        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{post.readTime}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: post.tagColor, marginLeft: "auto" }}>Read →</span>
      </div>
    </div>
  );
}

export default function Blog() {
  const [activeTag, setActiveTag] = useState("All");

  const filtered = posts.filter(p => activeTag === "All" || p.tag === activeTag);
  const featured = filtered.find(p => p.featured);
  const rest = filtered.filter(p => !p.featured);

  return (
    <MarketingLayout title="HeatWise Blog — Urban Cooling, Plant Science, Green City Stories" description="Expert articles on urban heat islands, plant science, AI-powered greening, society case studies, and seasonal tips for cooler Indian cities.">
      <div style={{ paddingTop: 100 }}>

        {/* Hero */}
        <section style={{ padding: "80px 24px 48px", textAlign: "center" }}>
          <FadeUp>
            <div style={{ display: "inline-flex", gap: 8, background: "rgba(82,183,136,0.12)", border: "1px solid rgba(82,183,136,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 24 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#52B788", letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace" }}>THE BLOG</span>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, color: "#fff", letterSpacing: -2, lineHeight: 1.1, marginBottom: 16, fontFamily: "'Space Grotesk',sans-serif" }}>
              Stories from the<br /><span style={{ background: "linear-gradient(135deg,#52B788,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>green city frontier</span>
            </h1>
          </FadeUp>
          <FadeUp delay={0.15}>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>Plant science, urban climate, case studies, and seasonal guides from the HeatWise team.</p>
          </FadeUp>
        </section>

        {/* Tag filters */}
        <section style={{ padding: "0 24px 40px", maxWidth: 1100, margin: "0 auto" }}>
          <FadeUp>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {tags.map(t => (
                <button key={t} onClick={() => setActiveTag(t)}
                  style={{ background: activeTag === t ? "linear-gradient(135deg,#1B4332,#52B788)" : "rgba(255,255,255,0.04)", border: activeTag === t ? "1px solid #52B78855" : "1px solid rgba(255,255,255,0.09)", borderRadius: 100, padding: "8px 18px", color: activeTag === t ? "#fff" : "rgba(255,255,255,0.50)", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                  {t}
                </button>
              ))}
            </div>
          </FadeUp>
        </section>

        <section style={{ padding: "0 24px 100px", maxWidth: 1100, margin: "0 auto" }}>
          {/* Featured post */}
          {featured && (
            <div style={{ marginBottom: 32 }}>
              <PostCard post={featured} index={0} featured />
            </div>
          )}

          {/* Rest */}
          {rest.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 20 }}>
              {rest.map((p, i) => <PostCard key={p.slug} post={p} index={i} />)}
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.35)" }}>No posts in this category yet.</div>
          )}
        </section>

        {/* Newsletter */}
        <section style={{ padding: "80px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(82,183,136,0.07) 0%, transparent 70%)" }}>
          <FadeUp style={{ textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
            <div style={{ fontSize: 40, marginBottom: 20 }}>🌱</div>
            <h2 style={{ fontSize: "clamp(22px,3.5vw,34px)", fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 12 }}>Get the monthly cooling update</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 28 }}>Plant picks, climate data, case studies, and city-specific tips — once a month, no spam.</p>
            <div style={{ display: "flex", gap: 10, maxWidth: 420, margin: "0 auto", flexWrap: "wrap" }}>
              <input placeholder="your@email.com" style={{ flex: 1, minWidth: 200, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
              <button style={{ background: "linear-gradient(135deg,#1B4332,#52B788)", color: "#fff", border: "none", padding: "14px 24px", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>Subscribe →</button>
            </div>
          </FadeUp>
        </section>

      </div>
    </MarketingLayout>
  );
}
