import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import MarketingLayout from "@/components/marketing/MarketingLayout";

const C = {
  CREAM: "#fafaf6",
  FOREST: "#1a3828",
  FOREST_MID: "#2a5c3e",
  FOREST_LT: "#3d8a58",
  GREEN: "#40b070",
  GREEN_PALE: "#7dcc9a",
  MINT: "#e0f5e8",
  SKY: "#4a8fc8",
  GOLD: "#c8a440",
  HEAT_RED: "#d83030",
  HEAT_ORANGE: "#d87040",
  BG_DARK: "#111e18",
};

const CATEGORIES = ["All", "Science", "How-To", "Case Studies", "News", "Species"];

const POSTS = [
  {
    id: 1,
    category: "Science",
    emoji: "🌡️",
    title: "Why Mumbai Rooftops Reach 52°C — and What You Can Do About It",
    excerpt: "MODIS satellite data reveals alarming surface temperatures on concrete rooftops across Mumbai. We analysed 18 months of data and found a 12% year-on-year increase. Here's the physics, and the fix.",
    author: "Dr. Priya Nair",
    authorInitials: "PN",
    date: "April 28, 2026",
    readTime: "8 min read",
    color: C.HEAT_RED,
    featured: true,
  },
  {
    id: 2,
    category: "Case Studies",
    emoji: "🏠",
    title: "How a Bengaluru Housing Society Saved ₹1.2L on Electricity in One Summer",
    excerpt: "Koramangala Greens — a 240-unit society — partnered with HeatWise for a podium garden project. We tracked every degree and every rupee. The results exceeded all projections.",
    author: "Ravi Krishnan",
    authorInitials: "RK",
    date: "April 22, 2026",
    readTime: "12 min read",
    color: C.GREEN,
    featured: true,
  },
  {
    id: 3,
    category: "How-To",
    emoji: "📷",
    title: "The Complete Guide to Using HeatWise AR on Android",
    excerpt: "Step-by-step walkthrough of the AR scanning feature — from clearing the space to getting your first cooling score report. Includes tips for difficult angles and small spaces.",
    author: "Team HeatWise",
    authorInitials: "HW",
    date: "April 18, 2026",
    readTime: "6 min read",
    color: C.SKY,
    featured: false,
  },
  {
    id: 4,
    category: "Species",
    emoji: "🌿",
    title: "Neem vs Moringa: Which Tree Cools More — and Which is Right for You?",
    excerpt: "Both are drought-tolerant native trees beloved in Indian rooftop gardens. But which delivers better cooling, faster? We tested both across 40 installation sites over 18 months.",
    author: "Sunita Kapoor",
    authorInitials: "SK",
    date: "April 15, 2026",
    readTime: "7 min read",
    color: C.FOREST_MID,
    featured: false,
  },
  {
    id: 5,
    category: "News",
    emoji: "📰",
    title: "HeatWise Expands to 14th City: Welcome, Kochi",
    excerpt: "Kerala's coastal capital presents unique challenges — high humidity, salt spray and monsoon intensity. We've spent six months calibrating our models for Kochi's microclimate. We're ready.",
    author: "Team HeatWise",
    authorInitials: "HW",
    date: "April 10, 2026",
    readTime: "4 min read",
    color: C.GOLD,
    featured: false,
  },
  {
    id: 6,
    category: "Science",
    emoji: "💧",
    title: "Evapotranspiration: The Invisible Cooling Mechanism Most People Overlook",
    excerpt: "When people think about plant cooling, they think shade. But evapotranspiration — the water cycle through leaves — is often responsible for more than 60% of total cooling impact. Here's a deep dive.",
    author: "Dr. Amit Sharma",
    authorInitials: "AS",
    date: "April 5, 2026",
    readTime: "10 min read",
    color: C.SKY,
    featured: false,
  },
  {
    id: 7,
    category: "How-To",
    emoji: "🌱",
    title: "Succession Planting: How to Keep Your Rooftop Garden Productive Year-Round",
    excerpt: "India's climate cycles create opportunities for year-round growing. Learn how to sequence annuals, perennials and seasonals to maintain constant canopy cover and cooling output.",
    author: "Anita Desai",
    authorInitials: "AD",
    date: "March 30, 2026",
    readTime: "9 min read",
    color: C.GREEN,
    featured: false,
  },
  {
    id: 8,
    category: "Case Studies",
    emoji: "🏢",
    title: "IIT Bombay Campus Green Roof: 24-Month Monitoring Report",
    excerpt: "In partnership with IIT Bombay's Civil Engineering department, we installed and monitored a 2,400 sq ft green roof on a faculty hostel. This is the full data — including what didn't work.",
    author: "Research Team",
    authorInitials: "RT",
    date: "March 25, 2026",
    readTime: "15 min read",
    color: C.FOREST_LT,
    featured: false,
  },
  {
    id: 9,
    category: "Species",
    emoji: "🌺",
    title: "The 12 Best Plants for Delhi Summers (With Cooling Data)",
    excerpt: "Delhi summers are extreme — 46°C+ surface temps, dry air, unpredictable dust storms. These 12 species have proven themselves in Delhi's harshest conditions. Data from 180 installations.",
    author: "Neha Gupta",
    authorInitials: "NG",
    date: "March 20, 2026",
    readTime: "8 min read",
    color: C.HEAT_ORANGE,
    featured: false,
  },
];

function PostCard({ post, featured }) {
  const [hov, setHov] = useState(false);
  if (featured) {
    return (
      <motion.article
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        whileHover={{ y: -4 }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{ background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: hov ? "0 16px 48px rgba(26,56,40,0.12)" : "0 4px 20px rgba(26,56,40,0.07)", border: `1px solid rgba(26,56,40,0.08)`, transition: "box-shadow 0.3s", cursor: "pointer" }}
      >
        <div style={{ background: `linear-gradient(135deg, ${post.color}22, ${post.color}08)`, padding: "48px 40px 32px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, fontSize: 120, opacity: 0.1 }}>{post.emoji}</div>
          <span style={{ background: post.color, color: "#fff", borderRadius: 999, padding: "4px 14px", fontSize: 12, fontWeight: 700, display: "inline-block", marginBottom: 20 }}>{post.category}</span>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(20px,2.5vw,28px)", fontWeight: 700, color: C.FOREST, lineHeight: 1.3, marginBottom: 16 }}>{post.title}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: C.FOREST, opacity: 0.7 }}>{post.excerpt}</p>
        </div>
        <div style={{ padding: "20px 40px", display: "flex", alignItems: "center", gap: 12, borderTop: `1px solid rgba(26,56,40,0.06)` }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>{post.authorInitials}</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.FOREST }}>{post.author}</span>
          <span style={{ marginLeft: "auto", fontSize: 13, color: C.FOREST, opacity: 0.4, fontFamily: "'JetBrains Mono',monospace" }}>{post.date} · {post.readTime}</span>
        </div>
      </motion.article>
    );
  }
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4, boxShadow: "0 12px 36px rgba(64,176,112,0.1)" }}
      style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(26,56,40,0.05)", border: `1px solid rgba(26,56,40,0.08)`, transition: "box-shadow 0.3s", cursor: "pointer", display: "flex", flexDirection: "column" }}
    >
      <div style={{ background: `linear-gradient(135deg, ${post.color}18, ${post.color}06)`, padding: "32px 28px 24px", flex: 1, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.08 }}>{post.emoji}</div>
        <span style={{ background: `${post.color}22`, color: post.color === C.FOREST_MID ? C.FOREST_MID : post.color, borderRadius: 999, padding: "3px 12px", fontSize: 11, fontWeight: 700, display: "inline-block", marginBottom: 16 }}>{post.category}</span>
        <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 17, fontWeight: 700, color: C.FOREST, lineHeight: 1.4, marginBottom: 12 }}>{post.title}</h3>
        <p style={{ fontSize: 13, lineHeight: 1.65, color: C.FOREST, opacity: 0.65 }}>{post.excerpt}</p>
      </div>
      <div style={{ padding: "16px 28px", display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid rgba(26,56,40,0.06)` }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700 }}>{post.authorInitials}</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.FOREST }}>{post.author}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.FOREST, opacity: 0.4, fontFamily: "'JetBrains Mono',monospace" }}>{post.readTime}</span>
      </div>
    </motion.article>
  );
}

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = POSTS.filter((p) => activeCategory === "All" || p.category === activeCategory);
  const featuredPosts = filtered.filter((p) => p.featured);
  const regularPosts = filtered.filter((p) => !p.featured);

  return (
    <MarketingLayout title="HeatWise Blog — Urban Cooling Insights" description="Science, case studies, how-to guides and species deep-dives from the HeatWise team.">
      <style>{`
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 16px 2px rgba(64,176,112,0.3); } 50% { box-shadow: 0 0 32px 8px rgba(64,176,112,0.6); } }
      `}</style>

      {/* Hero */}
      <section style={{ padding: "80px 24px 60px", background: C.CREAM, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 700, height: 500, background: `radial-gradient(ellipse, ${C.MINT} 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ maxWidth: 700, margin: "0 auto", position: "relative" }}>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: C.GREEN, marginBottom: 16 }}>
            Insights · Science · Stories
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(32px,5vw,58px)", fontWeight: 800, color: C.FOREST, lineHeight: 1.1, marginBottom: 20 }}>
            The{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>HeatWise</span>{" "}blog
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 17, lineHeight: 1.7, color: C.FOREST, opacity: 0.7, marginBottom: 40 }}>
            Deep dives into urban heat science, plant cooling data, case studies from our 3,250+ installations and practical how-to guides for every Indian city.
          </motion.p>
          {/* Newsletter signup */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ display: "flex", gap: 8, maxWidth: 440, margin: "0 auto", background: "#fff", borderRadius: 999, padding: "6px 6px 6px 20px", boxShadow: "0 4px 20px rgba(26,56,40,0.08)", border: `1px solid rgba(64,176,112,0.2)` }}>
            <input type="email" placeholder="your@email.com" style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: C.FOREST, background: "transparent", fontFamily: "'DM Sans',sans-serif" }} />
            <button style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, color: "#fff", border: "none", borderRadius: 999, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" }}>
              Subscribe →
            </button>
          </motion.div>
          <p style={{ fontSize: 12, color: C.FOREST, opacity: 0.4, marginTop: 12 }}>No spam. One email per week, max. Unsubscribe any time.</p>
        </div>
      </section>

      {/* Category filters */}
      <div style={{ position: "sticky", top: 68, zIndex: 100, background: "rgba(250,250,246,0.9)", backdropFilter: "blur(12px)", borderBottom: `1px solid rgba(26,56,40,0.08)`, padding: "14px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                style={{ padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: `1px solid ${active ? C.GREEN : "rgba(26,56,40,0.15)"}`, background: active ? C.MINT : "#fff", color: active ? C.FOREST_MID : C.FOREST, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s" }}>
                {cat}
              </button>
            );
          })}
          <span style={{ marginLeft: "auto", fontSize: 13, color: C.FOREST, opacity: 0.4, fontFamily: "'JetBrains Mono',monospace", alignSelf: "center" }}>
            {filtered.length} articles
          </span>
        </div>
      </div>

      {/* Posts */}
      <section style={{ padding: "48px 24px 100px", background: C.CREAM }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeCategory} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* Featured */}
              {featuredPosts.length > 0 && (
                <div style={{ marginBottom: 40 }}>
                  <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.GREEN, marginBottom: 20, opacity: 0.8 }}>Featured</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 24 }} className="featured-grid">
                    <style>{`@media (max-width: 768px) { .featured-grid { grid-template-columns: 1fr !important; } }`}</style>
                    {featuredPosts.map((post) => <PostCard key={post.id} post={post} featured />)}
                  </div>
                </div>
              )}

              {/* Regular */}
              {regularPosts.length > 0 && (
                <div>
                  {featuredPosts.length > 0 && (
                    <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.GREEN, marginBottom: 20, opacity: 0.8 }}>More articles</p>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }} className="posts-grid">
                    <style>{`@media (max-width: 900px) { .posts-grid { grid-template-columns: repeat(2,1fr) !important; } } @media (max-width: 600px) { .posts-grid { grid-template-columns: 1fr !important; } }`}</style>
                    {regularPosts.map((post, i) => (
                      <motion.div key={post.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }}>
                        <PostCard post={post} featured={false} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "80px 0", color: C.FOREST, opacity: 0.4 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
                  <p style={{ fontSize: 16 }}>No posts in this category yet. Check back soon!</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ padding: "80px 24px", background: "#fff", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ fontSize: 48, marginBottom: 20, animation: "bob 4s ease-in-out infinite" }}>🌿</div>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(24px,3.5vw,40px)", fontWeight: 700, color: C.FOREST, marginBottom: 16 }}>
            Ready to put the science to work?
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: C.FOREST, opacity: 0.7, marginBottom: 32 }}>
            Scan your space for free and get an AI cooling plan backed by the same research you've been reading.
          </p>
          <Link href="/?start=scan"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, color: "#fff", fontWeight: 700, fontSize: 16, padding: "14px 32px", borderRadius: 999, textDecoration: "none" }}>
            📷 Start Free Scan →
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
