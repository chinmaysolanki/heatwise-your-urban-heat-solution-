export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Grotesk:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}

body{
  font-family:'DM Sans','Space Grotesk',sans-serif;
  background:#EAECF0;
  color:#374151;
  -webkit-font-smoothing:antialiased;
}

::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-thumb{background:rgba(45,106,79,0.25);border-radius:8px;}

.mono{font-family:'JetBrains Mono',monospace;}

.scr{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;}
.scr::-webkit-scrollbar{display:none;}
.scr-fixed{position:absolute;inset:0;overflow:hidden;}

/* ── Animations ─────────────────────────────────────────────── */
@keyframes growUp{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideIn{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}
@keyframes slideBack{from{opacity:0;transform:translateX(-22%)}to{opacity:1;transform:translateX(0)}}
@keyframes rotateSlow{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.85}}
@keyframes dotBlink{0%,100%{opacity:.18}50%{opacity:1}}
@keyframes bounceIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
@keyframes heatRise{0%{transform:translateY(0) scaleX(1);opacity:.6}100%{transform:translateY(-70px) scaleX(1.8);opacity:0}}
@keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}
@keyframes bgFloat{0%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-12px,0)}100%{transform:translate3d(0,0,0)}}
@keyframes softGlow{0%,100%{box-shadow:0 4px 20px rgba(45,106,79,0.18)}50%{box-shadow:0 8px 36px rgba(45,106,79,0.32),0 0 40px rgba(82,183,136,0.12)}}
@keyframes breathe{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.02)}}
@keyframes leafFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-6px) rotate(1.5deg)}}
@keyframes signalTravel{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@keyframes drawSVG{from{stroke-dashoffset:400}to{stroke-dashoffset:0}}
@keyframes ping{0%{transform:scale(1);opacity:1}100%{transform:scale(2.5);opacity:0}}
@keyframes countUp{from{opacity:0;transform:scale(.5) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes sunrisePulse{0%,100%{box-shadow:0 0 0 rgba(245,158,11,0)}50%{box-shadow:0 0 18px rgba(245,158,11,0.30)}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes neonFlicker{0%,100%{opacity:1}50%{opacity:.96}}
@keyframes progressGlow{0%,100%{box-shadow:0 0 12px rgba(45,106,79,0.25)}50%{box-shadow:0 0 22px rgba(45,106,79,0.45)}}

.screen-in{animation:slideIn .35s cubic-bezier(.25,.46,.45,.94) forwards}
.screen-back{animation:slideBack .3s cubic-bezier(.25,.46,.45,.94) forwards}
.a0{animation:growUp .35s 0s ease both}
.a1{animation:growUp .4s 0s ease both}
.a2{animation:growUp .4s .07s ease both}
.a3{animation:growUp .4s .14s ease both}
.a4{animation:growUp .4s .21s ease both}
.a5{animation:growUp .4s .28s ease both}
.a6{animation:growUp .4s .35s ease both}

/* ── Phone background ───────────────────────────────────────── */
.hw-phone-bg{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;}
.hw-phone-bg::before{
  content:'';position:absolute;inset:0;
  background:transparent;
}

/* ── Text colour helpers ────────────────────────────────────── */
.ng{color:#2D6A4F;}
.nc{color:#40916C;}
.no{color:#E65100;}
.ngo{color:#D97706;}

/* ── Card / HUD ─────────────────────────────────────────────── */
.hud{
  background:#FFFFFF;
  border:1px solid rgba(0,0,0,0.07);
  border-radius:18px;
  position:relative;
  overflow:hidden;
  box-shadow:0 2px 12px rgba(0,0,0,0.06);
}
.hud::before{
  content:'';
  position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(45,106,79,0.18),rgba(82,183,136,0.12),transparent);
}

/* ── Buttons ────────────────────────────────────────────────── */
.gbtn{
  background:rgba(45,106,79,0.07);
  border:1px solid rgba(45,106,79,0.25);
  color:#2D6A4F;
  font-family:'DM Sans','Space Grotesk',sans-serif;
  font-size:13px;
  font-weight:600;
  letter-spacing:.25px;
  padding:14px 24px;
  cursor:pointer;
  width:100%;
  border-radius:14px;
  transition:all .2s ease;
}
.gbtn:hover{background:rgba(45,106,79,0.13);border-color:rgba(45,106,79,0.45);color:#1B4332;}
.gbtn:active{transform:scale(.98);}
.gbtn.fill{
  background:linear-gradient(135deg,#1B4332,#2D6A4F 50%,#40916C);
  color:#FFFFFF;
  border-color:transparent;
  font-weight:700;
  box-shadow:0 6px 24px rgba(45,106,79,0.30),0 2px 8px rgba(0,0,0,0.10);
  animation:softGlow 3.5s ease-in-out infinite;
  letter-spacing:.3px;
}
.gbtn.fill:hover{box-shadow:0 8px 32px rgba(45,106,79,0.42);}
.gbtn.fill:active{transform:scale(.98);}
.gbtn:disabled{opacity:.35;pointer-events:none;}
.gbtn.cyan{border-color:rgba(82,183,136,0.35);color:#40916C;background:rgba(82,183,136,0.08);}
.gbtn.earth{border-color:rgba(217,119,6,0.30);color:#D97706;background:rgba(217,119,6,0.07);}

/* ── Inputs ─────────────────────────────────────────────────── */
.hinp{
  width:100%;
  padding:14px 16px;
  background:#FFFFFF;
  border:1.5px solid rgba(0,0,0,0.10);
  border-radius:12px;
  color:#111827;
  font-family:'DM Sans','Space Grotesk',sans-serif;
  font-size:14px;
  outline:none;
  transition:border-color .2s,box-shadow .2s;
  box-shadow:0 1px 4px rgba(0,0,0,0.04);
}
.hinp:focus{border-color:rgba(45,106,79,0.55);box-shadow:0 0 0 3px rgba(45,106,79,0.08);}
.hinp::placeholder{color:#9CA3AF;}

/* ── Progress bar ───────────────────────────────────────────── */
.hprog{height:3px;background:rgba(45,106,79,0.10);position:relative;overflow:visible;margin:0 20px 20px;border-radius:8px;}
.hprog-fill{height:100%;background:linear-gradient(90deg,#1B4332,#2D6A4F,#74C69D);box-shadow:0 0 8px rgba(45,106,79,0.40);transition:width .6s cubic-bezier(.34,1.56,.64,1);border-radius:8px;position:relative;}
.hprog-fill::after{content:'';position:absolute;right:-5px;top:-4px;width:11px;height:11px;background:#2D6A4F;border-radius:50%;box-shadow:0 0 10px rgba(45,106,79,0.70);}

/* ── Bottom nav ─────────────────────────────────────────────── */
.bnav{position:fixed;bottom:0;left:0;right:0;height:68px;background:#FFFFFF;border-top:1px solid rgba(0,0,0,0.07);display:flex;z-index:100;box-shadow:0 -2px 12px rgba(0,0,0,0.06);}
.nvi{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;transition:all .2s;position:relative;}
.nvi::after{content:'';position:absolute;bottom:0;width:0;height:2px;background:linear-gradient(90deg,#2D6A4F,#74C69D);border-radius:2px;transition:width .25s;}
.nvi.on::after{width:28px;}
.nvi:active{transform:scale(.88);}

/* ── Data card ──────────────────────────────────────────────── */
.dc{background:#FFFFFF;border:1px solid rgba(0,0,0,0.07);border-radius:14px;padding:15px;position:relative;transition:all .2s;box-shadow:0 1px 6px rgba(0,0,0,0.05);}
.dc:active{background:rgba(45,106,79,0.04);border-color:rgba(45,106,79,0.28);}

/* ── Tag / Badge ────────────────────────────────────────────── */
.tag{display:inline-flex;align-items:center;padding:4px 12px;font-family:'DM Sans','Space Grotesk',sans-serif;font-size:10px;font-weight:600;letter-spacing:.3px;border-radius:20px;}

/* ── Option row ─────────────────────────────────────────────── */
.opt{background:#FFFFFF;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:14px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:12px;box-shadow:0 1px 4px rgba(0,0,0,0.04);}
.opt.sel{border-color:rgba(45,106,79,0.55);background:rgba(45,106,79,0.05);box-shadow:0 0 0 3px rgba(45,106,79,0.06);}

/* ── Toggle ─────────────────────────────────────────────────── */
.tog{width:46px;height:24px;border-radius:12px;background:rgba(0,0,0,0.08);border:1px solid rgba(0,0,0,0.12);position:relative;cursor:pointer;transition:all .25s;flex-shrink:0;}
.tog.on{background:rgba(45,106,79,0.20);border-color:#2D6A4F;}
.tth{position:absolute;top:2px;left:2px;width:18px;height:18px;background:#9CA3AF;border-radius:50%;transition:left .22s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 6px rgba(0,0,0,0.15);}
.tog.on .tth{left:24px;background:#2D6A4F;}

/* ── Navbar ─────────────────────────────────────────────────── */
.navbar{display:flex;align-items:center;padding-top:calc(env(safe-area-inset-top,44px) + 14px);padding-bottom:12px;padding-left:20px;padding-right:20px;background:rgba(10,45,18,0.72);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-bottom:1px solid rgba(120,200,140,0.25);position:sticky;top:0;z-index:10;box-shadow:0 2px 16px rgba(0,0,0,0.20);}

/* ── Section label ──────────────────────────────────────────── */
.slabel{font-family:'DM Sans','Space Grotesk',sans-serif;font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:rgba(45,106,79,0.65);margin-bottom:10px;}

/* ── Chip ───────────────────────────────────────────────────── */
.chip{
  appearance:none;-webkit-appearance:none;
  padding:7px 16px;border-radius:20px;font-size:11px;font-family:'DM Sans','Space Grotesk',sans-serif;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap;
  border:1.5px solid rgba(0,0,0,0.10);background:#FFFFFF;color:#6B7280;letter-spacing:.2px;
}
.chip.on{background:rgba(45,106,79,0.10);color:#2D6A4F;border-color:rgba(45,106,79,0.40);}

/* ── Horizontal scroll ──────────────────────────────────────── */
.scrx{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;}
.scrx::-webkit-scrollbar{display:none;}

/* ── Scan pills ─────────────────────────────────────────────── */
.scan-pill-row{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;}
.scan-pill{
  appearance:none;-webkit-appearance:none;
  border:1.5px solid rgba(0,0,0,0.10);
  background:#FFFFFF;
  color:#374151;
  font-family:'DM Sans','Space Grotesk',sans-serif;
  font-size:11px;font-weight:600;letter-spacing:.3px;
  padding:10px 18px;min-height:40px;border-radius:999px;
  cursor:pointer;transition:all .2s;flex-shrink:0;
  box-shadow:0 1px 4px rgba(0,0,0,0.04);
}
.scan-pill:active{transform:scale(.97);}
.scan-pill--active{background:rgba(45,106,79,0.10);border-color:#2D6A4F;color:#2D6A4F;box-shadow:0 0 14px rgba(45,106,79,0.18);}

/* ── Scanlines (no-op, keeps className working) ─────────────── */
.scanlines{}

/* ── Auth ───────────────────────────────────────────────────── */
.auth-shell{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 18px;position:relative;background:#F2F3F7;}
.auth-shell-bg{
  position:absolute;inset:0;pointer-events:none;
  background:
    radial-gradient(600px 480px at 50% 10%,rgba(45,106,79,0.08) 0%,transparent 58%),
    radial-gradient(500px 400px at 10% 90%,rgba(82,183,136,0.06) 0%,transparent 55%),
    radial-gradient(420px 360px at 92% 75%,rgba(245,158,11,0.05) 0%,transparent 50%),
    #F2F3F7;
}
.auth-brand-line{width:40px;height:3px;background:linear-gradient(90deg,#2D6A4F,#74C69D);border-radius:2px;margin-bottom:14px;}
.auth-card{
  position:relative;z-index:1;width:100%;max-width:420px;
  background:#FFFFFF;
  border:1px solid rgba(0,0,0,0.08);border-radius:22px;
  padding:28px 24px;
  box-shadow:0 8px 32px rgba(0,0,0,0.08),0 1px 0 rgba(255,255,255,0.8) inset;
}

/* ── Screen animations ──────────────────────────────────────── */
@keyframes leafDrop{0%{transform:translateY(-20px) rotate(-15deg);opacity:0}30%{opacity:1}100%{transform:translateY(60px) rotate(15deg);opacity:0}}
@keyframes celebratePop{0%{transform:scale(0) rotate(-30deg);opacity:0}60%{transform:scale(1.15) rotate(5deg);opacity:1}80%{transform:scale(.95) rotate(-2deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes impactGrow{from{width:0;opacity:0}to{opacity:1}}
@keyframes floatUp{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-40px);opacity:0}}
@keyframes ringExpand{0%{transform:scale(.6);opacity:.7}100%{transform:scale(2.2);opacity:0}}
@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes textShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes cardEntrance{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes heatPulse{0%,100%{box-shadow:0 0 10px rgba(230,81,0,.18)}50%{box-shadow:0 0 28px rgba(230,81,0,.38),0 0 50px rgba(245,158,11,.12)}}
@keyframes waterFlow{0%{stroke-dashoffset:200}100%{stroke-dashoffset:0}}
@keyframes notifSlide{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:translateX(0)}}
@keyframes treegrow{0%{transform:scaleY(0);transform-origin:bottom}100%{transform:scaleY(1);transform-origin:bottom}}
@keyframes particleBurst{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0}}
@keyframes auroraShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

/* ── Species card ───────────────────────────────────────────── */
.spc-card{
  background:#FFFFFF;
  border:1px solid rgba(0,0,0,0.07);
  border-radius:18px;
  overflow:hidden;
  cursor:pointer;
  transition:all .22s ease;
  animation:cardEntrance .4s ease both;
  box-shadow:0 2px 10px rgba(0,0,0,0.05);
}
.spc-card:active{transform:scale(.97);border-color:rgba(45,106,79,0.35);}

/* ── Tip card ───────────────────────────────────────────────── */
.tip-card{
  border-radius:18px;
  padding:18px;
  position:relative;
  overflow:hidden;
  cursor:pointer;
  transition:all .22s ease;
}
.tip-card:active{transform:scale(.98);}

/* ── Impact metric tile ─────────────────────────────────────── */
.imp-tile{
  background:#FFFFFF;
  border-radius:18px;
  padding:16px;
  border:1px solid rgba(0,0,0,0.07);
  transition:all .2s;
  position:relative;
  overflow:hidden;
  box-shadow:0 2px 10px rgba(0,0,0,0.05);
}
.imp-tile::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,rgba(45,106,79,0.22),transparent);
}

/* ── Notification item ──────────────────────────────────────── */
.notif-item{
  display:flex;align-items:flex-start;gap:12px;
  padding:14px 16px;
  border-bottom:1px solid rgba(0,0,0,0.05);
  animation:notifSlide .35s ease both;
  cursor:pointer;
  transition:background .18s;
}
.notif-item:active{background:rgba(45,106,79,0.04);}

/* ── Heat bar ───────────────────────────────────────────────── */
.heat-bar{height:5px;border-radius:3px;background:linear-gradient(90deg,#2D6A4F,#F59E0B,#E65100);position:relative;}

/* ── Explore card ───────────────────────────────────────────── */
.explore-card{
  border-radius:20px;
  padding:18px;
  position:relative;
  overflow:hidden;
  cursor:pointer;
  transition:all .22s ease;
  border:1px solid rgba(0,0,0,0.07);
  background:#FFFFFF;
  box-shadow:0 2px 8px rgba(0,0,0,0.05);
}
.explore-card:active{transform:scale(.98);}

/* ── Aurora gradient (now green-based) ─────────────────────── */
.aurora-text{
  background:linear-gradient(90deg,#2D6A4F,#40916C,#74C69D,#2D6A4F);
  background-size:300% 100%;
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  background-clip:text;
  animation:auroraShift 6s ease infinite;
}
.aurora-border{
  border:1px solid transparent;
  background:#FFFFFF padding-box,
             linear-gradient(135deg,#2D6A4F,#74C69D,#40916C) border-box;
}
`;
