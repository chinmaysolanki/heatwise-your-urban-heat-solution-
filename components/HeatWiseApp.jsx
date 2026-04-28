import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { AROverlay, ManualMeasurement, createSpatialMappingFromRecommendation } from "@/ar";
import { T } from "@/components/heatwise/theme";
import { CSS } from "@/components/heatwise/styles";
import { HomeDashboardLight } from "@/components/heatwise/HomeDashboardLight";
import { fetchHeatReductionSummary, logRecommendationFeedback } from "@/components/heatwise/feedback";
import { Ic } from "@/components/heatwise/ui/Icon";
import { BottomNav } from "@/components/heatwise/ui/BottomNav";
import { buildInstallerExport } from "@/lib/installerExport";
import { LiveARMeasurementScreen } from "@/live-ar/screens/LiveARMeasurementScreen";
import { useSession } from "next-auth/react";
import { PhoneLoginScreen } from "@/components/heatwise/auth/PhoneLoginScreen";
import { CompleteProfileScreen } from "@/components/heatwise/auth/CompleteProfileScreen";
import { OTPVerificationScreen } from "@/components/heatwise/auth/OTPVerificationScreen";
import {
  buildRecommendationGenerateRequestFromPhotoSession,
  buildGenerateLayoutRequestBody,
  layoutRecommendationsFromGenerateResponse,
} from "@/lib/recommendation/buildRecommendationGenerateRequestFromPhotoSession";
import { postLearningTelemetryEvent } from "@/lib/recommendation/postLearningTelemetryEvent";
import {
  buildSpeciesPayloadForTelemetrySnapshot,
  extractSpeciesCatalogCodesFromRecommendation,
} from "@/lib/recommendation/buildTelemetrySpeciesPayload";

/* ══════════════════════════════════════════════════════════════════
   GLOBAL CSS
══════════════════════════════════════════════════════════════════ */
const _CSS_DO_NOT_USE = `
/* CSS lives in components/heatwise/styles.js — this const is kept for legacy refs */
`;

/* Icons moved to `components/heatwise/ui/Icon.jsx` */

/* ══════════════════════════════════════════════════════════════════
   GLOBAL ANIMATED BACKGROUND
══════════════════════════════════════════════════════════════════ */
const GARDEN_BG_CSS = `
input::placeholder { color: rgba(255,255,255,0.45) !important; }

@keyframes gardenZoom {
  0%   { transform: scale(1.08) translate(0%, 0%); }
  25%  { transform: scale(1.14) translate(-1.5%, 0.5%); }
  50%  { transform: scale(1.10) translate(-0.5%, -1%); }
  75%  { transform: scale(1.15) translate(1%, 0.5%); }
  100% { transform: scale(1.08) translate(0%, 0%); }
}
@keyframes gardenBreathe {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.92; }
}
.garden-bg-img {
  position: absolute;
  inset: -8%;
  width: 116%;
  height: 116%;
  object-fit: cover;
  object-position: center 40%;
  animation: gardenZoom 28s ease-in-out infinite, gardenBreathe 8s ease-in-out infinite;
  will-change: transform;
  filter: brightness(0.55);
}
`;

const GlobalBg = () => (
  <div style={{
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    background: '#1a3a1a',
  }}>
    <style>{GARDEN_BG_CSS}</style>
    <img
      src="/garden-bg.webp"
      alt=""
      className="garden-bg-img"
    />
    {/* darkening overlay so cards/text stay readable */}
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, rgba(0,10,4,0.52) 0%, rgba(0,8,3,0.48) 50%, rgba(0,6,2,0.58) 100%)',
    }} />
  </div>
);

/* ══════════════════════════════════════════════════════════════════
   3D ── MEGA CITY (Splash / Home hero)
══════════════════════════════════════════════════════════════════ */
const MegaCityScene = ({ height=420, fog=true }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const W=el.clientWidth, H=el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ canvas:el, antialias:true, alpha:false });
    renderer.setSize(W,H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setClearColor(0x87CEEB,1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    if(fog) scene.fog = new THREE.FogExp2(0xC8E8C0, 0.028);
    // Standing in garden, looking down the path
    const camera = new THREE.PerspectiveCamera(55, W/H, 0.05, 80);
    camera.position.set(0, 1.55, 6); camera.lookAt(0, 1.0, -8);
    const rnd=(a,b)=>a+Math.random()*(b-a);

    // ── Beautiful afternoon sky ──
    const skyM=new THREE.ShaderMaterial({
      side:THREE.BackSide,
      vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        varying vec3 vP;
        void main(){
          float y=normalize(vP).y;
          vec3 top=vec3(.35,.62,.92);
          vec3 mid=vec3(.55,.78,.96);
          vec3 hor=vec3(.82,.90,.96);
          vec3 col=y>0.?mix(mid,top,smoothstep(0.,.7,y)):mix(hor,mid,smoothstep(-.1,0.,y));
          // subtle sun glow
          vec3 sd=normalize(vec3(.4,.55,-.72));
          float sc=dot(normalize(vP),sd);
          col+=vec3(1.,.98,.85)*smoothstep(.9985,.9999,sc);
          col+=vec3(.98,.88,.60)*pow(max(0.,sc),6.)*.18;
          gl_FragColor=vec4(col,1.);
        }`,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(60,16,10),skyM));

    // ── Manicured lawn ──
    const lawnM=new THREE.ShaderMaterial({
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        uniform float uT;varying vec2 vUv;
        float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
        float n(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
        void main(){
          float n1=n(vUv*8.+uT*.012);float n2=n(vUv*22.-uT*.008);
          float nm=n1*.6+n2*.4;
          // mow stripe pattern
          float stripe=sin(vUv.x*60.)*.04;
          vec3 g1=vec3(.22,.52,.14); vec3 g2=vec3(.28,.62,.18);
          vec3 col=mix(g1,g2,nm+stripe);
          gl_FragColor=vec4(col,1.);
        }`,
      uniforms:{uT:{value:0}},
    });
    const lawn=new THREE.Mesh(new THREE.PlaneGeometry(60,60,1,1),lawnM);
    lawn.rotation.x=-Math.PI/2; lawn.receiveShadow=true; scene.add(lawn);

    // ── Stone garden path down the center ──
    const stoneMat=new THREE.MeshStandardMaterial({color:0xC4B49A,roughness:.92,metalness:.02});
    const pathStones=[
      [0,.005,5.2,.9,.55],[0,.005,3.8,.85,.52],[-.15,.005,2.4,.92,.5],[.12,.005,1.0,.88,.54],
      [0,.005,-.4,.90,.52],[-.1,.005,-1.8,.86,.50],[.08,.005,-3.2,.92,.54],
      [0,.005,-4.6,.88,.52],[-.05,.005,-6.0,.85,.50],[0,.005,-7.4,.90,.54],
      [-.08,.005,-8.8,.86,.52],[0,.005,-10.2,.88,.50],
    ];
    pathStones.forEach(([px,py,pz,sw,sd])=>{
      const sg=new THREE.BoxGeometry(sw,0.04,sd);
      const stone=new THREE.Mesh(sg,stoneMat);
      stone.position.set(px,py,pz); stone.rotation.y=rnd(-.12,.12);
      stone.receiveShadow=true; stone.castShadow=false; scene.add(stone);
    });

    // ── Geometric hedge helper ──
    const hedgeMat=new THREE.MeshStandardMaterial({color:0x2E7D32,roughness:.85,metalness:0});
    const makeHedge=(x,z,w,h2,d)=>{
      const hg=new THREE.BoxGeometry(w,h2,d);
      const hedge=new THREE.Mesh(hg,hedgeMat);
      hedge.position.set(x,h2/2,z); hedge.castShadow=true; hedge.receiveShadow=true; scene.add(hedge);
    };
    // Left hedge row
    makeHedge(-2.2,0,0.55,0.9,16); makeHedge(-2.2,0,0.55,0.9,16);
    // Right hedge row
    makeHedge(2.2,0,0.55,0.9,16);
    // Back hedge (end of garden)
    makeHedge(0,-11,10,1.2,0.55);

    // ── Topiary balls on hedge corners ──
    const topMat=new THREE.MeshStandardMaterial({color:0x1B5E20,roughness:.80,metalness:0});
    [[-2.2,5.3],[-2.2,-2.8],[2.2,5.3],[2.2,-2.8]].forEach(([tx,tz])=>{
      const tp=new THREE.Mesh(new THREE.IcosahedronGeometry(.38,2),topMat);
      tp.position.set(tx,1.22,tz); tp.castShadow=true; scene.add(tp);
    });

    // ── Flower bed helper ──
    const soilMat=new THREE.MeshStandardMaterial({color:0x5D4037,roughness:.98,metalness:0});
    const makeBed=(cx,cz,bw,bd)=>{
      const bed=new THREE.Mesh(new THREE.BoxGeometry(bw,.06,bd),soilMat);
      bed.position.set(cx,.03,cz); scene.add(bed);
    };
    makeBed(-3.5,-2,1.6,8); makeBed(3.5,-2,1.6,8);

    // ── Flowers ──
    const flowerDefs=[
      // roses — deep pink
      {col:0xE91E8C,h:.38,r:.07,n:18,xr:[-4.5,-2.6],zr:[1,-5]},
      // lavender — purple spikes
      {col:0x9C27B0,h:.42,r:.05,n:15,xr:[-4.5,-2.6],zr:[-5,-9]},
      // marigolds — bright orange/yellow
      {col:0xFF8F00,h:.28,r:.09,n:14,xr:[2.6,4.5],zr:[1,-5]},
      // blue salvia
      {col:0x1565C0,h:.35,r:.055,n:12,xr:[2.6,4.5],zr:[-5,-9]},
      // white daisies scattered near path edges
      {col:0xF5F5F5,h:.22,r:.06,n:10,xr:[-1.8,1.8],zr:[5,3]},
    ];
    flowerDefs.forEach(({col,h,r,n,xr,zr})=>{
      const stemM2=new THREE.MeshStandardMaterial({color:0x388E3C,roughness:.9});
      const petalM=new THREE.MeshStandardMaterial({color:col,roughness:.45,metalness:.04});
      const centreM=new THREE.MeshStandardMaterial({color:0xFFEE58,roughness:.5});
      for(let i=0;i<n;i++){
        const fx=rnd(xr[0],xr[1]), fz=rnd(zr[1],zr[0]);
        const fh=h+rnd(-.06,.08);
        const stem=new THREE.Mesh(new THREE.CylinderGeometry(.008,.01,fh,5),stemM2);
        stem.position.set(fx,fh/2,fz); scene.add(stem);
        // petals as flattened torus or disc
        const bloom=new THREE.Mesh(new THREE.SphereGeometry(r+rnd(0,.02),7,5),petalM);
        bloom.scale.y=.45; bloom.position.set(fx,fh+r*.4,fz);
        bloom.castShadow=true; scene.add(bloom);
        const centre=new THREE.Mesh(new THREE.SphereGeometry(r*.35,5,4),centreM);
        centre.position.set(fx,fh+r*.55,fz); scene.add(centre);
      }
    });

    // ── Garden trees (ornamental) ──
    const perturbGeo=(geo,amt)=>{
      const p=geo.attributes.position;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        const len=Math.sqrt(x*x+y*y+z*z)||1;
        const noise=(Math.random()-.5)*amt;
        const s=(len+noise)/len;
        p.setXYZ(i,x*s,y*s,z*s);
      }
      geo.computeVertexNormals(); return geo;
    };
    const makeGardenTree=(tx,tz,tH,canR,bloomCol)=>{
      // Trunk
      const trunk=new THREE.Mesh(
        new THREE.CylinderGeometry(tH*.04,tH*.065,tH,8),
        new THREE.MeshStandardMaterial({color:0x5D4037,roughness:.97})
      );
      trunk.position.set(tx,tH/2,tz); trunk.castShadow=true; scene.add(trunk);
      // Canopy
      const cg=perturbGeo(new THREE.IcosahedronGeometry(canR,2),.3);
      const canM=new THREE.MeshStandardMaterial({
        color: bloomCol || new THREE.Color().setHSL(.30+rnd(0,.08),.55,.30+rnd(0,.12)),
        roughness:.82,metalness:0
      });
      const can=new THREE.Mesh(cg,canM);
      can.position.set(tx,tH+canR*.5,tz); can.castShadow=true; scene.add(can);
      // 3 sub-clusters
      for(let c=0;c<4;c++){
        const ca=(c/4)*Math.PI*2+rnd(-.3,.3);
        const cd=canR*.6;
        const sr=canR*rnd(.3,.55);
        const sg=perturbGeo(new THREE.IcosahedronGeometry(sr,1),.28);
        const sm=new THREE.MeshStandardMaterial({color:bloomCol||new THREE.Color().setHSL(.31+rnd(0,.07),.52,.28+rnd(0,.14)),roughness:.83});
        const sc2=new THREE.Mesh(sg,sm);
        sc2.position.set(tx+Math.cos(ca)*cd,tH+canR*.6+rnd(-.2,.3),tz+Math.sin(ca)*cd*.8);
        sc2.castShadow=true; scene.add(sc2);
      }
    };
    // Left side: flowering cherry (pink blossom)
    makeGardenTree(-5.5, 2.0, 3.8, 1.4, new THREE.Color(0xF48FB1));
    makeGardenTree(-5.2,-6.0, 3.2, 1.2, new THREE.Color(0xF48FB1));
    // Right side: apple green canopy
    makeGardenTree( 5.5, 1.5, 4.0, 1.5, null);
    makeGardenTree( 5.2,-5.5, 3.5, 1.3, null);
    // Background flanking
    makeGardenTree(-7.5,-10, 5.0, 1.8, null);
    makeGardenTree( 7.5,-10, 5.0, 1.8, null);
    makeGardenTree( 0, -14, 6.0, 2.2, null);

    // ── Instanced lawn grass blades ──
    const BLADES=4000;
    const bladeBaseG=new THREE.PlaneGeometry(.028,.32,1,3);
    const bv=bladeBaseG.attributes.position;
    for(let i=0;i<bv.count;i++){const yy=(bv.getY(i)+.16)/.32;bv.setX(i,bv.getX(i)*(1.-yy*.75));}
    bladeBaseG.computeVertexNormals();
    const bladeMat=new THREE.ShaderMaterial({
      side:THREE.DoubleSide,transparent:true,
      vertexShader:`
        attribute vec3 aOff;attribute float aRot;attribute float aSc;attribute float aPh;
        uniform float uT;varying float vY;
        void main(){
          vY=(position.y+.16)/.32;
          float w=sin(uT*2.2+aPh+aOff.x*.6)*(vY*vY*.4)+cos(uT*1.4+aPh*.8)*(vY*vY*.18);
          vec3 p=vec3(position.x+w,position.y,position.z)*aSc;
          float c=cos(aRot),s=sin(aRot);
          p=vec3(c*p.x-s*p.z,p.y,s*p.x+c*p.z)+aOff;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader:`
        varying float vY;
        void main(){
          vec3 root=vec3(.14,.38,.06);
          vec3 mid=vec3(.20,.55,.10);
          vec3 tip=vec3(.28,.68,.14);
          vec3 col=mix(root,mix(mid,tip,vY*.7),vY);
          float a=mix(1.,.0,smoothstep(.80,1.,vY));
          if(a<.01)discard;
          gl_FragColor=vec4(col,a);
        }`,
      uniforms:{uT:{value:0}},
    });
    const bOff=new Float32Array(BLADES*3),bRot=new Float32Array(BLADES),bSc=new Float32Array(BLADES),bPh=new Float32Array(BLADES);
    for(let i=0;i<BLADES;i++){
      const ang=Math.random()*Math.PI*2,r=rnd(.3,18);
      // Avoid path center (|x|<1.2)
      const bx=Math.cos(ang)*r*(Math.random()<.5?-1:1);
      bOff[i*3]=(Math.abs(bx)<1.2?bx+(bx<0?-1.2:1.2):bx);
      bOff[i*3+1]=0; bOff[i*3+2]=Math.sin(ang)*r-3;
      bRot[i]=Math.random()*Math.PI*2; bSc[i]=rnd(.6,1.6); bPh[i]=Math.random()*Math.PI*2;
    }
    const bladeIG=new THREE.InstancedBufferGeometry();
    bladeIG.index=bladeBaseG.index;
    bladeIG.attributes.position=bladeBaseG.attributes.position;
    bladeIG.attributes.normal=bladeBaseG.attributes.normal;
    bladeIG.attributes.uv=bladeBaseG.attributes.uv;
    bladeIG.setAttribute('aOff',new THREE.InstancedBufferAttribute(bOff,3));
    bladeIG.setAttribute('aRot',new THREE.InstancedBufferAttribute(bRot,1));
    bladeIG.setAttribute('aSc',new THREE.InstancedBufferAttribute(bSc,1));
    bladeIG.setAttribute('aPh',new THREE.InstancedBufferAttribute(bPh,1));
    bladeIG.instanceCount=BLADES;
    scene.add(new THREE.Mesh(bladeIG,bladeMat));

    // ── Garden bench (simple slats) ──
    const woodM=new THREE.MeshStandardMaterial({color:0x8D6E63,roughness:.88});
    const ironM=new THREE.MeshStandardMaterial({color:0x37474F,roughness:.7,metalness:.5});
    // Seat slats
    for(let s=0;s<4;s++){
      const slat=new THREE.Mesh(new THREE.BoxGeometry(1.4,.05,.18),woodM);
      slat.position.set(-4.0,.52+s*.01,-4.0+s*.2); slat.castShadow=true; scene.add(slat);
    }
    // Back rest
    for(let s=0;s<3;s++){
      const br=new THREE.Mesh(new THREE.BoxGeometry(1.4,.04,.14),woodM);
      br.position.set(-4.0,.75+s*.18,-4.55); br.rotation.x=-.15; br.castShadow=true; scene.add(br);
    }
    // Legs
    [[-3.4,.25,-3.8],[-4.6,.25,-3.8],[-3.4,.25,-4.6],[-4.6,.25,-4.6]].forEach(([lx,ly,lz])=>{
      const leg=new THREE.Mesh(new THREE.BoxGeometry(.06,.5,.06),ironM);
      leg.position.set(lx,ly,lz); scene.add(leg);
    });

    // ── Floating petals (pink cherry) ──
    const N=220;
    const pPos=new Float32Array(N*3),pSz=new Float32Array(N),pA=new Float32Array(N),pC=new Float32Array(N*3),pV=new Float32Array(N*2),pOff=new Float32Array(N);
    const petalPalette=[[.96,.70,.80],[.98,.80,.88],[1.,.90,.94],[.98,.75,.85]];
    for(let i=0;i<N;i++){
      pPos[i*3]=rnd(-8,8); pPos[i*3+1]=rnd(.3,6); pPos[i*3+2]=rnd(-14,5);
      pSz[i]=.004+Math.random()*.008; pA[i]=.4+Math.random()*.5; pOff[i]=Math.random()*Math.PI*2;
      const pc=petalPalette[Math.floor(Math.random()*petalPalette.length)];
      pC[i*3]=pc[0]; pC[i*3+1]=pc[1]; pC[i*3+2]=pc[2];
      pV[i*2]=(Math.random()-.5)*.004; pV[i*2+1]=-(0.002+Math.random()*.003);
    }
    const pGeo=new THREE.BufferGeometry();
    const pPA=new THREE.BufferAttribute(pPos,3);
    pGeo.setAttribute('position',pPA);
    pGeo.setAttribute('aSize',new THREE.BufferAttribute(pSz,1));
    pGeo.setAttribute('aAlpha',new THREE.BufferAttribute(pA,1));
    pGeo.setAttribute('aColor',new THREE.BufferAttribute(pC,3));
    const pMat=new THREE.ShaderMaterial({
      vertexShader:`attribute float aSize;attribute float aAlpha;attribute vec3 aColor;varying float vA;varying vec3 vC;uniform float uPR;void main(){vA=aAlpha;vC=aColor;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*uPR*(300./-mv.z);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying float vA;varying vec3 vC;void main(){vec2 uv=gl_PointCoord-.5;float r=length(uv);if(r>.5)discard;float a=(1.-smoothstep(.15,.5,r))*vA;gl_FragColor=vec4(vC,a);}`,
      uniforms:{uPR:{value:renderer.getPixelRatio()}},
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(pGeo,pMat));

    // ── Lighting — bright garden afternoon ──
    scene.add(new THREE.HemisphereLight(0xB3D9FF,0x4CAF50,2.8));
    const sun=new THREE.DirectionalLight(0xFFF8E1,4.8);
    sun.position.set(8,14,6); sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left=sun.shadow.camera.bottom=-22;
    sun.shadow.camera.right=sun.shadow.camera.top=22;
    sun.shadow.camera.far=45; sun.shadow.bias=-.001; scene.add(sun);
    const fillLight=new THREE.DirectionalLight(0xC8E6FF,1.4);
    fillLight.position.set(-6,8,-4); scene.add(fillLight);
    const groundBounce=new THREE.PointLight(0x8BC34A,1.8,20);
    groundBounce.position.set(0,.3,0); scene.add(groundBounce);

    let raf,t=0;
    const animate=()=>{
      raf=requestAnimationFrame(animate); t+=.004;
      lawnM.uniforms.uT.value=t;
      bladeMat.uniforms.uT.value=t;
      // Gentle camera sway — standing in garden looking down path
      camera.position.x=Math.sin(t*.022)*.35;
      camera.position.y=1.55+Math.sin(t*.038)*.06;
      camera.lookAt(Math.sin(t*.016)*.2,0.9+Math.sin(t*.028)*.08,-8);
      // Petals fall and drift
      for(let i=0;i<N;i++){
        pPos[i*3]+=pV[i*2]+Math.sin(t*1.2+pOff[i])*.0025;
        pPos[i*3+1]+=pV[i*2+1];
        if(pPos[i*3+1]<-.1){pPos[i*3+1]=rnd(3,7);pPos[i*3]=rnd(-8,8);}
      }
      pPA.needsUpdate=true;
      renderer.render(scene,camera);
    };
    animate();
    return ()=>{cancelAnimationFrame(raf);renderer.dispose();};
  },[]);
  return <canvas ref={ref} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>;
};

/* ══════════════════════════════════════════════════════════════════
   3D ── HOLOGRAPHIC GLOBE (Home hero)
══════════════════════════════════════════════════════════════════ */
const HoloGlobe = () => {
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current; if(!el) return;
    const W=el.clientWidth,H=el.clientHeight;
    const renderer=new THREE.WebGLRenderer({canvas:el,antialias:true,alpha:true});
    renderer.setSize(W,H); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setClearColor(0x000000,0);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(55,W/H,.1,50);
    camera.position.z=3.4;

    // Globe wireframe
    const geoSphere=new THREE.SphereGeometry(1,32,24);
    const wireMat=new THREE.ShaderMaterial({
      vertexShader:`varying vec3 vN;varying vec2 vUv;void main(){vN=normalize(normalMatrix*normal);vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        uniform float uT;varying vec3 vN;varying vec2 vUv;
        void main(){
          float lat=vUv.y; float lon=vUv.x;
          float latLine=step(.97,abs(sin(lat*3.14159*12.)));
          float lonLine=step(.97,abs(sin(lon*3.14159*24.)));
          float grid=max(latLine,lonLine);
          // temperature color: poles blue, equator orange
          float tempT=abs(lat-.5)*2.;
          vec3 cold=vec3(0.,.53,1.);vec3 hot=vec3(1.,.27,0.);
          vec3 tempCol=mix(hot,cold,tempT);
          // scanlines
          float scan=sin(vUv.y*60.+uT*2.)*.03+.97;
          float rim=1.-abs(dot(vN,vec3(0.,0.,1.)));
          rim=pow(rim,1.8);
          float a=grid*(.6+rim*.4)*scan;
          gl_FragColor=vec4(tempCol*.9+vec3(0.,.3,.15)*.4,a*(.3+rim*.5));
        }`,
      uniforms:{uT:{value:0}},
      transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    const globe=new THREE.Mesh(geoSphere,wireMat); scene.add(globe);

    // Atmosphere
    const atmoGeo=new THREE.SphereGeometry(1.22,32,24);
    const atmoMat=new THREE.ShaderMaterial({
      vertexShader:`varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec3 vN;void main(){float rim=1.-abs(dot(vN,vec3(0.,0.,1.)));rim=pow(rim,2.);gl_FragColor=vec4(0.,.8,.4,rim*.5);}`,
      transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    scene.add(new THREE.Mesh(atmoGeo,atmoMat));

    // Orbiting data satellites
    const satGroup=new THREE.Group(); scene.add(satGroup);
    for(let i=0;i<12;i++){
      const a=(i/12)*Math.PI*2;
      const r=1.45+Math.random()*.2;
      const geo=new THREE.BoxGeometry(.04,.04,.04);
      const mat=new THREE.MeshBasicMaterial({color:i%2===0?0x38BDF8:0x22D3EE});
      const mesh=new THREE.Mesh(geo,mat);
      mesh.position.set(r*Math.cos(a),( Math.random()-.5)*.8,r*Math.sin(a));
      satGroup.add(mesh);
      // Connection line to globe
      const pts=[new THREE.Vector3(r*Math.cos(a),(Math.random()-.5)*.8,r*Math.sin(a)),new THREE.Vector3(0,0,0)];
      const lg=new THREE.BufferGeometry().setFromPoints(pts);
      const lm=new THREE.LineBasicMaterial({color:0x38BDF8,transparent:true,opacity:.1});
      scene.add(new THREE.Line(lg,lm));
    }

    // Particles halo
    const hN=600,hPos=new Float32Array(hN*3),hC=new Float32Array(hN*3),hS=new Float32Array(hN);
    for(let i=0;i<hN;i++){
      const phi=Math.acos(-1+2*i/hN), theta=Math.sqrt(hN*Math.PI)*phi;
      const r=1.6+Math.random()*.5;
      hPos[i*3]=r*Math.sin(phi)*Math.cos(theta);
      hPos[i*3+1]=r*Math.sin(phi)*Math.sin(theta);
      hPos[i*3+2]=r*Math.cos(phi);
      const t=Math.random();
      hC[i*3]=t>.5?.2:.28; hC[i*3+1]=t>.5?.72:.79; hC[i*3+2]=t>.5?.53:.89;
      hS[i]=.008+Math.random()*.012;
    }
    const hGeo=new THREE.BufferGeometry();
    hGeo.setAttribute('position',new THREE.BufferAttribute(hPos,3));
    hGeo.setAttribute('aSize',new THREE.BufferAttribute(hS,1));
    hGeo.setAttribute('aColor',new THREE.BufferAttribute(hC,3));
    hGeo.setAttribute('aAlpha',new THREE.BufferAttribute(new Float32Array(hN).fill(.7),1));
    const hMat=new THREE.ShaderMaterial({
      vertexShader:`attribute float aSize;attribute vec3 aColor;attribute float aAlpha;varying float vA;varying vec3 vC;uniform float uPR;void main(){vA=aAlpha;vC=aColor;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*uPR*(250./-mv.z);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying float vA;varying vec3 vC;void main(){vec2 uv=gl_PointCoord-.5;if(length(uv)>.5)discard;gl_FragColor=vec4(vC,(1.-smoothstep(.2,.5,length(uv)))*vA);}`,
      uniforms:{uPR:{value:renderer.getPixelRatio()}},
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(hGeo,hMat));

    let raf,t=0;
    const animate=()=>{
      raf=requestAnimationFrame(animate); t+=.008;
      wireMat.uniforms.uT.value=t;
      globe.rotation.y=t*.2;
      satGroup.rotation.y=t*.3; satGroup.rotation.z=t*.08;
      renderer.render(scene,camera);
    };
    animate();
    return()=>{cancelAnimationFrame(raf);renderer.dispose();};
  },[]);
  return <canvas ref={ref} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
};

/* ══════════════════════════════════════════════════════════════════
   3D ── NEURAL BRAIN (Analysis)
══════════════════════════════════════════════════════════════════ */
const NeuralBrain = () => {
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current; if(!el) return;
    const W=el.clientWidth,H=el.clientHeight;
    const renderer=new THREE.WebGLRenderer({canvas:el,antialias:true,alpha:true});
    renderer.setSize(W,H); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setClearColor(0x000000,0);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(55,W/H,.1,50);
    camera.position.set(0,0,5.5);
    scene.add(new THREE.AmbientLight(0x0a2010,.5));
    const dl=new THREE.DirectionalLight(0x22D3EE,1.5); dl.position.set(3,5,2); scene.add(dl);

    // Nodes
    const nodePos=[
      [0,0,0],[1.5,.8,.3],[-1.3,.7,-.2],[-.5,-1.1,.4],[1.2,-.9,-.1],[0,1.4,-.3],
      [-1.7,.1,-.3],[1.6,-.2,.4],[0,-1.5,.2],[-.6,.6,1.2],[.7,-.4,-1.1],
      [-1.1,.4,-.9],[.9,.7,1.0],[-.4,-1.2,-.6],[1.2,-.4,.8],[-.8,1.2,.6],
      [0,0,-1.5],[1.0,1.3,-.5],[-.5,-.5,1.5],[1.8,.3,-.4],
    ];
    const nodeGroup=new THREE.Group(); scene.add(nodeGroup);
    const nodes=nodePos.map(([x,y,z],idx)=>{
      const r=idx===0?.14:.075;
      const geo=new THREE.SphereGeometry(r,16,12);
      const isCenter=idx===0;
      const col=new THREE.Color().setHSL(.56+Math.random()*.05,.85,.40+Math.random()*.15);
      const mat=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:isCenter?1.5:.8,roughness:.2,metalness:.1});
      const mesh=new THREE.Mesh(geo,mat);
      mesh.position.set(x,y,z); nodeGroup.add(mesh);
      return{mesh,mat,col:col.clone(),phase:Math.random()*Math.PI*2};
    });

    // Edges as line tubes
    const edges=[[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],[0,9],[0,10],
      [1,11],[2,12],[3,13],[4,14],[5,15],[6,16],[7,17],[8,18],[9,19],
      [1,2],[3,4],[5,6],[7,8],[11,13],[12,14],[15,16],[17,18],[1,5],[2,6]];
    const edgeMat=new THREE.LineBasicMaterial({color:0x38BDF8,transparent:true,opacity:.22});
    edges.forEach(([a,b])=>{
      const pA=new THREE.Vector3(...nodePos[a]), pB=new THREE.Vector3(...nodePos[b]);
      const g=new THREE.BufferGeometry().setFromPoints([pA,pB]);
      nodeGroup.add(new THREE.Line(g,edgeMat));
    });

    // Signal particles
    const sigGroup=new THREE.Group(); scene.add(sigGroup);
    const sigGeo=new THREE.SphereGeometry(.045,8,8);
    const sigMat=new THREE.MeshStandardMaterial({color:0x7DD3FC,emissive:0x7DD3FC,emissiveIntensity:2.5,roughness:0});
    const signals=edges.slice(0,18).map(([a,b])=>{
      const m=new THREE.Mesh(sigGeo,sigMat.clone()); sigGroup.add(m);
      return{a:new THREE.Vector3(...nodePos[a]),b:new THREE.Vector3(...nodePos[b]),t:Math.random(),spd:.006+Math.random()*.008};
    });

    // Background star field
    const sfN=600,sfPos=new Float32Array(sfN*3);
    for(let i=0;i<sfN;i++){sfPos[i*3]=(Math.random()-.5)*18;sfPos[i*3+1]=(Math.random()-.5)*18;sfPos[i*3+2]=(Math.random()-.5)*18;}
    const sfGeo=new THREE.BufferGeometry(); sfGeo.setAttribute('position',new THREE.BufferAttribute(sfPos,3));
    scene.add(new THREE.Points(sfGeo,new THREE.PointsMaterial({color:0x38BDF8,size:.025,transparent:true,opacity:.3,blending:THREE.AdditiveBlending})));

    // Outer torus rings
    const ring1=new THREE.Mesh(new THREE.TorusGeometry(2.5,.006,8,80),new THREE.MeshBasicMaterial({color:0x38BDF8,transparent:true,opacity:.2}));
    const ring2=new THREE.Mesh(new THREE.TorusGeometry(2.0,.004,8,60),new THREE.MeshBasicMaterial({color:0x22D3EE,transparent:true,opacity:.15}));
    ring1.rotation.x=Math.PI/2; ring2.rotation.z=Math.PI/3; scene.add(ring1,ring2);

    let raf,t=0;
    const animate=()=>{
      raf=requestAnimationFrame(animate); t+=.01;
      nodeGroup.rotation.y=t*.15; nodeGroup.rotation.x=Math.sin(t*.1)*.18;
      ring1.rotation.y=t*.2; ring2.rotation.x=t*.12;
      nodes.forEach(({mesh,mat,col,phase},i)=>{
        const pulse=.5+Math.sin(t*1.8+phase)*.45;
        mat.emissiveIntensity=i===0?1.5+pulse*.5:pulse*.9;
        mesh.scale.setScalar(1+pulse*.2);
      });
      signals.forEach((s,i)=>{
        s.t=(s.t+s.spd)%1;
        const p=new THREE.Vector3().lerpVectors(s.a,s.b,s.t);
        signals[i].mesh=sigGroup.children[i];
        sigGroup.children[i].position.copy(p);
        sigGroup.children[i].material.emissiveIntensity=2+Math.sin(t*5+i)*.8;
      });
      sigGroup.rotation.copy(nodeGroup.rotation);
      dl.position.set(Math.cos(t*.4)*4,3,Math.sin(t*.4)*4);
      renderer.render(scene,camera);
    };
    animate();
    return()=>{cancelAnimationFrame(raf);renderer.dispose();};
  },[]);
  return <canvas ref={ref} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
};

/* ══════════════════════════════════════════════════════════════════
   3D ── ROOFTOP TRANSFORMATION (Result)
══════════════════════════════════════════════════════════════════ */
const RooftopTransform = ({ progress=1 }) => {
  const ref=useRef(null);
  const progressRef=useRef(progress);
  useEffect(()=>{ progressRef.current=progress; },[progress]);
  useEffect(()=>{
    const el=ref.current; if(!el) return;
    const W=el.clientWidth,H=el.clientHeight;
    const renderer=new THREE.WebGLRenderer({canvas:el,antialias:true,alpha:true});
    renderer.setSize(W,H); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled=true;
    renderer.setClearColor(0x000000,0);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(45,W/H,.1,50);
    camera.position.set(4,4,4); camera.lookAt(0,0,0);
    scene.add(new THREE.AmbientLight(0xffffff,.4));
    const sun=new THREE.DirectionalLight(0xffd488,1.8); sun.position.set(3,6,2); sun.castShadow=true; scene.add(sun);
    scene.add(new THREE.PointLight(0x38BDF8,.8,10));

    // Rooftop base
    const roofG=new THREE.BoxGeometry(4,.12,3);
    const roofMat=new THREE.ShaderMaterial({
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        uniform float uP; varying vec2 vUv;
        void main(){
          vec3 hot=vec3(.28,.28,.3); vec3 cool=vec3(.12,.28,.14);
          vec3 col=mix(hot,cool,uP);
          // Heat shimmer noise pattern when cold > 0
          float n=fract(sin(dot(vUv,vec2(12.9898,78.233)))*43758.5453);
          col+=n*.04*(1.-uP);
          gl_FragColor=vec4(col,1.);
        }`,
      uniforms:{uP:{value:0}},
    });
    const roof=new THREE.Mesh(roofG,roofMat); roof.receiveShadow=true; scene.add(roof);

    // Green patches
    const patchData=[[-1,.06,-.6,.9,.7],[.6,.06,.3,.8,.9],[-.4,.06,.7,1.1,.5],[.5,.06,-.7,.6,.8],[-.1,.06,.0,1.2,1.1]];
    const patches=patchData.map(([x,_,z,w,d])=>{
      const g=new THREE.BoxGeometry(w,.05,d);
      const m=new THREE.MeshStandardMaterial({color:new THREE.Color(.1+Math.random()*.1,.45+Math.random()*.15,.12),roughness:.8});
      const mesh=new THREE.Mesh(g,m); mesh.position.set(x,.09,z); mesh.scale.setScalar(0); scene.add(mesh);
      return mesh;
    });

    // Trees
    const treeData=[[-1.2,0,.3],[.9,0,-.7],[-.2,0,1.0],[1.1,0,.5],[-.7,0,-.7]];
    const trees=treeData.map(([tx,_,tz],i)=>{
      const g=new THREE.Group();
      const trunkG=new THREE.CylinderGeometry(.03,.04,.2,6);
      const trunkM=new THREE.MeshStandardMaterial({color:0x4e2c0a,roughness:.9});
      const trunk=new THREE.Mesh(trunkG,trunkM); trunk.position.y=.1; g.add(trunk);
      const col=new THREE.Color().setHSL(.54+Math.random()*.05,.72,.30+Math.random()*.1);
      const fM=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.12,roughness:.7});
      [.42,.56,.68].forEach((y,j)=>{
        const r=.18-.03*j;
        const fG=new THREE.ConeGeometry(r,.35,7);
        const f=new THREE.Mesh(fG,fM); f.position.y=y; g.add(f);
      });
      g.position.set(tx,.06,tz); g.scale.setScalar(0); scene.add(g);
      return{group:g,delay:i*.3,targetScale:.75+Math.random()*.35,swayPhase:Math.random()*Math.PI*2};
    });

    // Heat particles (rising when progress=0)
    const hN=60,hPos=new Float32Array(hN*3),hV=new Float32Array(hN*3);
    for(let i=0;i<hN;i++){hPos[i*3]=(Math.random()-.5)*3.5;hPos[i*3+1]=Math.random()*.5;hPos[i*3+2]=(Math.random()-.5)*2.5;hV[i*3]=(Math.random()-.5)*.004;hV[i*3+1]=.008+Math.random()*.012;hV[i*3+2]=(Math.random()-.5)*.004;}
    const hGeo=new THREE.BufferGeometry(); const hPA=new THREE.BufferAttribute(hPos,3); hGeo.setAttribute('position',hPA);
    const hMat=new THREE.PointsMaterial({color:0xFF4400,size:.04,transparent:true,opacity:.7,blending:THREE.AdditiveBlending});
    const hPoints=new THREE.Points(hGeo,hMat); scene.add(hPoints);

    // Cool particles (falling when progress=1)
    const cN=80,cPos=new Float32Array(cN*3),cV=new Float32Array(cN*3);
    for(let i=0;i<cN;i++){cPos[i*3]=(Math.random()-.5)*3.5;cPos[i*3+1]=.2+Math.random()*2;cPos[i*3+2]=(Math.random()-.5)*2.5;cV[i*3]=(Math.random()-.5)*.002;cV[i*3+1]=-(.006+Math.random()*.01);cV[i*3+2]=(Math.random()-.5)*.002;}
    const cGeo=new THREE.BufferGeometry(); const cPA=new THREE.BufferAttribute(cPos,3); cGeo.setAttribute('position',cPA);
    const cMat=new THREE.PointsMaterial({color:0x22D3EE,size:.03,transparent:true,opacity:.8,blending:THREE.AdditiveBlending});
    scene.add(new THREE.Points(cGeo,cMat));

    let raf, t=0, startTime=Date.now();
    const animate=()=>{
      raf=requestAnimationFrame(animate); t+=.01;
      const elapsed=(Date.now()-startTime)/1000;
      const p=progressRef.current;
      roofMat.uniforms.uP.value+=(p-roofMat.uniforms.uP.value)*.04;
      // Patches
      patches.forEach((m,i)=>{const target=p>.2+i*.12?1:0;m.scale.x+=(target-m.scale.x)*.06;m.scale.y+=(target-m.scale.y)*.06;m.scale.z+=(target-m.scale.z)*.06;});
      // Trees
      trees.forEach(({group,delay,targetScale,swayPhase})=>{
        const target=p>.5?targetScale:0;
        const cur=group.scale.x; group.scale.setScalar(cur+(target-cur)*.05);
        group.rotation.z=Math.sin(t*.9+swayPhase)*.04*group.scale.x;
      });
      // Heat up when hot, cool down when green
      hMat.opacity=(.7*(1-p));
      for(let i=0;i<hN;i++){hPos[i*3]+=hV[i*3];hPos[i*3+1]+=hV[i*3+1];if(hPos[i*3+1]>2){hPos[i*3+1]=0;hPos[i*3]=(Math.random()-.5)*3.5;}}
      hPA.needsUpdate=true;
      cMat.opacity=.8*p;
      for(let i=0;i<cN;i++){cPos[i*3]+=cV[i*3];cPos[i*3+1]+=cV[i*3+1];if(cPos[i*3+1]<.05){cPos[i*3+1]=2.2;cPos[i*3]=(Math.random()-.5)*3.5;}}
      cPA.needsUpdate=true;
      sun.position.set(3+Math.sin(t*.15)*.5,6,2);
      renderer.render(scene,camera);
    };
    animate();
    return()=>{cancelAnimationFrame(raf);renderer.dispose();};
  },[]);
  return <canvas ref={ref} style={{width:'100%',height:'100%',display:'block',pointerEvents:'none'}}/>;
};

/* ══════════════════════════════════════════════════════════════════
   3D ── DATA ORB (floating background for settings/saved)
══════════════════════════════════════════════════════════════════ */
const DataOrb = () => {
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current; if(!el) return;
    const W=el.clientWidth,H=el.clientHeight;
    const renderer=new THREE.WebGLRenderer({canvas:el,antialias:false,alpha:true});
    renderer.setSize(W,H); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setClearColor(0,0);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(50,W/H,.1,30);
    camera.position.z=4;
    const N=1200, pos=new Float32Array(N*3), col=new Float32Array(N*3), sz=new Float32Array(N), phi=new Float32Array(N);
    for(let i=0;i<N;i++){
      const a=(i/N)*Math.PI*2, r=1.0+(Math.random()-.5)*.08;
      const tilt=(Math.random()-.5)*2*Math.PI;
      pos[i*3]=r*Math.cos(a)*Math.cos(tilt); pos[i*3+1]=r*Math.sin(tilt); pos[i*3+2]=r*Math.sin(a)*Math.cos(tilt);
      const t=Math.random(); col[i*3]=t>.5?.2:.28; col[i*3+1]=t>.5?.72:.79; col[i*3+2]=t>.5?.53:.89;
      sz[i]=.008+Math.random()*.014; phi[i]=Math.random()*Math.PI*2;
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    geo.setAttribute('aSize',new THREE.BufferAttribute(sz,1));
    geo.setAttribute('aAlpha',new THREE.BufferAttribute(new Float32Array(N).fill(.7),1));
    geo.setAttribute('aColor',new THREE.BufferAttribute(col,3));
    const mat=new THREE.ShaderMaterial({
      vertexShader:`attribute float aSize;attribute float aAlpha;attribute vec3 aColor;uniform float uT;uniform float uPR;varying float vA;varying vec3 vC;void main(){vA=aAlpha;vC=aColor;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*uPR*(260./-mv.z);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying float vA;varying vec3 vC;void main(){vec2 uv=gl_PointCoord-.5;if(length(uv)>.5)discard;gl_FragColor=vec4(vC,(1.-smoothstep(.2,.5,length(uv)))*vA);}`,
      uniforms:{uT:{value:0},uPR:{value:renderer.getPixelRatio()}},
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    const points=new THREE.Points(geo,mat); scene.add(points);
    let raf,t=0;
    const animate=()=>{raf=requestAnimationFrame(animate);t+=.006;points.rotation.y=t*.2;points.rotation.x=Math.sin(t*.12)*.15;renderer.render(scene,camera);};
    animate();
    return()=>{cancelAnimationFrame(raf);renderer.dispose();};
  },[]);
  return <canvas ref={ref} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
};

/* ══════════════════════════════════════════════════════════════════
   3D ── GARDEN SCENE  (Result screen hero)
   species: array of Plant objects  progress: 0→1 reveal
══════════════════════════════════════════════════════════════════ */
const GardenScene3D = ({ species = [], progress = 1, photoTexture = null, spatialMapping = null, editMode = false, onEditDone = null }) => {
  const canvasRef  = useRef(null);
  const overlayRef = useRef(null);
  const progRef    = useRef(progress);
  const speciesRef = useRef(species);
  const photoRef   = useRef(photoTexture);
  const smRef      = useRef(spatialMapping);
  const dragRef    = useRef({ active:false, pinching:false, lastX:0, lastY:0, lastDist:0,
    theta:0.35, phi:1.15, radius:9.8, vTheta:0.0008, vPhi:0 });

  // ── Edit mode refs (readable inside useEffect handlers) ──────────
  const editModeRef      = useRef(editMode);
  const selIdxRef        = useRef(-1);
  const plantGroupsRef   = useRef([]); // { grp, name, type, idx }
  const addPlantRef      = useRef(null);
  const deleteSelRef     = useRef(null);
  const notifySelRef     = useRef(null); // callback → React state
  const [editSelIdx, setEditSelIdx] = useState(-1);

  useEffect(()=>{ editModeRef.current = editMode; }, [editMode]);
  useEffect(()=>{ notifySelRef.current = setEditSelIdx; }, []);
  useEffect(()=>{ progRef.current    = progress;     }, [progress]);
  useEffect(()=>{ speciesRef.current = species;      }, [species]);
  useEffect(()=>{ photoRef.current   = photoTexture; }, [photoTexture]);
  useEffect(()=>{ smRef.current      = spatialMapping; }, [spatialMapping]);

  useEffect(()=>{
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas) return;
    const W = canvas.clientWidth || canvas.parentElement?.clientWidth || 390;
    const H = canvas.clientHeight || canvas.parentElement?.clientHeight || 290;
    if (!W || !H) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
    } catch(e) { return; }
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, W/H, 0.1, 60);
    camera.position.set(0, 5.5, 11.5); camera.lookAt(0, 1.5, 0);

    // ── All garden content lives in a rotatable group ─────────────
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // ── Lighting — warm golden-hour professional ──────────────────
    scene.add(new THREE.AmbientLight(0xfff8e7, 1.1));
    const sun = new THREE.DirectionalLight(0xffe8a0, 2.6);
    sun.position.set(6, 10, 4); sun.castShadow = true; scene.add(sun);
    const fill = new THREE.PointLight(0xffba4a, 0.65, 22); // warm amber fill
    fill.position.set(-4, 5, 2); scene.add(fill);
    const fill2 = new THREE.PointLight(0xa8d5a2, 0.45, 18); // soft sage rim
    fill2.position.set(3, 3, -4); scene.add(fill2);

    // ── Glass cube enclosure — sized to measured AR space ────────
    // Normalise measured dimensions so max side = 8 scene units
    const sm = smRef.current;
    const wM  = sm?.canvasWidthM  ?? 6;
    const lM  = sm?.canvasLengthM ?? 7;
    const NORM = 8 / Math.max(wM, lM, 1);
    const CW = Math.max(3, wM  * NORM);  // width  (X axis)
    const CD = Math.max(3, lM  * NORM);  // depth  (Z axis)
    const CH = 3.2;
    const cubeCenter = CH/2;

    // Helpers: convert layout-space metres → Three.js scene units
    const toSX = xM => (xM / wM) * CW - CW/2;
    const toSZ = zM => (zM / lM) * CD - CD/2;
    const toSW = wm => (wm / wM) * CW;
    const toSD = dm => (dm / lM) * CD;

    // Glowing wireframe edges
    const edgeMat = new THREE.LineBasicMaterial({ color:0xE8D5A3, transparent:true, opacity:0.55 });
    const edgeLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(CW, CH, CD)), edgeMat
    );
    edgeLines.position.y = cubeCenter;
    worldGroup.add(edgeLines);

    // Corner accent points (warm gold dots at each of the 8 corners)
    const cornerGeo = new THREE.SphereGeometry(0.055, 6, 6);
    const cornerMat = new THREE.MeshStandardMaterial({ color:0xD4A853, emissive:0xC8922A, emissiveIntensity:1.4 });
    [[-1,-1,-1],[-1,-1,1],[-1,1,-1],[-1,1,1],[1,-1,-1],[1,-1,1],[1,1,-1],[1,1,1]].forEach(([sx,sy,sz])=>{
      const c = new THREE.Mesh(cornerGeo, cornerMat);
      c.position.set(sx*CW/2, cubeCenter+sy*CH/2, sz*CD/2);
      worldGroup.add(c);
    });

    // Subtle glass walls (very low opacity tinted faces)
    const glassMat = new THREE.MeshStandardMaterial({
      color:0x95D5B2, transparent:true, opacity:0.028, side:THREE.DoubleSide, depthWrite:false,
    });
    [
      [0, cubeCenter, CD/2,  CW, CH, 0.01],  // front
      [0, cubeCenter, -CD/2, CW, CH, 0.01],  // back
      [-CW/2, cubeCenter, 0, 0.01, CH, CD],  // left
      [CW/2,  cubeCenter, 0, 0.01, CH, CD],  // right
      [0, CH, 0,          CW, 0.01, CD],      // top
    ].forEach(([x,y,z,w,h,d])=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), glassMat);
      m.position.set(x,y,z); worldGroup.add(m);
    });

    // ── Rooftop slab — blends AR photo → procedural green garden ──
    // Load photo texture if available (captured AR frame)
    let photoTex = null;
    if (photoRef.current) {
      try {
        photoTex = new THREE.TextureLoader().load(photoRef.current);
        photoTex.flipY = false; // canvas-origin images are already Y-correct
      } catch(e) { photoTex = null; }
    }
    const slabMat = new THREE.ShaderMaterial({
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        uniform float uP;
        uniform sampler2D uPhoto;
        uniform float uHasPhoto;
        varying vec2 vUv;
        void main(){
          vec2 uv2=vec2(vUv.x,1.-vUv.y); // flip Y for camera-origin texture
          vec3 concrete=vec3(.36,.30,.22);
          vec3 lush=vec3(.08,.28,.14);
          float border=step(.04,vUv.x)*step(vUv.x,.96)*step(.04,vUv.y)*step(vUv.y,.96);
          // base: photo (progress=0) → lush green (progress=1)
          vec3 photoCol=texture2D(uPhoto,uv2).rgb;
          vec3 base=mix(concrete,lush,uP*border);
          if(uHasPhoto>0.5) base=mix(photoCol,lush,uP*border);
          float n=fract(sin(dot(vUv*40.,vec2(12.98,78.23)))*43758.5)*0.035*(1.-uP);
          gl_FragColor=vec4(base+n,1.);
        }`,
      uniforms:{
        uP:       { value: 0 },
        uPhoto:   { value: photoTex ?? new THREE.Texture() },
        uHasPhoto:{ value: photoTex ? 1.0 : 0.0 },
      },
    });
    const slabW = CW * 0.96, slabD = CD * 0.96;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slabW,0.14,slabD), slabMat);
    slab.receiveShadow = true; worldGroup.add(slab);

    // ── Edge parapet — scaled to measured space ───────────────────
    const parapetMat = new THREE.MeshStandardMaterial({color:0x7a6a5a,roughness:.85});
    const hw=slabW/2+0.07, hd=slabD/2+0.07;
    [[0,0.2,hd,slabW+0.14,0.4,0.22],[0,0.2,-hd,slabW+0.14,0.4,0.22],[hw,0.2,0,0.22,0.4,slabD],[-hw,0.2,0,0.22,0.4,slabD]].forEach(([x,y,z,w,h,d])=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),parapetMat);
      m.position.set(x,y,z); worldGroup.add(m);
    });

    // ── Zone planter beds from spatial mapping ────────────────────
    if (sm?.anchors?.length) {
      const planterBoxMat = new THREE.MeshStandardMaterial({color:0x5c3d22,roughness:.92,metalness:.04});
      const soilMat2 = new THREE.MeshStandardMaterial({color:0x3d2b1f,roughness:1});
      sm.anchors
        .filter(a => a.type === 'zone' && a.meta?.zoneType !== 'path' && a.meta?.zoneType !== 'buffer')
        .forEach(zone => {
          const sx = toSX(zone.positionM.x), sz = toSZ(zone.positionM.z);
          const zw = Math.max(0.2, toSW(zone.sizeM?.width  ?? 1) - 0.06);
          const zd = Math.max(0.2, toSD(zone.sizeM?.length ?? 1) - 0.06);
          // Raised timber planter
          const planter = new THREE.Mesh(new THREE.BoxGeometry(zw, 0.14, zd), planterBoxMat);
          planter.position.set(sx, 0.07, sz); planter.castShadow = true; planter.receiveShadow = true;
          worldGroup.add(planter);
          // Soil surface
          const soil2 = new THREE.Mesh(new THREE.PlaneGeometry(zw-0.04, zd-0.04), soilMat2);
          soil2.rotation.x = -Math.PI/2; soil2.position.set(sx, 0.142, sz);
          worldGroup.add(soil2);
        });
      // Path strips
      sm.anchors
        .filter(a => a.type === 'path' || a.meta?.zoneType === 'path')
        .forEach(path => {
          const sx = toSX(path.positionM.x), sz = toSZ(path.positionM.z);
          const pw = Math.max(0.1, toSW(path.sizeM?.width  ?? 0.6));
          const pd = Math.max(0.1, toSD(path.sizeM?.length ?? 0.6));
          const pathM = new THREE.MeshStandardMaterial({color:0x3a4a3c,roughness:.95});
          const pathMesh = new THREE.Mesh(new THREE.BoxGeometry(pw,0.01,pd), pathM);
          pathMesh.position.set(sx, 0.075, sz); worldGroup.add(pathMesh);
        });
    }

    // ── Grid scan overlay (floor) ─────────────────────────────────
    const gridMat = new THREE.ShaderMaterial({
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        uniform float uT; varying vec2 vUv;
        void main(){
          vec2 g=abs(fract(vUv*12.-.5)-.5)/fwidth(vUv*12.);
          float l=1.-min(min(g.x,g.y),1.);
          float d=length(vUv-.5);
          float p=sin(d*18.-uT*1.8)*.5+.5;
          p*=(1.-smoothstep(.0,.5,d));
          vec3 col=vec3(0.,.8,.45);
          float a=l*.18*(1.-smoothstep(.3,.5,d));
          gl_FragColor=vec4(col,a);
        }`,
      uniforms:{uT:{value:0}},
      transparent:true, depthWrite:false,
    });
    const gridMesh=new THREE.Mesh(new THREE.PlaneGeometry(slabW,slabD,1,1),gridMat);
    gridMesh.rotation.x=-Math.PI/2; gridMesh.position.y=0.08; worldGroup.add(gridMesh);

    // ═══════════════════════════════════════════════════════════════
    // REFERENCE-MATCHED GARDEN LAYOUT
    // Built from real rooftop & indoor garden photos:
    //   · Central lawn panel (lush green grass shader)
    //   · Perimeter raised timber beds (dark frame + soil + plant cover)
    //   · Stone-tile path grid between beds
    //   · Corner anchor trees (tall rounded canopy)
    //   · Perimeter hedge strip (low dense shrubs)
    //   · Seating area cluster (chairs + table, front-right corner)
    //   · Trellis back wall (wire frame + climbing vines)
    // ═══════════════════════════════════════════════════════════════

    // ── Shared reusable materials ─────────────────────────────────
    const timberMat  = new THREE.MeshStandardMaterial({color:0x6b4226,roughness:.92,metalness:.04});
    const stoneMat   = new THREE.MeshStandardMaterial({color:0x7a6a5a,roughness:.95,metalness:.02});
    const soilTopMat = new THREE.MeshStandardMaterial({color:0x5c3d22,roughness:1.0});
    const hedgeMat   = new THREE.MeshStandardMaterial({color:0x1B4332,roughness:.85,metalness:.0});
    const cementMat  = new THREE.MeshStandardMaterial({color:0x8a8478,roughness:.98,metalness:.0});
    const metalMat   = new THREE.MeshStandardMaterial({color:0x6b7560,roughness:.6,metalness:.55});

    // ── Central lawn grass shader ─────────────────────────────────
    // Matches: top-down photo — central green lawn rect in the middle
    const lawnW = slabW * 0.46, lawnD = slabD * 0.46;
    const lawnMat = new THREE.ShaderMaterial({
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        uniform float uT; varying vec2 vUv;
        void main(){
          // Blade noise — fine stipple pattern
          float n1=fract(sin(dot(vUv*60.,vec2(12.98,78.23)))*43758.5);
          float n2=fract(sin(dot(vUv*120.,vec2(93.11,17.53)))*28459.3);
          // Natural grass tones: deep green to bright lime
          vec3 dark =vec3(.06,.22,.08);
          vec3 light=vec3(.22,.55,.18);
          vec3 mid  =vec3(.12,.38,.12);
          float blend=n1*.6+n2*.4;
          vec3 grass=mix(dark,light,blend);
          // Vignette towards edges
          float d=length(vUv-.5)*2.;
          grass=mix(grass,mid,smoothstep(.6,1.,d));
          gl_FragColor=vec4(grass,1.);
        }`,
      uniforms:{uT:{value:0}},
    });
    const lawnMesh = new THREE.Mesh(new THREE.PlaneGeometry(lawnW,lawnD), lawnMat);
    lawnMesh.rotation.x=-Math.PI/2; lawnMesh.position.y=0.082; worldGroup.add(lawnMesh);

    // ── Stone-tile path grid — 4 strips forming a cross ──────────
    // Matches: top-down photo — light gray paved paths between beds
    const pathH = 0.005, pathW = slabW * 0.08;
    // Horizontal path (x-axis)
    const hPath = new THREE.Mesh(new THREE.BoxGeometry(slabW*0.92, pathH, pathW), stoneMat);
    hPath.position.set(0, 0.082, 0); worldGroup.add(hPath);
    // Vertical path (z-axis)
    const vPath = new THREE.Mesh(new THREE.BoxGeometry(pathW, pathH, slabD*0.92), stoneMat);
    vPath.position.set(0, 0.082, 0); worldGroup.add(vPath);

    // ── Perimeter raised timber beds — 4 sides ───────────────────
    // Matches: rooftop isometric photo — dark timber frame beds along all edges
    const bedDepth = slabD * 0.19, bedSide = slabW * 0.19;
    const bedH = 0.16, bedInner = bedH - 0.01;
    // Front and back perimeter beds
    [-1, 1].forEach(sign => {
      const bz = sign * (slabD * 0.5 - bedDepth * 0.5 - 0.03);
      // Timber frame outer box
      const frame = new THREE.Mesh(new THREE.BoxGeometry(slabW * 0.9, bedH, bedDepth), timberMat);
      frame.position.set(0, bedH*0.5, bz); frame.castShadow=true; frame.receiveShadow=true;
      worldGroup.add(frame);
      // Soil top
      const soil = new THREE.Mesh(new THREE.PlaneGeometry(slabW*0.88, bedDepth-0.04), soilTopMat);
      soil.rotation.x=-Math.PI/2; soil.position.set(0, bedH+0.001, bz); worldGroup.add(soil);
      // Plant cover — dense sphere canopy across bed
      const numClumps = Math.round(slabW * 0.9 / 0.6);
      for(let ci=0;ci<numClumps;ci++){
        const cx = (ci/(numClumps-1))*(slabW*0.84)-slabW*0.42;
        const hue = 0.52+Math.random()*.06;
        const col = new THREE.Color().setHSL(hue, .70, .22+Math.random()*.12);
        const cm  = new THREE.MeshStandardMaterial({color:col,roughness:.8});
        const cr  = 0.18+Math.random()*.1;
        const clump = new THREE.Mesh(new THREE.SphereGeometry(cr,7,6), cm);
        clump.position.set(cx, bedH+cr*.65, bz+(Math.random()-.5)*.06);
        clump.scale.set(1,.78+Math.random()*.3,1); clump.castShadow=true;
        worldGroup.add(clump);
      }
    });
    // Left and right perimeter beds
    [-1, 1].forEach(sign => {
      const bx = sign * (slabW * 0.5 - bedSide * 0.5 - 0.03);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(bedSide, bedH, slabD * 0.62), timberMat);
      frame.position.set(bx, bedH*0.5, 0); frame.castShadow=true; frame.receiveShadow=true;
      worldGroup.add(frame);
      const soil = new THREE.Mesh(new THREE.PlaneGeometry(bedSide-0.04, slabD*0.6), soilTopMat);
      soil.rotation.x=-Math.PI/2; soil.position.set(bx, bedH+0.001, 0); worldGroup.add(soil);
      // Plant clumps
      const numClumps = Math.round(slabD * 0.62 / 0.55);
      for(let ci=0;ci<numClumps;ci++){
        const cz = (ci/(Math.max(numClumps-1,1)))*(slabD*0.56)-slabD*0.28;
        const hue = 0.53+Math.random()*.07;
        const col = new THREE.Color().setHSL(hue, .68, .20+Math.random()*.14);
        const cm  = new THREE.MeshStandardMaterial({color:col,roughness:.8});
        const cr  = 0.16+Math.random()*.09;
        const clump = new THREE.Mesh(new THREE.SphereGeometry(cr,7,6), cm);
        clump.position.set(bx+(Math.random()-.5)*.05, bedH+cr*.65, cz); clump.scale.set(.85,1,.85);
        clump.castShadow=true; worldGroup.add(clump);
      }
    });

    // ── Corner anchor trees (4 corners) ──────────────────────────
    // Matches: top-down photo — large rounded tree canopy at each corner
    const treeTrunkMat = new THREE.MeshStandardMaterial({color:0x3d1e08,roughness:.9});
    const cornerOffX = slabW*0.37, cornerOffZ = slabD*0.37;
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sz])=>{
      const tx=sx*cornerOffX, tz=sz*cornerOffZ;
      // Trunk
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.055,.08,.32,7), treeTrunkMat);
      trunk.position.set(tx, .16, tz); worldGroup.add(trunk);
      // Layered canopy (3 stacked spheres for volume)
      [
        [0,.52,.48,new THREE.Color(.04,.20,.44)],
        [0,.75,.36,new THREE.Color(.06,.30,.56)],
        [0,.95,.22,new THREE.Color(.10,.42,.62)],
      ].forEach(([cx,cy,cr,col])=>{
        const cm = new THREE.MeshStandardMaterial({color:col,roughness:.85});
        const c  = new THREE.Mesh(new THREE.SphereGeometry(cr,9,8), cm);
        c.position.set(tx+cx, cy, tz); c.castShadow=true; worldGroup.add(c);
      });
    });

    // ── Perimeter hedge strip — low dense border ──────────────────
    // Matches: all reference images — continuous green border inside parapet
    const hedgeH = 0.22, hedgeThk = 0.14;
    // Front + back hedge
    [-1,1].forEach(sign=>{
      const hz = sign*(slabD*0.5 - bedDepth - 0.18);
      for(let xi=0;xi<Math.round(slabW*0.88/0.28);xi++){
        const hx = xi*0.28 - slabW*0.43;
        const col = new THREE.Color().setHSL(.54+Math.random()*.05,.62,.18+Math.random()*.08);
        const hm  = new THREE.MeshStandardMaterial({color:col,roughness:.88});
        const hd  = new THREE.Mesh(new THREE.BoxGeometry(.25,hedgeH+Math.random()*.06,hedgeThk),hm);
        hd.position.set(hx, bedH+hedgeH*.5+0.001, hz); worldGroup.add(hd);
      }
    });

    // ── Trellis back wall with climbing vines ─────────────────────
    // Matches: rooftop photo — metal/timber trellis frame at back with climbers
    const trellisZ = -(slabD*0.5 - 0.08);
    // Vertical posts
    for(let pi=0;pi<5;pi++){
      const px = (pi/4)*slabW*0.85 - slabW*0.425;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,1.8,5), metalMat);
      post.position.set(px, .9, trellisZ); worldGroup.add(post);
    }
    // Horizontal wires (3 levels)
    [.38,.78,1.22].forEach(hy=>{
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,slabW*.87,4), metalMat);
      wire.rotation.z=Math.PI/2; wire.position.set(0,hy,trellisZ); worldGroup.add(wire);
    });
    // Vine leaves on trellis
    for(let vi=0;vi<18;vi++){
      const vx=(Math.random()-.5)*slabW*.82;
      const vy=.1+Math.random()*1.3;
      const hue=.54+Math.random()*.07;
      const col=new THREE.Color().setHSL(hue,.72,.18+Math.random()*.14);
      const vm=new THREE.MeshStandardMaterial({color:col,roughness:.8,side:THREE.DoubleSide});
      const vs=.08+Math.random()*.11;
      const leaf=new THREE.Mesh(new THREE.PlaneGeometry(vs,vs*.8),vm);
      leaf.position.set(vx,vy,trellisZ+.02);
      leaf.rotation.set((Math.random()-.5)*.6,Math.random()*Math.PI,(Math.random()-.5)*.5);
      worldGroup.add(leaf);
    }

    // ── Seating area — front-right corner (matches top-down photo) ─
    // Wicker chairs + small side table
    const seatX = slabW*0.31, seatZ = slabD*0.30;
    const wickerMat = new THREE.MeshStandardMaterial({color:0x7a5c32,roughness:.88,metalness:.05});
    const cushionMat= new THREE.MeshStandardMaterial({color:0x5a6660,roughness:.75});
    // Chair 1
    const chair1 = new THREE.Group();
    const c1Seat  = new THREE.Mesh(new THREE.BoxGeometry(.38,.06,.38),wickerMat);  c1Seat.position.set(0,.16,0);
    const c1Cush  = new THREE.Mesh(new THREE.BoxGeometry(.36,.08,.34),cushionMat); c1Cush.position.set(0,.20,0);
    const c1Back  = new THREE.Mesh(new THREE.BoxGeometry(.36,.28,.04),wickerMat);  c1Back.position.set(0,.26,-.17);
    chair1.add(c1Seat, c1Cush, c1Back);
    chair1.position.set(seatX-.22, 0, seatZ); chair1.castShadow=true; worldGroup.add(chair1);
    // Chair 2
    const chair2 = chair1.clone();
    chair2.position.set(seatX+.22, 0, seatZ); worldGroup.add(chair2);
    // Table
    const tableMat2=new THREE.MeshStandardMaterial({color:0x5c4020,roughness:.85});
    const table=new THREE.Group();
    const tTop = new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.04,10),tableMat2); tTop.position.set(0,.26,0);
    const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.26,6),tableMat2); tLeg.position.set(0,.13,0);
    table.add(tTop, tLeg);
    table.position.set(seatX, 0, seatZ+.3); table.castShadow=true; worldGroup.add(table);
    // Small decorative pot on table
    const tablePotMat=new THREE.MeshStandardMaterial({color:0xc45c20,roughness:.8});
    const tablePot=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,.07,8),tablePotMat);
    tablePot.position.set(seatX, .315, seatZ+.3); worldGroup.add(tablePot);
    const tablePlantMat=new THREE.MeshStandardMaterial({color:0x2a6a2a,roughness:.7});
    const tablePlant=new THREE.Mesh(new THREE.SphereGeometry(.06,6,5),tablePlantMat);
    tablePlant.position.set(seatX, .40, seatZ+.3); worldGroup.add(tablePlant);

    // ── Inner raised bed grid (vegetable/herb garden style) ───────
    // Matches: aerial vegetable photo — organised rectangular beds inside
    // 2×2 inner grid of narrow beds, separated by the path cross
    const innerBedW = lawnW*0.42, innerBedD = lawnD*0.42, innerBedH = 0.11;
    const innerBedOffsets = [
      [-lawnW*.28, -lawnD*.28], [-lawnW*.28, lawnD*.28],
      [ lawnW*.28, -lawnD*.28], [ lawnW*.28, lawnD*.28],
    ];
    const bedColors = [
      new THREE.Color(.13,.42,.24), // forest green
      new THREE.Color(.20,.55,.30), // mid sage
      new THREE.Color(.32,.62,.22), // lime-sage
      new THREE.Color(.26,.50,.18), // olive green
    ];
    innerBedOffsets.forEach(([bx,bz], bi)=>{
      const frame=new THREE.Mesh(new THREE.BoxGeometry(innerBedW,innerBedH,innerBedD),timberMat);
      frame.position.set(bx, innerBedH*.5, bz); frame.castShadow=true; worldGroup.add(frame);
      const soilb=new THREE.Mesh(new THREE.PlaneGeometry(innerBedW-.06,innerBedD-.06),soilTopMat);
      soilb.rotation.x=-Math.PI/2; soilb.position.set(bx, innerBedH+.001, bz); worldGroup.add(soilb);
      // Small herb clumps in each inner bed (low, so species plants dominate visually)
      const herbHue = .30 + bi*.04 + Math.random()*.05;
      for(let gi=0;gi<5;gi++){
        const gx=bx+(Math.random()-.5)*(innerBedW*.7);
        const gz=bz+(Math.random()-.5)*(innerBedD*.7);
        const col2=new THREE.Color().setHSL(herbHue,.62,.18+Math.random()*.08);
        const gm=new THREE.MeshStandardMaterial({color:col2,roughness:.80});
        const gr=.05+Math.random()*.025;
        const gp=new THREE.Mesh(new THREE.SphereGeometry(gr,5,4),gm);
        gp.position.set(gx, innerBedH+gr*.6, gz); gp.scale.set(1,.65,1);
        worldGroup.add(gp);
      }
    });

    // ── Helper: build a plant group by type ───────────────────────
    function makePlant(type, code){
      const g = new THREE.Group();
      const rnd=(a,b)=>a+Math.random()*(b-a);

      if(type==='succulent'||type==='cactus'){
        // Dome rosette — sized up to read well in scene
        const domeCol = code==='adenium'?new THREE.Color(.8,.3,.4):new THREE.Color(.18,.58,.22);
        const domeM = new THREE.MeshStandardMaterial({color:domeCol,emissive:domeCol,emissiveIntensity:.10,roughness:.62});
        const dome = new THREE.Mesh(new THREE.SphereGeometry(.30,12,8,0,Math.PI*2,0,Math.PI*.65),domeM);
        dome.position.y=.08; g.add(dome);
        // Leaf rosette petals
        for(let i=0;i<8;i++){
          const petalM=new THREE.MeshStandardMaterial({color:new THREE.Color(.20,.62,.24),roughness:.7});
          const petal=new THREE.Mesh(new THREE.SphereGeometry(.12,6,5),petalM);
          const a=i/8*Math.PI*2;
          petal.position.set(Math.cos(a)*.22,.12,Math.sin(a)*.22);
          petal.scale.set(.6,1,.6); g.add(petal);
        }
      } else if(type==='grass'){
        // Dense tall grass tuft matching reference lemongrass/vetiver
        const bladeCol=new THREE.Color(.48,.78,.20);
        for(let i=0;i<24;i++){
          const bm=new THREE.MeshStandardMaterial({color:bladeCol,roughness:.55,side:THREE.DoubleSide});
          const bh=rnd(.55,.90);
          const blade=new THREE.Mesh(new THREE.PlaneGeometry(.035,bh),bm);
          const a=i/24*Math.PI*2; const r=rnd(0,.18);
          blade.position.set(Math.cos(a)*r,bh/2,Math.sin(a)*r);
          blade.rotation.y=a; blade.rotation.z=(Math.random()-.5)*.3;
          g.add(blade);
        }
        // Seed head puffs at top
        for(let i=0;i<5;i++){
          const pm=new THREE.MeshStandardMaterial({color:new THREE.Color(.65,.82,.35),roughness:.5});
          const puff=new THREE.Mesh(new THREE.SphereGeometry(.06,5,4),pm);
          puff.position.set((Math.random()-.5)*.18,.82+Math.random()*.12,(Math.random()-.5)*.18);
          g.add(puff);
        }
      } else if(type==='herb'){
        // Bushy herb cluster — matches aerial vegetable/herb bed photo
        const leafCol=new THREE.Color(.22,.72,.28);
        const stem=new THREE.Mesh(new THREE.CylinderGeometry(.016,.022,.28,6),new THREE.MeshStandardMaterial({color:0x4e3308}));
        stem.position.y=.14; g.add(stem);
        for(let i=0;i<7;i++){
          const hue=.54+Math.random()*.06;
          const lm=new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(hue,.70,.24+Math.random()*.08),roughness:.60,side:THREE.DoubleSide});
          const leaf=new THREE.Mesh(new THREE.SphereGeometry(.18+Math.random()*.08,8,6),lm);
          const a=i/7*Math.PI*2; leaf.position.set(Math.cos(a)*.12,rnd(.22,.46),Math.sin(a)*.12);
          leaf.scale.set(1,.72,1); leaf.castShadow=true; g.add(leaf);
        }
      } else if(type==='climber'||type==='creeper'){
        // Trellis frame + vines
        const frameMat=new THREE.MeshStandardMaterial({color:0x5d3a1a,roughness:.9});
        [[0,.45,0,.025,.9,.025],[-.2,.22,0,.025,.45,.025],[.2,.22,0,.025,.45,.025]].forEach(([x,y,z,w,h,d])=>{
          const post=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),frameMat);
          post.position.set(x,y,z); g.add(post);
        });
        [.12,.26,.4].forEach(hy=>{
          const bar=new THREE.Mesh(new THREE.BoxGeometry(.5,.02,.02),frameMat);
          bar.position.set(0,hy,0); g.add(bar);
        });
        // Vine leaves
        const vineCol=new THREE.Color(.18,.65,.28);
        for(let i=0;i<10;i++){
          const lm=new THREE.MeshStandardMaterial({color:vineCol,side:THREE.DoubleSide,roughness:.5});
          const lf=new THREE.Mesh(new THREE.PlaneGeometry(.12,.09),lm);
          lf.position.set((Math.random()-.5)*.38,rnd(.1,.75),(Math.random()-.5)*.05);
          lf.rotation.set((Math.random()-.5)*.5,Math.random()*Math.PI,(Math.random()-.5)*.4);
          g.add(lf);
        }
      } else if(type==='shrub'||type==='foliage'){
        // Full multi-tier canopy — matches rounded shrubs in top-down garden photo
        const hue=type==='foliage'?.31:.34;
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.028,.040,.34,6),new THREE.MeshStandardMaterial({color:0x3e2008,roughness:.9}));
        trunk.position.y=.17; g.add(trunk);
        for(let tier=0;tier<4;tier++){
          const col=new THREE.Color().setHSL(hue,0.68,.20+tier*.05);
          const m=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.06,roughness:.72});
          const r=.32-.055*tier;
          const s=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),m);
          const offX=(Math.random()-.5)*.08, offZ=(Math.random()-.5)*.08;
          s.position.set(offX,.18+tier*.24,offZ); s.castShadow=true; g.add(s);
        }
      } else if(type==='vegetable'){
        // Foliage cluster + fruit pods
        const leafC=new THREE.Color(.3,.7,.2);
        const lm=new THREE.MeshStandardMaterial({color:leafC,roughness:.55,side:THREE.DoubleSide});
        for(let i=0;i<4;i++){
          const lf=new THREE.Mesh(new THREE.PlaneGeometry(.24,.18),lm);
          lf.position.set((Math.random()-.5)*.15,rnd(.2,.5),( Math.random()-.5)*.15);
          lf.rotation.y=i/4*Math.PI*2; g.add(lf);
        }
        // Fruit dots
        const fruitC=new THREE.Color(1,.3,.2);
        for(let i=0;i<4;i++){
          const fm=new THREE.MeshStandardMaterial({color:fruitC,emissive:fruitC,emissiveIntensity:.5,roughness:.3});
          const fr=new THREE.Mesh(new THREE.SphereGeometry(.045,8,8),fm);
          fr.position.set((Math.random()-.5)*.22,rnd(.15,.45),(Math.random()-.5)*.22);
          g.add(fr);
        }
      } else if(type==='ornamental'||type==='perennial'){
        // Lush flowering bush — matches colourful border plants in reference images
        const stemM=new THREE.MeshStandardMaterial({color:0x1e5c22,roughness:.8});
        const base=new THREE.Mesh(new THREE.SphereGeometry(.20,9,7),stemM);
        base.position.y=.20; base.castShadow=true; g.add(base);
        const flowerCols=[0xff6b35,0xec407a,0xffd740,0xba68c8,0xf48fb1,0xff8f00,0xe040fb];
        const fc=flowerCols[Math.floor(Math.random()*flowerCols.length)];
        const fCol=new THREE.Color(fc);
        // Outer ring of blooms
        for(let i=0;i<10;i++){
          const pM=new THREE.MeshStandardMaterial({color:fCol,emissive:fCol,emissiveIntensity:.55,roughness:.28});
          const petal=new THREE.Mesh(new THREE.SphereGeometry(.08,6,6),pM);
          const a=i/10*Math.PI*2; const r=.22;
          petal.position.set(Math.cos(a)*r,.32+Math.random()*.14,Math.sin(a)*r);
          g.add(petal);
        }
        // Centre cluster
        for(let i=0;i<4;i++){
          const pm2=new THREE.MeshStandardMaterial({color:fCol.clone().offsetHSL(0,0,.1),emissive:fCol,emissiveIntensity:.4,roughness:.3});
          const p2=new THREE.Mesh(new THREE.SphereGeometry(.06,5,5),pm2);
          p2.position.set((Math.random()-.5)*.12,.42+Math.random()*.08,(Math.random()-.5)*.12);
          g.add(p2);
        }
      } else if(type==='tree'||type==='palm'||type==='bamboo'){
        // Realistic tree: thick trunk + 3-layer rounded canopy
        const trunkM=new THREE.MeshStandardMaterial({color:0x5c3a1a,roughness:.92,metalness:.02});
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.048,.072,1.15,7),trunkM);
        trunk.position.y=.58; trunk.castShadow=true; g.add(trunk);
        const hues=[.33,.30,.27];
        const radii=[.52,.44,.30];
        const heights=[.90,1.22,1.50];
        for(let ti=0;ti<3;ti++){
          const col=new THREE.Color().setHSL(hues[ti],.68,.16+ti*.07);
          const cm=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.09,roughness:.72});
          const layer=new THREE.Mesh(new THREE.SphereGeometry(radii[ti],11,8),cm);
          layer.position.set((Math.random()-.5)*.06,heights[ti],(Math.random()-.5)*.06);
          layer.scale.set(1+rnd(-.05,.08),.82+rnd(-.04,.06),1+rnd(-.05,.08));
          layer.castShadow=true; g.add(layer);
        }
      } else {
        // default: lush rounded multi-layer bush
        const hue=.32+Math.random()*.06;
        const col=new THREE.Color().setHSL(hue,.65,.18);
        const trunkM=new THREE.MeshStandardMaterial({color:0x4a2e0c,roughness:.9});
        const tr=new THREE.Mesh(new THREE.CylinderGeometry(.020,.030,.26,6),trunkM);
        tr.position.y=.13; g.add(tr);
        [[0,.28,.30],[-.10,.42,.22],[.12,.46,.20],[0,.58,.14]].forEach(([ox,oy,r])=>{
          const col2=new THREE.Color().setHSL(hue+Math.random()*.04,.66,.18+Math.random()*.08);
          const m2=new THREE.MeshStandardMaterial({color:col2,roughness:.72});
          const s=new THREE.Mesh(new THREE.SphereGeometry(r,9,7),m2);
          s.position.set(ox,oy,(Math.random()-.5)*.08); s.castShadow=true; g.add(s);
        });
      }

      return g;
    }

    // ── Place plants — from spatial mapping anchors or fallback grid ─
    const plantGroups = [];
    const labelData   = []; // {group, name, code}
    const specArr     = speciesRef.current;

    const plantAnchors = sm?.anchors?.filter(a => a.type === 'plant') ?? [];

    // Zone ring colors — one per plant, cycling through greens
    const ZONE_RING_COLORS = [0x4ADE80,0x34D399,0x86EFAC,0x6EE7B7,0xA3E635,0xBEF264,0x22C55E,0x16A34A,0x059669];

    function addZoneRing(px, pz, idx){
      const ringColor = ZONE_RING_COLORS[idx % ZONE_RING_COLORS.length];
      // Glowing ring on the ground plane
      const ringGeo = new THREE.RingGeometry(0.20, 0.26, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(px, 0.005, pz);
      worldGroup.add(ring);
      // Soft glow disc under ring
      const glowGeo = new THREE.CircleGeometry(0.22, 20);
      const glowMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.10, side: THREE.DoubleSide });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(px, 0.003, pz);
      worldGroup.add(glow);
    }

    if (plantAnchors.length > 0) {
      plantAnchors.slice(0, 12).forEach((anchor, i) => {
        const sp  = specArr[i % Math.max(specArr.length, 1)] ?? {};
        const sx  = toSX(anchor.positionM.x);
        const sz  = toSZ(anchor.positionM.z);
        const grp = makePlant(sp.type || 'herb', sp.speciesCatalogCode || '');
        grp.position.set(sx + (Math.random()-.5)*.08, .07, sz + (Math.random()-.5)*.08);
        grp.scale.setScalar(0);
        grp.rotation.y = Math.random() * Math.PI * 2;
        addZoneRing(grp.position.x, grp.position.z, i);
        worldGroup.add(grp);
        plantGroups.push({ grp, delay: i * 0.07, targetScale: 0.75 + Math.random() * 0.25, swayPhase: Math.random()*Math.PI*2, type: sp.type||'herb' });
        labelData.push({ grp, name: anchor.label || sp.name || 'Plant', code: sp.speciesCatalogCode || '' });
      });
    } else {
      // ── TIERED PROFESSIONAL GARDEN LAYOUT ─────────────────────────
      // Zones: back tall trees → mid shrubs/herbs → front low flowers
      // Each slot: [xFrac, zFrac, forcedType, targetScale]
      const GARDEN_SLOTS = [
        // Back row — tall trees/large shrubs along trellis wall
        [-0.36, -0.40, 'tree',       1.55],
        [ 0.00, -0.42, 'tree',       1.65],
        [ 0.36, -0.40, 'tree',       1.50],
        // Mid-back row — medium shrubs & herbs
        [-0.24, -0.16, 'shrub',      1.10],
        [ 0.00, -0.14, 'herb',       0.95],
        [ 0.24, -0.16, 'shrub',      1.05],
        // Mid-front — climbers/foliage on sides + vegetable beds centre
        [-0.36,  0.06, 'climber',    0.90],
        [ 0.36,  0.06, 'climber',    0.90],
        [ 0.00,  0.10, 'vegetable',  0.85],
        // Front border — low ornamentals / flowers / succulents
        [-0.26,  0.36, 'ornamental', 0.78],
        [ 0.00,  0.38, 'succulent',  0.72],
        [ 0.26,  0.36, 'ornamental', 0.78],
      ];
      const available = specArr.length || 1;
      GARDEN_SLOTS.forEach((slot, i) => {
        const sp = specArr[i % available] ?? {};
        const [xf, zf, forcedType, tgtScale] = slot;
        const jx = xf * slabW * 0.5 + (Math.random()-.5)*.12;
        const jz = zf * slabD * 0.5 + (Math.random()-.5)*.12;
        const grp = makePlant(forcedType, sp.speciesCatalogCode || '');
        grp.position.set(jx, .07, jz);
        grp.scale.setScalar(0);
        grp.rotation.y = Math.random() * Math.PI * 2;
        addZoneRing(jx, jz, i);
        worldGroup.add(grp);
        plantGroups.push({ grp, delay: i * 0.08, targetScale: tgtScale, swayPhase: Math.random()*Math.PI*2, type: forcedType });
        labelData.push({ grp, name: sp.name || 'Plant', code: sp.speciesCatalogCode || '' });
      });
    }

    // ── Populate edit-mode plant registry ─────────────────────────
    plantGroupsRef.current = plantGroups.map((pg, i) => ({
      grp: pg.grp, name: (labelData[i]?.name || 'Plant'), type: pg.type, idx: i,
    }));

    // ── Edit mode: selection ring ─────────────────────────────────
    const selRingGeo = new THREE.RingGeometry(0.34, 0.42, 36);
    const selRingMat = new THREE.MeshBasicMaterial({ color:0xFFD700, transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false });
    const selRing = new THREE.Mesh(selRingGeo, selRingMat);
    selRing.rotation.x = -Math.PI / 2;
    selRing.visible = false;
    scene.add(selRing);

    // Corner handle dots on selection ring
    const handleMat = new THREE.MeshBasicMaterial({ color:0xFFD700 });
    for(let hi=0;hi<4;hi++){
      const ha=hi/4*Math.PI*2;
      const hdot=new THREE.Mesh(new THREE.SphereGeometry(0.055,6,4),handleMat);
      hdot.position.set(Math.cos(ha)*0.38, 0.01, Math.sin(ha)*0.38);
      selRing.add(hdot);
    }

    // ── Edit mode: raycasting + drag ─────────────────────────────
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), -0.07);
    const groundPt = new THREE.Vector3();
    let draggingPlant = false;
    let dragOffX = 0, dragOffZ = 0;
    const halfW = CW * 0.47, halfD = CD * 0.47;

    const isChildOf = (obj, parent) => {
      let cur = obj; while(cur){ if(cur===parent) return true; cur=cur.parent; } return false;
    };
    const getNDC = (e) => {
      const rect = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x:((src.clientX-rect.left)/W)*2-1, y:-(((src.clientY-rect.top)/H)*2-1) };
    };

    const editPointerDown = (e) => {
      const ndc = getNDC(e);
      raycaster.setFromCamera(ndc, camera);
      const meshes = plantGroupsRef.current.map(p=>p.grp);
      const hits = raycaster.intersectObjects(meshes, true);
      if(hits.length > 0){
        let found = null;
        for(const h of hits){
          for(const pg of plantGroupsRef.current){
            if(isChildOf(h.object, pg.grp)){ found=pg; break; }
          }
          if(found) break;
        }
        if(found){
          selIdxRef.current = found.idx;
          notifySelRef.current?.(found.idx);
          draggingPlant = true;
          if(raycaster.ray.intersectPlane(groundPlane, groundPt)){
            dragOffX = found.grp.position.x - groundPt.x;
            dragOffZ = found.grp.position.z - groundPt.z;
          }
          canvas.style.cursor = 'move';
          return;
        }
      }
      // Click on empty → deselect
      selIdxRef.current = -1;
      notifySelRef.current?.(-1);
      draggingPlant = false;
      canvas.style.cursor = 'crosshair';
    };

    const editPointerMove = (e) => {
      if(!draggingPlant || selIdxRef.current < 0) return;
      const ndc = getNDC(e);
      raycaster.setFromCamera(ndc, camera);
      if(raycaster.ray.intersectPlane(groundPlane, groundPt)){
        const pg = plantGroupsRef.current.find(p=>p.idx===selIdxRef.current);
        if(pg){
          const nx = Math.max(-halfW, Math.min(halfW, groundPt.x + dragOffX));
          const nz = Math.max(-halfD, Math.min(halfD, groundPt.z + dragOffZ));
          pg.grp.position.set(nx, pg.grp.position.y, nz);
        }
      }
    };

    const editPointerUp = () => { draggingPlant = false; if(editModeRef.current) canvas.style.cursor='crosshair'; };

    // ── Add / delete plant (called from React overlay) ─────────────
    addPlantRef.current = (type) => {
      const sp = speciesRef.current[0] ?? {};
      const grp = makePlant(type, sp.speciesCatalogCode||'');
      const idx = plantGroupsRef.current.length ? Math.max(...plantGroupsRef.current.map(p=>p.idx))+1 : 0;
      grp.position.set(0, 0.07, 0);
      grp.scale.setScalar(1.0);
      grp.rotation.y = Math.random()*Math.PI*2;
      worldGroup.add(grp);
      addZoneRing(0, 0, idx);
      plantGroups.push({ grp, delay:0, targetScale:1.0, swayPhase:Math.random()*Math.PI*2, type });
      labelData.push({ grp, name: sp.name || type, code: sp.speciesCatalogCode||'' });
      plantGroupsRef.current.push({ grp, name: sp.name||type, type, idx });
      selIdxRef.current = idx;
      notifySelRef.current?.(idx);
    };

    deleteSelRef.current = () => {
      const idx = selIdxRef.current;
      if(idx < 0) return;
      const pg = plantGroupsRef.current.find(p=>p.idx===idx);
      if(!pg) return;
      worldGroup.remove(pg.grp);
      plantGroupsRef.current = plantGroupsRef.current.filter(p=>p.idx!==idx);
      selIdxRef.current = -1;
      notifySelRef.current?.(-1);
    };

    // ── Cool mist particles — bounded to slab dimensions ──────────
    const pHW = CW * 0.46, pHD = CD * 0.46;
    const mN=120, mPos=new Float32Array(mN*3), mV=new Float32Array(mN*3);
    for(let i=0;i<mN;i++){
      mPos[i*3]=(Math.random()-.5)*CW*0.9; mPos[i*3+1]=.1+Math.random()*.6; mPos[i*3+2]=(Math.random()-.5)*CD*0.9;
      mV[i*3]=(Math.random()-.5)*.003; mV[i*3+1]=.005+Math.random()*.008; mV[i*3+2]=(Math.random()-.5)*.003;
    }
    const mGeo=new THREE.BufferGeometry(); const mPA=new THREE.BufferAttribute(mPos,3);
    mGeo.setAttribute('position',mPA);
    const mMat=new THREE.PointsMaterial({color:0x00E5CC,size:.055,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    worldGroup.add(new THREE.Points(mGeo,mMat));

    // ── Firefly pollen particles ────────────────────────────────────
    const fN=80, fPos=new Float32Array(fN*3), fV=new Float32Array(fN*3);
    for(let i=0;i<fN;i++){
      fPos[i*3]=(Math.random()-.5)*CW*0.85; fPos[i*3+1]=.3+Math.random()*2; fPos[i*3+2]=(Math.random()-.5)*CD*0.85;
      fV[i*3]=(Math.random()-.5)*.006; fV[i*3+1]=(Math.random()-.5)*.003+.002; fV[i*3+2]=(Math.random()-.5)*.006;
    }
    const fGeo=new THREE.BufferGeometry(); const fPA=new THREE.BufferAttribute(fPos,3);
    fGeo.setAttribute('position',fPA);
    const fMat=new THREE.PointsMaterial({color:0xFFDB58,size:.04,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    worldGroup.add(new THREE.Points(fGeo,fMat));

    // ── Label helper ───────────────────────────────────────────────
    const projVec = new THREE.Vector3();
    // Zone colour palette for plant ring indicators
    const ZONE_PILL_COLORS = ['#4ADE80','#34D399','#86EFAC','#6EE7B7','#A7F3D0','#D1FAE5','#22C55E','#16A34A'];

    function updateLabels(){
      if(!overlay) return;
      while(overlay.firstChild) overlay.removeChild(overlay.firstChild);
      const p = progRef.current;
      if(p < 0.55) return;
      const alpha = Math.min(1,(p-0.55)*3.5);

      // Collect visible screen positions first to skip overlapping labels
      const placed = [];

      labelData.forEach(({grp, name}, idx)=>{
        projVec.setFromMatrixPosition(grp.matrixWorld);
        projVec.y += 0.75;
        projVec.project(camera);
        if(projVec.z > 1) return;
        const x = (projVec.x*.5+.5)*W;
        const y = (-.5*projVec.y+.5)*H;

        // Skip if out of bounds
        if(x<10||x>W-10||y<10||y>H-30) return;

        // Skip if too close to an already-placed label (avoid clutter)
        const tooClose = placed.some(([px,py])=>Math.hypot(px-x,py-y)<42);
        if(tooClose) return;
        placed.push([x,y]);

        // Abbreviated name: first word, max 9 chars
        const shortName = (name||'Plant').split(' ')[0].slice(0,9);
        const zoneColor = ZONE_PILL_COLORS[idx % ZONE_PILL_COLORS.length];

        const tag = document.createElement('div');
        tag.style.cssText=`position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-100%);pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:2px;opacity:${alpha};`;

        // Compact pill label
        const pill = document.createElement('div');
        pill.style.cssText=`background:rgba(255,255,255,0.92);border:1.5px solid ${zoneColor};padding:2px 6px;border-radius:20px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.18);display:flex;align-items:center;gap:3px;`;

        // Coloured zone dot
        const zoneDot = document.createElement('div');
        zoneDot.style.cssText=`width:5px;height:5px;border-radius:50%;background:${zoneColor};flex-shrink:0;`;
        pill.appendChild(zoneDot);

        // Short name text
        const namEl = document.createElement('span');
        namEl.style.cssText=`font-family:'DM Sans',sans-serif;font-size:8px;font-weight:700;color:#1B4332;letter-spacing:.3px;`;
        namEl.textContent = shortName;
        pill.appendChild(namEl);

        // Stem line
        const stem = document.createElement('div');
        stem.style.cssText=`width:1px;height:6px;background:${zoneColor};opacity:0.7;`;

        tag.appendChild(pill);
        tag.appendChild(stem);
        overlay.appendChild(tag);
      });

      // ── Bottom-left HUD: compact zone legend ─────────────────────
      if(placed.length>0){
        const hud = document.createElement('div');
        hud.style.cssText=`position:absolute;bottom:10px;left:10px;display:flex;flex-direction:column;gap:3px;opacity:${alpha};`;
        labelData.slice(0,6).forEach(({name},idx)=>{
          const shortN=(name||'Plant').split(' ')[0].slice(0,9);
          const zc=ZONE_PILL_COLORS[idx%ZONE_PILL_COLORS.length];
          const row=document.createElement('div');
          row.style.cssText=`display:flex;align-items:center;gap:4px;`;
          const dot=document.createElement('div');
          dot.style.cssText=`width:6px;height:6px;border-radius:50%;background:${zc};flex-shrink:0;`;
          const lbl=document.createElement('span');
          lbl.style.cssText=`font-family:'DM Sans',sans-serif;font-size:7px;font-weight:600;color:#fff;letter-spacing:.3px;text-shadow:0 1px 3px rgba(0,0,0,.6);`;
          lbl.textContent=shortN;
          row.appendChild(dot);row.appendChild(lbl);hud.appendChild(row);
        });
        overlay.appendChild(hud);
      }
    }

    // ── Spherical orbit camera interaction (360° + pinch-zoom + inertia) ──
    const drag = dragRef.current;
    canvas.style.cursor = 'grab';

    const onPointerDown = (e) => {
      if (editModeRef.current) { editPointerDown(e); return; }
      if (e.touches && e.touches.length >= 2) {
        drag.pinching = true; drag.active = false;
        drag.lastDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        return;
      }
      drag.active = true; drag.pinching = false;
      drag.lastX = e.touches ? e.touches[0].clientX : e.clientX;
      drag.lastY = e.touches ? e.touches[0].clientY : e.clientY;
      drag.vTheta = 0; drag.vPhi = 0;
      canvas.style.cursor = 'grabbing';
    };
    const onPointerMove = (e) => {
      if (editModeRef.current) { editPointerMove(e); return; }
      if (drag.pinching && e.touches && e.touches.length >= 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        if (drag.lastDist > 0)
          drag.radius = Math.max(5, Math.min(20, drag.radius * (drag.lastDist / d)));
        drag.lastDist = d; return;
      }
      if (!drag.active) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = cx - drag.lastX, dy = cy - drag.lastY;
      drag.vTheta = dx * 0.009;
      drag.vPhi   = dy * 0.006;
      drag.theta += drag.vTheta;
      drag.phi = Math.max(0.22, Math.min(1.38, drag.phi + drag.vPhi));
      drag.lastX = cx; drag.lastY = cy;
    };
    const onPointerUp = (e) => {
      if (editModeRef.current) { editPointerUp(); return; }
      drag.active = false; drag.pinching = false;
      canvas.style.cursor = 'grab';
    };

    canvas.addEventListener('mousedown',  onPointerDown);
    canvas.addEventListener('mousemove',  onPointerMove);
    canvas.addEventListener('mouseup',    onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    canvas.addEventListener('touchmove',  onPointerMove, { passive: true });
    canvas.addEventListener('touchend',   onPointerUp);

    // ── Animate ────────────────────────────────────────────────────
    let raf, t=0;
    const animate=()=>{
      raf=requestAnimationFrame(animate); t+=.012;
      const p=progRef.current;

      // Inertia decay & auto-rotate when idle
      if (!drag.active) {
        drag.vTheta = drag.vTheta * 0.96 + 0.00035; // gentle auto-spin, converges to ~0.009
        drag.vPhi   *= 0.88;
        drag.theta  += drag.vTheta;
        drag.phi     = Math.max(0.22, Math.min(1.38, drag.phi + drag.vPhi));
      }

      // Azimuth: rotate the world group for full 360° horizontal orbit
      worldGroup.rotation.y = drag.theta;

      // Elevation: raise/lower camera spherically while staying in front
      const { phi, radius } = drag;
      camera.position.set(0, radius * Math.cos(phi) + 1.5, radius * Math.sin(phi));
      camera.lookAt(0, 1.5, 0);

      // Cube edge subtle shimmer
      edgeMat.opacity = 0.38 + Math.sin(t * 1.1) * 0.12;

      slabMat.uniforms.uP.value += (p - slabMat.uniforms.uP.value)*.05;
      gridMat.uniforms.uT.value = t;

      // Reveal plants
      plantGroups.forEach(({grp,delay,targetScale,swayPhase,type})=>{
        const localP = Math.max(0, p - delay*.5);
        const target = localP > 0.15 ? targetScale : 0;
        const cur = grp.scale.x;
        grp.scale.setScalar(cur + (target-cur)*.06);
        if(type==='grass'||type==='climber'){
          grp.rotation.z = Math.sin(t*1.2+swayPhase)*.05;
        }
        if(type==='ornamental'||type==='perennial'){
          grp.position.y = grp.position.y + (Math.sin(t*1.8+swayPhase)*.003);
        }
      });

      // Mist — stay inside slab bounds
      mMat.opacity = p * .55;
      for(let i=0;i<mN;i++){
        mPos[i*3]+=mV[i*3]; mPos[i*3+1]+=mV[i*3+1]; mPos[i*3+2]+=mV[i*3+2];
        if(mPos[i*3+1]>2.8){ mPos[i*3+1]=.1; mPos[i*3]=(Math.random()-.5)*CW*0.9; }
      }
      mPA.needsUpdate=true;

      // Pollen — stay inside slab bounds
      fMat.opacity = p * .7;
      for(let i=0;i<fN;i++){
        fPos[i*3]+=fV[i*3]; fPos[i*3+1]+=fV[i*3+1]; fPos[i*3+2]+=fV[i*3+2];
        if(fPos[i*3+1]>3.0||Math.abs(fPos[i*3])>pHW||Math.abs(fPos[i*3+2])>pHD){
          fPos[i*3]=(Math.random()-.5)*CW*0.85; fPos[i*3+1]=.3+Math.random()*.4; fPos[i*3+2]=(Math.random()-.5)*CD*0.85;
        }
      }
      fPA.needsUpdate=true;

      // Edit mode — selection ring follows selected plant
      const sIdx = selIdxRef.current;
      if(editModeRef.current && sIdx >= 0){
        const spg = plantGroupsRef.current.find(p=>p.idx===sIdx);
        if(spg){
          selRing.position.set(spg.grp.position.x, 0.008, spg.grp.position.z);
          selRingMat.opacity = 0.65 + Math.sin(t*4)*0.30;
          selRing.visible = true;
        }
      } else { selRing.visible = false; }

      // Cursor update for edit hover
      if(editModeRef.current) canvas.style.cursor = 'crosshair';
      else canvas.style.cursor = drag.active ? 'grabbing' : 'grab';

      renderer.render(scene,camera);
      updateLabels();
    };
    animate();
    return()=>{
      cancelAnimationFrame(raf);
      renderer?.dispose();
      if(overlay) overlay.innerHTML='';
      canvas.removeEventListener('mousedown',  onPointerDown);
      canvas.removeEventListener('mousemove',  onPointerMove);
      canvas.removeEventListener('mouseup',    onPointerUp);
      canvas.removeEventListener('mouseleave', onPointerUp);
      canvas.removeEventListener('touchstart', onPointerDown);
      canvas.removeEventListener('touchmove',  onPointerMove);
      canvas.removeEventListener('touchend',   onPointerUp);
    };
  }, []); // mount once; species/progress read via refs

  const EDIT_PLANTS = [
    {type:'tree',      emoji:'🌳', label:'Tree'},
    {type:'shrub',     emoji:'🌿', label:'Shrub'},
    {type:'ornamental',emoji:'🌸', label:'Flower'},
    {type:'herb',      emoji:'🌱', label:'Herb'},
    {type:'succulent', emoji:'🌵', label:'Succulent'},
    {type:'climber',   emoji:'🍃', label:'Climber'},
    {type:'vegetable', emoji:'🥬', label:'Veggie'},
    {type:'grass',     emoji:'🌾', label:'Grass'},
    {type:'foliage',   emoji:'🍃', label:'Foliage'},
  ];

  return (
    <div style={{position:'relative',width:'100%',height:'100%'}}>
      <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block',cursor:'grab',touchAction:'none'}}/>
      <div ref={overlayRef} style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}/>

      {/* ── Edit mode panel ───────────────────────────────────────── */}
      {editMode && (
        <div style={{position:'absolute',bottom:0,left:0,right:0,background:'rgba(255,255,255,0.97)',backdropFilter:'blur(14px)',borderTop:`2px solid ${T.green}`,padding:'10px 12px 14px',zIndex:20}}>

          {/* Selected plant banner */}
          {editSelIdx >= 0 ? (
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,padding:'8px 12px',background:T.cardGreen,borderRadius:10,border:`1px solid ${T.greenLight}`}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:T.green,flexShrink:0}}/>
              <span style={{fontSize:12,color:T.green,fontWeight:600,flex:1}}>
                {plantGroupsRef.current.find(p=>p.idx===editSelIdx)?.name || 'Plant'} selected — drag to move
              </span>
              <button onClick={()=>deleteSelRef.current?.()}
                style={{padding:'5px 12px',background:'#FEE2E2',border:'1px solid #FCA5A5',borderRadius:8,color:'#DC2626',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>
                Delete
              </button>
            </div>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,padding:'7px 10px',background:T.bgMid,borderRadius:10,border:`1px solid ${T.border}`}}>
              <span style={{fontSize:11,color:T.textDim}}>Tap a plant to select · drag to reposition</span>
            </div>
          )}

          {/* Add plant palette */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:T.textDim,letterSpacing:'.6px',marginBottom:6}}>ADD PLANT</div>
            <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:2}}>
              {EDIT_PLANTS.map(({type,emoji,label})=>(
                <button key={type} onClick={()=>addPlantRef.current?.(type)}
                  style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'6px 8px',minWidth:56,background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:12,cursor:'pointer',flexShrink:0,overflow:'hidden'}}>
                  <PlantImg code={type} type={type} emoji={emoji} size={36} round={8}/>
                  <span style={{fontSize:9,color:T.textDim,fontWeight:600,whiteSpace:'nowrap'}}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Done button */}
          <button onClick={onEditDone}
            style={{width:'100%',padding:'12px 0',background:`linear-gradient(135deg,${T.greenDark},${T.green})`,border:'none',borderRadius:12,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',letterSpacing:'.3px',boxShadow:`0 4px 14px rgba(45,106,79,0.28)`}}>
            Done Editing ✓
          </button>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   SPLASH SCREEN
══════════════════════════════════════════════════════════════════ */
const SplashScreen = ({ onDone }) => {
  const [prog,setProg]=useState(0);
  const [phase,setPhase]=useState(0);
  const labels=["Preparing your profile…","Loading climate data…","Warming up AI engine…","Ready to grow 🌿"];
  useEffect(()=>{
    const t=setInterval(()=>setProg(p=>{
      if(p>=100){clearInterval(t);setTimeout(onDone,500);return 100;}
      return Math.min(100,p+1.4);
    }),45);
    return()=>clearInterval(t);
  },[]);
  useEffect(()=>{setPhase(Math.min(3,Math.floor(prog/25)));},[prog]);
  return(
    <div style={{height:'100%',background:'transparent',position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
      <MegaCityScene height={420}/>
      {/* Organic gradient overlay */}
      <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(4,28,14,.05) 0%,rgba(4,22,12,.20) 50%,rgba(4,16,8,.68) 100%)',pointerEvents:'none'}}/>
      {/* Content */}
      <div style={{position:'relative',zIndex:3,textAlign:'center',padding:'0 32px',animation:'fadeIn .9s ease'}}>
        {/* Logo — organic leaf rings */}
        <div style={{display:'flex',justifyContent:'center',marginBottom:28}}>
          <div style={{width:80,height:80,position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{position:'absolute',inset:0,borderRadius:'50%',border:'1.5px solid rgba(56,189,248,.35)',animation:'rotateSlow 8s linear infinite'}}/>
            <div style={{position:'absolute',inset:8,borderRadius:'50%',border:'1px solid rgba(34,211,238,.22)',animation:'rotateSlow 14s linear infinite reverse'}}/>
            <div style={{width:50,height:50,borderRadius:'50%',background:'rgba(56,189,248,.13)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid rgba(56,189,248,.3)',boxShadow:'0 0 22px rgba(56,189,248,.22)'}}>
              <Ic n="leaf" s={24} c="#7DD3FC"/>
            </div>
          </div>
        </div>
        <h1 style={{fontSize:42,fontWeight:700,letterSpacing:'3px',color:'#E0F2FE',marginBottom:8,fontFamily:"'Space Grotesk',sans-serif",textShadow:'0 2px 24px rgba(56,189,248,.4)'}}>
          HeatWise
        </h1>
        <p style={{fontSize:13,color:'rgba(56,189,248,.72)',marginBottom:44,fontFamily:"'DM Sans',sans-serif",fontWeight:400,letterSpacing:'.3px'}}>Urban Cooling Intelligence</p>
        <div style={{fontSize:12,color:'rgba(186,230,253,.58)',marginBottom:16,height:18,fontFamily:"'DM Sans',sans-serif",fontStyle:'italic'}}>
          {labels[phase]}
        </div>
      </div>
      {/* Progress bar */}
      <div style={{position:'absolute',bottom:44,left:32,right:32,zIndex:3}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,fontSize:11,color:'rgba(56,189,248,.55)',fontFamily:"'DM Sans',sans-serif"}}>
          <span>Loading</span><span style={{color:'#7DD3FC',fontWeight:600}}>{Math.round(prog)}%</span>
        </div>
        <div style={{height:3,background:'rgba(56,189,248,.1)',borderRadius:4,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${prog}%`,background:'linear-gradient(90deg,#0C4A6E,#38BDF8,#7DD3FC)',boxShadow:'0 0 10px rgba(56,189,248,.45)',transition:'width .04s linear',borderRadius:4}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:8}}>
          {[0,25,50,75,100].map(v=>(
            <div key={v} style={{width:5,height:5,borderRadius:'50%',background:prog>=v?'#38BDF8':'rgba(56,189,248,.2)',boxShadow:prog>=v?'0 0 7px rgba(56,189,248,.7)':'',transition:'all .3s'}}/>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   ONBOARDING
══════════════════════════════════════════════════════════════════ */
const slides=[
  {title:"Urban Heat Islands",body:"Cities are up to 3°C hotter than surroundings. Concrete absorbs heat. Green surfaces fight back.",stat:"+3.0°C",statLabel:"Urban heat premium",col:T.orange},
  {title:"AI Rooftop Analysis",body:"Scan your space. Our AI designs the optimal green layout for your rooftop in under 30 seconds.",stat:"94%",statLabel:"Model accuracy",col:T.sky},
  {title:"Measurable Cooling",body:"Track real temperature drops, CO₂ offset, and your city's collective cooling impact over time.",stat:"−3.8°C",statLabel:"Avg surface cooling",col:T.green},
];
const Onboarding = ({ navigate, onDone }) => {
  const [s,setS]=useState(0);
  const sl=slides[s];
  const finish = onDone ?? (() => navigate('home'));
  return(
    <div style={{height:'100%',background:'transparent',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      <MegaCityScene/>
      <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(4,28,14,.08),rgba(4,22,12,.25) 50%,rgba(4,16,8,.75))',pointerEvents:'none'}}/>
      {/* Slide content */}
      <div style={{position:'relative',zIndex:2,marginTop:'auto',padding:'0 24px 40px'}}>
        {/* Stat badge */}
        <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
          <div className="hud" style={{padding:'14px 28px',textAlign:'center',borderColor:sl.col+'44'}}>
            <div className="mono" style={{fontSize:38,fontWeight:700,color:sl.col,textShadow:`0 0 20px ${sl.col}80`,animation:'countUp .4s ease'}}>
              {sl.stat}
            </div>
            <div className="mono" style={{fontSize:9,letterSpacing:'2px',color:'rgba(186,230,253,.5)',marginTop:2}}>{sl.statLabel}</div>
          </div>
        </div>
        <div style={{marginBottom:24}}>
          <div className="mono" style={{fontSize:9,letterSpacing:'3px',color:'rgba(56,189,248,.5)',marginBottom:8}}>// {String(s+1).padStart(2,'0')} OF 03</div>
          <h2 style={{fontSize:28,fontWeight:800,color:'#fff',letterSpacing:'2px',marginBottom:12,lineHeight:1.15}}>{sl.title}</h2>
          <p style={{color:T.text,fontSize:14,lineHeight:1.7}}>{sl.body}</p>
        </div>
        {/* Dots */}
        <div style={{display:'flex',gap:6,marginBottom:20}}>
          {slides.map((_,i)=>(
            <div key={i} onClick={()=>setS(i)} style={{height:2,width:i===s?28:8,background:i===s?T.green:'rgba(56,189,248,.2)',boxShadow:i===s?`0 0 8px ${T.green}`:'',transition:'all .35s cubic-bezier(.34,1.56,.64,1)',cursor:'pointer'}}/>
          ))}
        </div>
        <button className="gbtn fill" onClick={()=>s<2?setS(s+1):finish()}>
          {s<2?'CONTINUE →':'CREATE MY PROFILE →'}
        </button>
        {s<2&&<button onClick={finish} style={{background:'none',border:'none',color:'rgba(186,230,253,.35)',fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:'2px',width:'100%',marginTop:14,cursor:'pointer',padding:'8px'}}>SKIP INTRO</button>}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   PROFILE SETUP (first-run, after onboarding slides)
══════════════════════════════════════════════════════════════════ */
const GARDENING_INTERESTS = [
  {id:'cooling',   e:'🌡', l:'Heat Cooling'},
  {id:'food',      e:'🍅', l:'Food Garden'},
  {id:'herbs',     e:'🌿', l:'Herbs & Spices'},
  {id:'biodiv',    e:'🦋', l:'Biodiversity'},
  {id:'aesthetics',e:'🌸', l:'Aesthetics'},
  {id:'energy',    e:'⚡', l:'Energy Saving'},
  {id:'water',     e:'💧', l:'Water Conservation'},
  {id:'wellness',  e:'🧘', l:'Wellness'},
];
const SPACE_TYPES_PS = [
  {id:'rooftop', e:'🏢', l:'Rooftop'},
  {id:'balcony', e:'🌇', l:'Balcony'},
  {id:'terrace', e:'🏡', l:'Terrace'},
  {id:'mixed',   e:'🌆', l:'Multiple'},
];
const EXP_LEVELS = [
  {id:'beginner',      e:'🌱', l:'Beginner',     s:'Just getting started'},
  {id:'intermediate',  e:'🌿', l:'Intermediate',  s:'Some experience'},
  {id:'experienced',   e:'🌳', l:'Experienced',   s:'Regular gardener'},
  {id:'expert',        e:'🏆', l:'Expert',        s:'Professional level'},
];

const ProfileSetupScreen = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [exp, setExp] = useState('');
  const [interests, setInterests] = useState([]);
  const [spaceType, setSpaceType] = useState('');
  const [spaceSize, setSpaceSize] = useState(30);
  const [detectingCity, setDetectingCity] = useState(false);
  const [detectErr, setDetectErr] = useState('');

  const toggleInterest = (id) => setInterests(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const detectLocation = async () => {
    setDetectingCity(true);
    setDetectErr('');
    try {
      // Try GPS first
      let lat, lon;
      try {
        const { getCurrentPosition: getPos } = await import('../lib/geolocation.js');
        const coords = await getPos();
        lat = coords.latitude;
        lon = coords.longitude;
      } catch {
        // GPS denied/unavailable — fall back to IP geolocation
        const ipRes = await fetch('https://ipapi.co/json/');
        const ipData = await ipRes.json();
        if (!ipData.latitude) throw new Error('Location unavailable');
        lat = ipData.latitude;
        lon = ipData.longitude;
      }
      const r = await fetch(`/api/env/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon }),
      });
      const d = await r.json();
      if (d.locationLabel) setCity(d.locationLabel);
      else throw new Error('Could not determine city');
    } catch(e) {
      setDetectErr(e?.message || 'Could not detect location. Enter manually.');
    }
    setDetectingCity(false);
  };

  const canProceed = [
    name.trim().length >= 2,   // step 0
    city.trim().length >= 2,   // step 1
  ][step];

  const save = () => {
    const profile = { name: name.trim(), age: age ? parseInt(age) : null, city: city.trim(), address: address.trim(), exp: exp||'intermediate', interests: [], spaceType: 'rooftop', spaceSize: 30, createdAt: new Date().toISOString() };
    try { localStorage.setItem('hw_profile', JSON.stringify(profile)); } catch {}
    onDone(profile);
  };

  const STEPS = ['You', 'Location'];
  const pct = ((step + 1) / 2) * 100;

  const stepContent = () => {
    if (step === 0) return (
      <div>
        <div style={{fontSize:28,fontWeight:800,color:'#E0F2FE',marginBottom:6,lineHeight:1.2}}>
          Welcome to<br /><span style={{color:T.green}}>HeatWise</span> 🌿
        </div>
        <div style={{fontSize:13,color:T.textDim,marginBottom:28,lineHeight:1.6}}>
          Let's set up your profile so we can personalize your urban garden experience.
        </div>
        <div style={{marginBottom:18}}>
          <div className="slabel">YOUR NAME</div>
          <input
            className="hinp mono"
            placeholder="e.g. Chinmay"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{fontSize:15,fontWeight:600}}
          />
        </div>
        <div style={{marginBottom:18}}>
          <div className="slabel">AGE <span style={{color:'rgba(56,189,248,.35)',fontWeight:400,fontSize:9}}>(optional)</span></div>
          <input
            className="hinp mono"
            placeholder="e.g. 27"
            value={age}
            onChange={e => setAge(e.target.value.replace(/\D/g,''))}
            type="number"
            inputMode="numeric"
          />
        </div>
        <div>
          <div className="slabel">GARDENING EXPERIENCE</div>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:4}}>
            {EXP_LEVELS.map(lvl=>(
              <div
                key={lvl.id}
                onClick={()=>setExp(lvl.id)}
                style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:12,cursor:'pointer',border:`1.5px solid ${exp===lvl.id?T.green:'rgba(56,189,248,.15)'}`,background:exp===lvl.id?'rgba(56,189,248,.10)':'rgba(6,14,34,.6)',transition:'all .18s'}}
              >
                <span style={{fontSize:22}}>{lvl.e}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:exp===lvl.id?T.textBright:T.text,fontFamily:"'Space Grotesk',sans-serif"}}>{lvl.l}</div>
                  <div style={{fontSize:11,color:T.textDim,marginTop:1}}>{lvl.s}</div>
                </div>
                {exp===lvl.id&&<div style={{width:8,height:8,borderRadius:'50%',background:T.green,boxShadow:`0 0 8px ${T.green}`}}/>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    if (step === 1) return (
      <div>
        <div style={{fontSize:24,fontWeight:800,color:'#E0F2FE',marginBottom:6}}>Where are you<br/><span style={{color:T.cyan}}>based?</span></div>
        <div style={{fontSize:13,color:T.textDim,marginBottom:24}}>We use this to fetch live climate data for your area.</div>
        <div style={{marginBottom:16}}>
          <div className="slabel">CITY / REGION</div>
          <input
            className="hinp mono"
            placeholder="e.g. Mumbai, India"
            value={city}
            onChange={e => setCity(e.target.value)}
          />
        </div>
        <div>
          <div className="slabel">ADDRESS <span style={{color:'rgba(56,189,248,.35)',fontWeight:400,fontSize:9}}>(optional)</span></div>
          <input
            className="hinp mono"
            placeholder="Street, neighbourhood…"
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
        </div>
        {city && (
          <div style={{marginTop:14,padding:'10px 14px',borderRadius:10,background:'rgba(34,211,238,.08)',border:'1px solid rgba(34,211,238,.18)',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:16}}>📍</span>
            <span style={{fontSize:12,color:T.cyan}}>{city}</span>
          </div>
        )}
      </div>
    );
    // only 2 steps — this branch is never reached
    return null;
  };

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'rgba(4,9,26,.98)',fontFamily:"'DM Sans',sans-serif"}}>
      {/* Top progress */}
      <div style={{padding:'52px 20px 0'}}>
        <div style={{display:'flex',gap:6,marginBottom:20}}>
          {STEPS.map((sl, i) => (
            <div key={sl} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <div style={{height:3,width:'100%',background:i<=step?T.green:'rgba(56,189,248,.15)',borderRadius:2,boxShadow:i===step?`0 0 8px ${T.green}`:'',transition:'all .3s'}}/>
              <div style={{fontSize:8,letterSpacing:'1px',color:i<=step?T.green:'rgba(56,189,248,.35)',fontWeight:i===step?700:400}}>{sl.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'4px 20px 24px'}}>
        {stepContent()}
      </div>

      {/* Bottom CTA */}
      <div style={{padding:'12px 20px 40px',borderTop:'1px solid rgba(56,189,248,.1)'}}>
        <button
          onClick={step < 1 ? () => setStep(s => s + 1) : save}
          disabled={!canProceed}
          style={{width:'100%',padding:'16px',borderRadius:14,border:'none',cursor:canProceed?'pointer':'not-allowed',fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,letterSpacing:'.5px',background:canProceed?'linear-gradient(135deg,#0C4A6E,#38BDF8)':'rgba(56,189,248,.08)',color:canProceed?'#BAE6FD':'rgba(56,189,248,.3)',boxShadow:canProceed?'0 4px 20px rgba(56,189,248,.35)':'none',transition:'all .2s'}}
        >
          {step < 1 ? `Continue →` : `Launch My Dashboard 🌿`}
        </button>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{width:'100%',marginTop:10,padding:'10px',background:'none',border:'none',cursor:'pointer',color:'rgba(56,189,248,.4)',fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   HOME DASHBOARD
══════════════════════════════════════════════════════════════════ */
/* Animated counter hook */
function useCounter(target, duration=900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);
  return val;
}

const HomeDashboard = ({ navigate, me, resumeProject }) => {
  const [dbProjects, setDbProjects] = useState([]);
  const [projectsErr, setProjectsErr] = useState(null);
  const [resumeBusy, setResumeBusy] = useState(null);
  const [expandedMetric, setExpandedMetric] = useState(null);
  const [cfInfoOpen, setCfInfoOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [greeting, setGreeting] = useState('');

  // Load user profile from localStorage
  const [profile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hw_profile') || 'null'); } catch { return null; }
  });

  // Load projects
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data)) setDbProjects(data);
      } catch (e) {
        if (alive) setProjectsErr(e instanceof Error ? e.message : "Could not load projects");
      }
    })();
    return () => { alive = false; };
  }, []);

  // Greeting based on time
  useEffect(() => {
    const h = new Date().getHours();
    const firstName = (profile?.name || me?.name || '').split(' ')[0];
    const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    setGreeting(firstName ? `${g}, ${firstName}` : g);
  }, [profile, me]);

  // ── Computed metrics from real data ────────────────────────────────────────
  const totalArea   = dbProjects.reduce((s, p) => s + (p.area || 0), 0);
  // Use profile's estimated space as a floor if no projects yet
  const effectiveArea = Math.max(totalArea, profile?.spaceSize || 0);
  const tempDrop    = parseFloat(Math.min(9.8, effectiveArea * 0.067).toFixed(1));
  const co2yr       = parseFloat((effectiveArea * 0.021 + (dbProjects.length * 0.08)).toFixed(1));
  const energySav   = Math.max(5, Math.round(tempDrop * 5.5));
  const cityCoolScore = Math.min(99, Math.max(12, Math.round(
    effectiveArea * 0.55 + dbProjects.length * 9 + (profile ? 14 : 0)
  )));
  const monthlyGain = Math.max(1, Math.round(dbProjects.length * 2.4 + (effectiveArea > 0 ? 4 : 0)));

  // Animated values
  const animScore   = useCounter(cityCoolScore, 1400);
  const animArea    = useCounter(Math.round(effectiveArea));
  const animEnergy  = useCounter(energySav);

  const circ = 226, off = circ - (animScore / 100) * circ;

  const displayName = profile?.name || me?.name || me?.phoneNumber || "Operator";
  const userInitials = displayName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();


  // Interest tags from profile
  const profileTags = profile?.interests?.slice(0,3).map(id =>
    GARDENING_INTERESTS.find(g=>g.id===id)
  ).filter(Boolean) || [];

  return (
    <div style={{paddingBottom:80,fontFamily:"'DM Sans',sans-serif"}}>
      {/* ── Header ── */}
      <div style={{background:'rgba(4,9,26,.97)',backdropFilter:'blur(20px)',padding:'12px 20px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(56,189,248,.1)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div
            onClick={()=>navigate('settings')}
            style={{width:38,height:38,borderRadius:12,border:'1.5px solid rgba(56,189,248,.35)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',cursor:'pointer',background:'linear-gradient(135deg,rgba(56,189,248,.12),rgba(56,189,248,.05))',boxShadow:'0 2px 10px rgba(56,189,248,.12)'}}
          >
            {userInitials
              ? <span style={{fontSize:13,fontWeight:800,color:T.green}}>{userInitials}</span>
              : <Ic n="user" s={16} c={T.green}/>
            }
            <div style={{position:'absolute',bottom:-2,right:-2,width:9,height:9,borderRadius:'50%',background:T.green,boxShadow:`0 0 8px ${T.green}`,border:'1.5px solid rgba(4,9,26,.9)'}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:'rgba(56,189,248,.55)',fontWeight:600,letterSpacing:'.5px'}}>{greeting}</div>
            <div style={{fontSize:14,fontWeight:800,color:T.textBright,lineHeight:1.1}}>{displayName}</div>
            {profile?.exp&&(()=>{const lvl=EXP_LEVELS.find(e=>e.id===profile.exp);return lvl?(
              <div style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:3,padding:'2px 8px',borderRadius:20,background:'rgba(56,189,248,.08)',border:'1px solid rgba(56,189,248,.18)'}}>
                <span style={{fontSize:11}}>{lvl.e}</span>
                <span style={{fontSize:9,color:T.green,fontWeight:700,letterSpacing:'.4px'}}>{lvl.l} Gardener</span>
              </div>
            ):null;})()}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>navigate('tips')} style={{background:'rgba(56,189,248,.07)',border:'1px solid rgba(56,189,248,.18)',borderRadius:10,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:16}}>
            💡
          </button>
          <button onClick={()=>navigate('notifications')} style={{background:'rgba(56,189,248,.07)',border:'1px solid rgba(56,189,248,.18)',borderRadius:10,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative'}}>
            <Ic n="bell" s={16} c={T.green}/>
            <div style={{position:'absolute',top:7,right:7,width:6,height:6,borderRadius:'50%',background:T.heat,border:`1.5px solid rgba(4,9,26,.9)`}}/>
          </button>
        </div>
      </div>

      <div style={{padding:'16px 20px 0'}}>

        {/* ── Hero — City Cooling Index ── */}
        <div
          className="a1"
          style={{position:'relative',marginBottom:12,overflow:'hidden',border:'1px solid rgba(56,189,248,.2)',cursor:'pointer',borderRadius:16}}
          onClick={()=>navigate('create')}
        >
          <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,#04091A,#0D1F14)'}}/>
          <HoloGlobe/>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to right,rgba(4,9,26,.88) 55%,transparent)',zIndex:2,padding:'18px 20px',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                <div className="mono" style={{fontSize:8,letterSpacing:'2px',color:'rgba(56,189,248,.5)'}}>// CITY COOLING INDEX</div>
                {profile?.city && <div style={{fontSize:8,color:'rgba(34,211,238,.5)',letterSpacing:'1px'}}>· {profile.city.split(',')[0].toUpperCase()}</div>}
              </div>
              <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                <div>
                  <span className="mono ng" style={{fontSize:58,fontWeight:700,lineHeight:1}}>{animScore}</span>
                  <span className="mono" style={{fontSize:20,color:'rgba(56,189,248,.45)'}}>/100</span>
                  <div style={{fontSize:10,color:T.textDim,marginTop:2}}>
                    {cityCoolScore < 30 ? 'Starting up' : cityCoolScore < 60 ? 'Building impact' : cityCoolScore < 80 ? 'Good progress' : 'High impact'}
                  </div>
                </div>
                <div style={{position:'relative',marginTop:2}}>
                  <svg width="72" height="72" viewBox="0 0 80 80" style={{transform:'rotate(-90deg)'}}>
                    <circle cx="40" cy="40" r="36" stroke="rgba(56,189,248,.12)" strokeWidth="6" fill="none"/>
                    <circle cx="40" cy="40" r="36" stroke={cityCoolScore>75?T.green:cityCoolScore>50?T.gold:T.orange} strokeWidth="6" fill="none" strokeLinecap="round"
                      strokeDasharray={circ} strokeDashoffset={off}
                      style={{transition:'stroke-dashoffset 1.8s cubic-bezier(.34,1,.64,1)',filter:`drop-shadow(0 0 8px ${cityCoolScore>75?T.green:T.gold}80)`}}/>
                  </svg>
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',transform:'rotate(0deg)'}}>
                    <span style={{fontSize:10,fontWeight:800,color:T.green}}>{Math.round(animScore/10)}/10</span>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div style={{display:'flex',gap:12,marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:T.cyan,boxShadow:`0 0 6px ${T.cyan}`}}/>
                  <span className="mono" style={{fontSize:9,color:'rgba(34,211,238,.7)'}}>↑ +{monthlyGain} pts this month</span>
                </div>
                {dbProjects.length > 0 && (
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <div style={{width:5,height:5,borderRadius:'50%',background:T.green,boxShadow:`0 0 6px ${T.green}`}}/>
                    <span className="mono" style={{fontSize:9,color:'rgba(56,189,248,.7)'}}>{dbProjects.length} active project{dbProjects.length!==1?'s':''}</span>
                  </div>
                )}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:12,color:T.green,fontWeight:700}}>Start New Scan</span>
                <Ic n="arr" s={14} c={T.green}/>
              </div>
            </div>
          </div>
        </div>


        {/* ── Carbon Footprint Block ── */}
        {(()=>{
          const cp = (()=>{try{return JSON.parse(localStorage.getItem('hw_carbon_profile')||'null');}catch{return null;}})();
          const bd = calcAnnualFootprint(cp);
          const gardenOff = parseFloat((effectiveArea * 0.021).toFixed(3));
          const gross = bd ? parseFloat(bd.total.toFixed(2)) : 0;
          const net   = bd ? parseFloat(Math.max(0, gross - gardenOff).toFixed(2)) : null;
          const gr    = net != null ? carbonGrade(net) : null;

          // Gauge arc — 220° sweep (start 200° → end 340° clockwise in SVG coords)
          // SVG: 0° = right, angles go clockwise
          const GW=220, GH=130, cx=110, cy=118, R=88, sw=11;
          const toRad = d => d * Math.PI/180;
          const arcPt = (deg) => ({
            x: cx + R * Math.cos(toRad(deg)),
            y: cy + R * Math.sin(toRad(deg)),
          });
          const startDeg=200, endDeg=340, sweep=300;
          const arcLen = 2*Math.PI*R*(sweep/360);
          const s0=arcPt(startDeg), e0=arcPt(endDeg);
          const trackD=`M${s0.x.toFixed(1)},${s0.y.toFixed(1)} A${R},${R} 0 1,1 ${e0.x.toFixed(1)},${e0.y.toFixed(1)}`;
          // fill: value/maxScale mapped onto arcLen
          const maxScale=10; // 10T = full arc
          const fillFrac = net!=null ? Math.min(1, net/maxScale) : 0;
          const fillLen  = fillFrac * arcLen;
          // Benchmark ticks: India avg 1.9T, Paris 2.5T, World avg 4.7T
          const benchmarks=[
            {v:1.9,l:'India',c:'#7DD3FC'},
            {v:2.5,l:'Paris',c:'#4ADE80'},
            {v:4.7,l:'Global',c:'#FB923C'},
          ];
          const tickAt=(v)=>{
            const f=Math.min(1,v/maxScale);
            const deg=startDeg+(f*sweep);
            const rOuter=R+sw/2+4, pt=arcPt(deg);
            return pt;
          };

          // Breakdown categories with exact values
          const cats = bd ? [
            {l:'Transport', v:bd.transport, c:'#F97316', e:'🚗', pct: gross>0?Math.round(bd.transport/gross*100):0},
            {l:'Diet',      v:bd.diet,      c:'#FBBF24', e:'🍽', pct: gross>0?Math.round(bd.diet/gross*100):0},
            {l:'Energy',    v:bd.energy,    c:'#38BDF8', e:'⚡', pct: gross>0?Math.round(bd.energy/gross*100):0},
            {l:'Lifestyle', v:bd.lifestyle, c:'#A78BFA', e:'\ud83d\uded2', pct: gross>0?Math.round(bd.lifestyle/gross*100):0},
          ] : [];

          const offsetPct = gross>0 ? Math.min(100,Math.round(gardenOff/gross*100)) : 0;
          const treesEq   = net!=null ? Math.round(net*45) : 0;
          const kgPerDay  = net!=null ? (net*1000/365).toFixed(1) : null;

          return (
            <div className="a2" style={{marginBottom:18}}>
              <div style={{
                borderRadius:22,
                overflow:'hidden',
                border:`1.5px solid ${gr ? gr.col+'44' : 'rgba(56,189,248,.2)'}`,
                background:'linear-gradient(160deg,#060E22 0%,#09172E 60%,#061020 100%)',
                position:'relative',
              }}>
                {/* ambient glow */}
                <div style={{position:'absolute',inset:0,pointerEvents:'none',
                  background:`radial-gradient(ellipse at 50% -10%, ${gr?gr.col+'20':'rgba(56,189,248,.14)'} 0%, transparent 60%)`}}/>

                {/* ── Info modal ── */}
                {cfInfoOpen && (
                  <div
                    onClick={(e)=>{e.stopPropagation();setCfInfoOpen(false);}}
                    style={{position:'absolute',inset:0,zIndex:20,background:'rgba(4,9,22,.92)',backdropFilter:'blur(8px)',borderRadius:22,display:'flex',flexDirection:'column',padding:'20px 20px 24px',overflow:'auto'}}
                  >
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:20}}>🌍</span>
                        <div className="mono" style={{fontSize:11,fontWeight:800,color:T.green,letterSpacing:'1.5px'}}>WHAT IS CARBON FOOTPRINT?</div>
                      </div>
                      <button onClick={(e)=>{e.stopPropagation();setCfInfoOpen(false);}}
                        style={{background:'rgba(56,189,248,.1)',border:'1px solid rgba(56,189,248,.2)',borderRadius:8,width:28,height:28,cursor:'pointer',color:T.green,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        ✕
                      </button>
                    </div>
                    {[
                      {q:'What it measures',a:'Your carbon footprint is the total greenhouse gases — mainly CO₂ — your lifestyle produces each year. Measured in tonnes (T).'},
                      {q:'What counts',a:'We add up 4 sources: 🚗 Transport (driving, flights), ⚡ Energy (electricity, LPG), 🍽 Diet (food type), 🛒 Lifestyle (shopping, deliveries).'},
                      {q:'Global benchmarks',a:'🌏 World average: 4.7T/yr · 🇮🇳 India average: 1.9T/yr · 🎯 Paris Agreement target: below 2.5T/yr by 2030 to limit warming to 1.5°C.'},
                      {q:'How your garden helps',a:'Green plants absorb CO₂ through photosynthesis. Every 1 m² of rooftop or balcony garden sequesters ~21 kg CO₂/yr — offsetting a portion of your gross footprint.'},
                      {q:'Net vs gross',a:'Gross = total you emit. Net = gross minus what your garden offsets. Growing your garden directly lowers your net footprint in real time.'},
                      {q:'Grading scale',a:'A+ < 1.5T · A < 2.5T · B < 4T · C < 6T · D < 9T · F ≥ 9T. Based on Paris targets and IPCC 2030 pathways.'},
                    ].map(({q,a})=>(
                      <div key={q} style={{marginBottom:14}}>
                        <div style={{fontSize:11,fontWeight:700,color:T.textBright,marginBottom:3}}>{q}</div>
                        <div style={{fontSize:11,color:T.textDim,lineHeight:1.6}}>{a}</div>
                      </div>
                    ))}
                    <div style={{marginTop:4,padding:'10px 12px',borderRadius:10,background:'rgba(56,189,248,.06)',border:'1px solid rgba(56,189,248,.14)'}}>
                      <div style={{fontSize:10,color:'rgba(186,230,253,.5)',lineHeight:1.5}}>
                        Data sources: IPCC AR6, IEA 2023, UNFCCC Paris Agreement, India CEA emissions factors.
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Header label + grade badge ── */}
                <div style={{padding:'14px 16px 0',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'nowrap',gap:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
                    <div className="mono" style={{fontSize:8,letterSpacing:'2px',color:'rgba(186,230,253,.38)',fontWeight:700,whiteSpace:'nowrap'}}>
                      CARBON FOOTPRINT
                    </div>
                    <button
                      onClick={(e)=>{e.stopPropagation();setCfInfoOpen(true);}}
                      style={{
                        width:15,height:15,borderRadius:'50%',border:'1px solid rgba(56,189,248,.35)',
                        background:'rgba(56,189,248,.1)',cursor:'pointer',padding:0,flexShrink:0,
                        display:'flex',alignItems:'center',justifyContent:'center',
                      }}
                    >
                      <Ic n="info" s={8} c="rgba(56,189,248,.7)"/>
                    </button>
                  </div>
                  {gr && (
                    <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
                      <div style={{
                        padding:'2px 8px',borderRadius:20,
                        background:gr.bg,border:`1px solid ${gr.col}55`,
                        fontSize:10,fontWeight:800,color:gr.col,
                        boxShadow:`0 0 8px ${gr.col}30`,whiteSpace:'nowrap',
                      }}>{gr.grade}</div>
                      <span style={{fontSize:9,color:gr.col,fontWeight:600,whiteSpace:'nowrap'}}>{gr.label}</span>
                    </div>
                  )}
                </div>

                {cp && bd ? (<>
                  {/* ── Gauge — top semicircle, fully contained ── */}
                  <div style={{display:'flex',justifyContent:'center',marginTop:6}}>
                    {(()=>{
                      // Semicircle: M (cx-R, cy) A R R 0 0,1 (cx+R, cy)
                      // Goes LEFT → TOP → RIGHT (clockwise through top)
                      // All points stay within SVG bounds — no clipping needed
                      const gW=280,gH=152,gcx=140,gcy=134,gR=108,gsw=13;
                      const gALen=Math.PI*gR; // semicircle arc length
                      const lx=(gcx-gR).toFixed(1), rx=(gcx+gR).toFixed(1), by=gcy.toFixed(1);
                      const gTrack=`M${lx},${by} A${gR},${gR} 0 0,1 ${rx},${by}`;
                      const gFrac=net!=null?Math.min(1,net/maxScale):0;
                      const gFLen=(gFrac*gALen).toFixed(1);
                      // Benchmark angle: 180° + frac*180° (clockwise from left)
                      const bAng=(v)=>{ const f=Math.min(1,v/maxScale); return (180+f*180)*Math.PI/180; };
                      const bPt=(v,r)=>{ const a=bAng(v); return {x:gcx+r*Math.cos(a),y:gcy+r*Math.sin(a)}; };
                      const benchList=[{v:1.9,l:'India',c:'#7DD3FC'},{v:2.5,l:'Paris',c:'#4ADE80'},{v:4.7,l:'Global',c:'#FB923C'}];
                      return (
                        <svg width={gW} height={gH} viewBox={`0 0 ${gW} ${gH}`} style={{display:'block',overflow:'visible'}}>
                          {/* track */}
                          <path d={gTrack} fill="none" stroke="rgba(56,189,248,.1)" strokeWidth={gsw} strokeLinecap="round"/>
                          {/* fill */}
                          <path d={gTrack} fill="none"
                            stroke={gr?.col||'#38BDF8'} strokeWidth={gsw} strokeLinecap="round"
                            strokeDasharray={`${gFLen} ${gALen.toFixed(1)}`}
                            style={{filter:`drop-shadow(0 0 7px ${gr?.col||'#38BDF8'}aa)`,transition:'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)'}}
                          />
                          {/* benchmark ticks */}
                          {benchList.map(({v,l,c})=>{
                            const iR=gR-gsw/2-3, oR=gR+gsw/2+3, lR=gR+gsw/2+15;
                            const iP=bPt(v,iR), oP=bPt(v,oR), lP=bPt(v,lR);
                            return (
                              <g key={l}>
                                <line x1={iP.x.toFixed(1)} y1={iP.y.toFixed(1)} x2={oP.x.toFixed(1)} y2={oP.y.toFixed(1)} stroke={c} strokeWidth={2.5} strokeLinecap="round"/>
                                <text x={lP.x.toFixed(1)} y={lP.y.toFixed(1)} textAnchor="middle" dominantBaseline="middle"
                                  fontSize={8} fill={c} fontFamily="JetBrains Mono,monospace" fontWeight={700}>{l}</text>
                              </g>
                            );
                          })}
                          {/* center value */}
                          <text x={gcx} y={gcy-22} textAnchor="middle" fontSize={44} fontWeight={900}
                            fill={gr?.col||'#38BDF8'} fontFamily="Space Grotesk,sans-serif">{net?.toFixed(1)}</text>
                          <text x={gcx} y={gcy-2} textAnchor="middle" fontSize={11} fill="rgba(186,230,253,.55)"
                            fontFamily="DM Sans,sans-serif">{'T CO\u2082 / yr'}</text>
                          <text x={gcx} y={gcy+14} textAnchor="middle" fontSize={9} fill="rgba(186,230,253,.28)"
                            fontFamily="DM Sans,sans-serif">net after garden offset</text>
                        </svg>
                      );
                    })()}
                  </div>

                  {/* ── Stats row — 3 equal columns ── */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1px 1fr 1px 1fr',alignItems:'center',margin:'4px 16px 12px',padding:'10px 0',background:'rgba(56,189,248,.04)',borderRadius:12,border:'1px solid rgba(56,189,248,.1)'}}>
                    <div style={{textAlign:'center',padding:'0 8px'}}>
                      <div style={{fontSize:14,fontWeight:800,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif",lineHeight:1.2}}>{kgPerDay}<span style={{fontSize:9,color:T.textDim,fontWeight:400}}>kg</span></div>
                      <div style={{fontSize:8,color:'rgba(186,230,253,.35)',letterSpacing:'.5px',marginTop:2}}>PER DAY</div>
                    </div>
                    <div style={{background:'rgba(56,189,248,.12)',height:28,width:1}}/>
                    <div style={{textAlign:'center',padding:'0 8px'}}>
                      <div style={{fontSize:11,fontWeight:800,color:net!=null&&net<2.5?'#4ADE80':T.heat,fontFamily:"'Space Grotesk',sans-serif",lineHeight:1.2}}>
                        {net!=null&&net<2.5?'Below \u2713':'Above \u26a0\ufe0f'}
                      </div>
                      <div style={{fontSize:8,color:'rgba(186,230,253,.35)',letterSpacing:'.5px',marginTop:2}}>PARIS 2.5T</div>
                    </div>
                    <div style={{background:'rgba(56,189,248,.12)',height:28,width:1}}/>
                    <div style={{textAlign:'center',padding:'0 8px'}}>
                      <div style={{fontSize:14,fontWeight:800,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif",lineHeight:1.2}}>{treesEq}</div>
                      <div style={{fontSize:8,color:'rgba(186,230,253,.35)',letterSpacing:'.5px',marginTop:2}}>TREES EQUIV</div>
                    </div>
                  </div>

                  {/* ── Category breakdown ── */}
                  <div style={{padding:'0 16px 4px'}}>
                    <div className="mono" style={{fontSize:8,letterSpacing:'2px',color:'rgba(56,189,248,.35)',marginBottom:10}}>BREAKDOWN</div>
                    {cats.map(cat=>(
                      <div key={cat.l} style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                        <span style={{fontSize:13,width:18,textAlign:'center',flexShrink:0,lineHeight:1}}>{cat.e}</span>
                        <div style={{fontSize:10,color:T.textDim,width:62,flexShrink:0}}>{cat.l}</div>
                        <div style={{flex:1,height:5,background:'rgba(56,189,248,.08)',borderRadius:3,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${cat.pct}%`,background:`linear-gradient(90deg,${cat.c}66,${cat.c})`,borderRadius:3}}/>
                        </div>
                        <div style={{fontSize:10,fontWeight:700,color:cat.c,width:36,textAlign:'right',fontFamily:"'Space Grotesk',sans-serif",flexShrink:0,whiteSpace:'nowrap'}}>{cat.v.toFixed(2)}<span style={{fontSize:7,fontWeight:400,color:'rgba(186,230,253,.35)'}}>T</span></div>
                        <div style={{fontSize:9,color:'rgba(186,230,253,.3)',width:26,textAlign:'right',flexShrink:0}}>{cat.pct}%</div>
                      </div>
                    ))}
                  </div>

                  {/* ── Garden offset strip ── */}
                  <div style={{margin:'4px 16px 0'}}>
                    <div style={{height:1,background:'rgba(56,189,248,.1)',marginBottom:12}}/>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:14}}>🌿</span>
                        <div>
                          <div style={{fontSize:10,fontWeight:700,color:'#4ADE80'}}>Garden offset: −{gardenOff} T/yr</div>
                          <div style={{fontSize:9,color:'rgba(186,230,253,.4)'}}>{effectiveArea} m² green · {offsetPct}% of gross</div>
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:11,fontWeight:700,color:T.textBright}}>{gross.toFixed(2)}<span style={{fontSize:8,color:T.textDim}}> T gross</span></div>
                        <div style={{fontSize:9,color:'#4ADE80'}}>→ {net?.toFixed(2)} T net</div>
                      </div>
                    </div>
                    {/* stacked offset bar */}
                    <div style={{height:6,background:'rgba(56,189,248,.07)',borderRadius:4,overflow:'hidden',display:'flex',marginBottom:14}}>
                      <div style={{width:`${offsetPct}%`,background:'linear-gradient(90deg,#16A34A,#4ADE80)',transition:'width 1s ease'}}/>
                      <div style={{flex:1,background:`linear-gradient(90deg,${gr?.col||'#F97316'}55,${gr?.col||'#F97316'}22)`}}/>
                    </div>
                  </div>

                  {/* ── CTA ── */}
                  <div style={{padding:'0 16px 16px'}}>
                    <button onClick={(e)=>{e.stopPropagation();navigate('carbonSetup');}}
                      style={{
                        width:'100%',padding:'11px',borderRadius:12,border:'none',cursor:'pointer',
                        background:'rgba(56,189,248,.09)',
                        color:T.green,fontSize:12,fontWeight:700,fontFamily:"'DM Sans',sans-serif",
                        letterSpacing:'.3px',display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                        borderWidth:1,borderStyle:'solid',borderColor:'rgba(56,189,248,.18)',
                      }}>
                      Update footprint data <Ic n="chev" s={14} c={T.green}/>
                    </button>
                  </div>
                </>) : (
                  /* ── Empty state ── */
                  <div style={{padding:'20px 18px 20px',textAlign:'center'}}>
                    <div style={{fontSize:48,marginBottom:12,filter:'drop-shadow(0 0 20px rgba(56,189,248,.3))'}}>🌍</div>
                    <div style={{fontSize:17,fontWeight:800,color:T.textBright,marginBottom:6,fontFamily:"'Space Grotesk',sans-serif"}}>
                      What's your carbon footprint?
                    </div>
                    <div style={{fontSize:12,color:T.textDim,lineHeight:1.6,marginBottom:18}}>
                      4 quick inputs — see your CO₂ breakdown and how your garden helps offset it.
                    </div>
                    {/* mini benchmark preview */}
                    <div style={{display:'flex',justifyContent:'center',gap:16,marginBottom:20}}>
                      {[{l:'India avg',v:'1.9T',c:'#7DD3FC'},{l:'Paris goal',v:'2.5T',c:'#4ADE80'},{l:'World avg',v:'4.7T',c:'#FB923C'}].map(b=>(
                        <div key={b.l} style={{textAlign:'center'}}>
                          <div style={{fontSize:14,fontWeight:800,color:b.c,fontFamily:"'Space Grotesk',sans-serif"}}>{b.v}</div>
                          <div style={{fontSize:8,color:'rgba(186,230,253,.38)',letterSpacing:'.5px'}}>{b.l.toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={(e)=>{e.stopPropagation();navigate('carbonSetup');}}
                      style={{
                        padding:'12px 28px',borderRadius:13,border:'none',cursor:'pointer',
                        background:'linear-gradient(135deg,#0C4A6E,#38BDF8)',
                        color:'#fff',fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif",
                        boxShadow:'0 4px 18px rgba(56,189,248,.3)',
                      }}>
                      Calculate my footprint →
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Explore ── */}
        <div style={{marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div style={{fontSize:10,letterSpacing:'2px',color:'rgba(56,189,248,.5)',fontWeight:700,textTransform:'uppercase'}}>Explore</div>
          </div>
          <div className="scrx" style={{gap:10}}>
            {[
              {label:'City Heat Map',  sub:'Live temperatures', icon:'🌡', dest:'cityHeat',     col:T.heat,       bg:'rgba(231,111,81,.1)'},
              {label:'Carbon Track',   sub:`${(()=>{try{const c=JSON.parse(localStorage.getItem('hw_carbon_profile')||'null');return c?`${(calcAnnualFootprint(c)?.total||0).toFixed(1)}T/yr`:'Track it'}catch{return 'Track it'}})()}`, icon:'🌍', dest:'carbon',   col:T.sky,  bg:'rgba(34,211,238,.08)'},
              {label:'Plant Library',  sub:'51 species',        icon:'🌿', dest:'speciesLib',   col:T.greenLight, bg:'rgba(56,189,248,.08)'},
              {label:'Your Impact',    sub:`${co2yr}T CO\u2082/yr`, icon:'\u267b\ufe0f', dest:'impact',       col:T.sun,        bg:'rgba(249,199,79,.08)'},
              {label:'Eco Tips',       sub:'Daily guides',      icon:'\ud83d\udca1', dest:'tips',         col:T.gold,       bg:'rgba(249,199,79,.06)'},
            ].map((e,i)=>(
              <div key={e.dest} onClick={()=>navigate(e.dest)}
                style={{flexShrink:0,width:116,background:e.bg,border:`1px solid ${e.col}22`,borderRadius:14,padding:'12px',cursor:'pointer',transition:'transform .15s',animation:`growUp .4s ${i*.06}s ease both`}}
                onPointerDown={ev=>ev.currentTarget.style.transform='scale(.96)'}
                onPointerUp={ev=>ev.currentTarget.style.transform='scale(1)'}
              >
                <div style={{fontSize:24,marginBottom:7}}>{e.icon}</div>
                <div style={{fontSize:12,fontWeight:700,color:T.textBright,marginBottom:2}}>{e.label}</div>
                <div style={{fontSize:10,color:T.textDim}}>{e.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent scans ── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <div className="mono" style={{fontSize:10,letterSpacing:'2px',color:'rgba(56,189,248,.5)'}}>// RECENT SCANS</div>
          <button onClick={()=>navigate('saved')} style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
            <span className="mono" style={{fontSize:10,color:T.cyan,letterSpacing:'1px'}}>VIEW ALL</span>
            <Ic n="arr" s={12} c={T.cyan}/>
          </button>
        </div>
        {projectsErr && (
          <div className="mono" style={{fontSize:10,color:T.orange,marginBottom:10}}>{projectsErr}</div>
        )}
        {(dbProjects.length
          ? dbProjects.slice(0, 4).map(proj => ({
              n: proj.name ?? "Project",
              a: proj.area ? `${proj.area} m²` : "—",
              score: proj.analysis?.score != null
                ? Math.min(100, Math.round(proj.analysis.score))
                : Math.min(85, Math.round((proj.area || 30) * 1.2)),
              s: (proj.status || "Draft").toUpperCase(),
              c: proj.status === "Analyzed" ? T.green : T.textDim,
              id: proj.id,
            }))
          : [{ n: 'Tap + to start your first scan', a: '—', score: 0, s: 'NEW', c: 'rgba(186,230,253,.4)', id: null }]
        ).map((p, i) => (
          <div
            key={p.id ?? p.n}
            className={`a${i + 3}`}
            onClick={() => {
              if (!p.id) { navigate('create'); return; }
              void (async () => {
                setResumeBusy(p.id);
                setProjectsErr(null);
                try { await resumeProject?.(p.id); }
                catch (e) { setProjectsErr(e instanceof Error ? e.message : "Could not open project"); }
                finally { setResumeBusy(null); }
              })();
            }}
            style={{opacity:(resumeBusy===p.id||deletingId===p.id)?0.55:1,background:'rgba(56,189,248,.03)',border:'1px solid rgba(56,189,248,.12)',padding:'12px 12px 12px 14px',marginBottom:10,cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'all .2s',borderRadius:12}}
            onPointerDown={ev=>ev.currentTarget.style.background='rgba(56,189,248,.08)'}
            onPointerUp={ev=>ev.currentTarget.style.background='rgba(56,189,248,.03)'}
          >
            {/* icon */}
            <div style={{width:42,height:42,background:'rgba(56,189,248,.08)',border:'1px solid rgba(56,189,248,.2)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Ic n="leaf" s={19} c={p.c}/>
            </div>

            {/* content */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                <span style={{fontSize:13,fontWeight:600,color:T.textBright,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {resumeBusy===p.id ? 'Opening…' : deletingId===p.id ? 'Deleting…' : p.n}
                </span>
                <span className="mono" style={{fontSize:9,color:p.c,letterSpacing:'1px',flexShrink:0,marginLeft:6}}>{p.s}</span>
              </div>
              <div style={{height:3,background:'rgba(56,189,248,.1)',borderRadius:2,marginBottom:4,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.max(4,p.score)}%`,background:`linear-gradient(90deg,#0284C7,#38BDF8)`,borderRadius:2,transition:'width 1s ease'}}/>
              </div>
              <div style={{fontSize:10,color:'rgba(186,230,253,.38)'}}>
                {p.a}{p.score ? ` · Score ${p.score}/100` : ''}
              </div>
            </div>

            {/* delete button */}
            {p.id && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (deletingId) return;
                  setDeletingId(p.id);
                  try {
                    const res = await fetch(`/api/projects/${p.id}`, { method: 'DELETE' });
                    if (res.ok || res.status === 404) {
                      setDbProjects(prev => prev.filter(pr => pr.id !== p.id));
                    } else {
                      setProjectsErr('Could not delete project');
                    }
                  } catch {
                    setDbProjects(prev => prev.filter(pr => pr.id !== p.id));
                  } finally {
                    setDeletingId(null);
                  }
                }}
                style={{
                  width:32,height:32,borderRadius:9,flexShrink:0,
                  background:'rgba(244,63,94,.08)',
                  border:'1px solid rgba(244,63,94,.2)',
                  display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',
                  transition:'all .18s',
                }}
                onPointerDown={e=>{e.stopPropagation();e.currentTarget.style.background='rgba(244,63,94,.22)';}}
                onPointerUp={e=>{e.currentTarget.style.background='rgba(244,63,94,.08)';}}
              >
                <Ic n="trash" s={14} c="#F43F5E"/>
              </button>
            )}

            {!p.id && <Ic n="chev" s={16} c="rgba(56,189,248,.3)"/>}
          </div>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={()=>navigate('create')}
        style={{position:'fixed',bottom:84,right:22,width:54,height:54,borderRadius:16,background:'linear-gradient(135deg,#0C4A6E,#38BDF8)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 24px rgba(56,189,248,.55),0 0 40px rgba(56,189,248,.18)',animation:'progressGlow 2s ease-in-out infinite',zIndex:50}}
      >
        <Ic n="plus" s={24} c="#04091A"/>
      </button>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   PROJECT CREATION (multi-step form)
══════════════════════════════════════════════════════════════════ */
const ProjectCreation = ({ navigate, setPhotoSession }) => {
  const [name,setName]=useState('');const [surf,setSurf]=useState('');const [goal,setGoal]=useState('');
  const [petSafe,setPetSafe]=useState(false);const [childSafe,setChildSafe]=useState(false);
  const [creating,setCreating]=useState(false);
  const [createErr,setCreateErr]=useState(null);
  const surfs=[
    {id:'rooftop', e:'🏢', l:'ROOFTOP',  s:'Flat or pitched building roof',        img:'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?w=800&q=80'},
    {id:'balcony', e:'🌇', l:'BALCONY',  s:'Apartment or building balcony',         img:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'},
    {id:'terrace', e:'🏡', l:'TERRACE',  s:'Ground or podium level terrace',        img:'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80'},
    {id:'indoor',  e:'🪴', l:'INDOOR',   s:'Sunlit indoor space or windowsill',     img:'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=800&q=80'},
  ];
  const goals=[
    {id:'cooling',     e:'❄️', l:'COOLING',      s:'Reduce surface & ambient temperature', img:'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80'},
    {id:'food',        e:'🥗', l:'FOOD GARDEN',  s:'Grow edibles, herbs & vegetables',     img:'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&q=80'},
    {id:'aesthetic',   e:'🌸', l:'AESTHETIC',    s:'Visual beauty & seasonal blooms',      img:'https://images.unsplash.com/photo-1490750967868-88df5691cc34?w=800&q=80'},
    {id:'biodiversity',e:'🌱', l:'BIODIVERSITY', s:'Support local flora & pollinators',    img:'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&q=80'},
    {id:'privacy',     e:'🛡️', l:'PRIVACY',      s:'Screening, windbreak & natural shade', img:'https://images.unsplash.com/photo-1558905586-b025a657ed0b?w=800&q=80'},
    {id:'energy',      e:'⚡', l:'ENERGY',        s:'Lower AC load and energy costs',       img:'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80'},
  ];
  return(
    <div style={{paddingBottom:100,height:'100%',overflowY:'auto'}}>
      <div className="navbar">
        <button onClick={()=>navigate('home')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><Ic n="back" s={22} c={T.green}/></button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <div className="mono" style={{fontSize:13,fontWeight:700,color:T.textBright,letterSpacing:'2px'}}>NEW SCAN</div>
          <div className="mono" style={{fontSize:9,color:'rgba(56,189,248,.4)',letterSpacing:'1px'}}>01 / 04</div>
        </div>
      </div>
      <div className="hprog"><div className="hprog-fill" style={{width:'25%'}}/></div>
      <div style={{padding:'0 20px'}}>
        <div className="a1" style={{marginBottom:20}}>
          <div className="slabel">PROJECT DESIGNATION</div>
          <input className="hinp mono" placeholder="e.g. HOME-ROOF-001" value={name} onChange={e=>setName(e.target.value)}/>
        </div>
        <div className="a2" style={{marginBottom:20}}>
          <div className="slabel">COORDINATES</div>
          <div style={{position:'relative'}}>
            <input className="hinp mono" defaultValue="Patiāla, Punjab · 30.3398° N" style={{paddingLeft:42}}/>
            <div style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)'}}><Ic n="map" s={16} c="rgba(56,189,248,.5)"/></div>
          </div>
          {/* Mini map */}
          <div style={{height:80,marginTop:8,background:'rgba(56,189,248,.04)',border:'1px solid rgba(56,189,248,.14)',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 14px,rgba(56,189,248,.06) 14px,rgba(56,189,248,.06) 15px),repeating-linear-gradient(90deg,transparent,transparent 14px,rgba(56,189,248,.06) 14px,rgba(56,189,248,.06) 15px)'}}/>
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:10,height:10,background:T.green,boxShadow:`0 0 12px ${T.green}`}}/>
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:24,height:24,border:`1px solid ${T.green}`,animation:'ping 1.5s ease-out infinite'}}/>
          </div>
        </div>
        <div className="a3" style={{marginBottom:20}}>
          <div className="slabel">SURFACE TYPE</div>
          {surfs.map((s,i)=>{
            const sel=surf===s.id;
            return(
              <div key={s.id} onClick={()=>setSurf(s.id)} style={{
                position:'relative',height:72,borderRadius:18,overflow:'hidden',
                marginBottom:10,cursor:'pointer',
                border:`2px solid ${sel?T.green:'transparent'}`,
                boxShadow:sel?`0 0 0 1px ${T.green},0 4px 20px rgba(45,106,79,.20)`:'0 2px 10px rgba(0,0,0,.10)',
                transition:'all .22s ease',
                animation:`growUp .4s ${i*.07}s ease both`,
              }}>
                {/* background image */}
                <img src={s.img} alt={s.l} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}
                  onError={e=>{e.target.style.display='none';}}/>
                {/* gradient overlay */}
                <div style={{position:'absolute',inset:0,background:sel
                  ?'linear-gradient(90deg,rgba(27,67,50,.82) 0%,rgba(45,106,79,.55) 60%,rgba(45,106,79,.30) 100%)'
                  :'linear-gradient(90deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.42) 60%,rgba(0,0,0,.18) 100%)'
                }}/>
                {/* content row */}
                <div style={{position:'relative',zIndex:2,display:'flex',alignItems:'center',gap:14,height:'100%',padding:'0 18px'}}>
                  <div style={{
                    width:40,height:40,borderRadius:12,
                    background:sel?'rgba(255,255,255,.22)':'rgba(255,255,255,.14)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:20,flexShrink:0,
                    border:`1px solid ${sel?'rgba(255,255,255,.40)':'rgba(255,255,255,.18)'}`,
                  }}>{s.e}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:'#fff',letterSpacing:'2px',fontFamily:"'Space Grotesk',sans-serif"}}>{s.l}</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,.72)',marginTop:2,fontFamily:"'DM Sans',sans-serif"}}>{s.s}</div>
                  </div>
                  {/* check */}
                  <div style={{
                    width:22,height:22,borderRadius:6,flexShrink:0,
                    border:`2px solid ${sel?T.greenLight:'rgba(255,255,255,.40)'}`,
                    background:sel?T.green:'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    transition:'all .2s',
                  }}>
                    {sel&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="a4" style={{marginBottom:20}}>
          <div className="slabel">PRIMARY OBJECTIVE</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {goals.map((g,i)=>{
            const sel=goal===g.id;
            return(
              <div key={g.id} onClick={()=>setGoal(g.id)} style={{
                position:'relative',height:80,borderRadius:16,overflow:'hidden',
                cursor:'pointer',
                border:`2px solid ${sel?T.green:'transparent'}`,
                boxShadow:sel?`0 0 0 1px ${T.green},0 4px 18px rgba(45,106,79,.22)`:'0 2px 8px rgba(0,0,0,.10)',
                transition:'all .22s ease',
                animation:`growUp .4s ${i*.06}s ease both`,
              }}>
                {/* background image */}
                <img src={g.img} alt={g.l} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}
                  onError={e=>{e.target.style.display='none';}}/>
                {/* overlay */}
                <div style={{position:'absolute',inset:0,background:sel
                  ?'linear-gradient(160deg,rgba(27,67,50,.80),rgba(45,106,79,.50))'
                  :'linear-gradient(160deg,rgba(0,0,0,.68),rgba(0,0,0,.35))'
                }}/>
                {/* content */}
                <div style={{position:'relative',zIndex:2,display:'flex',flexDirection:'column',justifyContent:'flex-end',height:'100%',padding:'0 12px 10px'}}>
                  <div style={{fontSize:16,marginBottom:3}}>{g.e}</div>
                  <div style={{fontSize:11,fontWeight:800,color:'#fff',letterSpacing:'1.5px',fontFamily:"'Space Grotesk',sans-serif"}}>{g.l}</div>
                  <div style={{fontSize:9.5,color:'rgba(255,255,255,.65)',marginTop:1,lineHeight:1.3,fontFamily:"'DM Sans',sans-serif"}}>{g.s}</div>
                </div>
                {/* selected tick */}
                {sel&&<div style={{
                  position:'absolute',top:10,right:10,
                  width:18,height:18,borderRadius:5,
                  background:T.green,
                  display:'flex',alignItems:'center',justifyContent:'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>}
              </div>
            );
          })}
          </div>
        </div>

        {/* ── Safety Filters ── */}
        <div className="a5" style={{marginBottom:20}}>
          <div className="slabel">SAFETY FILTERS</div>
          <div style={{display:'flex',gap:10}}>
            {[
              {key:'pet',  label:'Pet Safe',   icon:'\ud83d\udc3e', desc:'Non-toxic to dogs & cats',      active:petSafe,  set:setPetSafe},
              {key:'child',label:'Child Safe',  icon:'\ud83d\udc76', desc:'Safe for children & toddlers',  active:childSafe,set:setChildSafe},
            ].map(({key,label,icon,desc,active,set})=>(
              <div key={key} onClick={()=>set(v=>!v)}
                style={{
                  flex:1,padding:'12px 10px',borderRadius:14,cursor:'pointer',
                  border:`1.5px solid ${active?'rgba(56,189,248,.6)':'rgba(56,189,248,.15)'}`,
                  background:active?'rgba(56,189,248,.12)':'rgba(6,14,34,.6)',
                  transition:'all .2s',display:'flex',flexDirection:'column',alignItems:'center',gap:6,
                }}
              >
                <div style={{fontSize:26}}>{icon}</div>
                <div style={{fontSize:11,fontWeight:700,color:active?T.green:T.textBright,letterSpacing:'.5px',textAlign:'center'}}>{label}</div>
                <div style={{fontSize:9,color:T.textDim,textAlign:'center',lineHeight:1.4}}>{desc}</div>
                <div style={{
                  marginTop:4,width:20,height:20,borderRadius:'50%',
                  border:`1.5px solid ${active?T.green:'rgba(56,189,248,.3)'}`,
                  background:active?T.green:'transparent',
                  display:'flex',alignItems:'center',justifyContent:'center',
                }}>
                  {active&&<Ic n="check" s={10} c="#04091A"/>}
                </div>
              </div>
            ))}
          </div>
          {(petSafe||childSafe)&&(
            <div style={{marginTop:8,padding:'8px 12px',borderRadius:10,background:'rgba(56,189,248,.06)',border:'1px solid rgba(56,189,248,.12)'}}>
              <div style={{fontSize:10,color:T.green,fontWeight:700,marginBottom:2}}>Filter active</div>
              <div style={{fontSize:10,color:T.textDim,lineHeight:1.5}}>
                {petSafe&&childSafe?'Plants will be filtered to only show species safe for both pets and children.'
                  :petSafe?'Plants will exclude species toxic to dogs and cats (ASPCA-verified).'
                  :'Plants will exclude species unsafe for children and toddlers.'}
              </div>
            </div>
          )}
        </div>
        {createErr && (
          <div className="mono" style={{fontSize:10,color:T.orange,marginTop:12,letterSpacing:"1px"}}>{createErr}</div>
        )}
      </div>
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'rgba(4,9,26,.97)',padding:'16px 20px 32px',borderTop:'1px solid rgba(56,189,248,.1)',maxWidth:430,margin:'0 auto'}}>
        <button
          className={`gbtn${name&&surf&&goal&&!creating?' fill':''}`}
          disabled={!name||!surf||!goal||creating}
          onClick={async ()=>{
            setCreateErr(null);
            setCreating(true);
            const goalMap={cooling:'cooling',food:'food',aesthetic:'aesthetic',biodiversity:'biodiversity',privacy:'privacy',energy:'cooling'};
            const primaryGoal=goalMap[goal]||'mixed';
            const meta={name,location:"Patiāla, Punjab",surfaceType:surf,primaryGoal:goal,petSafe,childSafe};
            try{
              const res=await fetch("/api/projects",{
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({name,location:"Patiāla, Punjab",surfaceType:surf,primaryGoal,area:0,obstacles:"Unknown"}),
              });
              const data=await res.json().catch(()=>({}));
              const projectId=res.ok&&data?.id ? data.id : ('local-'+Math.random().toString(36).slice(2,9));
              setPhotoSession(prev=>({...prev,projectId,projectMeta:meta}));
              navigate('measure');
            }catch{
              // Network error — proceed with local-only session
              const projectId='local-'+Math.random().toString(36).slice(2,9);
              setPhotoSession(prev=>({...prev,projectId,projectMeta:meta}));
              navigate('measure');
            }finally{
              setCreating(false);
            }
          }}
        >
          {creating?"Creating project…":"Proceed to Measurements →"}
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   ANALYSIS SCREEN (full 3D neural brain)
══════════════════════════════════════════════════════════════════ */
const ANALYSIS_RECOMMEND_MS = 35000;

const AnalysisScreen = ({ navigate, ensureRecommendation, photoSession, generatePhotoRecommendations }) => {
  const [phase,setPhase]=useState(0);const [insight,setInsight]=useState(0);const [done,setDone]=useState(false);
  /** True while waiting on /api after the phase animation begins the last step (replaces dots when `done`). */
  const [recPending,setRecPending]=useState(false);
  const phases=[{l:'Scanning dimensions',ic:'layers'},{l:'Modelling sun exposure',ic:'sun'},{l:'Selecting species mix',ic:'leaf'},{l:'Calculating thermal impact',ic:'thermo'}];
  const insights=[
    {t:'A 100m² green roof reduces cooling energy by up to 25% annually',v:'25%'},
    {t:'Sedum varieties survive 6+ weeks without irrigation in hot climates',v:'6wks'},
    {t:'Green roofs can be 40°C cooler than conventional black roofs',v:'40°C'},
    {t:'Urban gardens support 50+ native insect species within 2 seasons',v:'50+'},
  ];
  useEffect(()=>{
    const pt=setInterval(()=>setPhase(p=>{
      if(p>=3){
        clearInterval(pt);
        setRecPending(true);
        setDone(true);
        return p;
      }
      return p+1;
    }),1700);
    const it=setInterval(()=>setInsight(i=>(i+1)%insights.length),3400);
    return()=>{clearInterval(pt);clearInterval(it);};
  },[]);
  useEffect(()=>{
    if(!done)return;
    let cancelled=false;
    const run=async()=>{
      const withTimeout=(promise,ms)=>{
        return Promise.race([
          promise,
          new Promise((_,rej)=>setTimeout(()=>rej(new Error("analysis-timeout")),ms)),
        ]);
      };
      try{
        await withTimeout((async()=>{
          if (photoSession?.measurementStatus === "ar_complete") {
            const recs = await generatePhotoRecommendations?.();
            if (!recs || recs.length === 0) {
              await ensureRecommendation?.();
            }
          } else {
            await ensureRecommendation?.();
          }
        })(),ANALYSIS_RECOMMEND_MS);
      }catch{
        /* Offline, slow API, or Capacitor fetch hang — still leave analysis screen */
      }finally{
        if(!cancelled){
          setRecPending(false);
          navigate('gardenLayout');
        }
      }
    };
    void run();
    return()=>{cancelled=true;};
  },[done, ensureRecommendation, navigate, photoSession, generatePhotoRecommendations]);
  return(
    <div style={{height:'100%',background:'rgba(242,243,247,0.92)',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      {/* Full screen neural brain (faded) */}
      <div style={{position:'absolute',inset:0,opacity:0.18}}><NeuralBrain/></div>
      {/* Light gradient overlay */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:'68%',background:`linear-gradient(transparent,rgba(242,243,247,0.92) 40%)`,pointerEvents:'none'}}/>
      {/* Content */}
      <div style={{position:'relative',zIndex:2,marginTop:'auto',padding:'0 20px 44px'}}>
        {/* Status badge */}
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,border:`1.5px solid ${T.greenLight}`,padding:'8px 18px',marginBottom:14,background:T.cardGreen,borderRadius:24}}>
            <div style={{width:7,height:7,background:T.green,borderRadius:'50%',boxShadow:`0 0 8px ${T.green}`,animation:'pulse 1.4s ease-in-out infinite'}}/>
            <span style={{fontSize:12,color:T.green,letterSpacing:'.5px',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>AI Analysis Active</span>
          </div>
          <h2 style={{fontSize:24,fontWeight:700,color:T.textBright,letterSpacing:'.3px',marginBottom:6,fontFamily:"'Space Grotesk',sans-serif"}}>Analysing Your Space</h2>
          <p style={{color:T.textDim,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>AI designing your personalised cooling plan…</p>
        </div>
        {/* Phase list */}
        <div style={{background:'rgba(255,255,255,0.97)',border:`1px solid ${T.border}`,borderRadius:16,padding:'4px 0',marginBottom:14,boxShadow:'0 2px 12px rgba(45,106,79,0.08)',overflow:'hidden'}}>
          {phases.map((p,i)=>(
            <div key={p.l} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderBottom:i<3?`1px solid ${T.border}`:'none',background:i===phase?T.cardGreen:'transparent',transition:'background .3s'}}>
              <div style={{width:30,height:30,borderRadius:8,border:`1.5px solid ${i<phase?T.green:i===phase?T.greenLight:T.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,background:i<phase?T.cardGreen:i===phase?'rgba(255,255,255,0.8)':'transparent',transition:'all .3s'}}>
                {i<phase
                  ?<Ic n="check" s={13} c={T.green}/>
                  :<Ic n={p.ic} s={13} c={i===phase?T.green:T.textDim}/>
                }
              </div>
              <span style={{fontSize:13,color:i<=phase?T.textBright:T.textDim,flex:1,fontFamily:"'DM Sans',sans-serif",fontWeight:i===phase?600:400,transition:'color .3s'}}>{p.l}</span>
              {i<phase&&<span style={{fontSize:11,color:T.green,fontWeight:700,fontFamily:"'DM Sans',sans-serif",background:T.cardGreen,padding:'2px 8px',borderRadius:20,border:`1px solid ${T.greenLight}`}}>OK</span>}
              {i===phase&&(!done||recPending)&&<div style={{display:'flex',gap:3}}>{[0,1,2].map(d=><div key={d} style={{width:5,height:5,borderRadius:'50%',background:T.green,animation:`dotBlink 1s ${d*.22}s ease-in-out infinite`}}/>)}</div>}
            </div>
          ))}
        </div>
        {/* Insight card */}
        <div style={{background:'rgba(255,255,255,0.97)',border:`1px solid ${T.borderEarth}`,borderRadius:16,padding:'16px',boxShadow:'0 2px 12px rgba(217,119,6,0.08)',display:'flex',gap:14,alignItems:'center'}}>
          <div style={{fontSize:28,fontWeight:800,color:T.earth,minWidth:54,textAlign:'center',fontFamily:"'Space Grotesk',sans-serif",lineHeight:1}}>{insights[insight].v}</div>
          <p style={{fontSize:13,color:T.text,lineHeight:1.6,margin:0,fontFamily:"'DM Sans',sans-serif"}}>{insights[insight].t}</p>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   FRAME SELECT MODAL — crop + zone overlay before Runware inpainting
══════════════════════════════════════════════════════════════════ */
const FRAME_ZONE_COLORS = {
  plant:    { fill: 'rgba(34,197,94,0.38)',   stroke: 'rgba(34,197,94,0.85)'   },
  module:   { fill: 'rgba(56,189,248,0.32)',  stroke: 'rgba(56,189,248,0.80)'  },
  path:     { fill: 'rgba(161,120,75,0.45)',  stroke: 'rgba(161,120,75,0.85)'  },
  buffer:   { fill: 'rgba(100,100,100,0.22)', stroke: 'rgba(150,150,150,0.50)' },
  existing: { fill: 'rgba(200,200,200,0.20)', stroke: 'rgba(200,200,200,0.50)' },
};

const FrameSelectModal = ({
  photo,          // base64 capturedPhoto
  layoutSchema,   // from selectedRecommendation
  widthM,
  lengthM,
  onConfirm,      // (cropFrac, maskDataUrl, prompt) => void
  onClose,
}) => {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const imgRef       = useRef(null);
  const [step, setStep]           = useState(1); // 1 = frame select, 2 = prompt
  const [spaceType, setSpaceType] = useState('');
  const [gardenStyle, setGardenStyle] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [cropFrac, setCropFrac] = useState({ x: 0.04, y: 0.04, w: 0.92, h: 0.92 });
  const [dragging,  setDragging]  = useState(null);
  const [dragStart, setDragStart] = useState(null);

  const getPos = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const src = e.touches ? e.touches[0] : e;
    return {
      x: Math.max(0, Math.min(1, (src.clientX - rect.left)  / rect.width)),
      y: Math.max(0, Math.min(1, (src.clientY - rect.top)   / rect.height)),
    };
  };

  // Redraw zone + crop overlay on canvas whenever cropFrac or schema changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || !img.complete) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = img.offsetWidth;
    const H   = img.offsetHeight;
    if (!W || !H) return;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const cx = cropFrac.x * W, cy = cropFrac.y * H;
    const cw = cropFrac.w * W, ch = cropFrac.h * H;

    // Dim outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.54)';
    ctx.fillRect(0, 0, W, H);
    ctx.clearRect(cx, cy, cw, ch);

    // Draw layout zones inside crop
    if (layoutSchema?.zones?.length) {
      const schW = layoutSchema.canvasWidthM  || widthM  || 6;
      const schH = layoutSchema.canvasLengthM || lengthM || 7;
      layoutSchema.zones.forEach(z => {
        if (z.x == null || z.y == null) return;
        const zx = cx + (z.x  / schW) * cw;
        const zy = cy + (z.y  / schH) * ch;
        const zw = ((z.widthM  || 0) / schW) * cw;
        const zh = ((z.lengthM || 0) / schH) * ch;
        const col = FRAME_ZONE_COLORS[z.type] || FRAME_ZONE_COLORS.plant;
        ctx.fillStyle   = col.fill;
        ctx.fillRect(zx, zy, zw, zh);
        ctx.strokeStyle = col.stroke;
        ctx.lineWidth   = 0.8;
        ctx.strokeRect(zx + 0.5, zy + 0.5, zw - 1, zh - 1);
        if (zw > 40 && zh > 14) {
          ctx.fillStyle = 'rgba(255,255,255,0.88)';
          ctx.font = "bold 8px 'DM Sans',sans-serif";
          ctx.fillText((z.label || z.type || 'zone').toUpperCase(), zx + 4, zy + 12);
        }
      });
    }

    // Crop border
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(cx, cy, cw, ch);

    // Corner handles
    const hS = 9;
    ctx.fillStyle = '#38BDF8';
    [[cx-hS/2,cy-hS/2],[cx+cw-hS/2,cy-hS/2],[cx-hS/2,cy+ch-hS/2],[cx+cw-hS/2,cy+ch-hS/2]]
      .forEach(([hx,hy]) => ctx.fillRect(hx, hy, hS, hS));
    // Edge midpoints
    ctx.fillStyle = 'rgba(56,189,248,0.55)';
    const hSm = 6;
    [[cx+cw/2-hSm/2,cy-hSm/2],[cx+cw/2-hSm/2,cy+ch-hSm/2],[cx-hSm/2,cy+ch/2-hSm/2],[cx+cw-hSm/2,cy+ch/2-hSm/2]]
      .forEach(([hx,hy]) => ctx.fillRect(hx, hy, hSm, hSm));
  }, [cropFrac, layoutSchema, widthM, lengthM]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(e);
    const { x: cx, y: cy, w: cw, h: ch } = cropFrac;
    const tol = 0.045;
    let mode = null;
    if      (Math.abs(pos.x - cx) < tol        && Math.abs(pos.y - cy) < tol)        mode = 'tl';
    else if (Math.abs(pos.x - (cx+cw)) < tol   && Math.abs(pos.y - cy) < tol)        mode = 'tr';
    else if (Math.abs(pos.x - cx) < tol        && Math.abs(pos.y - (cy+ch)) < tol)   mode = 'bl';
    else if (Math.abs(pos.x - (cx+cw)) < tol   && Math.abs(pos.y - (cy+ch)) < tol)  mode = 'br';
    else if (pos.x > cx+tol && pos.x < cx+cw-tol && pos.y > cy+tol && pos.y < cy+ch-tol) mode = 'move';
    else mode = 'new';
    setDragging(mode);
    setDragStart({ x: pos.x, y: pos.y, crop: { ...cropFrac } });
    if (mode === 'new') setCropFrac({ x: pos.x, y: pos.y, w: 0.001, h: 0.001 });
  }, [cropFrac]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging || !dragStart) return;
    e.preventDefault();
    const pos = getPos(e);
    const dx  = pos.x - dragStart.x;
    const dy  = pos.y - dragStart.y;
    const o   = dragStart.crop;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (dragging === 'move') {
      setCropFrac({ x: clamp(o.x+dx, 0, 1-o.w), y: clamp(o.y+dy, 0, 1-o.h), w: o.w, h: o.h });
    } else if (dragging === 'new') {
      const nx = Math.min(dragStart.x, pos.x), ny = Math.min(dragStart.y, pos.y);
      setCropFrac({ x: clamp(nx,0,1), y: clamp(ny,0,1), w: clamp(Math.abs(pos.x-dragStart.x),0.05,1-nx), h: clamp(Math.abs(pos.y-dragStart.y),0.05,1-ny) });
    } else if (dragging === 'tl') {
      const nx = clamp(o.x+dx,0,o.x+o.w-0.08), ny = clamp(o.y+dy,0,o.y+o.h-0.08);
      setCropFrac({ x:nx, y:ny, w:o.x+o.w-nx, h:o.y+o.h-ny });
    } else if (dragging === 'tr') {
      const ny = clamp(o.y+dy,0,o.y+o.h-0.08);
      setCropFrac({ ...o, y:ny, w:clamp(o.w+dx,0.08,1-o.x), h:o.y+o.h-ny });
    } else if (dragging === 'bl') {
      const nx = clamp(o.x+dx,0,o.x+o.w-0.08);
      setCropFrac({ ...o, x:nx, w:o.x+o.w-nx, h:clamp(o.h+dy,0.08,1-o.y) });
    } else if (dragging === 'br') {
      setCropFrac({ ...o, w:clamp(o.w+dx,0.08,1-o.x), h:clamp(o.h+dy,0.08,1-o.y) });
    }
  }, [dragging, dragStart]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
    setDragStart(null);
    // Snap tiny rects to safe minimum
    setCropFrac(cf => {
      if (cf.w < 0.06 || cf.h < 0.06) return { x:0.04, y:0.04, w:0.92, h:0.92 };
      return cf;
    });
  }, []);

  const buildMask = () => {
    const MASK = 1024;
    const mc = document.createElement('canvas');
    mc.width = mc.height = MASK;
    const mCtx = mc.getContext('2d');
    // All black (preserve)
    mCtx.fillStyle = 'black';
    mCtx.fillRect(0, 0, MASK, MASK);
    // White in crop (transform)
    mCtx.fillStyle = 'white';
    mCtx.fillRect(cropFrac.x*MASK, cropFrac.y*MASK, cropFrac.w*MASK, cropFrac.h*MASK);
    // Carve out preserved zones
    if (layoutSchema?.zones?.length) {
      const schW = layoutSchema.canvasWidthM  || widthM  || 6;
      const schH = layoutSchema.canvasLengthM || lengthM || 7;
      const cpx = cropFrac.x*MASK, cpy = cropFrac.y*MASK;
      const cpw = cropFrac.w*MASK, cph = cropFrac.h*MASK;
      layoutSchema.zones.forEach(z => {
        if ((z.type !== 'path' && z.type !== 'buffer') || z.x == null) return;
        mCtx.fillStyle = 'black';
        mCtx.fillRect(
          cpx + (z.x / schW) * cpw,
          cpy + (z.y / schH) * cph,
          ((z.widthM  || 0) / schW) * cpw,
          ((z.lengthM || 0) / schH) * cph,
        );
      });
    }
    return mc.toDataURL('image/png');
  };

  const handleConfirm = () => {
    const mask = buildMask();
    const parts = [];
    if (spaceType)    parts.push(spaceType);
    if (gardenStyle)  parts.push(`${gardenStyle} style garden`);
    if (customPrompt) parts.push(customPrompt.trim());
    const finalPrompt = parts.join(', ');
    onConfirm(cropFrac, mask, finalPrompt);
  };

  const hasZones = (layoutSchema?.zones?.length ?? 0) > 0;
  const uniqueTypes = hasZones
    ? [...new Set(layoutSchema.zones.map(z => z.type).filter(Boolean))]
    : [];

  const SPACE_TYPES  = ['Rooftop','Balcony','Backyard','Terrace','Courtyard','Indoor'];
  const GARDEN_STYLES = ['Tropical','Zen Garden','Cottage','Modern Minimal','Herb Garden','Native Plants','Lush Green','Desert Oasis'];

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:600,
      background:T.bg,
      display:'flex', flexDirection:'column',
      fontFamily:"'DM Sans',sans-serif",
    }}>
      {/* Header */}
      <div style={{padding:'12px 16px', display:'flex', alignItems:'center', gap:10, borderBottom:`1px solid ${T.border}`, background:'rgba(255,255,255,0.97)'}}>
        <button onClick={step===2 ? ()=>setStep(1) : onClose}
          style={{width:32,height:32,borderRadius:10,background:T.bgMid,border:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:15,color:T.textDim}}>
          {step===2 ? '←' : '✕'}
        </button>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:T.textBright}}>
            {step===1 ? 'Select Garden Frame' : 'Describe Your Garden Vision'}
          </div>
          <div style={{fontSize:11,color:T.textDim,marginTop:1}}>
            {step===1 ? 'Drag corners to frame your planting area' : 'Help AI understand what you want to build'}
          </div>
        </div>
        {/* Step indicator */}
        <div style={{display:'flex',gap:5,alignItems:'center'}}>
          {[1,2].map(s=>(
            <div key={s} style={{width:s===step?22:7,height:7,borderRadius:4,background:s===step?T.green:T.border,transition:'all .3s'}}/>
          ))}
        </div>
      </div>

      {/* ── STEP 1: Frame selection ─────────────────────────────── */}
      {step===1 && (<>
        <div
          ref={containerRef}
          style={{flex:1, position:'relative', overflow:'hidden', touchAction:'none', userSelect:'none', background:'#111'}}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          <img
            ref={imgRef}
            src={photo}
            alt="Captured"
            draggable={false}
            onLoad={() => setCropFrac(cf => ({ ...cf }))}
            style={{width:'100%', height:'100%', objectFit:'contain', display:'block', pointerEvents:'none'}}
          />
          <canvas
            ref={canvasRef}
            style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none'}}
          />
          {/* crop indicator */}
          <div style={{position:'absolute',top:8,right:10,background:'rgba(45,106,79,0.85)',borderRadius:10,padding:'3px 10px',fontSize:10,color:'#fff',fontWeight:600}}>
            {Math.round(cropFrac.w*100)}% × {Math.round(cropFrac.h*100)}%
          </div>
        </div>

        {/* Zone legend */}
        {hasZones && (
          <div style={{padding:'8px 14px', display:'flex', gap:10, flexWrap:'wrap', borderTop:`1px solid ${T.border}`, background:T.bgMid}}>
            {[
              {type:'plant',  label:'Planted zone',    color:'rgba(34,197,94,0.65)'},
              {type:'path',   label:'Path (preserved)', color:'rgba(161,120,75,0.65)'},
              {type:'module', label:'Structure',         color:'rgba(56,189,248,0.65)'},
            ].filter(leg => uniqueTypes.includes(leg.type)).map(leg => (
              <div key={leg.type} style={{display:'flex', alignItems:'center', gap:4}}>
                <div style={{width:8, height:8, borderRadius:2, background:leg.color}}/>
                <span style={{fontSize:10, color:T.textDim}}>{leg.label}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{padding:'12px 14px 16px', display:'flex', gap:8, borderTop:`1px solid ${T.border}`, background:'rgba(255,255,255,0.97)'}}>
          <button
            onClick={() => setCropFrac({x:0,y:0,w:1,h:1})}
            style={{flex:1, padding:'11px 0', background:T.bgMid, border:`1px solid ${T.border}`, borderRadius:12, color:T.text, fontSize:12, cursor:'pointer'}}
          >
            Full Frame
          </button>
          <button
            onClick={() => setStep(2)}
            style={{flex:2.2, padding:'11px 0', background:`linear-gradient(135deg,${T.greenDark},${T.green})`, border:'none', borderRadius:12, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.3px'}}
          >
            Continue →
          </button>
        </div>
      </>)}

      {/* ── STEP 2: Garden vision prompt ────────────────────────── */}
      {step===2 && (
        <div style={{flex:1, overflowY:'auto', padding:'18px 16px 24px'}}>

          {/* Thumbnail preview */}
          <div style={{borderRadius:14,overflow:'hidden',marginBottom:18,border:`1px solid ${T.border}`,maxHeight:130,position:'relative'}}>
            <img src={photo} alt="frame" style={{width:'100%',height:130,objectFit:'cover',display:'block'}}/>
            <div style={{position:'absolute',inset:0,background:'linear-gradient(transparent 50%,rgba(27,67,50,0.6))'}}/>
            <div style={{position:'absolute',bottom:8,left:12,fontSize:11,color:'#fff',fontWeight:600}}>
              Frame selected — {Math.round(cropFrac.w*100)}% × {Math.round(cropFrac.h*100)}%
            </div>
          </div>

          {/* Space type */}
          <div style={{marginBottom:18}}>
            <div style={{fontSize:13,fontWeight:700,color:T.textBright,marginBottom:10}}>What type of space is this?</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {SPACE_TYPES.map(s=>(
                <button key={s} onClick={()=>setSpaceType(spaceType===s?'':s)}
                  style={{padding:'8px 14px',borderRadius:22,border:`1.5px solid ${spaceType===s?T.green:T.border}`,background:spaceType===s?T.cardGreen:T.bgAlt,color:spaceType===s?T.green:T.text,fontSize:12,fontWeight:spaceType===s?700:400,cursor:'pointer',transition:'all .2s'}}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Garden style */}
          <div style={{marginBottom:18}}>
            <div style={{fontSize:13,fontWeight:700,color:T.textBright,marginBottom:10}}>Garden style you want</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {GARDEN_STYLES.map(s=>(
                <button key={s} onClick={()=>setGardenStyle(gardenStyle===s?'':s)}
                  style={{padding:'8px 14px',borderRadius:22,border:`1.5px solid ${gardenStyle===s?T.teal:T.border}`,background:gardenStyle===s?T.tealDim:T.bgAlt,color:gardenStyle===s?T.teal:T.text,fontSize:12,fontWeight:gardenStyle===s?700:400,cursor:'pointer',transition:'all .2s'}}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Custom description */}
          <div style={{marginBottom:22}}>
            <div style={{fontSize:13,fontWeight:700,color:T.textBright,marginBottom:8}}>Anything specific? <span style={{fontWeight:400,color:T.textDim}}>(optional)</span></div>
            <textarea
              value={customPrompt}
              onChange={e=>setCustomPrompt(e.target.value)}
              placeholder="e.g. Add a small seating area, use mostly drought-resistant plants, keep it low maintenance, include a water feature…"
              rows={3}
              style={{width:'100%',borderRadius:12,border:`1.5px solid ${T.border}`,padding:'10px 12px',fontSize:13,color:T.text,fontFamily:"'DM Sans',sans-serif",background:T.bgAlt,resize:'none',outline:'none',boxSizing:'border-box',lineHeight:1.55}}
            />
          </div>

          {/* Prompt preview */}
          {(spaceType||gardenStyle||customPrompt) && (
            <div style={{borderRadius:12,background:T.cardGreen,border:`1px solid ${T.greenLight}`,padding:'10px 14px',marginBottom:18}}>
              <div style={{fontSize:10,color:T.green,fontWeight:700,letterSpacing:'.5px',marginBottom:4}}>AI PROMPT PREVIEW</div>
              <div style={{fontSize:12,color:T.greenDark,lineHeight:1.55}}>
                {[spaceType,gardenStyle?`${gardenStyle} style garden`:null,customPrompt||null].filter(Boolean).join(' · ')}
              </div>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleConfirm}
            style={{width:'100%',padding:'15px 0',borderRadius:14,border:'none',background:`linear-gradient(135deg,${T.greenDark},${T.green},${T.teal})`,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',letterSpacing:'.3px',boxShadow:`0 6px 20px rgba(45,106,79,0.30)`}}
          >
            Generate AI Garden →
          </button>
          <div style={{textAlign:'center',marginTop:10,fontSize:11,color:T.textDim}}>
            Powered by Runware AI · photorealistic result
          </div>
        </div>
      )}
    </div>
  );

};

/* ══════════════════════════════════════════════════════════════════
   RESULT SCREEN (3D rooftop transformation)
══════════════════════════════════════════════════════════════════ */
const ResultScreen = ({ navigate, selectedRecommendation, photoSession, setActivePhotoRecommendation, generatePhotoVisualization, generateRunwareVisualization, me }) => {
  const [prog,setProg]=useState(0);
  const [numAnim,setNumAnim]=useState(false);
  const [visLoading,setVisLoading]=useState(false);
  const [runwareLoading,setRunwareLoading]=useState(false);
  const [showRunware,setShowRunware]=useState(true);
  const [sunF,setSunF]=useState('all');
  const [windF,setWindF]=useState('all');
  const [coolF,setCoolF]=useState('all');
  const [showAIVis,setShowAIVis]=useState(false);
  const [showFrameSelect,setShowFrameSelect]=useState(false);
  const [gardenEditMode,setGardenEditMode]=useState(false);
  const [runwareError,setRunwareError]=useState(null);
  const runViewLoggedRef = useRef(false);

  // Both visualizations are triggered manually via the single Generate button

  const spatialMapping = selectedRecommendation
    ? createSpatialMappingFromRecommendation(selectedRecommendation)
    : null;
  useEffect(()=>{
    let v=0;const t=setInterval(()=>{v+=.018;setProg(Math.min(1,v));if(v>=1)clearInterval(t);},30);
    setTimeout(()=>setNumAnim(true),300);
    return()=>clearInterval(t);
  },[]);
  // Log when recommendations / results are shown
  useEffect(()=>{
    logRecommendationFeedback("view", {
      recommendation:selectedRecommendation,
      extra:{ screen:"result" },
    });
  },[selectedRecommendation]);
  useEffect(() => {
    if (runViewLoggedRef.current) return;
    const sid = photoSession?.recommendationTelemetrySessionId;
    const pid = photoSession?.projectId;
    if (!sid || !pid || !me?.id) return;
    runViewLoggedRef.current = true;
    void postLearningTelemetryEvent({
      sessionId: sid,
      projectId: pid,
      userId: me.id,
      eventType: "recommendation_run_viewed",
      screenName: "result",
      metadata: {
        speciesCatalogCodes: extractSpeciesCatalogCodesFromRecommendation(selectedRecommendation),
      },
    });
  }, [photoSession?.recommendationTelemetrySessionId, photoSession?.projectId, me?.id, selectedRecommendation]);
  const heatSummary = selectedRecommendation?.heatReductionSummary || null;
  const recs = photoSession?.recommendations ?? [];
  const selectedRecIndex = selectedRecommendation
    ? recs.findIndex((r) => r === selectedRecommendation)
    : -1;

  // ── Species from real catalog data ──────────────────────────
  const PTYPE_EMOJI={succulent:'🌵',grass:'🌾',herb:'🌿',climber:'🍃',perennial:'🌸',shrub:'🌳',vegetable:'🥬',fern:'🪴',foliage:'🪴',creeper:'🍃',ornamental:'🌺'};
  const WATER_COL={low:T.green,medium:T.gold,high:T.cyan};
  const FALLBACK_SPECIES=[
    {name:'Sedum',speciesCatalogCode:'sedum',type:'succulent',waterNeeds:'low',sunRequirement:['full'],windTolerance:'low',coolingScore:9,petSafe:true,edible:false},
    {name:'Portulaca',speciesCatalogCode:'portulaca',type:'perennial',waterNeeds:'low',sunRequirement:['full'],windTolerance:'medium',coolingScore:7,petSafe:true,edible:false},
    {name:'Aloe vera',speciesCatalogCode:'aloe_vera',type:'succulent',waterNeeds:'low',sunRequirement:['full','partial'],windTolerance:'medium',coolingScore:7,petSafe:false,edible:false},
    {name:'Prickly pear',speciesCatalogCode:'prickly_pear',type:'succulent',waterNeeds:'low',sunRequirement:['full'],windTolerance:'medium',coolingScore:8,petSafe:false,edible:true},
    {name:'Vetiver',speciesCatalogCode:'vetiver',type:'grass',waterNeeds:'medium',sunRequirement:['full'],windTolerance:'high',coolingScore:9,petSafe:true,edible:false},
    {name:'Lemongrass',speciesCatalogCode:'lemongrass',type:'grass',waterNeeds:'medium',sunRequirement:['full'],windTolerance:'high',coolingScore:8,petSafe:true,edible:true},
    {name:'Holy basil',speciesCatalogCode:'tulsi_holy',type:'herb',waterNeeds:'medium',sunRequirement:['full','partial'],windTolerance:'medium',coolingScore:7,petSafe:true,edible:true},
    {name:'Curry leaf',speciesCatalogCode:'curry_leaf',type:'herb',waterNeeds:'medium',sunRequirement:['full'],windTolerance:'medium',coolingScore:7,petSafe:false,edible:true},
    {name:'Adenium',speciesCatalogCode:'adenium',type:'succulent',waterNeeds:'low',sunRequirement:['full'],windTolerance:'low',coolingScore:6,petSafe:false,edible:false},
    {name:'Desert rose',speciesCatalogCode:'adenium',type:'succulent',waterNeeds:'low',sunRequirement:['full'],windTolerance:'low',coolingScore:6,petSafe:false,edible:false},
    {name:'Snake plant',speciesCatalogCode:'snake_plant',type:'perennial',waterNeeds:'low',sunRequirement:['shade','partial','full'],windTolerance:'medium',coolingScore:6,petSafe:false,edible:false},
    {name:'Money plant',speciesCatalogCode:'pothos',type:'climber',waterNeeds:'medium',sunRequirement:['shade','partial'],windTolerance:'low',coolingScore:6,petSafe:false,edible:false},
    {name:'Bougainvillea',speciesCatalogCode:'bougainvillea',type:'shrub',waterNeeds:'low',sunRequirement:['full'],windTolerance:'high',coolingScore:6,petSafe:false,edible:false},
    {name:'Marigold',speciesCatalogCode:'marigold',type:'perennial',waterNeeds:'medium',sunRequirement:['full'],windTolerance:'medium',coolingScore:6,petSafe:true,edible:true},
    {name:'Sweet potato vine',speciesCatalogCode:'sweet_potato_vine',type:'creeper',waterNeeds:'medium',sunRequirement:['full','partial'],windTolerance:'medium',coolingScore:6,petSafe:true,edible:true},
    {name:'Dracaena',speciesCatalogCode:'dracaena_marginata',type:'foliage',waterNeeds:'low',sunRequirement:['shade','partial'],windTolerance:'medium',coolingScore:5,petSafe:false,edible:false},
    {name:'Coleus',speciesCatalogCode:'coleus',type:'foliage',waterNeeds:'medium',sunRequirement:['shade','partial'],windTolerance:'low',coolingScore:5,petSafe:true,edible:false},
    {name:'Spider plant',speciesCatalogCode:'spider_plant',type:'perennial',waterNeeds:'medium',sunRequirement:['partial','shade'],windTolerance:'low',coolingScore:5,petSafe:true,edible:false},
    {name:'Malabar spinach',speciesCatalogCode:'malabar_spinach',type:'vegetable',waterNeeds:'high',sunRequirement:['partial','full'],windTolerance:'low',coolingScore:5,petSafe:true,edible:true},
    {name:'Jasmine mogra',speciesCatalogCode:'jasmine_mogra',type:'shrub',waterNeeds:'medium',sunRequirement:['partial','full'],windTolerance:'low',coolingScore:6,petSafe:true,edible:false},
    {name:'Creeping fig',speciesCatalogCode:'ficus_pumila',type:'climber',waterNeeds:'medium',sunRequirement:['shade','partial'],windTolerance:'low',coolingScore:6,petSafe:false,edible:false},
  ];
  const rawPlants=(selectedRecommendation?.candidate?.scoredPlants??[]).map(sp=>sp?.plant).filter(Boolean);
  const allPlants=rawPlants.length>0?rawPlants:FALLBACK_SPECIES;
  // ── Compute real metrics ────────────────────────────────────
  const areaM2Result = (photoSession?.widthM && photoSession?.lengthM)
    ? Math.round(photoSession.widthM * photoSession.lengthM)
    : null;
  const speciesCountResult = allPlants.length > 0 ? allPlants.length : null;
  const waterPerDayResult = allPlants.length > 0
    ? (() => {
        const wMap={low:2,medium:5,high:9};
        return Math.round(allPlants.reduce((s,p)=>s+(wMap[p.waterNeeds]||4),0)/allPlants.length*Math.min(allPlants.length,8));
      })()
    : null;
  const energyResult = heatSummary ? `−${Math.round(heatSummary.estimatedDropC*5.5)}%` : null;
  const confidencePct = heatSummary?.confidence==='high' ? 92
    : heatSummary?.confidence==='medium' ? 76
    : heatSummary?.confidence==='low' ? 58 : null;
  const locationResult = photoSession?.projectMeta?.location || null;
  const now = new Date();
  const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const co2BaseResult = areaM2Result ? (areaM2Result*0.008).toFixed(1) : '0.4';
  const co2Year3Result = areaM2Result ? (areaM2Result*0.028).toFixed(1) : '1.2';
  const metrics=[
    {ic:'leaf',l:'GREEN AREA',v:areaM2Result?`${areaM2Result} m²`:'42 m²',c:T.green,bg:'rgba(56,189,248,.07)'},
    {ic:'drop',l:'WATER/DAY',v:waterPerDayResult?`${waterPerDayResult}L`:'12L',c:T.cyan,bg:'rgba(34,211,238,.07)'},
    {ic:'sun',l:'SPECIES',v:speciesCountResult?String(speciesCountResult):'8',c:T.gold,bg:'rgba(255,184,0,.07)'},
    {ic:'zap',l:'ENERGY',v:energyResult||'−22%',c:'#AA88FF',bg:'rgba(170,136,255,.07)'},
  ];
  // ────────────────────────────────────────────────────────────
  const maxCooling=Math.max(...allPlants.map(p=>p.coolingScore||0),1);
  const speciesCards=allPlants.filter(p=>{
    if(sunF!=='all'&&!(p.sunRequirement??[]).includes(sunF)) return false;
    if(windF!=='all'&&p.windTolerance!==windF) return false;
    if(coolF==='high'&&(p.coolingScore||0)<maxCooling*0.6) return false;
    if(coolF==='medium'&&(p.coolingScore||0)<maxCooling*0.3) return false;
    return true;
  });
  const displaySpecies=speciesCards.length>0?speciesCards:allPlants;
  // ────────────────────────────────────────────────────────────

  return(
    <div style={{paddingBottom:260,height:'100%',overflowY:'auto',WebkitOverflowScrolling:'touch',background:'#04091A',position:'relative',zIndex:1}}>
      {/* 3D Garden Hero */}
      <div style={{height:gardenEditMode?520:360,position:'relative',overflow:'hidden',background:`linear-gradient(180deg,${T.greenDark} 0%,${T.green} 100%)`,transition:'height .35s ease'}}>
        <GardenScene3D
          species={allPlants.slice(0,8)}
          progress={prog}
          photoTexture={photoSession?.capturedPhoto ?? null}
          spatialMapping={spatialMapping}
          editMode={gardenEditMode}
          onEditDone={()=>setGardenEditMode(false)}
        />
        {/* Edit Layout button — visible when NOT in edit mode */}
        {!gardenEditMode && (
          <button onClick={()=>setGardenEditMode(true)}
            style={{position:'absolute',top:'calc(env(safe-area-inset-top, 44px) + 12px)',right:60,zIndex:10,display:'flex',alignItems:'center',gap:5,padding:'7px 12px',background:'rgba(255,255,255,0.18)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.35)',borderRadius:20,color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',letterSpacing:'.3px'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Layout
          </button>
        )}
        {/* Nav */}
        <div style={{position:'absolute',top:0,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'calc(env(safe-area-inset-top, 44px) + 12px)',paddingBottom:12,paddingLeft:18,paddingRight:18,zIndex:10}}>
          <button onClick={()=>{
            const telId = photoSession?.recommendationTelemetrySessionId;
            const snaps = photoSession?.telemetryCandidateSnapshotIds ?? [];
            const idx = selectedRecIndex >= 0 ? selectedRecIndex : 0;
            const snapId = snaps[idx] ?? null;
            if (telId && photoSession?.projectId && me?.id) {
              void postLearningTelemetryEvent({
                sessionId: telId,
                projectId: photoSession.projectId,
                userId: me.id,
                eventType: "candidate_dismissed",
                candidateSnapshotId: snapId,
                screenName: "result",
                metadata: {
                  reason: "back_to_layout",
                  speciesCatalogCodes: extractSpeciesCatalogCodesFromRecommendation(selectedRecommendation),
                },
              });
            }
            logRecommendationFeedback("dismiss",{
              recommendation:selectedRecommendation,
              extra:{ screen:"result", reason:"back_to_layout" },
            });
            navigate('gardenLayout');
          }} style={{width:34,height:34,borderRadius:10,background:'rgba(4,9,26,.7)',border:'1px solid rgba(56,189,248,.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Ic n="back" s={16} c={T.green}/></button>
          <div style={{fontSize:11,color:T.textBright,letterSpacing:'.5px',background:'rgba(9,24,14,.85)',padding:'6px 16px',border:'1px solid rgba(56,189,248,.3)',borderRadius:20,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Scan Complete</div>
          <button
            style={{width:34,height:34,borderRadius:10,background:'rgba(4,9,26,.7)',border:'1px solid rgba(56,189,248,.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}
            onClick={()=>navigate('report')}
          >
            <Ic n="layers" s={14} c={T.green}/>
          </button>
        </div>
        {/* Transformation progress bar */}
        <div style={{position:'absolute',bottom:10,left:18,right:18,zIndex:5}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span className="mono" style={{fontSize:9,color:T.orange,letterSpacing:'1px'}}>BARE ROOF</span>
            <span className="mono" style={{fontSize:9,color:'rgba(56,189,248,.6)',letterSpacing:'1px'}}>
              {allPlants.slice(0,8).length} SPECIES · {Math.round(prog*100)}% PLANTED
            </span>
            <span className="mono ng" style={{fontSize:9,letterSpacing:'1px'}}>GARDEN</span>
          </div>
          <div style={{height:2,background:'rgba(255,68,0,.2)'}}>
            <div style={{height:'100%',width:`${prog*100}%`,background:`linear-gradient(90deg,${T.orange},${T.gold},${T.green})`,boxShadow:`0 0 10px ${T.green}`,transition:'width .03s linear'}}/>
          </div>
        </div>
        {/* Impact overlay */}
        <div style={{position:'absolute',bottom:32,right:18,zIndex:5,textAlign:'right'}}>
          <div className="mono" style={{fontSize:9,color:'rgba(56,189,248,.5)',letterSpacing:'1px',marginBottom:2}}>SURFACE COOLING</div>
          <div style={{fontSize:48,fontWeight:800,color:T.green,lineHeight:1,textShadow:`0 0 24px ${T.green}80`,fontFamily:"'Space Grotesk',sans-serif",opacity:numAnim?1:0,transform:numAnim?'scale(1)':'scale(.5)',transition:'all .5s cubic-bezier(.34,1.56,.64,1)'}}>
            {heatSummary
              ? `−${heatSummary.estimatedDropC.toFixed(1)}°`
              : "−3.8°"}
          </div>
          {heatSummary && (
            <div className="mono" style={{fontSize:9,color:'rgba(186,230,253,.6)',marginTop:4}}>
              Plant: {(heatSummary.plantCoverageRatio*100).toFixed(0)}% · Shade: {(heatSummary.shadeCoverageRatio*100).toFixed(0)}% · Reflective: {(heatSummary.reflectiveCoverageRatio*100).toFixed(0)}% · {heatSummary.confidence} confidence
            </div>
          )}
        </div>
      </div>

      {/* ── AI Visualization panel (from captured AR frame) ── */}
      {(visLoading || photoSession?.generatedVisualization?.imageUrl) && (
        <div style={{margin:'14px 16px 0',borderRadius:16,overflow:'hidden',border:'1px solid rgba(56,189,248,0.22)',background:'rgba(6,14,38,0.95)'}}>
          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid rgba(56,189,248,0.1)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:visLoading?T.gold:T.green,boxShadow:`0 0 6px ${visLoading?T.gold:T.green}`,animation:visLoading?'pulse 1s infinite':undefined}}/>
              <span style={{fontSize:10,letterSpacing:'1.5px',color:visLoading?T.gold:T.green,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                {visLoading?'AI GENERATING VISUAL…':'AI GARDEN VISUAL'}
              </span>
            </div>
            {photoSession?.generatedVisualization?.imageUrl && (
              <button onClick={()=>setShowAIVis(v=>!v)}
                style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'rgba(186,230,253,0.5)',fontFamily:"'DM Sans',sans-serif"}}>
                {showAIVis?'Hide':'Show'}
              </button>
            )}
          </div>
          {/* Loading state */}
          {visLoading && (
            <div style={{padding:'20px',display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
              <div style={{display:'flex',gap:4}}>
                {[0,1,2,3].map(i=>(
                  <div key={i} style={{width:6,height:6,borderRadius:'50%',background:T.gold,animation:`dotBlink 1s ${i*0.18}s ease-in-out infinite`}}/>
                ))}
              </div>
              <div style={{fontSize:11,color:'rgba(186,230,253,0.45)',fontFamily:"'DM Sans',sans-serif",textAlign:'center'}}>
                Applying AI garden overlay to your scanned rooftop…
              </div>
              {/* Show the raw captured frame while waiting */}
              {photoSession?.capturedPhoto && (
                <div style={{width:'100%',borderRadius:10,overflow:'hidden',opacity:0.55,position:'relative'}}>
                  <img src={photoSession.capturedPhoto} alt="Scanned rooftop" style={{width:'100%',display:'block',objectFit:'cover',maxHeight:160}}/>
                  <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,rgba(56,189,248,0.15),transparent)',pointerEvents:'none'}}/>
                </div>
              )}
            </div>
          )}
          {/* AI result image */}
          {!visLoading && showAIVis && photoSession?.generatedVisualization?.imageUrl && (
            <div style={{position:'relative'}}>
              <img
                src={photoSession.generatedVisualization.imageUrl}
                alt="AI garden visualization"
                style={{width:'100%',display:'block',objectFit:'cover',maxHeight:220}}
              />
              {/* Before/after toggle strip */}
              <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'8px 12px',background:'linear-gradient(transparent,rgba(4,9,22,0.88))',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:9,letterSpacing:'1.5px',color:'rgba(186,230,253,0.6)',fontFamily:"'JetBrains Mono',monospace"}}>AI VISUAL · YOUR ROOFTOP</span>
                <button onClick={()=>navigate('beforeAfter')}
                  style={{background:'rgba(56,189,248,0.15)',border:'1px solid rgba(56,189,248,0.3)',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:10,color:T.green,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>
                  Before / After →
                </button>
              </div>
            </div>
          )}
          {/* Collapsed state — just the thumbnail */}
          {!visLoading && !showAIVis && photoSession?.generatedVisualization?.imageUrl && (
            <button onClick={()=>setShowAIVis(true)}
              style={{width:'100%',padding:'10px 14px',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:10,textAlign:'left'}}>
              <img src={photoSession.generatedVisualization.imageUrl} alt="" style={{width:44,height:44,borderRadius:8,objectFit:'cover',flexShrink:0}}/>
              <span style={{fontSize:12,color:'rgba(186,230,253,0.6)',fontFamily:"'DM Sans',sans-serif"}}>Tap to view AI garden visual</span>
              <span style={{marginLeft:'auto',fontSize:16,color:T.green}}>›</span>
            </button>
          )}
        </div>
      )}

      {/* ── Frame Select Modal overlay ── */}
      {showFrameSelect && photoSession?.capturedPhoto && (
        <FrameSelectModal
          photo={photoSession.capturedPhoto}
          layoutSchema={selectedRecommendation?.layoutSchema ?? null}
          widthM={photoSession?.widthM ?? 6}
          lengthM={photoSession?.lengthM ?? 7}
          onClose={() => setShowFrameSelect(false)}
          onConfirm={(cropFrac, maskDataUrl, userPrompt) => {
            setShowFrameSelect(false);
            setRunwareLoading(true);
            generateRunwareVisualization?.({ frameCrop: cropFrac, frameMask: maskDataUrl, userPrompt: userPrompt || undefined })
              .finally(() => setRunwareLoading(false));
          }}
        />
      )}

      {/* ── Runware AI Garden Preview panel ── */}
      {(runwareLoading || photoSession?.runwareVisualization?.imageUrl) && (
        <div style={{margin:'14px 16px 0',borderRadius:16,overflow:'hidden',border:'1px solid rgba(212,175,55,0.28)',background:'rgba(12,18,10,0.97)'}}>
          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid rgba(212,175,55,0.12)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:runwareLoading?T.gold:'#e8c14e',boxShadow:`0 0 8px ${runwareLoading?T.gold:'#e8c14e'}`,animation:runwareLoading?'pulse 1s infinite':undefined}}/>
              <span style={{fontSize:10,letterSpacing:'1.5px',color:runwareLoading?T.gold:'#e8c14e',fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                {runwareLoading?'INPAINTING GARDEN…':'AI GARDEN PREVIEW'}
              </span>
              {!runwareLoading && photoSession?.runwareVisualization?.mode && (
                <span style={{fontSize:8,letterSpacing:'1px',color:'rgba(34,197,94,0.7)',fontFamily:"'JetBrains Mono',monospace",background:'rgba(34,197,94,0.1)',padding:'1px 5px',borderRadius:4,border:'1px solid rgba(34,197,94,0.25)'}}>
                  {photoSession.runwareVisualization.mode === 'inpaint' ? 'INPAINT' : photoSession.runwareVisualization.mode === 'img2img' ? 'IMG2IMG' : 'GEN'}
                </span>
              )}
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              {photoSession?.runwareVisualization?.imageUrl && (
                <button onClick={async()=>{setRunwareLoading(true);await generateRunwareVisualization?.({});setRunwareLoading(false);}}
                  style={{background:'rgba(212,175,55,0.10)',border:'1px solid rgba(212,175,55,0.30)',borderRadius:7,padding:'3px 8px',cursor:'pointer',fontSize:9,color:'#e8c14e',fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>
                  ↺ Regen
                </button>
              )}
              {photoSession?.runwareVisualization?.imageUrl && (
                <button onClick={()=>setShowRunware(v=>!v)}
                  style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'rgba(186,230,253,0.5)',fontFamily:"'DM Sans',sans-serif"}}>
                  {showRunware?'Hide':'Show'}
                </button>
              )}
            </div>
          </div>
          {/* Loading — inpainting progress */}
          {runwareLoading && (
            <div style={{padding:'20px',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
              <div style={{display:'flex',gap:5}}>
                {[0,1,2,3,4].map(i=>(
                  <div key={i} style={{width:5,height:5,borderRadius:'50%',background:'#e8c14e',animation:`dotBlink 1.2s ${i*0.15}s ease-in-out infinite`}}/>
                ))}
              </div>
              <div style={{fontSize:11,color:'rgba(186,230,253,0.4)',fontFamily:"'DM Sans',sans-serif",textAlign:'center',lineHeight:1.5}}>
                {photoSession?.capturedPhoto
                  ? 'Transforming your measured space with recommended species…'
                  : 'Generating photorealistic garden from species and layout plan…'}
              </div>
              <div style={{width:'100%',height:160,borderRadius:10,background:'linear-gradient(135deg,rgba(30,50,30,0.8),rgba(12,22,14,0.9))',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontSize:28,opacity:.18}}>🌿</span>
              </div>
            </div>
          )}
          {/* Result image */}
          {!runwareLoading && showRunware && photoSession?.runwareVisualization?.imageUrl && (
            <div style={{position:'relative'}}>
              <img
                src={photoSession.runwareVisualization.imageUrl}
                alt="AI garden preview"
                style={{width:'100%',display:'block',objectFit:'cover',maxHeight:260}}
              />
              {/* Metadata badges */}
              <div style={{position:'absolute',top:8,left:8,display:'flex',gap:4,flexWrap:'wrap'}}>
                {photoSession.runwareVisualization.hadSeedImage && (
                  <span style={{fontSize:8,padding:'2px 6px',background:'rgba(34,197,94,0.75)',borderRadius:4,color:'#fff',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'0.5px'}}>FRAME-GROUNDED</span>
                )}
                {photoSession.runwareVisualization.hadLayoutSchema && (
                  <span style={{fontSize:8,padding:'2px 6px',background:'rgba(56,189,248,0.75)',borderRadius:4,color:'#fff',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'0.5px'}}>LAYOUT PLAN</span>
                )}
              </div>
              <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'10px 14px',background:'linear-gradient(transparent,rgba(4,9,26,0.92))',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:9,letterSpacing:'1.5px',color:'rgba(186,230,253,0.55)',fontFamily:"'JetBrains Mono',monospace"}}>PHOTOREALISTIC · RUNWARE AI</span>
                <button onClick={async()=>{setRunwareLoading(true);await generateRunwareVisualization?.({});setRunwareLoading(false);}}
                  style={{background:'rgba(212,175,55,0.12)',border:'1px solid rgba(212,175,55,0.35)',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:10,color:'#e8c14e',fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>
                  ↺ Regenerate
                </button>
              </div>
            </div>
          )}
          {/* Collapsed thumbnail */}
          {!runwareLoading && !showRunware && photoSession?.runwareVisualization?.imageUrl && (
            <button onClick={()=>setShowRunware(true)}
              style={{width:'100%',padding:'10px 14px',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:10,textAlign:'left'}}>
              <img src={photoSession.runwareVisualization.imageUrl} alt="" style={{width:44,height:44,borderRadius:8,objectFit:'cover',flexShrink:0}}/>
              <span style={{fontSize:12,color:'rgba(186,230,253,0.6)',fontFamily:"'DM Sans',sans-serif"}}>Tap to view AI garden preview</span>
              <span style={{marginLeft:'auto',fontSize:16,color:'#e8c14e'}}>›</span>
            </button>
          )}
        </div>
      )}

      <div style={{padding:'18px 20px 0'}}>
        {photoSession?.recommendations && photoSession.recommendations.length > 1 && (
          <div className="a0" style={{display:'flex',justifyContent:'center',gap:8,marginBottom:14}}>
            {photoSession.recommendations.map((_, idx)=>(
              <button
                key={idx}
                onClick={()=>setActivePhotoRecommendation?.(idx)}
                style={{
                  padding:'6px 10px',
                  border:'1px solid rgba(56,189,248,.3)',
                  background: idx === selectedRecIndex
                    ? 'rgba(56,189,248,.12)'
                    : 'rgba(56,189,248,.03)',
                  cursor:'pointer',
                }}
                className="mono"
              >
                OPTION {idx+1}
              </button>
            ))}
          </div>
        )}
        <div className="a1" style={{display:'flex',alignItems:'center',gap:10,marginBottom:18,padding:'12px 16px',background:'rgba(56,189,248,.06)',border:'1px solid rgba(56,189,248,.2)'}}>
          <Ic n="check" s={18} c={T.green}/>
          <div style={{flex:1}}>
            <div className="mono" style={{fontSize:11,color:T.green,letterSpacing:'1.5px',fontWeight:700}}>ANALYSIS COMPLETE{confidencePct ? ` · ${confidencePct}% CONFIDENCE` : ''}</div>
            <div style={{fontSize:11,color:T.textDim,marginTop:2}}>Home Rooftop · {locationResult || 'Your Location'} · {MONTHS[now.getMonth()]} {now.getFullYear()}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:22}}>
          {metrics.map((m,i)=>(
            <div key={m.l} className={`a${i+2}`} style={{background:m.bg,border:`1px solid ${m.c}28`,padding:'14px',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:'1px',background:`linear-gradient(90deg,transparent,${m.c},transparent)`}}/>
              <div style={{marginBottom:8}}><Ic n={m.ic} s={18} c={m.c}/></div>
              <div className="mono" style={{fontSize:22,fontWeight:700,color:m.c,textShadow:`0 0 14px ${m.c}60`,marginBottom:1}}>{m.v}</div>
              <div className="mono" style={{fontSize:9,letterSpacing:'1.5px',color:'rgba(186,230,253,.4)'}}>{m.l}</div>
            </div>
          ))}
        </div>
        {/* Recommended plants */}
        <div className="slabel a5">// RECOMMENDED SPECIES</div>
        {/* Filter chips */}
        <div style={{display:'flex',gap:5,marginBottom:10,flexWrap:'wrap'}}>
          {[['all','ALL ☀'],['full','FULL ☀️'],['partial','PART ⛅'],['shade','SHADE 🌑']].map(([v,l])=>(
            <button key={v} onClick={()=>setSunF(v)} className="mono" style={{padding:'3px 8px',fontSize:9,letterSpacing:'1px',background:sunF===v?'rgba(56,189,248,.15)':'rgba(56,189,248,.03)',border:`1px solid ${sunF===v?T.green:'rgba(56,189,248,.2)'}`,color:sunF===v?T.green:T.textDim,cursor:'pointer',transition:'all .15s'}}>{l}</button>
          ))}
          <span style={{alignSelf:'stretch',width:1,background:'rgba(56,189,248,.15)',margin:'0 2px'}}/>
          {[['all','WIND 💨'],['low','LOW 🌬'],['medium','MED 💨'],['high','HIGH 🌪']].map(([v,l])=>(
            <button key={`w${v}`} onClick={()=>setWindF(v)} className="mono" style={{padding:'3px 8px',fontSize:9,letterSpacing:'1px',background:windF===v?'rgba(34,211,238,.15)':'rgba(56,189,248,.03)',border:`1px solid ${windF===v?T.cyan:'rgba(56,189,248,.2)'}`,color:windF===v?T.cyan:T.textDim,cursor:'pointer',transition:'all .15s'}}>{l}</button>
          ))}
          <span style={{alignSelf:'stretch',width:1,background:'rgba(56,189,248,.15)',margin:'0 2px'}}/>
          {[['all','COOL 🌡'],['high','HIGH 🔥'],['medium','MED ✅']].map(([v,l])=>(
            <button key={`c${v}`} onClick={()=>setCoolF(v)} className="mono" style={{padding:'3px 8px',fontSize:9,letterSpacing:'1px',background:coolF===v?'rgba(255,184,0,.15)':'rgba(56,189,248,.03)',border:`1px solid ${coolF===v?T.gold:'rgba(56,189,248,.2)'}`,color:coolF===v?T.gold:T.textDim,cursor:'pointer',transition:'all .15s'}}>{l}</button>
          ))}
        </div>
        <div className="scrx a5" style={{marginBottom:22}}>
          {displaySpecies.map((p,i)=>{
            const wc=WATER_COL[p.waterNeeds]||T.green;
            const em=PTYPE_EMOJI[p.type]||'🌱';
            const sunLabel=(p.sunRequirement??[]).join('/').toUpperCase()||null;
            return(
              <div key={p.id||p.name||i} style={{minWidth:118,background:'rgba(56,189,248,.04)',border:'1px solid rgba(56,189,248,.14)',padding:'14px 12px',flexShrink:0}}>
                <div style={{fontSize:28,marginBottom:6}}>{em}</div>
                <div className="mono" style={{fontSize:11,fontWeight:700,color:T.textBright,marginBottom:4,lineHeight:1.3}}>{p.name}</div>
                {p.speciesCatalogCode&&<div className="mono" style={{fontSize:8,color:'rgba(56,189,248,.38)',marginBottom:5,letterSpacing:'1px'}}>{p.speciesCatalogCode}</div>}
                <div style={{display:'flex',flexDirection:'column',gap:3}}>
                  <div className="tag" style={{background:`${wc}18`,color:wc,border:`1px solid ${wc}40`,fontSize:9}}>H₂O {(p.waterNeeds||'').toUpperCase()}</div>
                  {sunLabel&&<div className="tag" style={{background:'rgba(255,184,0,.08)',color:T.gold,border:'1px solid rgba(255,184,0,.25)',fontSize:9}}>☀ {sunLabel}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {/* CO2 spark chart */}
        <div className="slabel a6">// CO₂ PROJECTION</div>
        <div className="a6 hud" style={{padding:'16px',marginBottom:8}}>
          <svg width="100%" height="80" viewBox="0 0 280 80">
            <defs>
              <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity=".35"/>
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d="M0,72 C50,64 120,42 190,22 C230,10 260,5 280,2 L280,80 L0,80Z" fill="url(#cg2)"/>
            <path d="M0,72 C50,64 120,42 190,22 C230,10 260,5 280,2" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" style={{strokeDasharray:400,strokeDashoffset:0,animation:'drawSVG 2s ease .3s both'}}/>
            {[{x:0,l:'Y1'},{x:140,l:'Y2'},{x:280,l:'Y3'}].map(({x,l})=><text key={l} x={x} y="78" fontSize="8" fill="rgba(56,189,248,.4)" fontFamily="JetBrains Mono" textAnchor={x===0?"start":x===280?"end":"middle"}>{l}</text>)}
          </svg>
          <div className="mono" style={{display:'flex',justifyContent:'space-between',fontSize:10,marginTop:4}}>
            <span style={{color:'rgba(186,230,253,.4)'}}>{co2BaseResult}T → {co2Year3Result}T CO₂/yr</span>
            <span style={{color:T.green}}>+{areaM2Result?Math.round((parseFloat(co2Year3Result)/parseFloat(co2BaseResult)-1)*100):200}% over 3yrs</span>
          </div>
        </div>
      </div>
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'rgba(4,9,26,.97)',padding:'12px 20px 32px',borderTop:'1px solid rgba(56,189,248,.1)',maxWidth:430,margin:'0 auto',display:'flex',flexDirection:'column',gap:10}}>
        {runwareError && (
          <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(244,63,94,0.10)',border:'1px solid rgba(244,63,94,0.30)',fontSize:11,color:'#F43F5E',fontFamily:"'DM Sans',sans-serif",lineHeight:1.4}}>
            {runwareError}
          </div>
        )}
        <button
          disabled={runwareLoading || allPlants.length === 0}
          onClick={async () => {
            setRunwareError(null);
            setRunwareLoading(true);
            // If no selectedRecommendation, pass allPlants directly so generation still works
            const opts = selectedRecommendation ? {} : {
              scoredPlants: allPlants.map((p, i) => ({
                plant: { name: p.name, type: p.type ?? 'herb', heightM: p.heightM ?? 0.5 },
                quantity: 2,
                placementZone: ['perimeter','center','container'][i % 3],
                relevanceScore: p.coolingScore ?? 50,
              })),
            };
            const result = await generateRunwareVisualization?.(opts);
            setRunwareLoading(false);
            if (result?.error) setRunwareError(result.error);
          }}
          style={{
            padding:'14px',borderRadius:14,border:'none',cursor:'pointer',
            background: runwareLoading
              ? 'rgba(212,175,55,0.12)'
              : 'linear-gradient(135deg,#7C5200,#e8c14e)',
            color: runwareLoading ? '#e8c14e' : '#0A0A0A',
            fontSize:14,fontWeight:700,fontFamily:"'DM Sans',sans-serif",
            letterSpacing:'0.3px',
            opacity: runwareLoading ? 0.7 : 1,
            display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            transition:'all .2s',
          }}
        >
          {runwareLoading ? (
            <>
              <div style={{width:14,height:14,border:'2px solid #e8c14e',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite',flexShrink:0}}/>
              Generating AI Garden…
            </>
          ) : photoSession?.runwareVisualization?.imageUrl ? (
            '↺ Regenerate AI Garden'
          ) : (
            '🌿 Generate AI Garden'
          )}
        </button>
        <button className="gbtn fill" onClick={()=>navigate('install')}>Request Installation Quote</button>
        <button className="gbtn" onClick={()=>navigate('report')}>View Full Report</button>
      </div>
    </div>
  );
};

// ── Zone colours for overlay canvas ──────────────────────────────────────
const OVERLAY_ZONE_COLORS = {
  perimeter:   { fill: 'rgba(56,189,248,0.28)',  stroke: 'rgba(56,189,248,0.85)' },
  north_wall:  { fill: 'rgba(14,116,144,0.28)',   stroke: 'rgba(14,116,144,0.85)'  },
  south_wall:  { fill: 'rgba(14,116,144,0.28)',   stroke: 'rgba(14,116,144,0.85)'  },
  east_wall:   { fill: 'rgba(14,116,144,0.28)',   stroke: 'rgba(14,116,144,0.85)'  },
  west_wall:   { fill: 'rgba(14,116,144,0.28)',   stroke: 'rgba(14,116,144,0.85)'  },
  center:      { fill: 'rgba(212,175,55,0.22)',  stroke: 'rgba(212,175,55,0.80)' },
  path:        { fill: 'rgba(180,140,80,0.18)',  stroke: 'rgba(180,140,80,0.55)' },
  container:   { fill: 'rgba(130,90,50,0.28)',   stroke: 'rgba(180,130,80,0.80)' },
  module:      { fill: 'rgba(56,189,248,0.18)',  stroke: 'rgba(56,189,248,0.60)' },
  default:     { fill: 'rgba(56,189,248,0.18)',  stroke: 'rgba(56,189,248,0.55)' },
};

/**
 * Draws zone/module/plant anchors from spatialMapping onto a canvas element.
 * Uses a mild perspective approximation (far edge compressed toward top of frame).
 */
function drawLayoutOverlay(canvas, anchors, widthM, lengthM) {
  if (!canvas || !anchors?.length || !widthM || !lengthM) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.offsetWidth;
  const h   = canvas.offsetHeight;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // Perspective transform: depth (y in meters) compresses toward top of frame.
  // Near edge (y=0) → bottom of canvas; far edge (y=lengthM) → ~15% from top.
  // Horizontal (x) is roughly linear.
  const toX = (xM) => (xM / widthM) * w;
  const toY = (yM) => {
    const frac = yM / lengthM; // 0=near, 1=far
    return h * (0.88 - frac * 0.73); // linear perspective approximation
  };
  const toSizeW = (sM) => (sM / widthM) * w;
  const toSizeH = (sM) => (sM / lengthM) * h * 0.73; // foreshortened

  for (const anchor of anchors) {
    const { type, label, positionM, sizeM } = anchor;
    if (!positionM || !sizeM) continue;

    const cx = toX(positionM.x);
    const cy = toY(positionM.y);
    const hw = toSizeW((sizeM.width  ?? 1) / 2);
    const hh = toSizeH((sizeM.length ?? 1) / 2);

    const col = OVERLAY_ZONE_COLORS[type] ?? OVERLAY_ZONE_COLORS.default;

    if (type === 'zone' || type === 'module' || type === 'planter') {
      ctx.save();
      ctx.fillStyle   = col.fill;
      ctx.strokeStyle = col.stroke;
      ctx.lineWidth   = 1.5;
      // Rounded rect (compat)
      const rx = cx - hw, ry = cy - hh, rw = hw * 2, rh = hh * 2, r = 4;
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + rw - r, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
      ctx.lineTo(rx + rw, ry + rh - r);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
      ctx.lineTo(rx + r, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
      ctx.lineTo(rx, ry + r);
      ctx.quadraticCurveTo(rx, ry, rx + r, ry);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Label
      if (label) {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = `bold ${Math.max(8, Math.min(12, hw * 0.4))}px 'DM Sans', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Shadow for legibility
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(label.length > 14 ? label.slice(0, 12) + '…' : label, cx, cy);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    } else if (type === 'plant' || type === 'planting') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(56,189,248,0.95)';
      ctx.strokeStyle = '#BAE6FD';
      ctx.lineWidth   = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // Dimension annotations (bottom-left corner)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.rect(6, h - 26, 110, 20);
  ctx.fill();
  ctx.fillStyle = 'rgba(56,189,248,0.95)';
  ctx.font = "bold 9px 'DM Mono', monospace";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${widthM.toFixed(1)}m × ${lengthM.toFixed(1)}m`, 12, h - 16);
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════════
   BEFORE / AFTER VISUALIZATION SCREEN
══════════════════════════════════════════════════════════════════ */
const BeforeAfterVisualizationScreen = ({ navigate, photoSession, selectedRecommendation, generatePhotoVisualization }) => {
  const [visLoading, setVisLoading] = useState(false);
  const [mode, setMode] = useState("slider"); // 'slider' | 'side' | 'overlay'
  const [sliderPos, setSliderPos] = useState(50); // percentage
  const sliderContainerRef = useRef(null);
  const overlayCanvasRef   = useRef(null);
  const autoVisTriggeredRef = useRef(false);

  const rec = photoSession?.selectedRecommendation || selectedRecommendation;
  const spatialMapping = rec ? createSpatialMappingFromRecommendation(rec) : null;
  const heatSummary = rec?.heatReductionSummary || null;
  const cost = rec?.candidate?.costEstimate || null;
  const modules = rec?.candidate?.resolvedModules || [];
  const layoutName = rec?.candidate?.template?.name || rec?.explanation?.headline || "HeatWise layout";
  const measuredW = photoSession?.widthM ?? null;
  const measuredL = photoSession?.lengthM ?? null;
  const measuredFloor = photoSession?.floorLevel ?? null;

  // Auto-generate visualization when entering this screen if not already done
  useEffect(() => {
    if (autoVisTriggeredRef.current) return;
    if (photoSession?.generatedVisualization?.imageUrl) return;
    if (!photoSession?.capturedPhoto || !rec) return;
    autoVisTriggeredRef.current = true;
    setVisLoading(true);
    generatePhotoVisualization?.().finally(() => setVisLoading(false));
  }, [photoSession?.capturedPhoto, photoSession?.generatedVisualization?.imageUrl, rec]);

  // Draw zone overlay whenever overlay mode is active or anchors change
  useEffect(() => {
    if (mode !== 'overlay') return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const anchors = spatialMapping?.anchors ?? [];
    const w = measuredW ?? 6;
    const l = measuredL ?? 7;
    // Slight delay so the canvas has rendered its layout dimensions
    const id = setTimeout(() => drawLayoutOverlay(canvas, anchors, w, l), 50);
    return () => clearTimeout(id);
  }, [mode, spatialMapping, measuredW, measuredL]);

  // Touch/mouse drag on the slider image
  const handleSliderPointerMove = useCallback((clientX) => {
    const el = sliderContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handleSliderMouseMove = useCallback((e) => {
    if (e.buttons !== 1) return;
    handleSliderPointerMove(e.clientX);
  }, [handleSliderPointerMove]);

  const handleSliderTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length > 0) handleSliderPointerMove(e.touches[0].clientX);
  }, [handleSliderPointerMove]);

  const plants = (() => {
    // Best-effort extraction across possible schema shapes.
    const schema = rec?.layoutSchema;
    const out = [];
    const pushName = (n) => {
      if (!n) return;
      const name = String(n).trim();
      if (!name) return;
      if (!out.includes(name)) out.push(name);
    };

    if (Array.isArray(schema?.plants)) {
      for (const p of schema.plants) pushName(p?.name ?? p?.id ?? p);
    }
    if (Array.isArray(schema?.zones)) {
      for (const z of schema.zones) {
        if (Array.isArray(z?.plants)) for (const p of z.plants) pushName(p?.name ?? p?.id ?? p);
        if (Array.isArray(z?.plantings)) for (const p of z.plantings) pushName(p?.name ?? p?.id ?? p);
      }
    }
    if (Array.isArray(schema?.modules)) {
      for (const m of schema.modules) {
        // some engines embed plant suggestions per module
        if (Array.isArray(m?.plants)) for (const p of m.plants) pushName(p?.name ?? p?.id ?? p);
      }
    }
    return out;
  })();

  return (
    <div style={{ paddingBottom: 100, minHeight: "100dvh", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "rgba(242,243,247,0.92)" }}>
      <div className="navbar">
        <button
          onClick={()=>navigate('result')}
          style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}
        >
          <Ic n="back" s={22} c={T.green}/>
        </button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <div className="mono" style={{fontSize:12,fontWeight:700,letterSpacing:'3px',color:T.textBright}}>BEFORE / AFTER</div>
          <div className="mono" style={{fontSize:9,color:'rgba(56,189,248,.4)',letterSpacing:'1px'}}>VISUALIZATION</div>
        </div>
      </div>
      <div className="hprog"><div className="hprog-fill" style={{width:'100%'}}/></div>
      <div style={{padding:'16px 20px 110px',display:'flex',flexDirection:'column',gap:18}}>
        {/* Comparison mode toggle */}
        <div style={{display:'flex',justifyContent:'flex-end',gap:6}}>
          <button
            className={`chip${mode==='slider'?' on':''}`}
            onClick={()=>setMode('slider')}
          >
            SLIDER
          </button>
          <button
            className={`chip${mode==='side'?' on':''}`}
            onClick={()=>setMode('side')}
          >
            SIDE BY SIDE
          </button>
          <button
            className={`chip${mode==='overlay'?' on':''}`}
            onClick={()=>setMode('overlay')}
          >
            LAYOUT
          </button>
        </div>

        {/* Before / After images */}
        <div className="hud" style={{padding:12}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div className="slabel">
              {mode === 'overlay' ? 'LAYOUT OVERLAY' : 'PHOTO COMPARISON'}
            </div>
            {visLoading && (
              <div className="mono" style={{fontSize:9,color:T.green,letterSpacing:'1px',animation:'pulse 1.5s infinite'}}>
                GENERATING…
              </div>
            )}
          </div>
          {mode === 'overlay' ? (
            /* ── Layout zone overlay on top of captured photo ── */
            <div style={{position:'relative',border:'1px solid rgba(56,189,248,.25)',background:'#000',height:260,overflow:'hidden',borderRadius:8}}>
              {photoSession?.capturedPhoto ? (
                <img
                  src={photoSession.capturedPhoto}
                  alt="Captured space"
                  draggable={false}
                  style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:0.75}}
                />
              ) : (
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span className="mono" style={{fontSize:10,color:T.textDim}}>No photo captured</span>
                </div>
              )}
              {/* Canvas overlay */}
              <canvas
                ref={overlayCanvasRef}
                style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
              />
              {/* Legend */}
              <div style={{position:'absolute',top:8,right:8,background:'rgba(4,9,26,0.82)',borderRadius:6,padding:'6px 8px',display:'flex',flexDirection:'column',gap:3}}>
                {[
                  { color:'rgba(56,189,248,0.8)',  label:'Planting Zone'  },
                  { color:'rgba(212,175,55,0.8)',   label:'Central Bed'    },
                  { color:'rgba(180,130,60,0.8)',   label:'Container/Pot'  },
                  { color:'rgba(180,140,80,0.65)',  label:'Path'           },
                ].map(({ color, label }) => (
                  <div key={label} style={{display:'flex',alignItems:'center',gap:5}}>
                    <div style={{width:10,height:10,borderRadius:2,background:color,flexShrink:0}}/>
                    <span className="mono" style={{fontSize:8,color:'rgba(186,230,253,.8)',letterSpacing:'0.5px'}}>{label}</span>
                  </div>
                ))}
              </div>
              {/* No anchors fallback */}
              {(!spatialMapping?.anchors?.length) && (
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div className="mono" style={{fontSize:10,color:T.textDim,background:'rgba(0,0,0,.6)',padding:'8px 14px',borderRadius:6,textAlign:'center'}}>
                    Layout overlay unavailable — no spatial anchors
                  </div>
                </div>
              )}
            </div>
          ) : mode === "side" ? (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <div className="mono" style={{fontSize:9,letterSpacing:'1.5px',color:T.textDim,marginBottom:4}}>BEFORE</div>
                <div style={{border:'1px solid rgba(56,189,248,.25)',background:'#000',height:190,overflow:'hidden',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {photoSession?.capturedPhoto ? (
                    <img
                      src={photoSession.capturedPhoto}
                      alt="Original rooftop"
                      style={{width:'100%',height:'100%',objectFit:'cover'}}
                    />
                  ) : (
                    <span className="mono" style={{fontSize:10,color:T.textDim}}>No photo captured</span>
                  )}
                </div>
              </div>
              <div>
                <div className="mono" style={{fontSize:9,letterSpacing:'1.5px',color:T.textDim,marginBottom:4}}>AFTER</div>
                <div style={{border:'1px solid rgba(56,189,248,.25)',background:'#000',height:190,overflow:'hidden',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
                  {photoSession?.generatedVisualization?.imageUrl ? (
                    <img
                      src={photoSession.generatedVisualization.imageUrl}
                      alt="Garden visualization"
                      style={{width:'100%',height:'100%',objectFit:'cover'}}
                    />
                  ) : photoSession?.capturedPhoto && visLoading ? (
                    <>
                      <img src={photoSession.capturedPhoto} alt="Generating…" style={{width:'100%',height:'100%',objectFit:'cover',opacity:.4}}/>
                      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
                        <div style={{width:28,height:28,border:'2px solid #38BDF8',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                        <div className="mono" style={{fontSize:9,color:T.green,letterSpacing:'1.5px'}}>TRANSFORMING</div>
                      </div>
                    </>
                  ) : (
                    <span className="mono" style={{fontSize:10,color:T.textDim,textAlign:'center',padding:'0 8px'}}>
                      {photoSession?.capturedPhoto ? 'Generating visualization…' : 'No photo captured'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Drag-to-reveal slider */
            <div
              ref={sliderContainerRef}
              onMouseMove={handleSliderMouseMove}
              onMouseDown={e => handleSliderPointerMove(e.clientX)}
              onTouchMove={handleSliderTouchMove}
              onTouchStart={e => { if (e.touches.length > 0) handleSliderPointerMove(e.touches[0].clientX); }}
              style={{position:'relative',border:'1px solid rgba(56,189,248,.25)',background:'#111',height:260,overflow:'hidden',borderRadius:8,cursor:'ew-resize',userSelect:'none',touchAction:'none'}}
            >
              {/* Base: original photo (BEFORE) */}
              {photoSession?.capturedPhoto ? (
                <img
                  src={photoSession.capturedPhoto}
                  alt="Original rooftop"
                  draggable={false}
                  style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}
                />
              ) : (
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span className="mono" style={{fontSize:10,color:T.textDim}}>No photo captured</span>
                </div>
              )}

              {/* Overlay: generated visual, clipped by slider (AFTER) */}
              {photoSession?.generatedVisualization?.imageUrl ? (
                <div style={{position:'absolute',top:0,left:0,bottom:0,width:`${sliderPos}%`,overflow:'hidden'}}>
                  <img
                    src={photoSession.generatedVisualization.imageUrl}
                    alt="Garden visualization"
                    draggable={false}
                    style={{position:'absolute',top:0,left:0,width:sliderContainerRef.current ? `${sliderContainerRef.current.offsetWidth}px` : '100%',height:'100%',objectFit:'cover',maxWidth:'none'}}
                  />
                </div>
              ) : visLoading && photoSession?.capturedPhoto ? (
                /* Loading shimmer on top of before photo */
                <div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,rgba(56,189,248,0) 0%,rgba(56,189,248,.18) 50%,rgba(56,189,248,0) 100%)',backgroundSize:'200% 100%',animation:'shimmer 1.5s infinite',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10}}>
                  <div style={{width:36,height:36,border:'3px solid #38BDF8',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                  <div className="mono" style={{fontSize:10,color:'#38BDF8',letterSpacing:'2px',textShadow:'0 0 12px rgba(56,189,248,.8)'}}>TRANSFORMING YOUR ROOFTOP</div>
                  <div className="mono" style={{fontSize:9,color:'rgba(56,189,248,.6)',letterSpacing:'1px'}}>AI is planting your garden…</div>
                </div>
              ) : null}

              {/* Divider line + handle */}
              {photoSession?.generatedVisualization?.imageUrl && (
                <div style={{position:'absolute',top:0,bottom:0,left:`${sliderPos}%`,transform:'translateX(-50%)',pointerEvents:'none',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:0}}>
                  <div style={{width:2,height:'100%',background:'rgba(56,189,248,.8)',boxShadow:'0 0 12px rgba(56,189,248,.6)',position:'absolute',top:0}}/>
                  <div style={{position:'relative',zIndex:2,width:36,height:36,borderRadius:'50%',background:'rgba(4,9,22,.9)',border:'2px solid #38BDF8',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 16px rgba(56,189,248,.5)'}}>
                    <span style={{fontSize:14,color:'#38BDF8',fontWeight:700,letterSpacing:0}}>⟺</span>
                  </div>
                </div>
              )}

              {/* Labels */}
              <div className="mono" style={{position:'absolute',top:10,left:10,fontSize:9,letterSpacing:'1.5px',color:'rgba(255,255,255,.7)',background:'rgba(0,0,0,.5)',padding:'3px 7px',borderRadius:4,pointerEvents:'none'}}>BEFORE</div>
              {photoSession?.generatedVisualization?.imageUrl && (
                <div className="mono" style={{position:'absolute',top:10,right:10,fontSize:9,letterSpacing:'1.5px',color:'rgba(56,189,248,.9)',background:'rgba(0,0,0,.5)',padding:'3px 7px',borderRadius:4,pointerEvents:'none'}}>AFTER</div>
              )}

              {/* Hint text when no visualization yet and not loading */}
              {!photoSession?.generatedVisualization?.imageUrl && !visLoading && (
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div className="mono" style={{fontSize:10,color:T.textDim,background:'rgba(0,0,0,.6)',padding:'8px 14px',borderRadius:6,textAlign:'center'}}>
                    Tap "Generate Visualization" below
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trust & explainability */}
        {rec && (
          <div className="hud" style={{padding:14}}>
            <div className="slabel" style={{marginBottom:8}}>BASED ON YOUR SELECTED LAYOUT</div>
            <div className="mono" style={{fontSize:11,color:T.textBright,marginBottom:6}}>
              {layoutName}
            </div>
            <div className="mono" style={{fontSize:10,color:"rgba(186,230,253,.7)",letterSpacing:"1px",lineHeight:1.6}}>
              This image is a <span style={{color:T.gold}}>concept visualization</span> based on your <span style={{color:T.green}}>selected recommendation</span> and <span style={{color:T.cyan}}>measured dimensions</span>.
              <br/>
              It may differ from exact installation details (lighting, plant maturity, textures, and perspective).
            </div>
            <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div className="slabel" style={{marginBottom:6}}>MEASURED INPUTS</div>
                <div className="mono" style={{fontSize:10,color:T.textDim,lineHeight:1.7}}>
                  Width: {measuredW ? `${Number(measuredW).toFixed(1)} m` : "—"}
                  <br/>
                  Length: {measuredL ? `${Number(measuredL).toFixed(1)} m` : "—"}
                  <br/>
                  Floor: {measuredFloor ?? "—"}
                </div>
              </div>
              <div>
                <div className="slabel" style={{marginBottom:6}}>LAYOUT INGREDIENTS</div>
                <div className="mono" style={{fontSize:10,color:T.textDim,lineHeight:1.7}}>
                  Modules: {modules?.length ? modules.length : "—"}
                  <br/>
                  Plants: {plants?.length ? plants.length : "—"}
                </div>
              </div>
            </div>

            {/* Confidence / realism guidance */}
            <div style={{marginTop:12,borderTop:"1px solid rgba(56,189,248,.10)",paddingTop:10}}>
              <div className="slabel" style={{marginBottom:6}}>CONFIDENCE / REALISM</div>
              <div className="mono" style={{fontSize:10,color:"rgba(186,230,253,.7)",letterSpacing:"1px",lineHeight:1.65}}>
                - Best realism when the original photo is bright, level, and shows full edges of the usable area.<br/>
                - Plants shown represent the selected layout’s intent; exact species/placement can vary during installation.<br/>
                - If your measurement confidence was low, treat dimensions and spacing as approximate.
              </div>
              {heatSummary?.confidence && (
                <div className="mono" style={{fontSize:10,color:T.textDim,marginTop:8}}>
                  Model confidence: <span style={{color:T.green}}>{heatSummary.confidence}</span>
                </div>
              )}
            </div>

            {(modules?.length > 0 || plants?.length > 0) && (
              <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <div className="slabel" style={{marginBottom:6}}>KEY MODULES USED</div>
                  <div className="mono" style={{fontSize:10,color:T.textDim,lineHeight:1.7}}>
                    {modules.slice(0,6).map((m) => (
                      <div key={m.id || m.name}>
                        - {m.name || m.id}
                      </div>
                    ))}
                    {modules.length > 6 && <div>… +{modules.length - 6} more</div>}
                  </div>
                </div>
                <div>
                  <div className="slabel" style={{marginBottom:6}}>KEY PLANTS USED</div>
                  <div className="mono" style={{fontSize:10,color:T.textDim,lineHeight:1.7}}>
                    {plants.slice(0,8).map((p) => (
                      <div key={p}>
                        - {p}
                      </div>
                    ))}
                    {plants.length > 8 && <div>… +{plants.length - 8} more</div>}
                    {plants.length === 0 && <div>—</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommendation summary */}
        {rec && (
          <div className="hud" style={{padding:14}}>
            <div className="slabel" style={{marginBottom:8}}>RECOMMENDATION SUMMARY</div>
            <div className="mono" style={{fontSize:11,color:T.textBright,marginBottom:2}}>
              {layoutName}
            </div>
            <div style={{fontSize:11,color:T.textDim,marginBottom:10}}>
              {rec.explanation?.summary || "AI-recommended rooftop layout tuned for cooling, water use, and maintenance."}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr',gap:10}}>
              <div>
                <div className="slabel" style={{marginBottom:6}}>HEAT REDUCTION</div>
                {heatSummary ? (
                  <div className="mono" style={{fontSize:11,color:T.green}}>
                    −{heatSummary.estimatedDropC.toFixed(1)}°C surface cooling
                    <div style={{fontSize:10,color:'rgba(186,230,253,.7)',marginTop:4}}>
                      Plant {(heatSummary.plantCoverageRatio*100).toFixed(0)}% ·
                      Shade {(heatSummary.shadeCoverageRatio*100).toFixed(0)}% ·
                      Reflective {(heatSummary.reflectiveCoverageRatio*100).toFixed(0)}% ·
                      {heatSummary.confidence} confidence
                    </div>
                  </div>
                ) : (
                  <div className="mono" style={{fontSize:10,color:T.textDim}}>Cooling estimate not available.</div>
                )}
              </div>
              <div>
                <div className="slabel" style={{marginBottom:6}}>COST SNAPSHOT</div>
                {cost ? (
                  <div className="mono" style={{fontSize:10,color:T.textDim}}>
                    Materials: {Math.round(cost.totalMin)}–{Math.round(cost.totalMax)} {cost.currency || "₹"}
                    <br/>
                    Install: {Math.round(cost.labourMin)}–{Math.round(cost.labourMax)} {cost.currency || "₹"}
                    <br/>
                    Annual maintenance: {Math.round(cost.annualMaintenance)} {cost.currency || "₹"}
                    <br/>
                    ROI ≈ {Math.round(cost.roiMonths)} months
                  </div>
                ) : (
                  <div className="mono" style={{fontSize:10,color:T.textDim}}>Cost estimate not available.</div>
                )}
              </div>
            </div>
            {modules && modules.length > 0 && (
              <div style={{marginTop:10}}>
                <div className="slabel" style={{marginBottom:4}}>KEY MODULES</div>
                <div className="scrx">
                  {modules.slice(0,6).map((m)=>(
                    <div key={m.id} style={{minWidth:110,background:'rgba(56,189,248,.04)',border:'1px solid rgba(56,189,248,.16)',padding:'10px 10px'}}>
                      <div className="mono" style={{fontSize:11,color:T.textBright,marginBottom:2}}>{m.name}</div>
                      <div style={{fontSize:10,color:T.textDim,marginBottom:4,textTransform:'uppercase',letterSpacing:'1px'}}>{m.type}</div>
                      <div className="mono" style={{fontSize:9,color:'rgba(186,230,253,.7)'}}>
                        {m.widthM}×{m.lengthM}m · qty {m.quantitySuggested ?? 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prompt snippet (optional) */}
        {photoSession?.generatedVisualization?.prompt && (
          <div className="hud" style={{padding:12}}>
            <div className="slabel" style={{marginBottom:6}}>AI VISUALIZATION CONTEXT</div>
            <div className="mono" style={{fontSize:9,color:T.textDim,maxHeight:80,overflowY:'auto'}}>
              {photoSession.generatedVisualization.prompt}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'rgba(4,9,26,.97)',padding:'12px 20px 32px',borderTop:'1px solid rgba(56,189,248,.1)',maxWidth:430,margin:'0 auto',display:'flex',flexDirection:'column',gap:10}}>
        <button
          className="gbtn"
          disabled={visLoading || !photoSession?.capturedPhoto || !rec}
          onClick={async ()=>{
            setVisLoading(true);
            autoVisTriggeredRef.current = true; // prevent double-trigger
            await generatePhotoVisualization?.();
            setVisLoading(false);
          }}
        >
          {visLoading
            ? "Transforming Your Rooftop…"
            : photoSession?.generatedVisualization?.imageUrl
              ? "Regenerate Visualization"
              : "Generate Visualization"}
        </button>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <button className="gbtn" onClick={()=>navigate('report')}>Full Report</button>
          <button className="gbtn fill" onClick={()=>navigate('install')}>Get Quote</button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   DETAILED REPORT
══════════════════════════════════════════════════════════════════ */
function snapshotProjectInputForReport(ps) {
  if (!ps) return {};
  const meta = ps.projectMeta ?? {};
  const env = ps.environment ?? {};
  const goalKey = meta.primaryGoal ?? "cooling";
  return {
    spaceType: meta.surfaceType ?? "rooftop",
    widthM: ps.widthM ?? 6,
    lengthM: ps.lengthM ?? 7,
    floorLevel: ps.floorLevel ?? 1,
    sunExposure: env.sunExposure ?? "full",
    windLevel: env.windLevel ?? "medium",
    waterAccess: true,
    budgetRange: "medium",
    maintenanceLevel: "moderate",
    primaryGoal: goalKey === "cooling" ? "cooling" : "mixed",
  };
}

/**
 * Map POST /api/recommendations/generate `telemetryMeta` → create-session payload (stable, backward compatible).
 */
function telemetrySessionFieldsFromGenerateMeta(telemetryMeta, generateLatencyMs) {
  const latencyRaw = Number(generateLatencyMs);
  const latencyMs = Number.isFinite(latencyRaw) && latencyRaw >= 0 ? Math.floor(latencyRaw) : 0;
  if (!telemetryMeta || typeof telemetryMeta !== "object") {
    return {
      generatorSource: "live_rules",
      rulesVersion: "rules-v1",
      modelVersion: "heatwise-app-v1",
      candidateSource: "live_rules",
      latencyMs,
    };
  }
  const parts = [
    telemetryMeta.modelVersionFeasibility,
    telemetryMeta.modelVersionHeat,
    telemetryMeta.modelVersionRanking,
  ]
    .map((x) => (x == null ? "" : String(x).trim()))
    .filter(Boolean);
  const modelVersion = parts.length > 0 ? parts.join("|") : "heatwise-app-v1";
  const generatorSource =
    typeof telemetryMeta.generatorSource === "string" && telemetryMeta.generatorSource.trim()
      ? telemetryMeta.generatorSource.trim()
      : "live_rules";
  const rulesVersion =
    typeof telemetryMeta.rulesVersion === "string" && telemetryMeta.rulesVersion.trim()
      ? telemetryMeta.rulesVersion.trim()
      : "rules-v1";
  return {
    generatorSource,
    rulesVersion,
    modelVersion,
    candidateSource: generatorSource,
    latencyMs,
  };
}

/**
 * Primary path POST /api/recommendations/generate (`layoutGeneration`).
 * Phase 4: server sets `layoutSlate` for eligibility/failures; falls back to POST /api/generate-layout only when no layout recs.
 * Duplicate RecommendationRun from fallback is suppressed server-side (fingerprint + time window).
 */
async function fetchLayoutRecommendationsForSession(photoSession, userId) {
  const body = buildRecommendationGenerateRequestFromPhotoSession(photoSession ?? {}, {
    userId: userId ?? null,
  });
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  let res = await fetch("/api/recommendations/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = res.ok ? await res.json() : null;
  } catch {
    data = null;
  }
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const generateLatencyMs = Math.max(0, Math.round(t1 - t0));
  const telemetryMeta =
    data && typeof data === "object" && data.telemetryMeta && typeof data.telemetryMeta === "object"
      ? data.telemetryMeta
      : null;
  const recs = layoutRecommendationsFromGenerateResponse(data);
  if (recs.length > 0) {
    return { recommendations: recs, telemetryMeta, generateLatencyMs, layoutSource: "canonical" };
  }

  if (typeof console !== "undefined" && console.warn) {
    const ls = data?.layoutSlate;
    console.warn(
      "[HeatWise] No layout recommendations from /api/recommendations/generate",
      ls ? { layoutSlate: ls } : {},
      "— falling back to /api/generate-layout if applicable",
    );
  }
  const legacyBody = buildGenerateLayoutRequestBody(photoSession ?? {});
  res = await fetch("/api/generate-layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(legacyBody),
  });
  try {
    data = res.ok ? await res.json() : null;
  } catch {
    data = null;
  }
  const legacyRecs = Array.isArray(data?.recommendations) ? data.recommendations : [];
  return {
    recommendations: legacyRecs,
    telemetryMeta: null,
    generateLatencyMs,
    layoutSource: "legacy_layout",
  };
}

/** Registers candidates for telemetry, dossier, mark-select, and installer quote APIs. */
async function createRecommendationTelemetrySessionFromClient(sessionSnapshot, recs, userId) {
  if (!userId || !sessionSnapshot?.projectId || !recs?.length) return null;
  try {
    const telFields = telemetrySessionFieldsFromGenerateMeta(
      sessionSnapshot.recommendationGenerateTelemetryMeta,
      sessionSnapshot.recommendationGenerateLatencyMs,
    );
    const candidates = recs.map((r, i) => ({
      candidateRank: i + 1,
      candidateSource: telFields.candidateSource,
      candidatePayload: JSON.parse(JSON.stringify(r)),
      speciesPayload: buildSpeciesPayloadForTelemetrySnapshot(r),
      wasShownToUser: true,
    }));
    const inputPayload = snapshotProjectInputForReport(sessionSnapshot);
    const res = await fetch("/api/recommendations/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: sessionSnapshot.projectId,
        userId,
        photoSessionId: sessionSnapshot.id,
        modelVersion: telFields.modelVersion,
        rulesVersion: telFields.rulesVersion,
        generatorSource: telFields.generatorSource,
        projectSnapshot: { ...inputPayload, projectName: sessionSnapshot.projectMeta?.name ?? null },
        environmentSnapshot: sessionSnapshot.environment ?? {},
        preferenceSnapshot: {},
        totalCandidates: candidates.length,
        latencyMs: telFields.latencyMs,
        candidates,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return {
      recommendationSessionId: data.recommendationSessionId,
      candidateSnapshotIds: data.candidateSnapshotIds ?? [],
    };
  } catch {
    return null;
  }
}

const ReportScreen = ({ navigate, selectedRecommendation, photoSession, me, setPhotoSession }) => {
  const [tab,setTab]=useState(0);const [exp,setExp]=useState(null);
  const [dossierBusy,setDossierBusy]=useState(false);
  const [dossierErr,setDossierErr]=useState(null);
  const[lastDossierId,setLastDossierId]=useState(null);
  const[userReport,setUserReport]=useState(null);
  const reportOpenedRef = useRef(false);
  useEffect(() => {
    if (reportOpenedRef.current) return;
    const sid = photoSession?.recommendationTelemetrySessionId;
    const pid = photoSession?.projectId;
    if (!sid || !pid || !me?.id) return;
    reportOpenedRef.current = true;
    void postLearningTelemetryEvent({
      sessionId: sid,
      projectId: pid,
      userId: me.id,
      eventType: "report_opened",
      screenName: "report",
      metadata: {
        speciesCatalogCodes: extractSpeciesCatalogCodesFromRecommendation(selectedRecommendation),
      },
    });
  }, [photoSession?.recommendationTelemetrySessionId, photoSession?.projectId, me?.id, selectedRecommendation]);
  const heatSummary = selectedRecommendation?.heatReductionSummary || null;
  const tabs=['THERMAL','SPECIES','IMPACT'];
  const repTitle=photoSession?.projectMeta?.name
    ? `${photoSession.projectMeta.name} · ${photoSession.projectMeta.location || "Patiāla"}`
    : "Home Rooftop · Patiāla, Punjab";
  return(
    <div style={{paddingBottom:20}}>
      <div className="navbar">
        <button onClick={()=>navigate('result')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><Ic n="back" s={22} c={T.green}/></button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <div style={{fontSize:14,fontWeight:700,letterSpacing:'.5px',color:T.textBright,fontFamily:"'Space Grotesk',sans-serif"}}>Full Report</div>
        </div>
        <button type="button" style={{background:'none',border:'none',cursor:'pointer',display:'flex',marginLeft:'auto'}} aria-label="Export"><Ic n="dl" s={18} c={T.green}/></button>
      </div>
      {/* Report header */}
      <div style={{background:'linear-gradient(135deg,#07102B,#04091A)',padding:'18px 20px',margin:'0 20px 16px',border:'1px solid rgba(56,189,248,.2)',borderRadius:14,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,#38BDF8,transparent)'}}/>
        <div className="mono" style={{fontSize:9,letterSpacing:'2px',color:'rgba(56,189,248,.5)',marginBottom:4}}>// HEATWISE ANALYSIS REPORT · v2.1</div>
        <div style={{fontSize:17,fontWeight:700,color:T.textBright,marginBottom:2}}>{repTitle}</div>
        <div className="mono" style={{fontSize:10,color:T.textDim}}>{heatSummary?`${heatSummary.confidence} confidence · live layout`:"Summary · open options below"}</div>
        <div style={{position:'absolute',top:16,right:20}}>
          <div className="mono ng" style={{fontSize:32,fontWeight:800}}>A</div>
          <div style={{fontSize:9,color:'rgba(56,189,248,.5)',letterSpacing:'.5px',textAlign:'center',fontFamily:"'DM Sans',sans-serif"}}>Grade</div>
        </div>
      </div>
      {/* Tabs */}
      <div style={{display:'flex',borderBottom:'1px solid rgba(56,189,248,.1)',marginBottom:16}}>
        {tabs.map((t,i)=>(
          <button key={t} onClick={()=>setTab(i)} style={{flex:1,padding:'12px 0',background:'none',border:'none',borderBottom:`2px solid ${tab===i?T.green:'transparent'}`,color:tab===i?T.green:'rgba(186,230,253,.4)',fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:'2px',cursor:'pointer',transition:'all .2s',boxShadow:tab===i?`inset 0 -2px 8px rgba(56,189,248,.3)`:'none'}}>{t}</button>
        ))}
      </div>
      <div style={{padding:'0 20px 12px'}}>
        <div className="a2" style={{padding:12,marginBottom:12}}>
          <div className="slabel" style={{marginBottom:8}}>SERVER REPORT (DOSSIER)</div>
          <p style={{fontSize:11,color:T.textDim,lineHeight:1.6,marginBottom:10}}>
            Registers this recommendation run and loads the homeowner summary from the API (needs a saved project).
          </p>
          {dossierErr && (
            <div className="mono" style={{fontSize:10,color:T.orange,marginBottom:8}}>{dossierErr}</div>
          )}
          <button
            type="button"
            className="gbtn fill"
            disabled={dossierBusy || !photoSession?.projectId || !me?.id}
            onClick={async ()=>{
              setDossierErr(null);
              setUserReport(null);
              const recs=photoSession?.recommendations?.length
                ? photoSession.recommendations
                : (selectedRecommendation?[selectedRecommendation]:[]);
              if(!recs.length){
                setDossierErr("No recommendations loaded. Run analysis from the environment step.");
                return;
              }
              setDossierBusy(true);
              try{
                let sessionId=photoSession.recommendationTelemetrySessionId;
                let snapshotIds=photoSession.telemetryCandidateSnapshotIds || [];
                const haveTel=sessionId && snapshotIds.length===recs.length;
                if(!haveTel){
                  const created=await createRecommendationTelemetrySessionFromClient(photoSession,recs,me.id);
                  if(!created) throw new Error("Could not register recommendation session");
                  sessionId=created.recommendationSessionId;
                  snapshotIds=created.candidateSnapshotIds;
                  setPhotoSession?.(prev=>({
                    ...prev,
                    recommendationTelemetrySessionId:sessionId,
                    telemetryCandidateSnapshotIds:snapshotIds,
                  }));
                }
                const selIdx=recs.findIndex(r=>r===selectedRecommendation);
                const selectedCandidateSnapshotId=snapshotIds[selIdx >= 0 ? selIdx : 0] ?? null;
                const dr=await fetch("/api/reports/recommendation-dossier",{
                  method:"POST",
                  headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({
                    recommendationSessionId:sessionId,
                    dossierType:"user_final_recommendation",
                    userId:me.id,
                    selectedCandidateSnapshotId,
                  }),
                });
                const dd=await dr.json().catch(()=>({}));
                if(!dr.ok){
                  throw new Error(dd?.error?.message || dd?.message || "dossier create failed");
                }
                const dossierId=dd.recommendationDossierId;
                setLastDossierId(dossierId);
                const ur=await fetch(`/api/reports/user-report?dossierId=${encodeURIComponent(dossierId)}&format=demo`);
                const ud=await ur.json().catch(()=>null);
                if(!ur.ok){
                  throw new Error(ud?.error?.message || "user-report failed");
                }
                setUserReport(ud);
              }catch(e){
                setDossierErr(e instanceof Error?e.message:String(e));
              }finally{
                setDossierBusy(false);
              }
            }}
          >
            {dossierBusy?"Building Report…":"Generate Dossier + User Summary"}
          </button>
          {!photoSession?.projectId && (
            <div className="mono" style={{fontSize:9,color:T.gold,marginTop:8}}>Create a project on the New Scan flow so a projectId exists.</div>
          )}
          {userReport?.summary && (
            <div className="hud" style={{padding:12,marginTop:12,maxHeight:280,overflowY:"auto"}}>
              <pre className="mono" style={{fontSize:9,color:T.textDim,margin:0,whiteSpace:"pre-wrap",lineHeight:1.5}}>
                {JSON.stringify(userReport.summary,null,2)}
              </pre>
            </div>
          )}
          {lastDossierId && (
            <div className="mono" style={{fontSize:9,color:T.textDim,marginTop:8}}>dossierId: {lastDossierId}</div>
          )}
        </div>
      </div>
      <div style={{padding:'0 20px'}}>
        {tab===0&&(
          <div>
            <div style={{background:'linear-gradient(135deg,rgba(56,189,248,.12),rgba(56,189,248,.06))',border:'1px solid rgba(56,189,248,.25)',padding:20,marginBottom:16,textAlign:'center'}}>
              <div className="mono" style={{fontSize:9,letterSpacing:'2px',color:'rgba(56,189,248,.6)',marginBottom:4}}>SURFACE TEMP REDUCTION</div>
              <div className="mono ng" style={{fontSize:52,fontWeight:700}}>
                {heatSummary
                  ? `−${heatSummary.estimatedDropC.toFixed(1)}°C`
                  : "−3.8°C"}
              </div>
              <div className="mono" style={{fontSize:10,color:T.textDim}}>
                {heatSummary
                  ? `Plant ${(heatSummary.plantCoverageRatio*100).toFixed(0)}% · Shade ${(heatSummary.shadeCoverageRatio*100).toFixed(0)}% · Reflective ${(heatSummary.reflectiveCoverageRatio*100).toFixed(0)}% · ${heatSummary.confidence} confidence`
                  : "42 m² installation · Summer 2026"}
              </div>
            </div>
            {[{l:'Without treatment',v:82,c:T.orange,deg:'42°C'},{l:'With HeatWise',v:35,c:T.green,deg:heatSummary?`${(42-heatSummary.estimatedDropC).toFixed(1)}°C`:'38.2°C'}].map(b=>(
              <div key={b.l} className="a2" style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span className="mono" style={{fontSize:10,color:T.textDim,letterSpacing:'1px'}}>{b.l}</span>
                  <span className="mono" style={{fontSize:12,fontWeight:700,color:b.c}}>{b.deg}</span>
                </div>
                <div style={{height:6,background:'rgba(56,189,248,.08)',position:'relative'}}>
                  <div style={{height:'100%',width:`${b.v}%`,background:b.c,boxShadow:`0 0 8px ${b.c}80`}}/>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab===1&&(
          <div>
            {(()=>{
              const PTYPE_E2={succulent:'🌵',grass:'🌾',herb:'🌿',climber:'🍃',perennial:'🌸',shrub:'🌳',vegetable:'🥬',foliage:'🪴',creeper:'🍃',ornamental:'🌺'};
              const repPlants=(selectedRecommendation?.candidate?.scoredPlants??[]).map(sp=>sp?.plant).filter(Boolean);
              const showPlants=repPlants.length>0?repPlants:[
                {name:'Sedum',speciesCatalogCode:'sedum',type:'succulent',waterNeeds:'low',petSafe:true},
                {name:'Portulaca',speciesCatalogCode:'portulaca',type:'perennial',waterNeeds:'low',petSafe:true},
                {name:'Aloe vera',speciesCatalogCode:'aloe_vera',type:'succulent',waterNeeds:'low',petSafe:false},
                {name:'Vetiver',speciesCatalogCode:'vetiver',type:'grass',waterNeeds:'medium',petSafe:true},
                {name:'Holy basil',speciesCatalogCode:'tulsi_holy',type:'herb',waterNeeds:'medium',petSafe:true},
              ];
              return showPlants.map((p,i)=>(
                <div key={p.id||p.name||i} className="a1" style={{background:'rgba(56,189,248,.03)',border:'1px solid rgba(56,189,248,.12)',marginBottom:8}}>
                  <div onClick={()=>setExp(exp===i?null:i)} style={{padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                    <span style={{fontSize:26}}>{PTYPE_E2[p.type]||'🌱'}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:T.textBright}}>{p.name}</div>
                      <div className="mono" style={{fontSize:9,letterSpacing:'1px',color:T.textDim}}>
                        WATER: {(p.waterNeeds||'—').toUpperCase()}
                        {p.speciesCatalogCode ? ` · ${p.speciesCatalogCode}` : ''}
                        {p.petSafe===true ? ' · 🐾 PET-SAFE' : ''}
                      </div>
                    </div>
                    <Ic n="chev" s={14} c="rgba(56,189,248,.3)" st={{transform:exp===i?'rotate(90deg)':'none',transition:'transform .3s'}}/>
                  </div>
                  {exp===i&&<div style={{padding:'0 14px 12px',borderTop:'1px solid rgba(56,189,248,.08)'}}>
                    <p style={{fontSize:12,color:T.textDim,marginTop:8,lineHeight:1.6}}>
                      {p.type==='succulent'||p.waterNeeds==='low'
                        ?'Drought-tolerant; minimal watering required. Ideal for water-scarce urban rooftops.'
                        :p.type==='herb'||p.edible
                        ?'Edible and functional. Thrives in Indian heat with moderate care.'
                        :p.type==='grass'
                        ?'High-transpiration grass; excellent cooling effect. Robust in wind.'
                        :'Suited to urban Indian rooftop conditions. Tolerates heat with regular watering.'}
                    </p>
                    {p.coolingScore!=null && <div className="mono" style={{fontSize:9,color:T.green,marginTop:4}}>COOLING SCORE: {p.coolingScore}/10</div>}
                  </div>}
                </div>
              ));
            })()}
          </div>
        )}
        {tab===2&&(
          <div>
            {heatSummary && (
              <div className="dc" style={{marginBottom:10,padding:14}}>
                <div className="mono" style={{fontSize:9,letterSpacing:'1.5px',color:'rgba(148,163,184,.9)',marginBottom:6}}>// COOLING DRIVERS</div>
                <ul style={{margin:0,paddingLeft:18,fontSize:12,color:T.textDim,lineHeight:1.6}}>
                  {heatSummary.drivers.map(d=>(
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
            {(()=>{
              const repArea=(photoSession?.widthM&&photoSession?.lengthM)
                ?Math.round(photoSession.widthM*photoSession.lengthM):null;
              const co2T=repArea?(repArea*0.028).toFixed(1):'1.2';
              const trees=repArea?Math.round(repArea*1.9):48;
              const waterL=repArea?Math.round(repArea*8):'340';
              const repPlants2=(selectedRecommendation?.candidate?.scoredPlants??[]).map(sp=>sp?.plant).filter(Boolean);
              const nativeCount=repPlants2.length>0?repPlants2.length:12;
              const bioDiversity=repPlants2.length>0?Math.min(10,(7+repPlants2.length*0.15)).toFixed(1):'7.8';
              return [{l:'CO₂ Offset Annual',v:`${co2T}T`,sub:`≈ ${trees} trees planted`,ic:'leaf',c:T.green},{l:'Water Conservation',v:`${waterL}L`,sub:'Per month via drip systems',ic:'drop',c:T.cyan},{l:'Biodiversity Score',v:`${bioDiversity}/10`,sub:`${nativeCount}+ species supported`,ic:'target',c:T.gold},{l:'Urban Heat Reduction',v:heatSummary?`${heatSummary.estimatedDropC.toFixed(1)}°C`:'HIGH',sub:'Measurable neighborhood effect',ic:'thermo',c:T.orange}];
            })().map((m,i)=>(
              <div key={m.l} className={`a${i+1} dc`} style={{marginBottom:10,display:'flex',gap:14,alignItems:'center'}}>
                <div style={{width:44,height:44,background:`${m.c}14`,border:`1px solid ${m.c}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Ic n={m.ic} s={20} c={m.c}/></div>
                <div>
                  <div className="mono" style={{fontSize:9,letterSpacing:'1.5px',color:T.textDim}}>{m.l}</div>
                  <div className="mono" style={{fontSize:22,fontWeight:700,color:m.c,textShadow:`0 0 12px ${m.c}60`}}>{m.v}</div>
                  <div style={{fontSize:11,color:T.textDim}}>{m.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   INSTALLATION REQUEST
══════════════════════════════════════════════════════════════════ */
const InstallScreen = ({ navigate, selectedRecommendation, photoSession, me, setPhotoSession }) => {
  const [done,setDone]=useState(false);const [contact,setContact]=useState('email');
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [timeline, setTimeline] = useState("ASAP");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [quoteRegion,setQuoteRegion]=useState("Punjab, India");
  const [quoteNotes,setQuoteNotes]=useState("");
  const [quoteBusy,setQuoteBusy]=useState(false);
  const [quoteErr,setQuoteErr]=useState(null);
  const [quoteOk,setQuoteOk]=useState(false);
  const hs = selectedRecommendation?.heatReductionSummary;
  const optIdx=photoSession?.recommendations?.findIndex(r=>r===selectedRecommendation) ?? 0;
  const selectedSnapshotId=photoSession?.telemetryCandidateSnapshotIds?.[optIdx >= 0 ? optIdx : 0] ?? null;
  const areaM2 = (photoSession?.widthM && photoSession?.lengthM)
    ? (photoSession.widthM * photoSession.lengthM).toFixed(1)
    : "—";
  const projTitle = photoSession?.projectMeta?.name || "Your rooftop";
  if(done){ setTimeout(()=>navigate('installDone'),300); return null; }
  return(
    <div style={{paddingBottom:380}}>
      <div className="navbar">
        <button onClick={()=>navigate('result')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><Ic n="back" s={22} c={T.green}/></button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)'}}>
          <div className="mono" style={{fontSize:12,fontWeight:700,letterSpacing:'3px',color:T.textBright}}>REQUEST QUOTE</div>
        </div>
      </div>
      <div style={{padding:'18px 20px'}}>
        <div className="a1 dc" style={{marginBottom:18}}>
          <div className="mono" style={{fontSize:9,letterSpacing:'2px',color:'rgba(56,189,248,.5)',marginBottom:4}}>// PROJECT SCOPE</div>
          <div style={{fontSize:15,fontWeight:600,color:T.textBright,marginBottom:4}}>{projTitle} · {areaM2} m²</div>
          <div style={{display:'flex',gap:16,marginBottom:8}}>
            <span className="mono" style={{fontSize:11,color:T.textDim}}>Cooling: <span style={{color:T.green}}>{hs?`−${hs.estimatedDropC.toFixed(1)}°C`:"—"}</span></span>
            <span className="mono" style={{fontSize:11,color:T.textDim}}>Confidence: <span style={{color:T.green}}>{hs?.confidence ?? "—"}</span></span>
          </div>
          <div className="tag" style={{background:'rgba(56,189,248,.1)',color:T.green,border:'1px solid rgba(56,189,248,.25)'}}>{(()=>{const n=new Date();const M=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];const m1=(n.getMonth()+1)%12;const m2=(n.getMonth()+2)%12;const yr=n.getMonth()>=10?n.getFullYear()+1:n.getFullYear();return`OPTIMAL INSTALL: ${M[m1]}–${M[m2]} ${yr}`;})()}</div>
        </div>
        <div className="a2" style={{marginBottom:16}}>
          <div className="slabel">CONTACT DETAILS</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <input className="hinp mono" placeholder="FULL NAME" value={name} onChange={e=>setName(e.target.value)}/>
            <input className="hinp mono" placeholder="EMAIL ADDRESS" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
            <input className="hinp mono" placeholder="PHONE (OPTIONAL)" type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/>
          </div>
        </div>
        <div className="a3" style={{marginBottom:16}}>
          <div className="slabel">INSTALLATION TIMELINE</div>
          <div style={{display:'flex',gap:8}}>
            {["ASAP","1-2 WEEKS","1 MONTH","3+ MONTHS"].map(tl=>(
              <button
                key={tl}
                onClick={()=>setTimeline(tl)}
                className="gbtn"
                style={{
                  padding:"12px 10px",
                  flex:1,
                  borderColor: timeline===tl ? T.green : "rgba(56,189,248,.15)",
                  color: timeline===tl ? T.green : T.textDim,
                  background: timeline===tl ? "rgba(56,189,248,.08)" : "transparent",
                }}
              >
                {tl}
              </button>
            ))}
          </div>
        </div>
        <div className="a3" style={{marginBottom:16}}>
          <div className="slabel">CONTACT METHOD</div>
          <div style={{display:'flex',gap:8}}>
            {[{id:'email',e:'📧',l:'EMAIL'},{id:'whatsapp',e:'💬',l:'WHATSAPP'},{id:'call',e:'📞',l:'CALL'}].map(c=>(
              <div key={c.id} onClick={()=>setContact(c.id)} style={{flex:1,background:contact===c.id?'rgba(56,189,248,.1)':'rgba(56,189,248,.03)',border:`1px solid ${contact===c.id?T.green:'rgba(56,189,248,.15)'}`,padding:'12px 8px',textAlign:'center',cursor:'pointer',transition:'all .2s',boxShadow:contact===c.id?`inset 0 0 16px rgba(56,189,248,.08)`:''  }}>
                <div style={{fontSize:22,marginBottom:5}}>{c.e}</div>
                <div className="mono" style={{fontSize:9,letterSpacing:'1.5px',color:contact===c.id?T.green:T.textDim}}>{c.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="a4" style={{marginBottom:16}}>
          <div className="slabel">PARTNERS IN {(photoSession?.projectMeta?.location||'YOUR AREA').toUpperCase()}</div>
          {[{n:'GreenBuild Solutions',r:'4.9',t:'TOP RATED'},{n:'EcoRoof India',r:'4.7',t:'CERTIFIED'}].map(p=>(
            <div key={p.n} className="dc" style={{marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:40,height:40,background:'rgba(56,189,248,.08)',border:'1px solid rgba(56,189,248,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>🏗</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:T.textBright}}>{p.n}</div>
                <div className="mono" style={{fontSize:9,color:'rgba(255,184,0,.7)',letterSpacing:'1px'}}>★ {p.r}</div>
              </div>
              <span className="tag" style={{background:'rgba(56,189,248,.1)',color:T.green,border:'1px solid rgba(56,189,248,.2)'}}>{p.t}</span>
            </div>
          ))}
        </div>
        <div className="a5 dc" style={{marginBottom:16,padding:14}}>
          <div className="slabel">INSTALLER NETWORK QUOTE</div>
          <p style={{fontSize:11,color:T.textDim,lineHeight:1.6,marginBottom:10}}>
            Structured request to the partner RFQ pipeline. Separate from the direct installation request below.
          </p>
          <input className="hinp mono" style={{marginBottom:8,width:"100%"}} value={quoteRegion} onChange={e=>setQuoteRegion(e.target.value)} placeholder="Your region (e.g. Punjab, India)"/>
          <textarea className="hinp mono" style={{minHeight:64,marginBottom:8,width:"100%",resize:"vertical",fontFamily:"inherit"}} value={quoteNotes} onChange={e=>setQuoteNotes(e.target.value)} placeholder="Notes for installers (optional)"/>
          {quoteErr && <div className="mono" style={{fontSize:10,color:T.orange,marginBottom:8}}>{quoteErr}</div>}
          {quoteOk && <div className="mono" style={{fontSize:10,color:T.green,marginBottom:8}}>Quote request registered — partners may follow up.</div>}
          <button
            type="button"
            className="gbtn"
            style={{width:"100%"}}
            disabled={quoteBusy || !photoSession?.projectId || !quoteRegion.trim()}
            onClick={async ()=>{
              setQuoteErr(null);
              setQuoteOk(false);
              setQuoteBusy(true);
              try{
                let telId=photoSession.recommendationTelemetrySessionId;
                let snapIds=photoSession.telemetryCandidateSnapshotIds || [];
                const recs=photoSession?.recommendations?.length ? photoSession.recommendations : (selectedRecommendation ? [selectedRecommendation] : []);
                if((!telId || snapIds.length !== recs.length) && recs.length && photoSession.projectId && me?.id){
                  const created=await createRecommendationTelemetrySessionFromClient(photoSession,recs,me.id);
                  if(created){
                    telId=created.recommendationSessionId;
                    snapIds=created.candidateSnapshotIds || [];
                    setPhotoSession?.(prev=>({
                      ...prev,
                      recommendationTelemetrySessionId:telId,
                      telemetryCandidateSnapshotIds:snapIds,
                    }));
                  }
                }
                const idx=recs.findIndex(r=>r===selectedRecommendation);
                const snapId=snapIds[idx >= 0 ? idx : 0] ?? selectedSnapshotId;
                const res=await fetch("/api/installers/request-quote",{
                  method:"POST",
                  headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({
                    projectId:photoSession.projectId,
                    recommendationSessionId:telId ?? null,
                    selectedCandidateSnapshotId:snapId,
                    userLocationRegion:quoteRegion.trim(),
                    projectSnapshot:{
                      ...snapshotProjectInputForReport(photoSession),
                      projectName:photoSession.projectMeta?.name ?? null,
                    },
                    candidateSnapshot:selectedRecommendation ? JSON.parse(JSON.stringify(selectedRecommendation)) : null,
                    notes:quoteNotes.trim() || null,
                    idempotencyKey:`quote-${photoSession.projectId}-${photoSession.id || "local"}`,
                  }),
                });
                const data=await res.json().catch(()=>({}));
                if(!res.ok) throw new Error(data?.error?.message || data?.message || "Quote request failed");
                setQuoteOk(true);
              }catch(e){
                setQuoteErr(e instanceof Error?e.message:"Request failed");
              }finally{
                setQuoteBusy(false);
              }
            }}
          >
            {quoteBusy?"SUBMITTING QUOTE…":"REQUEST NETWORK QUOTE →"}
          </button>
          {!photoSession?.projectId && (
            <div className="mono" style={{fontSize:9,color:T.gold,marginTop:8}}>Create a project first to attach a quote request.</div>
          )}
        </div>
      </div>
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'rgba(4,9,26,.97)',padding:'12px 20px 32px',borderTop:'1px solid rgba(56,189,248,.1)',maxWidth:430,margin:'0 auto'}}>
        <button
          className="gbtn"
          onClick={()=>{
            try{
              const payload = buildInstallerExport({ photoSession, selectedRecommendation });
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `heatwise-installer-export-${(photoSession?.id ?? "session").slice(0,8)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              const telId = photoSession?.recommendationTelemetrySessionId;
              if (telId && photoSession?.projectId && me?.id) {
                void postLearningTelemetryEvent({
                  sessionId: telId,
                  projectId: photoSession.projectId,
                  userId: me.id,
                  eventType: "installer_export_requested",
                  screenName: "install",
                  candidateSnapshotId: selectedSnapshotId,
                  metadata: {
                    speciesCatalogCodes: extractSpeciesCatalogCodesFromRecommendation(selectedRecommendation),
                  },
                });
              }
            }catch{}
          }}
        >
          DOWNLOAD INSTALLER EXPORT
        </button>
        {submitError && (
          <div className="mono" style={{fontSize:10,color:T.orange,textAlign:"center",marginBottom:8}}>{submitError}</div>
        )}
        <button
          className="gbtn fill"
          disabled={submitting || !name || !email}
          onClick={async ()=>{
            setSubmitting(true);
            setSubmitError(null);
            try{
              const installerExport = buildInstallerExport({ photoSession, selectedRecommendation });
              const res = await fetch("/api/installation/request",{
                method:"POST",
                headers:{ "Content-Type":"application/json" },
                body: JSON.stringify({
                  projectId: photoSession?.projectId ?? null,
                  contactName: name,
                  email,
                  phone: phone || null,
                  contactMethod: contact,
                  timeline,
                  installerExport,
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(data?.message || `Request failed (${res.status})`);
              }
              const telId = photoSession?.recommendationTelemetrySessionId;
              if (telId && photoSession?.projectId && me?.id) {
                void postLearningTelemetryEvent({
                  sessionId: telId,
                  projectId: photoSession.projectId,
                  userId: me.id,
                  eventType: "installation_request_started",
                  screenName: "install",
                  candidateSnapshotId: selectedSnapshotId,
                  metadata: {
                    contactMethod: contact,
                    speciesCatalogCodes: extractSpeciesCatalogCodesFromRecommendation(selectedRecommendation),
                  },
                });
              }
              logRecommendationFeedback("mark_installed",{
                recommendation:selectedRecommendation,
                extra:{ screen:"install", contactMethod:contact },
              });
              setDone(true);
            } catch (e) {
              setSubmitError(e instanceof Error ? e.message : "Could not submit. Try again.");
            } finally{
              setSubmitting(false);
            }
          }}
        >{submitting ? "SENDING…" : "TRANSMIT REQUEST →"}</button>
        <div className="mono" style={{textAlign:'center',marginTop:10,fontSize:9,letterSpacing:'1.5px',color:'rgba(186,230,253,.3)'}}>NO PAYMENT · RESPONSE WITHIN 24H</div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   SAVED PROJECTS
══════════════════════════════════════════════════════════════════ */
const SavedScreen = ({ navigate, setPhotoSession, setActivePhotoRecommendation }) => {
  const [f,setF]=useState('ALL');
  const [sessions,setSessions]=useState([]);
  const [loading,setLoading]=useState(false);
  const filters=['ALL','ROOFTOP','BALCONY','ANALYZED','DRAFT'];

  useEffect(()=>{
    (async()=>{
      try{
        setLoading(true);
        const res=await fetch("/api/photo-session");
        if(!res.ok) return;
        const data=await res.json();
        setSessions(data);
      } finally{
        setLoading(false);
      }
    })();
  },[]);

  const projects=sessions.map(s=>({
    id:s.id,
    n:`Session ${s.id.slice(0,6)}`,
    a:s.widthM && s.lengthM ? `${s.widthM}m x ${s.lengthM}m` : "Unknown size",
    type:'ROOFTOP',
    score:Math.min(100,Math.round((s.widthM ?? 6)*(s.lengthM ?? 7))),
    s:s.measurementStatus === "ar_complete" ? "ANALYZED" : "DRAFT",
    d:new Date(s.createdAt ?? s.capturedAt ?? Date.now()).toLocaleDateString(),
    c:s.measurementStatus === "ar_complete" ? T.green : T.textDim,
  }));

  const filtered=f==='ALL'?projects:projects.filter(p=>p.type===f||p.s===f);
  return(
    <div style={{paddingBottom:80,position:'relative',overflow:'hidden',background:'rgba(5,8,18,0.88)'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:300,pointerEvents:'none',opacity:.4}}><DataOrb/></div>
      <div className="navbar" style={{position:'relative',zIndex:2}}>
        <div>
          <div className="mono" style={{fontSize:9,letterSpacing:'2px',color:'rgba(56,189,248,.5)'}}>// SYSTEM</div>
          <div style={{fontSize:20,fontWeight:800,color:T.textBright,letterSpacing:'1px'}}>MY SCANS</div>
        </div>
        <button style={{background:'none',border:'none',cursor:'pointer',marginLeft:'auto',display:'flex'}}><Ic n="search" s={18} c="rgba(56,189,248,.5)"/></button>
      </div>
        <div style={{padding:'14px 20px 0',position:'relative',zIndex:2}}>
        <div className="slabel" style={{marginBottom:8}}>Filter scans</div>
        <div className="scan-pill-row">
          {filters.map(fi=>(
            <button
              key={fi}
              type="button"
              className={`scan-pill${f===fi?' scan-pill--active':''}`}
              onClick={()=>setF(fi)}
            >
              {fi}
            </button>
          ))}
        </div>
        <div className="mono" style={{fontSize:10,letterSpacing:'1.5px',color:T.textDim,marginBottom:14}}>{filtered.length} RECORDS FOUND</div>
        {filtered.map((p,i)=>(
          <div
            key={p.id ?? p.n}
            className={`a${i+1}`}
            onClick={()=>{
              (async()=>{
                if(!p.id) return;
                try{
                  const res=await fetch(`/api/photo-session/${p.id}`);
                  if(!res.ok) return;
                  const s=await res.json();
                  let rec=s.recommendationJson?JSON.parse(s.recommendationJson):null;
                  const layout=s.layoutSchema?JSON.parse(s.layoutSchema):null;
                  const mapping=s.spatialMapping?JSON.parse(s.spatialMapping):null;
                  if(rec && layout){
                    rec={ ...rec, layoutSchema:rec.layoutSchema ?? layout };
                  }
                  if(rec && mapping && !rec.spatialMapping){
                    rec={ ...rec, spatialMapping:mapping };
                  }
                  setPhotoSession({
                    id:s.id,
                    projectId:s.projectId ?? null,
                    projectMeta:s.projectMeta ?? null,
                    environment:s.environment ?? null,
                    capturedPhoto:s.photoData ?? null,
                    capturedAt:s.capturedAt ? new Date(s.capturedAt).toISOString() : null,
                    measurementStatus:s.measurementStatus ?? null,
                    widthM:s.widthM ?? null,
                    lengthM:s.lengthM ?? null,
                    floorLevel:s.floorLevel ?? null,
                    measurementCompletedAt:s.measurementCompletedAt ? new Date(s.measurementCompletedAt).toISOString() : null,
                    selectedRecommendation:rec,
                    generatedVisualization:s.visualizationImageUrl ? {
                      imageUrl:s.visualizationImageUrl,
                      prompt:s.visualizationPrompt ?? "",
                      createdAt:new Date().toISOString(),
                    } : null,
                    recommendations:rec ? [rec] : [],
                    recommendationTelemetrySessionId:null,
                    telemetryCandidateSnapshotIds:[],
                  });
                  // Resume from last screen the user visited for this session
                  let savedScreen = null;
                  const projId = s.projectId;
                  try{ if(projId) savedScreen = localStorage.getItem(`hw_proj_screen_${projId}`); }catch{}
                  const RESUMABLE = new Set(['result','gardenLayout','beforeAfter','report','install','environment']);
                  if(savedScreen && RESUMABLE.has(savedScreen)){
                    if(rec) setActivePhotoRecommendation(0);
                    navigate(savedScreen);
                  } else if(rec){
                    setActivePhotoRecommendation(0);
                    navigate('beforeAfter');
                  }else{
                    navigate('result');
                  }
                }catch{
                  // ignore
                }
              })();
            }}
            style={{background:'rgba(56,189,248,.03)',border:'1px solid rgba(56,189,248,.12)',marginBottom:10,display:'flex',cursor:'pointer',transition:'all .2s'}}
          >
            <div style={{width:64,background:`${p.c}14`,borderRight:'1px solid rgba(56,189,248,.1)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,padding:'12px 0'}}>
              <div className="mono" style={{fontSize:22,fontWeight:800,color:p.c,textShadow:`0 0 12px ${p.c}80`}}>{p.score}</div>
              <div className="mono" style={{fontSize:7,color:'rgba(186,230,253,.35)',letterSpacing:'1px'}}>SCORE</div>
            </div>
            <div style={{flex:1,padding:'12px 14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:14,fontWeight:700,color:"#E2E8F0"}}>{p.n}</span>
                <span className="mono tag" style={{color:p.c,background:`${p.c}12`,border:`1px solid ${p.c}30`}}>{p.s}</span>
              </div>
              <div style={{height:2,background:'rgba(56,189,248,.08)',marginBottom:5}}>
                <div style={{height:'100%',width:`${p.score}%`,background:`linear-gradient(90deg,#0284C7,${p.c})`,boxShadow:`0 0 6px ${p.c}80`}}/>
              </div>
              <div className="mono" style={{fontSize:9,letterSpacing:'1px',color:T.textDim}}>{p.type} · {p.a} · {p.d}</div>
            </div>
            <div style={{width:32,display:'flex',alignItems:'center',justifyContent:'center'}}><Ic n="chev" s={14} c="rgba(56,189,248,.25)"/></div>
          </div>
        ))}
      </div>
      <button onClick={()=>navigate('create')} style={{position:'fixed',bottom:82,right:22,width:50,height:50,borderRadius:16,background:T.green,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 4px 20px rgba(56,189,248,.5)`,animation:'progressGlow 2s ease-in-out infinite',zIndex:50}}>
        <Ic n="plus" s={20} c="#04091A"/>
      </button>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════════════════════ */
const SettingsScreen = () => {
  const [dark,setDark]=useState(true);const [notif,setNotif]=useState(true);const [ds,setDs]=useState(true);
  const [profile, setProfile] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/user/me");
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) return;
        setProfile(data);
      } catch {
        if (!alive) return;
      }
    })();
    return () => { alive = false; };
  }, []);

  const inputStyle = {
    width:"100%", padding:"11px 13px", borderRadius:10,
    border:"1.5px solid rgba(255,255,255,0.55)",
    background:"rgba(255,255,255,0.82)",
    color:"#1B4332", fontSize:13, fontWeight:500,
    outline:"none", boxSizing:"border-box",
  };
  const labelStyle = { fontSize:10, fontWeight:700, letterSpacing:"1.5px", color:"#2D6A4F", marginBottom:5 };

  const Row=({ic,l,sub,v,tog,onT,danger})=>(
    <div style={{display:'flex',alignItems:'center',padding:'14px 16px',gap:12,borderBottom:'1px solid rgba(255,255,255,0.15)',cursor:'pointer'}}>
      <div style={{width:34,height:34,borderRadius:10,background:danger?'rgba(220,38,38,0.12)':'rgba(255,255,255,0.25)',border:`1.5px solid ${danger?'rgba(220,38,38,0.35)':'rgba(255,255,255,0.5)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <Ic n={ic} s={16} c={danger?'#EF4444':'#1B4332'}/>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:14,color:danger?'#EF4444':'#1B4332',fontWeight:600}}>{l}</div>
        {sub&&<div style={{fontSize:11,color:'#40916C',marginTop:2}}>{sub}</div>}
      </div>
      {tog!==undefined
        ?<div className={`tog${tog?' on':''}`} onClick={onT}><div className="tth"/></div>
        :v?<span style={{fontSize:11,color:'#2D6A4F',fontWeight:700,background:'rgba(45,106,79,0.12)',padding:'3px 10px',borderRadius:20}}>{v}</span>
        :!danger?<Ic n="chev" s={14} c="rgba(27,67,50,0.4)"/>:null}
    </div>
  );
  const Sec=({t,children})=>(
    <div style={{marginBottom:18}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:'2px',color:'#FFFFFF',padding:'0 20px',marginBottom:8,textShadow:'0 1px 4px rgba(0,0,0,0.5)'}}>{t}</div>
      <div style={{background:'rgba(255,255,255,0.38)',backdropFilter:'blur(22px)',border:'1.5px solid rgba(255,255,255,0.65)',borderRadius:16,margin:'0 16px',boxShadow:'0 4px 20px rgba(0,0,0,0.18)',overflow:'hidden'}}>{children}</div>
    </div>
  );
  return(
    <div style={{paddingBottom:90,position:'relative',overflow:'hidden',background:'rgba(0,0,0,0.04)'}}>
      {/* Navbar */}
      <div className="navbar" style={{background:'rgba(10,45,18,0.72)',backdropFilter:'blur(24px)',borderBottom:'1px solid rgba(120,200,140,0.25)',position:'relative',zIndex:2}}>
        <div>
          <div style={{fontSize:9,letterSpacing:'2px',color:'rgba(180,255,200,0.6)',fontFamily:"monospace"}}>// CONFIG</div>
          <div style={{fontSize:20,fontWeight:800,color:'#FFFFFF',letterSpacing:'.5px',fontFamily:"'Space Grotesk',sans-serif"}}>Settings</div>
        </div>
      </div>

      <div style={{padding:'18px 0 0',position:'relative',zIndex:2}}>
        {/* Profile Card */}
        <div style={{margin:'0 16px 20px',background:'rgba(255,255,255,0.45)',backdropFilter:'blur(24px)',border:'1.5px solid rgba(255,255,255,0.70)',padding:'18px',borderRadius:18,boxShadow:'0 6px 28px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.6)'}}>
          {/* Avatar row */}
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
            <div style={{width:54,height:54,borderRadius:16,background:'rgba(45,106,79,0.15)',border:'2px solid rgba(45,106,79,0.35)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',flexShrink:0}}>
              <Ic n="user" s={26} c="#2D6A4F"/>
              <div style={{position:'absolute',bottom:-2,right:-2,width:12,height:12,borderRadius:'50%',background:'#40916C',border:'2px solid #fff'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:"#1B4332",marginBottom:3}}>
                {profile?.name || "Your HeatWise account"}
              </div>
              <div style={{fontSize:11,color:'#40916C'}}>
                {profile?.email || "Add an email for reports"}
              </div>
              {profile?.phoneNumber && (
                <div style={{fontSize:11,color:'#2D6A4F',marginTop:3,fontWeight:600}}>
                  {profile.phoneNumber} {profile.phoneVerified ? <span style={{color:'#40916C'}}>· verified</span> : ""}
                </div>
              )}
            </div>
          </div>

          {/* Fields */}
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12,marginBottom:14}}>
            <div>
              <div style={labelStyle}>MOBILE NUMBER</div>
              <input
                value={profile?.phoneNumber || ""}
                readOnly disabled
                style={{...inputStyle, background:'rgba(240,240,240,0.85)', color:'#6B7280'}}
              />
            </div>
            <div>
              <div style={labelStyle}>EMAIL</div>
              <input
                value={profile?.email || ""}
                onChange={e=>setProfile(p=>p?{...p,email:e.target.value}:p)}
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[["CITY","city"],["STATE","state"],["COUNTRY","country"]].map(([label,key])=>(
              <div key={label} style={label==="COUNTRY"?{gridColumn:"1 / -1"}:{}}>
                <div style={labelStyle}>{label}</div>
                <input
                  value={(profile && profile[key]) || ""}
                  onChange={e=>setProfile(p=>p?{...p,[key]:e.target.value}:p)}
                  placeholder={label.charAt(0)+label.slice(1).toLowerCase()}
                  style={inputStyle}
                />
              </div>
            ))}
            <div>
              <div style={labelStyle}>AGE</div>
              <input
                value={profile?.age ?? ""}
                onChange={e=>setProfile(p=>p?{...p,age:e.target.value}:p)}
                inputMode="numeric" placeholder="—"
                style={inputStyle}
              />
            </div>
            <div style={{gridColumn:"1 / -1"}}>
              {(()=>{
                const LEVELS=[
                  {score:2, icon:"🌱", label:"Curious",    desc:"Just exploring"},
                  {score:4, icon:"🌿", label:"Casual",     desc:"Weekend gardener"},
                  {score:6, icon:"🍃", label:"Regular",    desc:"Grow & maintain"},
                  {score:8, icon:"🌳", label:"Passionate", desc:"Dedicated grower"},
                  {score:10,icon:"🌲", label:"Expert",     desc:"Master gardener"},
                ];
                const cur = profile?.gardeningInterestScore ?? 5;
                const activeIdx = LEVELS.reduce((best,lv,i)=>Math.abs(lv.score-cur)<Math.abs(LEVELS[best].score-cur)?i:best, 0);
                const active = LEVELS[activeIdx];
                return (
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={labelStyle}>GARDENING INTEREST</div>
                      <div style={{fontSize:11,fontWeight:700,color:"#2D6A4F",background:"rgba(45,106,79,0.12)",padding:"3px 10px",borderRadius:20}}>
                        {active.icon} {active.label}
                      </div>
                    </div>
                    {/* Tab row */}
                    <div style={{display:"flex",gap:6,marginBottom:10}}>
                      {LEVELS.map((lv,i)=>{
                        const isActive = i===activeIdx;
                        return (
                          <button key={lv.score}
                            onClick={()=>setProfile(p=>p?{...p,gardeningInterestScore:lv.score}:p)}
                            style={{
                              flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                              padding:"8px 4px 6px", borderRadius:12, border:"none", cursor:"pointer",
                              background: isActive
                                ? "linear-gradient(135deg,#2D6A4F,#52B788)"
                                : "rgba(255,255,255,0.55)",
                              boxShadow: isActive
                                ? "0 4px 14px rgba(45,106,79,0.40)"
                                : "0 1px 4px rgba(0,0,0,0.08)",
                              border: isActive
                                ? "1.5px solid rgba(82,183,136,0.7)"
                                : "1.5px solid rgba(255,255,255,0.6)",
                              transform: isActive ? "translateY(-2px)" : "translateY(0)",
                              transition:"all .2s ease",
                            }}
                          >
                            <span style={{fontSize:18,lineHeight:1}}>{lv.icon}</span>
                            <span style={{fontSize:9,fontWeight:700,marginTop:4,letterSpacing:"0.3px",color:isActive?"#FFFFFF":"#2D6A4F"}}>
                              {lv.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Description strip */}
                    <div style={{textAlign:"center",fontSize:11,color:"#40916C",background:"rgba(45,106,79,0.08)",borderRadius:8,padding:"6px 12px",fontStyle:"italic"}}>
                      {active.desc} — score {active.score}/10
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {profileError && (
            <div style={{fontSize:11,color:'#DC2626',marginBottom:8,fontWeight:500}}>{profileError}</div>
          )}

          <button
            disabled={!profile || savingProfile}
            onClick={async ()=>{
              if (!profile) return;
              setSavingProfile(true); setProfileError(null);
              try{
                const res=await fetch("/api/user/profile",{method:"POST",headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({email:profile.email,city:profile.city,state:profile.state,country:profile.country,age:profile.age,gardeningInterestScore:profile.gardeningInterestScore})});
                const data=await res.json().catch(()=>null);
                if(!res.ok) throw new Error(data?.message || "Failed to save profile");
                setProfile(p=>p?{...p,...data}:p);
              }catch(e){ setProfileError(e instanceof Error?e.message:"Failed to save profile");
              }finally{ setSavingProfile(false); }
            }}
            style={{width:"100%",padding:"13px",borderRadius:12,border:"none",cursor:(!profile||savingProfile)?'not-allowed':'pointer',
              background:(!profile||savingProfile)?'rgba(45,106,79,0.4)':'linear-gradient(135deg,#2D6A4F,#40916C)',
              color:"#FFFFFF",fontSize:14,fontWeight:700,letterSpacing:'0.5px',
              boxShadow:(!profile||savingProfile)?'none':'0 4px 16px rgba(45,106,79,0.45)',
              transition:'all .2s',
            }}
          >
            {savingProfile ? "SAVING…" : "SAVE PROFILE"}
          </button>
        </div>

        <Sec t="PREFERENCES">
          <Row ic="globe" l="Units" sub="Measurement system" v="METRIC"/>
          <Row ic="bell" l="Notifications" sub="Analysis alerts & tips" tog={notif} onT={()=>setNotif(!notif)}/>
          <Row ic="moon" l="Dark Mode" tog={dark} onT={()=>setDark(!dark)}/>
        </Sec>
        <Sec t="ANALYSIS ENGINE">
          <Row ic="map" l="Default Location" v="PATIĀLA"/>
          <Row ic="target" l="AI Model" sub="Processing preset" v="BALANCED"/>
          <Row ic="chart" l="Data Sharing" sub="Improves model accuracy" tog={ds} onT={()=>setDs(!ds)}/>
        </Sec>
        <Sec t="ACCOUNT">
          <Row ic="lock" l="Privacy Policy"/>
          <Row ic="info" l="Terms of Service"/>
          <Row ic="mail" l="Send Feedback"/>
        </Sec>
        <Sec t="DANGER ZONE">
          <Row ic="trash" l="Delete All Scans" danger/>
          <Row ic="user" l="Sign Out" danger/>
        </Sec>
        <div style={{textAlign:'center',fontSize:10,letterSpacing:'2px',color:'rgba(255,255,255,0.5)',padding:'8px 0 24px',textShadow:'0 1px 4px rgba(0,0,0,0.5)'}}>HEATWISE v2.1.0 · BUILD 20260312</div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   SCREEN 19 — CITY HEAT MAP
══════════════════════════════════════════════════════════════════ */
const CITY_ZONES=[
  {n:'Old City',t:47,p:8},
  {n:'Industrial Belt',t:45,p:12},
  {n:'Central Plaza',t:43,p:18},
  {n:'Tech Corridor',t:40,p:22},
  {n:'Green Hills',t:34,p:44},
  {n:'Riverside',t:36,p:38},
];
// ══════════════════════════════════════════════════════════════════
//  CLIMATE SPECIES SCREEN — AI plant recommendations from live weather
// ══════════════════════════════════════════════════════════════════
const CLIMATE_PLANTS = [
  // id, name, emoji, tagline, heatMin, heatMax (annual avg °C), humidMin, humidMax (%), waterNeeds, sunlight, traits[]
  { id:'sedum',      name:'Sedum (Stonecrop)',      emoji:'🌵', tagline:'Thrives in extreme heat and drought — zero fuss',        hMin:18, hMax:42, humMin:10, humMax:60, water:'Very Low',  sun:'Full',         traits:['Drought-tolerant','Succulent','Heat-proof','Rooftop-ready'] },
  { id:'aloe',       name:'Aloe Vera',              emoji:'🌿', tagline:'Medicinal + cools surfaces; survives neglect',           hMin:15, hMax:45, humMin:10, humMax:65, water:'Very Low',  sun:'Full',         traits:['Medicinal','Air-purifying','Low-maintenance','Drought-tolerant'] },
  { id:'portulaca',  name:'Portulaca (Moss Rose)',  emoji:'🌸', tagline:'Blazing blooms through summer; loves baking sun',       hMin:22, hMax:45, humMin:10, humMax:70, water:'Very Low',  sun:'Full',         traits:['Colourful','Heat-loving','Ground-cover','Attracts pollinators'] },
  { id:'marigold',   name:'Marigold',              emoji:'🌼', tagline:'Natural pest repellent; blooms April–November',          hMin:15, hMax:38, humMin:20, humMax:75, water:'Low',       sun:'Full',         traits:['Pest-repellent','Pollinator-friendly','Easy-grow','Edible petals'] },
  { id:'basil',      name:'Basil',                 emoji:'🌱', tagline:'Kitchen herb; loves warmth and moderate moisture',       hMin:18, hMax:35, humMin:30, humMax:75, water:'Moderate',  sun:'Full/Partial',  traits:['Edible','Aromatic','Fast-growing','Companion plant'] },
  { id:'jasmine',    name:'Jasmine',               emoji:'🌺', tagline:'Fragrant climber; tolerates heat and partial shade',     hMin:15, hMax:38, humMin:30, humMax:80, water:'Moderate',  sun:'Full/Partial',  traits:['Fragrant','Climbing','Attracts bees','Night-blooming'] },
  { id:'lavender',   name:'Lavender',              emoji:'💜', tagline:'Drought-tolerant aromatic; repels mosquitoes',           hMin:10, hMax:32, humMin:10, humMax:55, water:'Low',       sun:'Full',          traits:['Aromatic','Pest-repellent','Drought-tolerant','Medicinal'] },
  { id:'lemongrass', name:'Lemongrass',            emoji:'🌾', tagline:'Screens wind, repels pests, loves heat + humidity',      hMin:22, hMax:42, humMin:50, humMax:90, water:'Moderate',  sun:'Full',          traits:['Edible','Pest-repellent','Wind-screen','Fast-growing'] },
  { id:'hibiscus',   name:'Hibiscus',              emoji:'🌺', tagline:'Bold blooms in hot humid climates; edible petals',       hMin:18, hMax:40, humMin:40, humMax:90, water:'Moderate',  sun:'Full',          traits:['Edible petals','Large blooms','Tropical','Heat-tolerant'] },
  { id:'chrysanth',  name:'Chrysanthemum',         emoji:'🌸', tagline:'Cool-season star; air-purifying indoor–outdoor plant',   hMin:8,  hMax:28, humMin:30, humMax:75, water:'Moderate',  sun:'Full/Partial',  traits:['Air-purifying','Cool-season','Long-blooming','Colourful'] },
  { id:'rosemary',   name:'Rosemary',              emoji:'🌿', tagline:'Mediterranean herb; heat+drought resistant',             hMin:8,  hMax:35, humMin:10, humMax:55, water:'Low',       sun:'Full',          traits:['Culinary herb','Drought-tolerant','Aromatic','Bee-friendly'] },
  { id:'mint',       name:'Mint',                  emoji:'🌱', tagline:'Vigorous grower; loves moisture, dislikes scorching sun', hMin:8,  hMax:30, humMin:40, humMax:85, water:'High',      sun:'Partial',       traits:['Edible','Spreads quickly','Pest-deterrent','Fragrant'] },
  { id:'agave',      name:'Agave',                 emoji:'🌵', tagline:'Architectural succulent; survives extreme arid heat',    hMin:20, hMax:48, humMin:5,  humMax:50, water:'Very Low',  sun:'Full',          traits:['Succulent','Architectural','Zero water','Xeric design'] },
  { id:'zinnia',     name:'Zinnia',                emoji:'🌻', tagline:'Summer-long colour; pollinators love it',                hMin:18, hMax:40, humMin:20, humMax:70, water:'Low',       sun:'Full',          traits:['Colourful','Pollinator-magnet','Heat-tolerant','Cut flowers'] },
  { id:'snake',      name:'Snake Plant',           emoji:'🪴', tagline:'Superb air purifier; thrives in heat and low water',     hMin:15, hMax:42, humMin:10, humMax:75, water:'Very Low',  sun:'Any',           traits:['Air-purifying','Drought-tolerant','Low-light','Beginner-friendly'] },
  { id:'tulsi',      name:'Tulsi (Holy Basil)',    emoji:'🌿', tagline:'Sacred herb; antibacterial, thrives in Indian heat',     hMin:20, hMax:42, humMin:30, humMax:80, water:'Low',       sun:'Full',          traits:['Medicinal','Sacred','Aromatic','Heat-adapted'] },
  { id:'turmeric',   name:'Turmeric',              emoji:'🟡', tagline:'Rhizome crop; loves tropical heat and moisture',         hMin:22, hMax:40, humMin:55, humMax:90, water:'High',      sun:'Partial',       traits:['Spice crop','Medicinal','Tropical','Edible rhizome'] },
  { id:'fern',       name:'Boston Fern',           emoji:'🌿', tagline:'Lush green; perfect for humid shaded spots',             hMin:8,  hMax:26, humMin:60, humMax:90, water:'High',      sun:'Shade/Partial',  traits:['Humidity-loving','Shade-tolerant','Air-purifying','Lush foliage'] },
  { id:'bougain',    name:'Bougainvillea',         emoji:'🌸', tagline:'Vivid climber; thrives in heat, forgives drought',       hMin:18, hMax:45, humMin:10, humMax:70, water:'Low',       sun:'Full',          traits:['Vibrant colour','Climbing','Heat-tolerant','Drought-tolerant'] },
  { id:'geranium',   name:'Geranium (Pelargonium)',emoji:'🌺', tagline:'All-season colour; pest-repellent fragrance',            hMin:10, hMax:32, humMin:20, humMax:65, water:'Low',       sun:'Full/Partial',  traits:['Fragrant','Pest-repellent','Long-blooming','Colourful'] },
];

function scoreClimateMatch(plant, annualAvgTemp, humidity) {
  // 0–100 score: how well the plant fits the climate
  const tempScore = annualAvgTemp >= plant.hMin && annualAvgTemp <= plant.hMax
    ? 50
    : annualAvgTemp < plant.hMin
      ? Math.max(0, 50 - (plant.hMin - annualAvgTemp) * 6)
      : Math.max(0, 50 - (annualAvgTemp - plant.hMax) * 6);
  const humScore  = humidity >= plant.humMin && humidity <= plant.humMax
    ? 50
    : humidity < plant.humMin
      ? Math.max(0, 50 - (plant.humMin - humidity) * 1.5)
      : Math.max(0, 50 - (humidity - plant.humMax) * 1.5);
  return Math.round(tempScore + humScore);
}

const WATER_COLOR = { 'Very Low':'#F59E0B','Low':'#10B981','Moderate':'#3B82F6','High':'#6366F1' };
const SUN_COLOR   = { 'Full':'#F97316','Full/Partial':'#FBBF24','Partial':'#84CC16','Any':'#8B5CF6','Shade/Partial':'#06B6D4' };

const ClimateSpeciesScreen = ({ navigate }) => {
  const [phase,  setPhase]  = useState('loading'); // loading | loaded | error
  const [climate,setClimate]= useState(null); // { temp, humidity, annualAvg, annualHumidity, city, lat, lon }
  const [plants, setPlants] = useState([]);
  const [expanded,setExpanded]=useState(null);

  useEffect(()=>{
    let cancelled=false;
    async function run(){
      try{
        // 1. Geolocation
        const { getCurrentPosition:getPos } = await import('../lib/geolocation.js');
        const coords = await getPos();
        const lat=coords.latitude, lon=coords.longitude;

        // 2. Reverse-geocode city name
        let cityName='Your Location';
        try{
          const gr=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const gj=await gr.json();
          cityName=gj.address?.city||gj.address?.town||gj.address?.state||'Your Location';
        }catch{}

        // 3. Open-Meteo: live current + last-year daily archive for annual averages
        const prevYear = new Date().getFullYear() - 1;
        const [curRes, archRes] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&timezone=auto`),
          fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${prevYear}-01-01&end_date=${prevYear}-12-31&daily=temperature_2m_mean,relative_humidity_2m_mean&timezone=auto`),
        ]);
        const curJ  = await curRes.json();
        const archJ = await archRes.json();

        const liveTemp     = Math.round(curJ?.current?.temperature_2m ?? 28);
        const liveHumidity = Math.round(curJ?.current?.relative_humidity_2m ?? 50);

        // Daily values → annual averages
        const dTemps = (archJ?.daily?.temperature_2m_mean     ?? []).filter(v=>v!=null);
        const dHumid = (archJ?.daily?.relative_humidity_2m_mean ?? []).filter(v=>v!=null);
        const annualAvg      = dTemps.length ? Math.round(dTemps.reduce((a,b)=>a+b,0)/dTemps.length) : liveTemp;
        const annualHumidity = dHumid.length ? Math.round(dHumid.reduce((a,b)=>a+b,0)/dHumid.length) : liveHumidity;

        if(cancelled)return;

        // 4. Score + rank plants
        const scored = CLIMATE_PLANTS.map(p=>({
          ...p,
          score: scoreClimateMatch(p, annualAvg, annualHumidity),
        })).sort((a,b)=>b.score-a.score);

        setClimate({ liveTemp, liveHumidity, annualAvg, annualHumidity, cityName, lat, lon });
        setPlants(scored.slice(0,10));
        setPhase('loaded');
      }catch(e){
        if(!cancelled) setPhase('error');
      }
    }
    run();
    return()=>{ cancelled=true; };
  },[]);

  const climateLabel = climate
    ? climate.annualAvg >= 32 ? 'Hot Arid / Semi-Arid'
    : climate.annualAvg >= 26 ? climate.annualHumidity >= 60 ? 'Hot Humid / Tropical' : 'Warm Semi-Arid'
    : climate.annualAvg >= 18 ? 'Warm Temperate'
    : 'Cool Temperate'
    : '';

  return (
    <div style={{height:'100%',background:'#0D2618',display:'flex',flexDirection:'column',overflow:'hidden',fontFamily:"'DM Sans',sans-serif"}}>
      {/* Header */}
      <div style={{padding:'calc(env(safe-area-inset-top,44px) + 14px) 18px 14px',background:'linear-gradient(180deg,rgba(13,38,24,1) 70%,rgba(13,38,24,0))',position:'relative',zIndex:2,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
          <button onClick={()=>navigate('home')} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,padding:'7px 11px',cursor:'pointer',color:'#52E8A0',fontSize:15,lineHeight:1}}>←</button>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:'#FFFFFF',lineHeight:1.1}}>AI Plant Recommendations</div>
            {climate && <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:3}}>{climate.cityName} · {climateLabel}</div>}
          </div>
        </div>
        {/* Climate strip */}
        {phase==='loaded' && climate && (
          <div style={{display:'flex',gap:8}}>
            {[
              {l:'Live Temp',    v:`${climate.liveTemp}°C`,  c:'#F97316'},
              {l:'Humidity',     v:`${climate.liveHumidity}%`,c:'#60A5FA'},
              {l:'Annual Avg',   v:`${climate.annualAvg}°C`, c:'#52E8A0'},
              {l:'Avg Humidity', v:`${climate.annualHumidity}%`,c:'#A78BFA'},
            ].map(s=>(
              <div key={s.l} style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'8px 6px',textAlign:'center'}}>
                <div style={{fontSize:14,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:8,color:'rgba(255,255,255,0.38)',marginTop:3,letterSpacing:'0.5px'}}>{s.l.toUpperCase()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:'auto',padding:'0 14px 32px',WebkitOverflowScrolling:'touch'}}>
        {/* Loading */}
        {phase==='loading' && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'70vh',gap:16}}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{width:56,height:56,borderRadius:'50%',border:'2px solid rgba(82,232,160,0.2)',borderTopColor:'#52E8A0',animation:'spin 1s linear infinite'}}/>
            <div style={{color:'#52E8A0',fontWeight:700,fontSize:15}}>Reading your climate…</div>
            <div style={{color:'rgba(255,255,255,0.3)',fontSize:12,textAlign:'center',maxWidth:220}}>Fetching live conditions + full-year climate archive to match plants to your location</div>
          </div>
        )}

        {/* Error */}
        {phase==='error' && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60vh',gap:14,padding:'0 24px'}}>
            <div style={{fontSize:40}}>📡</div>
            <div style={{color:'#F87171',fontWeight:700,fontSize:16}}>Location unavailable</div>
            <div style={{color:'rgba(255,255,255,0.4)',fontSize:13,textAlign:'center',lineHeight:1.5}}>Allow location access so we can match plants to your exact climate.</div>
            <button onClick={()=>{setPhase('loading');setTimeout(()=>window.location.reload(),100);}} style={{background:'linear-gradient(135deg,#2D6A4F,#52B788)',border:'none',borderRadius:14,padding:'12px 28px',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:14}}>Try Again</button>
          </div>
        )}

        {/* Results */}
        {phase==='loaded' && (
          <>
            <div style={{color:'rgba(255,255,255,0.35)',fontSize:11,letterSpacing:'1.5px',fontWeight:700,padding:'16px 0 10px'}}>
              TOP MATCHES FOR YOUR CLIMATE
            </div>
            {plants.map((plant,i)=>{
              const isOpen = expanded === plant.id;
              const matchPct = plant.score;
              const matchColor = matchPct>=80?'#52E8A0':matchPct>=60?'#FBBF24':'#F87171';
              return (
                <div key={plant.id} style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${isOpen?'rgba(82,232,160,0.3)':'rgba(255,255,255,0.06)'}`,borderRadius:16,marginBottom:10,overflow:'hidden',transition:'border-color .25s'}}
                  onClick={()=>setExpanded(isOpen?null:plant.id)}>
                  {/* Card row */}
                  <div style={{display:'flex',alignItems:'center',gap:12,padding:'13px 14px'}}>
                    {/* Rank badge */}
                    <div style={{width:28,height:28,borderRadius:'50%',background:i<3?'rgba(82,232,160,0.15)':'rgba(255,255,255,0.06)',border:`1px solid ${i<3?'rgba(82,232,160,0.35)':'rgba(255,255,255,0.1)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{fontSize:11,fontWeight:800,color:i<3?'#52E8A0':'rgba(255,255,255,0.4)'}}>{i+1}</span>
                    </div>
                    {/* Plant photo */}
                    <PlantImg code={plant.id} type={plant.id} emoji={plant.emoji} size={44} round={10}/>
                    {/* Name + tagline */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#FFFFFF',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{plant.name}</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2,lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{plant.tagline}</div>
                    </div>
                    {/* Match score */}
                    <div style={{flexShrink:0,textAlign:'center'}}>
                      <div style={{fontSize:16,fontWeight:900,color:matchColor,lineHeight:1}}>{matchPct}%</div>
                      <div style={{fontSize:7,color:'rgba(255,255,255,0.3)',letterSpacing:'0.5px'}}>MATCH</div>
                    </div>
                  </div>
                  {/* Match bar */}
                  <div style={{height:2,background:'rgba(255,255,255,0.06)',margin:'0 14px'}}>
                    <div style={{height:'100%',width:`${matchPct}%`,background:`linear-gradient(to right,${matchColor}88,${matchColor})`,borderRadius:2,transition:'width .5s'}}/>
                  </div>
                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{padding:'12px 14px 14px',borderTop:'1px solid rgba(255,255,255,0.06)',marginTop:0}}>
                      {/* Why it fits */}
                      <div style={{background:'rgba(82,232,160,0.06)',border:'1px solid rgba(82,232,160,0.15)',borderRadius:10,padding:'9px 12px',marginBottom:10}}>
                        <div style={{fontSize:9,color:'#52E8A0',fontWeight:700,letterSpacing:'1px',marginBottom:4}}>WHY IT SUITS YOUR CLIMATE</div>
                        <div style={{fontSize:12,color:'rgba(255,255,255,0.65)',lineHeight:1.5}}>
                          {plant.score>=80
                            ? `This plant is ideally suited to ${climate?.annualAvg}°C annual average and ${climate?.annualHumidity}% humidity. Expect excellent performance year-round.`
                            : plant.score>=60
                              ? `A good match for your ${climate?.annualAvg}°C climate with minor care adjustments during extreme peaks.`
                              : `Possible with extra care — protect from temperature extremes outside this plant's comfort zone.`
                          }
                        </div>
                      </div>
                      {/* Stats row */}
                      <div style={{display:'flex',gap:7,marginBottom:10}}>
                        {[
                          {l:'WATER',v:plant.water,c:WATER_COLOR[plant.water]||'#94A3B8'},
                          {l:'SUNLIGHT',v:plant.sun,c:SUN_COLOR[plant.sun]||'#FBBF24'},
                        ].map(s=>(
                          <div key={s.l} style={{flex:1,background:'rgba(255,255,255,0.05)',borderRadius:9,padding:'8px 10px',border:'1px solid rgba(255,255,255,0.07)'}}>
                            <div style={{fontSize:8,color:'rgba(255,255,255,0.3)',letterSpacing:'1px',marginBottom:4}}>{s.l}</div>
                            <div style={{fontSize:12,fontWeight:700,color:s.c}}>{s.v}</div>
                          </div>
                        ))}
                      </div>
                      {/* Traits */}
                      <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                        {plant.traits.map(tr=>(
                          <span key={tr} style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.55)',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:20,padding:'3px 9px'}}>
                            {tr}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Browse all CTA */}
            <button onClick={()=>navigate('speciesLib')} style={{width:'100%',background:'rgba(82,232,160,0.1)',border:'1px solid rgba(82,232,160,0.25)',borderRadius:14,padding:'14px',color:'#52E8A0',fontWeight:700,fontSize:14,cursor:'pointer',marginTop:6,letterSpacing:'0.3px'}}>
              Browse Full Plant Library →
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const CityHeatScreen=({navigate})=>{
  const [status,setStatus]=useState('idle'); // idle|locating|loading|loaded|error|search
  const [showSearch,setShowSearch]=useState(false);
  const [loc,setLoc]=useState(()=>{try{const s=localStorage.getItem('hw_city_loc');return s?JSON.parse(s):null;}catch{return null;}});
  const [weather,setWeather]=useState(null);
  const [seasons,setSeasons]=useState(null);
  const [monthlyData,setMonthlyData]=useState(null); // {mTemp,mMax,mMin,mPrec,mWind} 12-item arrays
  const [forecastDays,setForecastDays]=useState(null); // 7-item array
  const [err,setErr]=useState('');
  const [cityQ,setCityQ]=useState('');
  const [cityResults,setCityResults]=useState([]);
  const [citySearching,setCitySearching]=useState(false);
  const [selectedSeason,setSelectedSeason]=useState(null); // season object or null
  const [climateTab,setClimateTab]=useState('today'); // today|week|month|year

  const wxCodeDesc=(c)=>{if(c<=1)return'Clear Sky';if(c<=3)return'Partly Cloudy';if(c<=9)return'Overcast';if(c<=19)return'Foggy';if(c<=49)return'Foggy';if(c<=59)return'Drizzle';if(c<=69)return'Rain';if(c<=79)return'Snow / Sleet';if(c<=84)return'Rain Showers';if(c<=99)return'Thunderstorm';return'Stormy';};
  const wxCodeEmoji=(c)=>{if(c<=1)return'☀️';if(c<=3)return'⛅';if(c<=9)return'☁️';if(c<=49)return'🌫️';if(c<=69)return'🌧️';if(c<=79)return'🌨️';if(c<=84)return'🌦️';return'⛈️';};
  const heatLevel=(t)=>{
    if(t>=45)return{label:'Extreme Heat',c:T.heat,bg:'rgba(249,115,22,.18)',br:'rgba(249,115,22,.32)'};
    if(t>=38)return{label:'High Heat',c:T.sun,bg:'rgba(251,191,36,.14)',br:'rgba(251,191,36,.26)'};
    if(t>=30)return{label:'Warm',c:'#86EFAC',bg:'rgba(134,239,172,.10)',br:'rgba(134,239,172,.22)'};
    if(t>=15)return{label:'Comfortable',c:T.sky,bg:'rgba(34,211,238,.10)',br:'rgba(34,211,238,.22)'};
    return{label:'Cold',c:'#93C5FD',bg:'rgba(147,197,253,.10)',br:'rgba(147,197,253,.22)'};
  };
  const uvLabel=(u)=>u>=11?'Extreme':u>=8?'Very High':u>=6?'High':u>=3?'Moderate':'Low';
  const uvColor=(u)=>u>=8?T.heat:u>=6?T.sun:u>=3?T.earth:T.green;

  const fetchWeather=async(lat,lon)=>{
    setStatus('loading');
    try{
      // Reverse geocode
      const geoR=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,{headers:{'Accept-Language':'en','User-Agent':'HeatWise/1.0'}});
      const geoD=await geoR.json();
      const addr=geoD.address||{};
      const city=addr.city||addr.town||addr.village||addr.county||addr.municipality||'Your Location';
      const country=addr.country||'';
      const state=addr.state||'';

      // Current weather + 7-day daily forecast (Open-Meteo, no API key)
      const wxR=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index,precipitation,surface_pressure&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum&forecast_days=7&timezone=auto`);
      const wxD=await wxR.json();
      const cur=wxD.current||{};
      // Parse 7-day forecast
      const daily=wxD.daily||{};
      const days=Array.isArray(daily.time)?daily.time.map((dt,i)=>({
        date:dt,
        max:daily.temperature_2m_max?.[i]??null,
        min:daily.temperature_2m_min?.[i]??null,
        code:daily.weather_code?.[i]??0,
        rain:daily.precipitation_sum?.[i]??0,
      })):[];

      // Seasonal averages: monthly archive for last full year
      const yr=new Date().getFullYear()-1;
      const archR=await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${yr}-01-01&end_date=${yr}-12-31&monthly=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_mean&timezone=auto`);
      const archD=await archR.json();
      const mo=archD.monthly||{};
      const mTemp=mo.temperature_2m_mean||Array(12).fill(null);
      const mMax=mo.temperature_2m_max||Array(12).fill(null);
      const mMin=mo.temperature_2m_min||Array(12).fill(null);
      const mPrec=mo.precipitation_sum||Array(12).fill(null);
      const mWind=mo.wind_speed_10m_mean||Array(12).fill(null);
      const avg=(arr,idxs)=>{const v=idxs.map(i=>arr[i%12]).filter(x=>x!=null);return v.length?+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):null;};

      // NH vs SH season order
      const isSH=lat<0;
      const seasonDefs=isSH?[
        {name:'Summer',icon:'☀️',idxs:[0,1,11],months:'Dec–Feb'},
        {name:'Autumn',icon:'🍂',idxs:[2,3,4],months:'Mar–May'},
        {name:'Winter',icon:'❄️',idxs:[5,6,7],months:'Jun–Aug'},
        {name:'Spring',icon:'🌸',idxs:[8,9,10],months:'Sep–Nov'},
      ]:[
        {name:'Winter',icon:'❄️',idxs:[11,0,1],months:'Dec–Feb'},
        {name:'Spring',icon:'🌸',idxs:[2,3,4],months:'Mar–May'},
        {name:'Summer',icon:'☀️',idxs:[5,6,7],months:'Jun–Aug'},
        {name:'Autumn',icon:'🍂',idxs:[8,9,10],months:'Sep–Nov'},
      ];
      const seasonalData=seasonDefs.map(s=>({
        ...s,
        avgTemp:avg(mTemp,s.idxs),
        maxTemp:avg(mMax,s.idxs),
        minTemp:avg(mMin,s.idxs),
        rain:avg(mPrec,s.idxs),
        wind:avg(mWind,s.idxs),
      }));

      const locData={lat,lon,city,country,state};
      setLoc(locData);
      try{localStorage.setItem('hw_city_loc',JSON.stringify(locData));}catch{}
      setShowSearch(false);
      setWeather({
        temp:Math.round(cur.temperature_2m??20),
        feelsLike:Math.round(cur.apparent_temperature??20),
        humidity:Math.round(cur.relative_humidity_2m??50),
        windSpeed:Math.round(cur.wind_speed_10m??0),
        uvIndex:cur.uv_index??0,
        wxCode:cur.weather_code??0,
        pressure:Math.round(cur.surface_pressure??1013),
        precip:+(cur.precipitation??0).toFixed(1),
      });
      setSeasons(seasonalData);
      setMonthlyData({mTemp,mMax,mMin,mPrec,mWind});
      setForecastDays(days);
      setSelectedSeason(null);
      setClimateTab('today');
      setStatus('loaded');
    }catch(e){
      setErr('Could not load weather data. Check your connection and try again.');
      setStatus('error');
    }
  };


  // City search using Open-Meteo geocoding (broad, debounced)
  const _searchTimer=useRef(null);
  const searchCity=async(q,immediate=false)=>{
    if(!q.trim()){setCityResults([]);return;}
    if(_searchTimer.current)clearTimeout(_searchTimer.current);
    const run=async()=>{
      setCitySearching(true);
      try{
        // Primary: Open-Meteo — broad search, 20 results
        const r=await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=20&language=en&format=json`
        );
        const d=await r.json();
        const primary=(d.results||[]);
        if(primary.length>0){setCityResults(primary);setCitySearching(false);return;}
        // Fallback: Nominatim (better small-city coverage)
        const n=await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=15`,
          {headers:{'Accept-Language':'en','User-Agent':'HeatWise/1.0'}}
        );
        const nd=await n.json();
        const mapped=(nd||[]).map(x=>({
          id:x.place_id,
          name:x.name||x.display_name?.split(',')[0],
          admin1:x.address?.state||x.address?.county||'',
          country:x.address?.country||'',
          country_code:(x.address?.country_code||'').toUpperCase(),
          latitude:parseFloat(x.lat),
          longitude:parseFloat(x.lon),
        }));
        setCityResults(mapped);
      }catch{setCityResults([]);}
      setCitySearching(false);
    };
    if(immediate)run();
    else _searchTimer.current=setTimeout(run,350);
  };

  const requestLocation=async()=>{
    setStatus('locating');
    setCityQ('');
    setCityResults([]);
    const { getCurrentPosition: getPos } = await import('../lib/geolocation.js');
    const {latitude,longitude} = await getPos();
    await fetchWeather(+latitude.toFixed(6),+longitude.toFixed(6));
  };

  useEffect(()=>{
    // Always GPS-detect on open — never load stale cache directly.
    // Fall back to cache (then search) only if GPS fails.
    requestLocation().catch(()=>{
      try{
        const saved=localStorage.getItem('hw_city_loc');
        if(saved){ const l=JSON.parse(saved); fetchWeather(l.lat,l.lon); }
        else setStatus('search');
      }catch{ setStatus('search'); }
    });
  },[]);

  const hl=weather?heatLevel(weather.temp):null;

  return(
    <div style={{paddingBottom:104,background:'rgba(5,10,24,0.90)',minHeight:'100%'}}>
      {/* Navbar */}
      <div className="navbar" style={{background:'rgba(4,9,22,.98)'}}>
        <button onClick={()=>navigate('home')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><Ic n="back" s={22} c={T.green}/></button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <div style={{fontSize:14,fontWeight:700,letterSpacing:'.5px',color:'#FFFFFF',fontFamily:"'Space Grotesk',sans-serif"}}>Live Climate</div>
          {loc&&(
            <button onClick={()=>setShowSearch(s=>!s)} style={{background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:3,margin:'2px auto 0'}}>
              <span style={{fontSize:10,color:T.green,fontFamily:"'DM Sans',sans-serif"}}>{loc.city}{loc.country?`, ${loc.country}`:''}</span>
              <Ic n="chev" s={10} c={T.green}/>
            </button>
          )}
        </div>
        <button onClick={()=>{
          if(status==='loading'||status==='locating') return;
          try{localStorage.removeItem('hw_city_loc');}catch{}
          requestLocation();
        }} style={{background:'none',border:'none',cursor:'pointer',display:'flex',opacity:status==='loading'||status==='locating'?.45:1,transition:'opacity .2s'}}>
          <Ic n="refresh" s={20} c={T.green}/>
        </button>
      </div>

      {/* ── INLINE CITY SEARCH (shown when user taps city name) ── */}
      {showSearch&&(
        <div style={{background:'rgba(4,9,22,.98)',borderBottom:'1px solid rgba(56,189,248,.15)',padding:'12px 16px',animation:'fadeIn .2s ease'}}>
          <div style={{position:'relative'}}>
            <input
              autoFocus
              value={cityQ}
              onChange={e=>{const v=e.target.value;setCityQ(v);if(v.length>1)searchCity(v);else setCityResults([]);}}
              onKeyDown={e=>{if(e.key==='Enter')searchCity(cityQ,true);if(e.key==='Escape')setShowSearch(false);}}
              placeholder="Search city, e.g. Patiala, Mumbai…"
              style={{width:'100%',boxSizing:'border-box',padding:'11px 44px 11px 14px',background:'rgba(255,255,255,0.12)',border:`1.5px solid rgba(56,189,248,.45)`,borderRadius:12,color:'#FFFFFF',fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:'none',caretColor:'#52E8A0'}}
            />
            <button onClick={()=>searchCity(cityQ,true)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:4}}>
              {citySearching
                ?<div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${T.green}`,borderTopColor:'transparent',animation:'rotateSlow .7s linear infinite'}}/>
                :<Ic n="search" s={18} c={T.green}/>}
            </button>
          </div>
          {cityResults.length>0&&(
            <div style={{marginTop:8,background:'rgba(6,14,34,.98)',border:`1px solid rgba(56,189,248,.15)`,borderRadius:12,overflow:'hidden',maxHeight:220,overflowY:'auto'}}>
              {cityResults.map((r,i)=>(
                <div key={r.id||i} onClick={()=>{fetchWeather(r.latitude,r.longitude);setShowSearch(false);setCityQ('');setCityResults([]);}}
                  style={{padding:'11px 14px',borderBottom:i<cityResults.length-1?`1px solid rgba(56,189,248,.07)`:'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(56,189,248,.07)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div>
                    <div style={{fontSize:13,color:T.textBright,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>{r.name}</div>
                    <div style={{fontSize:11,color:T.textDim,fontFamily:"'DM Sans',sans-serif",marginTop:1}}>{[r.admin1,r.country].filter(Boolean).join(', ')}</div>
                  </div>
                  <Ic n="chev" s={14} c={T.green}/>
                </div>
              ))}
            </div>
          )}
          <button onClick={()=>{setShowSearch(false);requestLocation();}} style={{background:'none',border:'none',cursor:'pointer',color:T.textDim,fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:8,padding:0}}>
            Use my current location instead
          </button>
        </div>
      )}

      {/* ── LOCATING / IP fallback ── */}
      {(status==='idle'||status==='locating')&&(
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:400,gap:22,padding:'0 32px',animation:'fadeIn .5s ease'}}>
          <div style={{width:68,height:68,borderRadius:'50%',border:`2.5px solid ${T.green}`,borderTopColor:'transparent',animation:'rotateSlow .7s linear infinite'}}/>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:16,fontWeight:600,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif",marginBottom:8}}>Detecting Your Location</div>
            <div style={{fontSize:12,color:T.textDim,fontFamily:"'DM Sans',sans-serif",lineHeight:1.8}}>Trying GPS, then network location…</div>
          </div>
        </div>
      )}

      {/* ── LOADING WEATHER ── */}
      {status==='loading'&&(
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:400,gap:22,padding:'0 32px',animation:'fadeIn .5s ease'}}>
          <div style={{position:'relative',width:68,height:68}}>
            <div style={{position:'absolute',inset:0,borderRadius:'50%',border:`2.5px solid ${T.sky}`,borderTopColor:'transparent',animation:'rotateSlow .7s linear infinite'}}/>
            <div style={{position:'absolute',inset:10,borderRadius:'50%',border:`1.5px solid rgba(56,189,248,.3)`,borderBottomColor:'transparent',animation:'rotateSlow 1.1s linear infinite reverse'}}/>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:16,fontWeight:600,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif",marginBottom:6}}>Fetching Live Weather</div>
            {loc&&<div style={{fontSize:12,color:T.green,fontFamily:"'DM Sans',sans-serif"}}>{loc.city}</div>}
            <div style={{fontSize:11,color:T.textDim,fontFamily:"'DM Sans',sans-serif",marginTop:4}}>Loading current conditions + seasonal data…</div>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {status==='error'&&(
        <div style={{margin:'32px 20px',display:'flex',flexDirection:'column',alignItems:'center',gap:14,animation:'slideUp .4s ease'}}>
          <div style={{width:56,height:56,borderRadius:16,background:'rgba(244,63,94,.12)',border:'1px solid rgba(244,63,94,.22)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>🌡</div>
          <div style={{fontSize:15,fontWeight:600,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif",textAlign:'center'}}>Weather Unavailable</div>
          <div style={{fontSize:12,color:T.textDim,fontFamily:"'DM Sans',sans-serif",textAlign:'center',lineHeight:1.6,maxWidth:280}}>{err}</div>
          <div style={{display:'flex',gap:10,width:'100%',marginTop:4}}>
            <button className="gbtn" style={{flex:1,borderRadius:14}} onClick={requestLocation}>Retry</button>
            <button className="gbtn fill" style={{flex:1,borderRadius:14}} onClick={()=>{setStatus('search');setCityQ('');setCityResults([]);}}>Search City</button>
          </div>
        </div>
      )}

      {/* ── CITY SEARCH ── */}
      {status==='search'&&(
        <div style={{padding:'20px 16px',animation:'slideUp .4s ease'}}>
          {/* Header */}
          <div style={{textAlign:'center',marginBottom:22}}>
            <div style={{width:56,height:56,borderRadius:18,background:'rgba(56,189,248,.1)',border:'1px solid rgba(56,189,248,.22)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,margin:'0 auto 12px'}}>📍</div>
            <div style={{fontSize:18,fontWeight:800,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif",marginBottom:6}}>Set Your Location</div>
            <div style={{fontSize:12,color:T.textDim,fontFamily:"'DM Sans',sans-serif",lineHeight:1.6}}>GPS unavailable on this device.<br/>Search your city to get live weather.</div>
          </div>

          {/* GPS retry button */}
          <button
            onClick={()=>requestLocation().catch(()=>setStatus('search'))}
            style={{width:'100%',marginBottom:12,padding:'13px 0',borderRadius:14,border:'1px solid rgba(56,189,248,.3)',background:'rgba(56,189,248,.08)',color:'#BAE6FD',fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            <span style={{fontSize:16}}>📡</span> Try Auto-Detect
          </button>

          {/* Search input */}
          <div style={{position:'relative',marginBottom:10}}>
            <input
              autoFocus
              value={cityQ}
              onChange={e=>{const v=e.target.value;setCityQ(v);if(v.length>1)searchCity(v);else setCityResults([]);}}
              onKeyDown={e=>{if(e.key==='Enter')searchCity(cityQ,true);}}
              placeholder="Search city — e.g. Pune, Delhi, Bengaluru…"
              style={{width:'100%',boxSizing:'border-box',padding:'14px 48px 14px 16px',background:'rgba(10,20,46,.85)',border:'1px solid rgba(56,189,248,.28)',borderRadius:14,color:T.textBright,fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:'none'}}
            />
            <button onClick={()=>searchCity(cityQ)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:4}}>
              {citySearching
                ?<div style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${T.green}`,borderTopColor:'transparent',animation:'rotateSlow .7s linear infinite'}}/>
                :<Ic n="search" s={20} c={T.green}/>}
            </button>
          </div>

          {/* Results */}
          {cityResults.length>0&&(
            <div style={{background:'rgba(6,14,34,.95)',border:'1px solid rgba(56,189,248,.15)',borderRadius:14,overflow:'hidden',marginBottom:8}}>
              {cityResults.map((r,i)=>(
                <div key={r.id||i} onClick={()=>fetchWeather(r.latitude,r.longitude)}
                  style={{padding:'13px 16px',borderBottom:i<cityResults.length-1?'1px solid rgba(56,189,248,.08)':'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(56,189,248,.07)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div>
                    <div style={{fontSize:14,color:T.textBright,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{r.name}</div>
                    <div style={{fontSize:11,color:T.textDim,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{[r.admin1,r.country].filter(Boolean).join(', ')}</div>
                  </div>
                  <Ic n="chev" s={16} c={T.green}/>
                </div>
              ))}
            </div>
          )}
          {cityResults.length===0&&cityQ.length>1&&!citySearching&&(
            <div style={{textAlign:'center',padding:'16px',color:T.textDim,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>No results — try a different spelling.</div>
          )}
        </div>
      )}

      {/* ── LOADED ── */}
      {status==='loaded'&&weather&&hl&&(()=>{
        const MONTH_LABELS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const DAY_LABELS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const mTemp=monthlyData?.mTemp||[];
        const mMax=monthlyData?.mMax||[];
        const mMin=monthlyData?.mMin||[];
        const mPrec=monthlyData?.mPrec||[];
        const yearlyAvg=mTemp.filter(Boolean).length?+(mTemp.filter(Boolean).reduce((a,b)=>a+b,0)/mTemp.filter(Boolean).length).toFixed(1):null;

        // Season-based plant recommendations
        const seasonPlants=(s)=>{
          if(!s) return SPECIES_CATALOG.slice(0,6);
          const t=s.avgTemp??25;
          return SPECIES_CATALOG.filter(p=>{
            if(t>35) return p.drought||p.sun==='full';          // hot summer → drought/sun tolerant
            if(t<15) return p.water==='scarce'||p.type==='foliage'; // cold → low water, foliage
            return p.cooling>=5;                                  // moderate → cooling plants
          }).sort((a,b)=>b.cooling-a.cooling).slice(0,6);
        };
        const suggestedPlants=seasonPlants(selectedSeason);

        return(
          <>
          {/* ── Climate timeline tabs ── */}
          <div style={{display:'flex',background:'rgba(4,9,22,0.98)',borderBottom:'1px solid rgba(56,189,248,0.08)',margin:'8px 0 0',position:'sticky',top:42,zIndex:20,padding:'8px 12px',gap:6}}>
            {[['today','Today','☀️'],['week','Week','📅'],['month','Month','📊'],['year','Year','🗓']].map(([id,label,icon])=>(
              <button key={id} onClick={()=>setClimateTab(id)} style={{
                flex:1,padding:'8px 0',
                background:climateTab===id?'linear-gradient(135deg,rgba(56,189,248,.22),rgba(45,106,79,.18))':'rgba(255,255,255,.04)',
                border:`1px solid ${climateTab===id?'rgba(56,189,248,.45)':'rgba(255,255,255,.06)'}`,
                borderRadius:12,
                color:climateTab===id?'#BAE6FD':'rgba(186,230,253,0.35)',
                fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:climateTab===id?700:500,
                cursor:'pointer',transition:'all .2s',
                boxShadow:climateTab===id?'0 0 14px rgba(56,189,248,.2)':'none',
              }}>
                <div style={{fontSize:14,marginBottom:2}}>{icon}</div>
                <div>{label}</div>
              </button>
            ))}
          </div>

          {/* ── TODAY ── */}
          {climateTab==='today'&&(
            <>
              {/* ── Hero weather card ── */}
              <div style={{margin:'12px 16px 0',borderRadius:28,overflow:'hidden',position:'relative',animation:'cardEntrance .5s ease'}}>
                {/* Layered gradient bg */}
                <div style={{position:'absolute',inset:0,background:`linear-gradient(160deg,${hl.bg.replace('.18','.92')},rgba(4,9,22,.97))`}}/>
                <div style={{position:'absolute',inset:0,border:`1.5px solid ${hl.br}`,borderRadius:28,pointerEvents:'none'}}/>
                {/* Glow orbs */}
                <div style={{position:'absolute',top:-40,right:-30,width:160,height:160,borderRadius:'50%',background:`radial-gradient(circle,${hl.c}30,transparent 70%)`,pointerEvents:'none'}}/>
                <div style={{position:'absolute',bottom:-30,left:-20,width:120,height:120,borderRadius:'50%',background:`radial-gradient(circle,${hl.c}18,transparent 70%)`,pointerEvents:'none'}}/>

                <div style={{position:'relative',zIndex:2,padding:'22px 22px 20px'}}>
                  {/* Top row: location + heat badge */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                        <span style={{fontSize:13}}>📍</span>
                        <span style={{fontSize:14,color:'rgba(255,255,255,.9)',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{loc.city}{loc.state?`, ${loc.state}`:''}</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:5,height:5,borderRadius:'50%',background:'#4ADE80',boxShadow:'0 0 6px #4ADE80',animation:'heatPulse 1.8s ease-in-out infinite'}}/>
                        <div style={{fontSize:10,color:'rgba(255,255,255,.45)',fontFamily:"'DM Sans',sans-serif"}}>Live · {new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                      </div>
                    </div>
                    <div style={{display:'inline-flex',alignItems:'center',gap:6,background:`${hl.c}22`,border:`1.5px solid ${hl.c}55`,borderRadius:22,padding:'6px 14px',boxShadow:`0 0 16px ${hl.c}22`}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:hl.c,boxShadow:`0 0 8px ${hl.c}`,animation:'heatPulse 1.5s ease-in-out infinite'}}/>
                      <span style={{fontSize:11,color:hl.c,fontFamily:"'DM Sans',sans-serif",fontWeight:800,letterSpacing:'.5px'}}>{hl.label}</span>
                    </div>
                  </div>

                  {/* Temperature + weather icon */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                    <div>
                      <div style={{fontSize:92,fontWeight:900,color:'rgba(255,255,255,.95)',fontFamily:"'Space Grotesk',sans-serif",lineHeight:.85,letterSpacing:'-5px',textShadow:`0 0 40px ${hl.c}55`}}>{weather.temp}°</div>
                      <div style={{fontSize:13,color:'rgba(255,255,255,.45)',fontFamily:"'DM Sans',sans-serif",marginTop:10}}>
                        Feels like <span style={{color:'rgba(255,255,255,.75)',fontWeight:600}}>{weather.feelsLike}°C</span>
                      </div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:64,lineHeight:1,filter:`drop-shadow(0 4px 12px ${hl.c}44)`}}>{wxCodeEmoji(weather.wxCode)}</div>
                      <div style={{fontSize:12,color:'rgba(255,255,255,.55)',fontFamily:"'DM Sans',sans-serif",marginTop:8,fontWeight:500}}>{wxCodeDesc(weather.wxCode)}</div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{height:1,background:`linear-gradient(to right,transparent,${hl.c}40,transparent)`,marginBottom:16}}/>

                  {/* Metrics strip */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                    {[
                      {e:'💧',v:`${weather.humidity}%`,l:'Humidity',c:'#60A5FA'},
                      {e:'💨',v:`${weather.windSpeed}`,l:'km/h Wind',c:'#94A3B8'},
                      {e:'🌞',v:uvLabel(weather.uvIndex),l:'UV Index',c:uvColor(weather.uvIndex)},
                      {e:'🫧',v:`${weather.pressure}`,l:'hPa',c:'#A78BFA'},
                    ].map((s,i)=>(
                      <div key={i} style={{background:'rgba(255,255,255,.07)',borderRadius:14,padding:'11px 6px',textAlign:'center',border:`1px solid ${s.c}25`,backdropFilter:'blur(4px)'}}>
                        <div style={{fontSize:16,marginBottom:5,filter:`drop-shadow(0 2px 4px ${s.c}66)`}}>{s.e}</div>
                        <div style={{fontSize:13,fontWeight:800,color:s.c,fontFamily:"'Space Grotesk',sans-serif",lineHeight:1}}>{s.v}</div>
                        <div style={{fontSize:8,color:'rgba(255,255,255,.3)',fontFamily:"'DM Sans',sans-serif",marginTop:4,letterSpacing:'.3px'}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Heat Impact cards ── */}
              <div style={{padding:'18px 16px 0'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <div>
                    <div className="slabel" style={{margin:0}}>Heat Impact at Your Location</div>
                    <div style={{fontSize:10,color:'rgba(255,255,255,.35)',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>Based on live weather · {weather.city||'your area'}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(52,211,153,.1)',border:'1px solid rgba(52,211,153,.25)',borderRadius:20,padding:'4px 10px'}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:'#34D399',animation:'breathe 1.5s ease-in-out infinite'}}/>
                    <div style={{fontSize:9,color:'#34D399',fontFamily:"'DM Sans',sans-serif",letterSpacing:'.8px',fontWeight:700}}>LIVE</div>
                  </div>
                </div>
                {(()=>{
                  const uhiVal=Math.max(1.5,Math.round((weather.temp-18)*.15*10)/10).toFixed(1);
                  const gcPct=Math.max(20,Math.min(60,Math.round(weather.temp*.95-8)));
                  const coolVal=weather.temp>35?'4.2':weather.temp>28?'2.8':'1.6';
                  const coolPct=weather.temp>35?84:weather.temp>28?56:32;
                  const rows=[
                    {
                      icon:'🌆',label:'Urban Heat Island',val:`+${uhiVal}°C`,
                      desc:'above rural baseline',
                      insight:`Urban surfaces absorb ${uhiVal}°C more heat than natural areas nearby.`,
                      c:'#FB923C',bg:'rgba(251,146,60,.08)',br:'rgba(251,146,60,.28)',
                      pct:Math.min(100,Math.max(10,parseFloat(uhiVal)*20)),barLabel:'Heat excess',
                    },
                    {
                      icon:'🌿',label:'Green Cover Target',val:`${gcPct}%`,
                      desc:'canopy needed to offset heat',
                      insight:`You need ${gcPct}% green canopy on your rooftop to neutralise current conditions.`,
                      c:'#4ADE80',bg:'rgba(74,222,128,.08)',br:'rgba(74,222,128,.28)',
                      pct:gcPct,barLabel:'Coverage target',
                    },
                    {
                      icon:'🏠',label:'Cooling Potential',val:`−${coolVal}°C`,
                      desc:'with a green rooftop layer',
                      insight:`A green roof can drop surface temp by up to ${coolVal}°C, cutting AC load by ~20%.`,
                      c:'#38BDF8',bg:'rgba(56,189,248,.08)',br:'rgba(56,189,248,.28)',
                      pct:coolPct,barLabel:'Reduction capacity',
                    },
                    {
                      icon:'🌱',label:'CO₂ Offset (100m²)',val:'1.2 T',
                      desc:'annual carbon absorption',
                      insight:'100m² of green roof absorbs ~1.2 tonnes of CO₂ per year — equal to driving 4,800 km.',
                      c:'#34D399',bg:'rgba(52,211,153,.08)',br:'rgba(52,211,153,.28)',
                      pct:60,barLabel:'vs city goal',
                    },
                  ];
                  return(
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      {rows.map((row,i)=>(
                        <div key={i} style={{borderRadius:20,padding:'18px 14px 14px',background:row.bg,border:`1.5px solid ${row.br}`,position:'relative',overflow:'hidden',animation:`cardEntrance .4s ${i*.07}s ease both`,boxShadow:`0 4px 20px ${row.c}12`}}>
                          {/* radial glow */}
                          <div style={{position:'absolute',top:-24,right:-24,width:90,height:90,borderRadius:'50%',background:`radial-gradient(circle,${row.c}30,transparent 65%)`,pointerEvents:'none'}}/>
                          {/* Icon bubble */}
                          <div style={{width:40,height:40,borderRadius:13,background:`${row.c}18`,border:`1.5px solid ${row.c}35`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,marginBottom:12}}>{row.icon}</div>
                          {/* Big value */}
                          <div style={{fontSize:26,fontWeight:900,color:row.c,fontFamily:"'Space Grotesk',sans-serif",lineHeight:1,marginBottom:4,letterSpacing:'-0.5px'}}>{row.val}</div>
                          {/* Label */}
                          <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,.80)',fontFamily:"'DM Sans',sans-serif",marginBottom:2,lineHeight:1.3}}>{row.label}</div>
                          <div style={{fontSize:9.5,color:'rgba(255,255,255,.38)',fontFamily:"'DM Sans',sans-serif",marginBottom:10}}>{row.desc}</div>
                          {/* Progress bar with label */}
                          <div style={{marginBottom:8}}>
                            <div style={{height:5,background:'rgba(255,255,255,.08)',borderRadius:5,overflow:'hidden',marginBottom:4}}>
                              <div style={{height:'100%',width:`${row.pct}%`,background:`linear-gradient(to right,${row.c}70,${row.c})`,borderRadius:5,transition:'width 1.2s cubic-bezier(.34,1.2,.64,1)'}}/>
                            </div>
                            <div style={{display:'flex',justifyContent:'space-between'}}>
                              <span style={{fontSize:8.5,color:`${row.c}90`,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{row.barLabel}</span>
                              <span style={{fontSize:8.5,color:`${row.c}`,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>{row.pct}%</span>
                            </div>
                          </div>
                          {/* Insight */}
                          <div style={{background:`${row.c}10`,border:`1px solid ${row.c}20`,borderRadius:10,padding:'7px 9px'}}>
                            <div style={{fontSize:9.5,color:'rgba(255,255,255,.55)',fontFamily:"'DM Sans',sans-serif",lineHeight:1.5}}>{row.insight}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* ── WEEK ── */}
          {climateTab==='week'&&(
            <div style={{padding:'12px 16px'}}>
              <div className="slabel" style={{marginBottom:12}}>7-Day Forecast</div>
              {forecastDays&&forecastDays.length>0?(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {forecastDays.map((d,i)=>{
                    const dt=new Date(d.date);
                    const dayName=i===0?'Today':i===1?'Tomorrow':DAY_LABELS[dt.getDay()];
                    const dl=d.max!=null?heatLevel(d.max):hl;
                    const barPct=d.max!=null?Math.min(100,Math.max(10,(d.max-10)*2.5)):50;
                    return(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:14,background:'rgba(6,14,34,.85)',border:`1px solid rgba(56,189,248,.10)`}}>
                        <div style={{width:56,flexShrink:0}}>
                          <div style={{fontSize:12,fontWeight:700,color:T.textBright,fontFamily:"'DM Sans',sans-serif"}}>{dayName}</div>
                          <div style={{fontSize:10,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>{dt.toLocaleDateString([],{month:'short',day:'numeric'})}</div>
                        </div>
                        <div style={{fontSize:22,flexShrink:0}}>{wxCodeEmoji(d.code)}</div>
                        <div style={{flex:1}}>
                          <div style={{height:5,background:'rgba(56,189,248,.1)',borderRadius:5,overflow:'hidden',marginBottom:4}}>
                            <div style={{height:'100%',width:`${barPct}%`,background:`linear-gradient(90deg,${T.sky}88,${dl.c})`,borderRadius:5,transition:'width .8s ease'}}/>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between'}}>
                            <span style={{fontSize:10,color:T.sky,fontFamily:"'JetBrains Mono',monospace"}}>{d.min!=null?`${Math.round(d.min)}°`:'-'}</span>
                            <span style={{fontSize:10,color:dl.c,fontFamily:"'JetBrains Mono',monospace"}}>{d.max!=null?`${Math.round(d.max)}°`:'-'}</span>
                          </div>
                        </div>
                        {d.rain>0&&(
                          <div style={{textAlign:'center',flexShrink:0}}>
                            <div style={{fontSize:11,color:'#60A5FA',fontWeight:700,fontFamily:"'Space Grotesk',sans-serif"}}>{Math.round(d.rain)}mm</div>
                            <div style={{fontSize:8,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>rain</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ):(
                <div style={{textAlign:'center',padding:'40px 0',color:T.textDim,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Forecast data unavailable</div>
              )}
            </div>
          )}

          {/* ── MONTH ── */}
          {climateTab==='month'&&(
            <div style={{padding:'12px 16px'}}>
              <div className="slabel" style={{marginBottom:12}}>Monthly Temperature — {new Date().getFullYear()-1}</div>
              {mTemp.length>0?(
                <>
                  {/* Year avg pill */}
                  {yearlyAvg!=null&&(
                    <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(56,189,248,.08)',border:'1px solid rgba(56,189,248,.2)',borderRadius:20,padding:'6px 14px',marginBottom:14}}>
                      <span style={{fontSize:10,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>Yearly average</span>
                      <span style={{fontSize:14,fontWeight:800,color:T.sky,fontFamily:"'Space Grotesk',sans-serif"}}>{yearlyAvg}°C</span>
                    </div>
                  )}
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {MONTH_LABELS.map((m,i)=>{
                      const t=mTemp[i];const mx=mMax[i];const mn=mMin[i];const rain=mPrec[i];
                      if(t==null) return null;
                      const ml=heatLevel(t);
                      const barW=Math.min(100,Math.max(8,(t+5)*2));
                      const now=new Date().getMonth();
                      const isCurrent=i===now;
                      return(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:12,background:isCurrent?'rgba(56,189,248,.08)':'rgba(6,14,34,.6)',border:`1px solid ${isCurrent?'rgba(56,189,248,.3)':'rgba(56,189,248,.07)'}`}}>
                          <div style={{width:28,fontSize:10,fontWeight:isCurrent?700:500,color:isCurrent?T.sky:T.textDim,fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>{m}</div>
                          <div style={{flex:1}}>
                            <div style={{height:4,background:'rgba(56,189,248,.08)',borderRadius:4,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${barW}%`,background:`linear-gradient(90deg,${ml.c}66,${ml.c})`,borderRadius:4}}/>
                            </div>
                          </div>
                          <div style={{display:'flex',gap:8,flexShrink:0}}>
                            <span style={{fontSize:11,color:T.sky,fontFamily:"'JetBrains Mono',monospace",width:30,textAlign:'right'}}>{mn!=null?`${Math.round(mn)}°`:''}</span>
                            <span style={{fontSize:12,fontWeight:700,color:ml.c,fontFamily:"'Space Grotesk',sans-serif",width:32,textAlign:'right'}}>{Math.round(t)}°</span>
                            <span style={{fontSize:11,color:T.heat,fontFamily:"'JetBrains Mono',monospace",width:30,textAlign:'right'}}>{mx!=null?`${Math.round(mx)}°`:''}</span>
                          </div>
                          {rain!=null&&<div style={{fontSize:9,color:'#60A5FA',fontFamily:"'JetBrains Mono',monospace",width:36,textAlign:'right',flexShrink:0}}>{Math.round(rain)}mm</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:'flex',justifyContent:'flex-end',gap:12,marginTop:8,paddingRight:4}}>
                    {[{c:T.sky,l:'Low'},{c:T.textBright,l:'Avg'},{c:T.heat,l:'High'},{c:'#60A5FA',l:'Rain'}].map(x=>(
                      <div key={x.l} style={{display:'flex',alignItems:'center',gap:4}}>
                        <div style={{width:6,height:6,borderRadius:'50%',background:x.c}}/>
                        <span style={{fontSize:9,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>{x.l}</span>
                      </div>
                    ))}
                  </div>
                </>
              ):(
                <div style={{textAlign:'center',padding:'40px 0',color:T.textDim,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Monthly data unavailable</div>
              )}
            </div>
          )}

          {/* ── YEAR ── */}
          {climateTab==='year'&&(
            <div style={{padding:'12px 16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div className="slabel" style={{margin:0}}>Annual Overview — {new Date().getFullYear()-1}</div>
                {yearlyAvg!=null&&<span style={{fontSize:13,fontWeight:800,color:T.sky,fontFamily:"'Space Grotesk',sans-serif"}}>{yearlyAvg}°C avg</span>}
              </div>
              {mTemp.length>0?(
                <>
                  {/* Bar chart */}
                  <div style={{background:'rgba(6,14,34,.85)',border:'1px solid rgba(56,189,248,.12)',borderRadius:18,padding:'16px 12px'}}>
                    <div style={{display:'flex',alignItems:'flex-end',gap:4,height:100,marginBottom:8}}>
                      {MONTH_LABELS.map((m,i)=>{
                        const t=mTemp[i];
                        const maxT=Math.max(...mTemp.filter(Boolean));
                        const barH=t!=null?Math.max(8,Math.round((t/maxT)*88)):8;
                        const ml=t!=null?heatLevel(t):hl;
                        const isCurrent=i===new Date().getMonth();
                        return(
                          <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                            <div style={{fontSize:8,color:t!=null?ml.c:'transparent',fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{t!=null?`${Math.round(t)}°`:''}</div>
                            <div style={{width:'100%',height:barH,borderRadius:'4px 4px 0 0',background:isCurrent?ml.c:`${ml.c}80`,boxShadow:isCurrent?`0 0 8px ${ml.c}88`:undefined,transition:'height .8s cubic-bezier(.34,1.56,.64,1)'}}/>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{display:'flex',gap:4}}>
                      {MONTH_LABELS.map((m,i)=>(
                        <div key={i} style={{flex:1,textAlign:'center',fontSize:7,color:i===new Date().getMonth()?T.sky:T.textDim,fontFamily:"'DM Sans',sans-serif",fontWeight:i===new Date().getMonth()?700:400}}>{m[0]}</div>
                      ))}
                    </div>
                  </div>
                  {/* Season summary row */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:12}}>
                    {seasons&&seasons.map(s=>{
                      const sl=s.avgTemp!=null?heatLevel(s.avgTemp):hl;
                      return(
                        <div key={s.name} style={{padding:'10px 8px',borderRadius:12,background:'rgba(6,14,34,.85)',border:`1px solid ${sl.br}`,textAlign:'center'}}>
                          <div style={{fontSize:18,marginBottom:4}}>{s.icon}</div>
                          <div style={{fontSize:11,fontWeight:700,color:sl.c,fontFamily:"'Space Grotesk',sans-serif"}}>{s.avgTemp!=null?`${s.avgTemp}°`:'–'}</div>
                          <div style={{fontSize:8,color:T.textDim,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{s.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ):(
                <div style={{textAlign:'center',padding:'40px 0',color:T.textDim,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Annual data unavailable</div>
              )}
            </div>
          )}

          {/* ── SEASONAL AVERAGES — clickable ── */}
          <div style={{padding:'20px 16px 0'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div>
                <div className="slabel" style={{margin:0}}>Seasonal Climate — {new Date().getFullYear()-1}</div>
                <div style={{fontSize:10,color:'rgba(255,255,255,.35)',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>Tap a season to explore ideal plants</div>
              </div>
              <div style={{fontSize:9,color:'rgba(56,189,248,.55)',fontFamily:"'DM Sans',sans-serif",letterSpacing:'1px',fontWeight:700,background:'rgba(56,189,248,.08)',border:'1px solid rgba(56,189,248,.18)',borderRadius:20,padding:'4px 10px'}}>TAP TO EXPLORE</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {seasons.map((s,i)=>{
                const sl=s.avgTemp!=null?heatLevel(s.avgTemp):null;
                const isActive=selectedSeason?.name===s.name;
                const accentColor=sl?.c||T.green;
                const tempPct=s.avgTemp!=null?Math.min(100,Math.max(5,(s.avgTemp+5)*2)):40;
                const growLabel=
                  s.avgTemp>35?'Drought-resistant species':
                  s.avgTemp>28?'Heat-tolerant plants thrive':
                  s.avgTemp>18?'Peak growing season':
                  s.avgTemp>8?'Cold-adapted foliage':
                  'Protect & rest roots';
                return(
                  <div key={s.name}
                    onClick={()=>setSelectedSeason(isActive?null:s)}
                    style={{borderRadius:22,padding:'16px 14px 14px',
                      background:isActive?`linear-gradient(145deg,${accentColor}28,rgba(4,9,26,.98))`:'rgba(6,14,34,.92)',
                      border:`1.5px solid ${isActive?accentColor+'90':'rgba(255,255,255,.10)'}`,
                      cursor:'pointer',transition:'all .25s',position:'relative',overflow:'hidden',
                      boxShadow:isActive?`0 6px 28px ${accentColor}35,inset 0 0 0 1px ${accentColor}20`:'0 2px 12px rgba(0,0,0,.3)',
                      animation:`cardEntrance .4s ${i*.08}s ease both`}}>
                    {/* Large watermark icon */}
                    <div style={{position:'absolute',right:-10,bottom:-10,fontSize:72,opacity:isActive?.14:.07,pointerEvents:'none',lineHeight:1,filter:'blur(1px)'}}>{s.icon}</div>
                    {/* Icon + name row */}
                    <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:10}}>
                      <div style={{width:42,height:42,borderRadius:14,background:`${accentColor}20`,border:`1.5px solid ${accentColor}45`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0,boxShadow:isActive?`0 0 14px ${accentColor}40`:'none',transition:'box-shadow .25s'}}>{s.icon}</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:800,color:isActive?accentColor:'rgba(255,255,255,.88)',fontFamily:"'Space Grotesk',sans-serif",transition:'color .2s'}}>{s.name}</div>
                        <div style={{fontSize:10,color:'rgba(255,255,255,.35)',fontFamily:"'DM Sans',sans-serif"}}>{s.months}</div>
                      </div>
                    </div>
                    {/* Avg temp large */}
                    {s.avgTemp!=null&&(
                      <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:6}}>
                        <div style={{fontSize:34,fontWeight:900,color:isActive?accentColor:'rgba(255,255,255,.75)',fontFamily:"'Space Grotesk',sans-serif",lineHeight:1,textShadow:isActive?`0 0 28px ${accentColor}60`:'none',transition:'all .25s'}}>{s.avgTemp}°</div>
                        <div style={{fontSize:11,color:'rgba(255,255,255,.35)',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>avg °C</div>
                      </div>
                    )}
                    {/* Temp range bar */}
                    {s.minTemp!=null&&s.maxTemp!=null&&(
                      <div style={{marginBottom:10}}>
                        <div style={{height:5,background:'rgba(255,255,255,.08)',borderRadius:5,overflow:'hidden',marginBottom:5}}>
                          <div style={{height:'100%',width:`${tempPct}%`,background:`linear-gradient(to right,#60A5FA88,${accentColor})`,borderRadius:5,transition:'width 1s ease'}}/>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between'}}>
                          <span style={{fontSize:9.5,color:'#60A5FA',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>❄ {Math.round(s.minTemp)}° low</span>
                          <span style={{fontSize:9.5,color:T.heat,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>🔥 {Math.round(s.maxTemp)}° high</span>
                        </div>
                      </div>
                    )}
                    {/* Rain + Wind row */}
                    <div style={{display:'flex',gap:6,marginBottom:10}}>
                      {s.rain!=null&&(
                        <div style={{flex:1,display:'flex',alignItems:'center',gap:4,background:'rgba(96,165,250,.1)',border:'1px solid rgba(96,165,250,.2)',borderRadius:9,padding:'5px 7px'}}>
                          <span style={{fontSize:11}}>🌧</span>
                          <div>
                            <div style={{fontSize:10,color:'#60A5FA',fontWeight:800,fontFamily:"'Space Grotesk',sans-serif",lineHeight:1}}>{Math.round(s.rain)}mm</div>
                            <div style={{fontSize:8,color:'rgba(255,255,255,.3)',fontFamily:"'DM Sans',sans-serif"}}>rainfall</div>
                          </div>
                        </div>
                      )}
                      {s.wind!=null&&(
                        <div style={{flex:1,display:'flex',alignItems:'center',gap:4,background:'rgba(148,163,184,.08)',border:'1px solid rgba(148,163,184,.18)',borderRadius:9,padding:'5px 7px'}}>
                          <span style={{fontSize:11}}>💨</span>
                          <div>
                            <div style={{fontSize:10,color:'#94A3B8',fontWeight:800,fontFamily:"'Space Grotesk',sans-serif",lineHeight:1}}>{Math.round(s.wind)}</div>
                            <div style={{fontSize:8,color:'rgba(255,255,255,.3)',fontFamily:"'DM Sans',sans-serif"}}>km/h wind</div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Gardening insight */}
                    <div style={{background:`${accentColor}12`,border:`1px solid ${accentColor}22`,borderRadius:10,padding:'6px 9px',marginBottom:8}}>
                      <div style={{fontSize:9.5,color:`${accentColor}CC`,fontFamily:"'DM Sans',sans-serif",fontWeight:600,lineHeight:1.4}}>🌱 {growLabel}</div>
                    </div>
                    {!isActive&&(
                      <div style={{fontSize:9,color:`${accentColor}60`,fontFamily:"'DM Sans',sans-serif",fontWeight:600,letterSpacing:'.3px'}}>Tap to explore plants →</div>
                    )}
                    {isActive&&(
                      <div style={{display:'flex',alignItems:'center',gap:4,fontSize:9,color:accentColor,fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:'.3px'}}>
                        <div style={{width:6,height:6,borderRadius:'50%',background:accentColor,animation:'breathe 1s ease-in-out infinite'}}/>
                        Showing plants below ↓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── SEASON DETAIL PANEL (appears when season tapped) ── */}
          {selectedSeason&&(()=>{
            const sl=selectedSeason.avgTemp!=null?heatLevel(selectedSeason.avgTemp):hl;
            const condLabel=
              selectedSeason.avgTemp>35?'Extreme Heat — drought-resistant & full-sun plants work best':
              selectedSeason.avgTemp>28?'Hot & Sunny — heat-tolerant species thrive':
              selectedSeason.avgTemp>18?'Warm & Pleasant — ideal growing season for most plants':
              selectedSeason.avgTemp>8?'Mild & Cool — foliage and cold-adapted species':
              'Cold — limit outdoor planting; protect roots';
            return(
              <div style={{margin:'12px 16px 0',borderRadius:20,border:`1.5px solid ${sl.c}40`,background:'rgba(4,9,22,.98)',overflow:'hidden',animation:'cardEntrance .3s ease'}}>
                {/* Season header */}
                <div style={{background:`linear-gradient(135deg,${sl.bg.replace('.18','.6')},rgba(4,9,22,.95))`,padding:'16px 18px',borderBottom:`1px solid ${sl.c}20`}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                    <span style={{fontSize:28}}>{selectedSeason.icon}</span>
                    <div>
                      <div style={{fontSize:18,fontWeight:800,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif"}}>{selectedSeason.name}</div>
                      <div style={{fontSize:11,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>{selectedSeason.months} · Average conditions</div>
                    </div>
                    <div style={{marginLeft:'auto',textAlign:'right'}}>
                      <div style={{fontSize:28,fontWeight:800,color:sl.c,fontFamily:"'Space Grotesk',sans-serif",lineHeight:1}}>{selectedSeason.avgTemp!=null?`${selectedSeason.avgTemp}°`:'–'}</div>
                      <div style={{fontSize:9,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>avg °C</div>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:sl.c,fontFamily:"'DM Sans',sans-serif",fontWeight:500,lineHeight:1.4}}>{condLabel}</div>
                </div>

                {/* Conditions grid */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,background:`${sl.c}12`,borderBottom:`1px solid ${sl.c}15`}}>
                  {[
                    {e:'🌡️',v:selectedSeason.maxTemp!=null?`${selectedSeason.maxTemp}°`:'–',l:'Peak High',c:T.heat},
                    {e:'❄️',v:selectedSeason.minTemp!=null?`${selectedSeason.minTemp}°`:'–',l:'Daily Low',c:T.sky},
                    {e:'🌧️',v:selectedSeason.rain!=null?`${Math.round(selectedSeason.rain)}mm`:'–',l:'Avg Rain',c:'#60A5FA'},
                    {e:'💨',v:selectedSeason.wind!=null?`${Math.round(selectedSeason.wind)}`:'–',l:'Wind km/h',c:T.textDim},
                  ].map((s,i)=>(
                    <div key={i} style={{padding:'12px 4px',textAlign:'center',background:'rgba(4,9,22,.85)'}}>
                      <div style={{fontSize:16,marginBottom:4}}>{s.e}</div>
                      <div style={{fontSize:14,fontWeight:800,color:s.c,fontFamily:"'Space Grotesk',sans-serif"}}>{s.v}</div>
                      <div style={{fontSize:8,color:T.textDim,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Suitable plants */}
                <div style={{padding:'14px 16px'}}>
                  <div style={{fontSize:10,letterSpacing:'1.5px',color:`${sl.c}`,fontFamily:"'JetBrains Mono',monospace",marginBottom:12,fontWeight:700}}>
                    BEST PLANTS FOR {selectedSeason.name.toUpperCase()}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {suggestedPlants.map((p,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:12,background:'rgba(10,20,46,.7)',border:'1px solid rgba(56,189,248,.1)'}}>
                        <span style={{fontSize:22,flexShrink:0}}>{p.emoji}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif"}}>{p.name}</div>
                          <div style={{fontSize:10,color:T.textDim,fontFamily:"'DM Sans',sans-serif",marginTop:1}}>{p.sci}</div>
                        </div>
                        <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:6}}>
                          {p.drought&&<span style={{fontSize:9,padding:'2px 6px',borderRadius:6,background:'rgba(251,191,36,.12)',border:'1px solid rgba(251,191,36,.25)',color:'#FBBF24',fontFamily:"'DM Sans',sans-serif"}}>Drought</span>}
                          <div style={{textAlign:'center'}}>
                            <div style={{fontSize:14,fontWeight:800,color:sl.c,fontFamily:"'Space Grotesk',sans-serif"}}>{p.cooling}</div>
                            <div style={{fontSize:7,color:T.textDim,fontFamily:"'JetBrains Mono',monospace"}}>COOL</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={()=>navigate('speciesLib')}
                    style={{width:'100%',marginTop:14,padding:'13px 0',borderRadius:14,border:`1px solid ${sl.c}50`,cursor:'pointer',
                      background:`linear-gradient(135deg,${sl.bg.replace('.18','.6')},rgba(4,9,22,.95))`,
                      color:sl.c,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,letterSpacing:'.3px'}}>
                    🌱 See All Plants for {selectedSeason.name} →
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Scan CTA */}
          <div style={{padding:'20px 16px 0',display:'flex',flexDirection:'column',gap:10}}>
            <button onClick={()=>navigate('create')}
              style={{width:'100%',padding:'20px 24px',borderRadius:20,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#0A2E4A,#0369A1,#38BDF8)',boxShadow:'0 10px 36px rgba(56,189,248,.38)',display:'flex',alignItems:'center',gap:14,position:'relative',overflow:'hidden',textAlign:'left'}}>
              <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 25% 50%,rgba(255,255,255,.14),transparent 55%)',pointerEvents:'none'}}/>
              <div style={{width:46,height:46,borderRadius:14,background:'rgba(255,255,255,.12)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Ic n="scan" s={24} c="#E0F2FE"/>
              </div>
              <div style={{flex:1,position:'relative',zIndex:1}}>
                <div style={{fontSize:17,fontWeight:700,color:'#E0F2FE',fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'.2px'}}>Scan With Us</div>
                <div style={{fontSize:11,color:'rgba(224,242,254,.65)',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>Open AR measurement · analyse your space</div>
              </div>
              <div style={{fontSize:20,color:'rgba(224,242,254,.7)',position:'relative',zIndex:1}}>→</div>
            </button>
            <button className="gbtn" onClick={()=>navigate('speciesLib')} style={{borderRadius:16}}>Browse All Cooling Plants</button>
          </div>
          </>
        );
      })()}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   PLANT PHOTOS — direct verified Wikimedia CDN URLs
   Format: https://upload.wikimedia.org/wikipedia/commons/thumb/{a}/{ab}/{file}/{w}px-{file}
   These are permanent CDN links used by Wikipedia; no redirects, no CORS issues.
   Falls back to emoji via onError if an individual image fails.
══════════════════════════════════════════════════════════════════ */
const PLANT_PHOTOS = {
  // ── species catalog codes ────────────────────────────────────────
  tulsi_holy:       'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Ocimum_tenuiflorum3.jpg/240px-Ocimum_tenuiflorum3.jpg',
  basil_sweet:      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Basilicum_labelled.jpg/240px-Basilicum_labelled.jpg',
  mint:             'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Peppermint_bush.jpg/240px-Peppermint_bush.jpg',
  lemongrass:       'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Lemongrass_01.jpg/240px-Lemongrass_01.jpg',
  sedum:            'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Sedum_spathulifolium_2.jpg/240px-Sedum_spathulifolium_2.jpg',
  prickly_pear:     'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Opuntia_ficus-indica_1.jpg/240px-Opuntia_ficus-indica_1.jpg',
  portulaca:        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Portulaca_grandiflora.jpg/240px-Portulaca_grandiflora.jpg',
  marigold:         'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Tagetes_erecta_flowers.jpg/240px-Tagetes_erecta_flowers.jpg',
  bougainvillea:    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Bougainvillea_shrub.jpg/240px-Bougainvillea_shrub.jpg',
  pothos:           'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Epipremnum_aureum_31082012.jpg/240px-Epipremnum_aureum_31082012.jpg',
  snake_plant:      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Sansevieria_trifasciata_Prain.jpg/240px-Sansevieria_trifasciata_Prain.jpg',
  areca_palm_dwarf: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Chrysalidocarpus_lutescens.jpg/240px-Chrysalidocarpus_lutescens.jpg',
  vetiver:          'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Chrysopogon_zizanioides.jpg/240px-Chrysopogon_zizanioides.jpg',
  bamboo_dwarf:     'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Pleioblastus_variegatus.jpg/240px-Pleioblastus_variegatus.jpg',
  cherry_tomato:    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Tomato_je.jpg/240px-Tomato_je.jpg',
  curry_leaf:       'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Curry_leaf_plant.jpg/240px-Curry_leaf_plant.jpg',
  aloe_vera:        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Aloe_vera_flower_inset.png/240px-Aloe_vera_flower_inset.png',
  zinnia:           'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Zinnia_elegans_001.jpg/240px-Zinnia_elegans_001.jpg',
  // ── climate-screen plant ids ────────────────────────────────────
  aloe:             'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Aloe_vera_flower_inset.png/240px-Aloe_vera_flower_inset.png',
  jasmine:          'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Jasmine_flowers.jpg/240px-Jasmine_flowers.jpg',
  lavender:         'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Lavandula_angustifolia_2.jpg/240px-Lavandula_angustifolia_2.jpg',
  hibiscus:         'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Hibiscus_rosa-sinensis.jpg/240px-Hibiscus_rosa-sinensis.jpg',
  chrysanth:        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Chrysanthemum_morifolium_Ramat.jpg/240px-Chrysanthemum_morifolium_Ramat.jpg',
  rosemary:         'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Rosemary_bush.jpg/240px-Rosemary_bush.jpg',
  agave:            'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Agave_americana_2.jpg/240px-Agave_americana_2.jpg',
  snake:            'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Sansevieria_trifasciata_Prain.jpg/240px-Sansevieria_trifasciata_Prain.jpg',
  tulsi:            'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Ocimum_tenuiflorum3.jpg/240px-Ocimum_tenuiflorum3.jpg',
  turmeric:         'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Curcuma_longa_roots.jpg/240px-Curcuma_longa_roots.jpg',
  fern:             'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Nephrolepis_exaltata_HabitusLeaf_BotGardBln0906.jpg/240px-Nephrolepis_exaltata_HabitusLeaf_BotGardBln0906.jpg',
  bougain:          'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Bougainvillea_shrub.jpg/240px-Bougainvillea_shrub.jpg',
  geranium:         'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Geranium_phaeum_flowers.jpg/240px-Geranium_phaeum_flowers.jpg',
  // ── plant-type fallbacks for Edit palette ───────────────────────
  tree:             'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Curry_leaf_plant.jpg/240px-Curry_leaf_plant.jpg',
  shrub:            'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Hibiscus_rosa-sinensis.jpg/240px-Hibiscus_rosa-sinensis.jpg',
  ornamental:       'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Tagetes_erecta_flowers.jpg/240px-Tagetes_erecta_flowers.jpg',
  herb:             'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Basilicum_labelled.jpg/240px-Basilicum_labelled.jpg',
  succulent:        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Aloe_vera_flower_inset.png/240px-Aloe_vera_flower_inset.png',
  climber:          'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Bougainvillea_shrub.jpg/240px-Bougainvillea_shrub.jpg',
  vegetable:        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Tomato_je.jpg/240px-Tomato_je.jpg',
  grass:            'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Chrysopogon_zizanioides.jpg/240px-Chrysopogon_zizanioides.jpg',
  foliage:          'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Epipremnum_aureum_31082012.jpg/240px-Epipremnum_aureum_31082012.jpg',
};

/**
 * Renders a plant photo from Wikimedia CDN; falls back to emoji via onError.
 * No hooks — pure img element, zero crash risk.
 */
const PlantImg = ({ code, type, emoji, size = 56, round = 10, style = {} }) => {
  const src = PLANT_PHOTOS[code] || PLANT_PHOTOS[type];
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <span style={{ fontSize: size * 0.55, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, ...style }}>
        {emoji}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={code || type}
      onError={() => setErr(true)}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: round, display: 'block', flexShrink: 0, ...style }}
    />
  );
};

/* ══════════════════════════════════════════════════════════════════
   SCREEN 20 — SPECIES LIBRARY
══════════════════════════════════════════════════════════════════ */
const SPECIES_CATALOG=[
  {code:'tulsi_holy',name:'Tulsi',sci:'Ocimum tenuiflorum',emoji:'🌿',type:'herb',cooling:7,sun:'full',water:'moderate',petSafe:true,drought:false,desc:'Sacred and medicinal; strong aroma repels insects. Thrives in Indian summer heat.'},
  {code:'basil_sweet',name:'Sweet Basil',sci:'Ocimum basilicum',emoji:'🌱',type:'herb',cooling:5,sun:'full',water:'moderate',petSafe:true,drought:false,desc:'Culinary herb with excellent rooftop adaptability. Fragrant and productive.'},
  {code:'mint',name:'Mint',sci:'Mentha spp.',emoji:'🌿',type:'herb',cooling:6,sun:'partial',water:'abundant',petSafe:false,drought:false,desc:'Rapid ground cover. Needs moist conditions. Invasive — keep isolated.'},
  {code:'lemongrass',name:'Lemongrass',sci:'Cymbopogon citratus',emoji:'🌾',type:'herb',cooling:8,sun:'full',water:'moderate',petSafe:false,drought:false,desc:'Tall grass with citrus aroma. Exceptional heat tolerance and cooling score.'},
  {code:'sedum',name:'Sedum',sci:'Sedum spp.',emoji:'🪨',type:'succulent',cooling:6,sun:'full',water:'scarce',petSafe:true,drought:true,desc:'Ideal for low-water rooftops. Forms dense mats reducing surface temperature.'},
  {code:'prickly_pear',name:'Prickly Pear',sci:'Opuntia spp.',emoji:'🌵',type:'succulent',cooling:7,sun:'full',water:'scarce',petSafe:false,drought:true,desc:'Extreme drought tolerance. Excellent insulation layer. Handle with care.'},
  {code:'portulaca',name:'Portulaca',sci:'Portulaca grandiflora',emoji:'🌸',type:'ornamental',cooling:6,sun:'full',water:'scarce',petSafe:true,drought:true,desc:'Bright flowering succulent. Drought-hardy and perfect for hot terraces.'},
  {code:'marigold',name:'Marigold',sci:'Tagetes spp.',emoji:'🌼',type:'ornamental',cooling:5,sun:'full',water:'moderate',petSafe:true,drought:false,desc:'Cheerful orange blooms. Natural pest deterrent for adjacent vegetables.'},
  {code:'bougainvillea',name:'Bougainvillea',sci:'Bougainvillea spp.',emoji:'🌺',type:'ornamental',cooling:8,sun:'full',water:'moderate',petSafe:false,drought:false,desc:'Spectacular blooms cover large areas. Best for trellis or wall coverage.'},
  {code:'pothos',name:'Pothos',sci:'Epipremnum aureum',emoji:'🍃',type:'foliage',cooling:6,sun:'shade',water:'moderate',petSafe:false,drought:true,desc:'Shade master. Excellent for north-facing and partially covered spaces.'},
  {code:'snake_plant',name:'Snake Plant',sci:'Sansevieria trifasciata',emoji:'🌿',type:'foliage',cooling:5,sun:'shade',water:'scarce',petSafe:false,drought:true,desc:'Ultra-resilient. Tolerates neglect and low light. Superb air purifier.'},
  {code:'areca_palm_dwarf',name:'Areca Palm',sci:'Dypsis lutescens',emoji:'🌴',type:'foliage',cooling:7,sun:'partial',water:'abundant',petSafe:true,drought:false,desc:'Tropical accent. Excellent shade and humidity generation. Pet-safe!'},
  {code:'vetiver',name:'Vetiver',sci:'Chrysopogon zizanioides',emoji:'🌾',type:'grass',cooling:9,sun:'full',water:'moderate',petSafe:true,drought:false,desc:'Highest cooling score. Deep roots prevent erosion. Wind-resistant champion.'},
  {code:'bamboo_dwarf',name:'Dwarf Bamboo',sci:'Pleioblastus spp.',emoji:'🎋',type:'grass',cooling:8,sun:'partial',water:'moderate',petSafe:true,drought:false,desc:'Dense screening and shade. Fast growing. Creates microclimate in containers.'},
  {code:'cherry_tomato',name:'Cherry Tomato',sci:'Solanum lycopersicum',emoji:'🍅',type:'vegetable',cooling:4,sun:'full',water:'moderate',petSafe:true,drought:false,desc:'Productive edible option. Combine with herbs for companion planting benefits.'},
  {code:'curry_leaf',name:'Curry Leaf',sci:'Murraya koenigii',emoji:'🌿',type:'herb',cooling:6,sun:'full',water:'moderate',petSafe:false,drought:false,desc:'Indispensable in Indian cooking. Moderate heat tolerance with good moisture.'},
  {code:'aloe_vera',name:'Aloe Vera',sci:'Aloe barbadensis',emoji:'🌵',type:'succulent',cooling:5,sun:'full',water:'scarce',petSafe:false,drought:true,desc:'Medicinal succulent. Stores water in leaves for prolonged dry spells.'},
  {code:'zinnia',name:'Zinnia',sci:'Zinnia elegans',emoji:'🌸',type:'ornamental',cooling:5,sun:'full',water:'moderate',petSafe:true,drought:false,desc:'Fast-growing annual with vivid blooms. Attracts pollinators and butterflies.'},
];
const TYPE_FILTERS=['all','herb','ornamental','succulent','foliage','grass','vegetable'];
const SpeciesLibraryScreen=({navigate,setSelectedSpecies})=>{
  const [filter,setFilter]=useState('all');
  const [search,setSearch]=useState('');
  const visible=SPECIES_CATALOG.filter(s=>(filter==='all'||s.type===filter)&&(!search||s.name.toLowerCase().includes(search.toLowerCase())));
  const typeColor={herb:T.green,ornamental:'#F48FB1',succulent:T.earth,foliage:'#7DD3FC',grass:'#B5C99A',vegetable:T.sun};
  return(
    <div style={{paddingBottom:90,background:'rgba(242,243,247,0.92)'}}>
      <div className="navbar">
        <button onClick={()=>navigate('cityHeat')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><Ic n="back" s={22} c={T.green}/></button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <div style={{fontSize:14,fontWeight:700,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif"}}>Species Library</div>
          <div style={{fontSize:10,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>{visible.length} of {SPECIES_CATALOG.length} plants</div>
        </div>
        <div style={{width:32}}/>
      </div>
      {/* Search */}
      <div style={{padding:'12px 20px 0'}}>
        <div style={{position:'relative'}}>
          <input className="hinp" placeholder="Search plants…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{paddingLeft:38,fontSize:13}}/>
          <div style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)'}}><Ic n="search" s={14} c="rgba(56,189,248,.5)"/></div>
        </div>
      </div>
      {/* Filter chips */}
      <div className="scrx" style={{padding:'12px 20px',gap:8}}>
        {TYPE_FILTERS.map(f=>(
          <button key={f} className={`chip${filter===f?' on':''}`} onClick={()=>setFilter(f)}
            style={filter===f?{background:`${typeColor[f]||T.green}18`,color:typeColor[f]||T.green,borderColor:`${typeColor[f]||T.green}50`}:{}}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>
      {/* Grid */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px'}}>
        {visible.map((sp,i)=>(
          <div key={sp.code} className="spc-card" style={{animationDelay:`${i*.04}s`}}
            onClick={()=>{ setSelectedSpecies(sp); navigate('speciesDetail'); }}>
            {/* Header — plant photo or emoji fallback */}
            <div style={{height:80,background:`linear-gradient(135deg,${(typeColor[sp.type]||T.green)}18,${(typeColor[sp.type]||T.green)}08)`,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
              <PlantImg code={sp.code} type={sp.type} emoji={sp.emoji} size={80} round={0} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:0}}/>
              {sp.drought&&<div style={{position:'absolute',top:8,right:8,fontSize:10,background:'rgba(9,22,14,0.82)',border:'1px solid rgba(251,191,36,.5)',borderRadius:12,padding:'2px 7px',color:T.earth,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Drought ✓</div>}
            </div>
            <div style={{padding:'10px 12px'}}>
              <div style={{fontSize:13,fontWeight:700,color:T.textBright,marginBottom:2,fontFamily:"'Space Grotesk',sans-serif"}}>{sp.name}</div>
              <div style={{fontSize:9,color:T.textDim,marginBottom:8,fontFamily:"'DM Sans',sans-serif",fontStyle:'italic'}}>{sp.sci}</div>
              {/* Cooling score bar */}
              <div style={{marginBottom:6}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:9,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>Cooling</span>
                  <span style={{fontSize:9,fontWeight:700,color:T.green,fontFamily:"'DM Sans',sans-serif"}}>{sp.cooling}/10</span>
                </div>
                <div style={{height:3,background:'rgba(56,189,248,.1)',borderRadius:2}}>
                  <div style={{height:'100%',width:`${sp.cooling*10}%`,background:`linear-gradient(90deg,#0284C7,#38BDF8)`,borderRadius:2,transition:'width .6s ease'}}/>
                </div>
              </div>
              <div style={{display:'flex',gap:4}}>
                {sp.petSafe&&<span style={{fontSize:9,background:'rgba(34,211,238,.1)',color:T.sky,border:'1px solid rgba(34,211,238,.25)',borderRadius:10,padding:'2px 7px',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Pet Safe</span>}
                <span style={{fontSize:9,background:`${(typeColor[sp.type]||T.green)}12`,color:typeColor[sp.type]||T.green,border:`1px solid ${(typeColor[sp.type]||T.green)}28`,borderRadius:10,padding:'2px 7px',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{sp.type}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   SCREEN 21 — SPECIES DETAIL
══════════════════════════════════════════════════════════════════ */
const SpeciesDetailScreen=({navigate,selectedSpecies})=>{
  const sp=selectedSpecies||SPECIES_CATALOG[0];
  const typeColor={herb:T.green,ornamental:'#F48FB1',succulent:T.earth,foliage:'#7DD3FC',grass:'#B5C99A',vegetable:T.sun};
  const tc=typeColor[sp.type]||T.green;
  const [animated,setAnimated]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setAnimated(true),300);return()=>clearTimeout(t);},[sp]);
  const sunLabel={full:'Full Sun ☀️',partial:'Partial ⛅',shade:'Shade 🌑'};
  const waterLabel={abundant:'Abundant 💧💧',moderate:'Moderate 💧',scarce:'Scarce 🏜'};
  return(
    <div style={{paddingBottom:90,background:'rgba(242,243,247,0.92)'}}>
      <div className="navbar">
        <button onClick={()=>navigate('speciesLib')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><Ic n="back" s={22} c={T.green}/></button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <div style={{fontSize:14,fontWeight:700,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif"}}>Plant Profile</div>
        </div>
        <div style={{width:32}}/>
      </div>
      {/* Hero */}
      <div className="a1" style={{margin:'16px 20px',borderRadius:22,overflow:'hidden',position:'relative',minHeight:200}}>
        <div style={{position:'absolute',inset:0,background:`linear-gradient(135deg,${tc}18,${tc}08)`}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 50% 40%,rgba(56,189,248,.08),transparent 70%)'}}/>
        {/* Animated rings */}
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-52%)',width:160,height:160}}>
          {[1,2,3].map(r=>(
            <div key={r} style={{position:'absolute',inset:0,borderRadius:'50%',border:`1px solid ${tc}${r===1?'40':r===2?'25':'12'}`,margin:r*20,animation:`breathe ${2+r*.5}s ease-in-out infinite`}}/>
          ))}
        </div>
        <div style={{position:'relative',zIndex:2,padding:'32px 24px',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center'}}>
          <div style={{marginBottom:16,animation:'leafFloat 3s ease-in-out infinite',borderRadius:18,overflow:'hidden',boxShadow:`0 4px 24px ${tc}44`}}>
            <PlantImg code={sp.code} type={sp.type} emoji={sp.emoji} size={96} round={18}/>
          </div>
          <div style={{fontSize:22,fontWeight:800,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif",marginBottom:4}}>{sp.name}</div>
          <div style={{fontSize:11,color:T.textDim,fontStyle:'italic',fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>{sp.sci}</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
            <span style={{fontSize:11,background:`${tc}18`,color:tc,border:`1px solid ${tc}35`,borderRadius:20,padding:'4px 12px',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{sp.type}</span>
            {sp.petSafe&&<span style={{fontSize:11,background:'rgba(34,211,238,.12)',color:T.sky,border:'1px solid rgba(34,211,238,.3)',borderRadius:20,padding:'4px 12px',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Pet Safe 🐾</span>}
            {sp.drought&&<span style={{fontSize:11,background:'rgba(251,191,36,.12)',color:T.earth,border:'1px solid rgba(251,191,36,.3)',borderRadius:20,padding:'4px 12px',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Drought Tolerant</span>}
          </div>
        </div>
      </div>
      {/* Care indicators */}
      <div style={{padding:'0 20px',marginBottom:16}}>
        <div className="slabel a2">Care Guide</div>
        <div className="a3 hud" style={{padding:'16px 18px'}}>
          {[
            {label:'Cooling Score',val:sp.cooling,max:10,color:T.green,icon:'❄'},
            {label:'Sun Exposure',text:sunLabel[sp.sun]||sp.sun,icon:'☀'},
            {label:'Water Need',text:waterLabel[sp.water]||sp.water,icon:'💧'},
          ].map((c,i)=>(
            <div key={i} style={{marginBottom:i<2?14:0}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,alignItems:'center'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:14}}>{c.icon}</span>
                  <span style={{fontSize:12,color:T.text,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>{c.label}</span>
                </div>
                <span style={{fontSize:12,color:T.textBright,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{c.text||`${c.val}/${c.max}`}</span>
              </div>
              {c.val&&(
                <div style={{height:5,background:'rgba(56,189,248,.08)',borderRadius:3}}>
                  <div style={{height:'100%',width:animated?`${c.val/c.max*100}%`:'0%',background:`linear-gradient(90deg,#0284C7,${c.color})`,borderRadius:3,transition:'width .9s cubic-bezier(.34,1.06,.64,1)'}}/>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Description */}
      <div style={{padding:'0 20px',marginBottom:20}}>
        <div className="slabel a4">About This Plant</div>
        <div className="a5 hud" style={{padding:'14px 16px'}}>
          <p style={{fontSize:13,color:T.text,lineHeight:1.7,fontFamily:"'DM Sans',sans-serif"}}>{sp.desc}</p>
        </div>
      </div>
      {/* Ideal for */}
      <div style={{padding:'0 20px',marginBottom:20}}>
        <div className="slabel a6">Best For</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',animation:'growUp .4s .35s ease both',opacity:0,animationFillMode:'both'}}>
          {(sp.sun==='shade'?['shaded balcony','indoor pots']:sp.drought?['dry terrace','water-scarce roof']:['open terrace','sunny rooftop']).map(tag=>(
            <div key={tag} style={{background:'rgba(56,189,248,.08)',border:'1px solid rgba(56,189,248,.2)',borderRadius:20,padding:'7px 14px',fontSize:11,color:T.green,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{tag}</div>
          ))}
          <div style={{background:'rgba(56,189,248,.08)',border:'1px solid rgba(56,189,248,.2)',borderRadius:20,padding:'7px 14px',fontSize:11,color:T.green,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>container garden</div>
        </div>
      </div>
      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:10}}>
        <button className="gbtn fill" onClick={()=>navigate('create')}>Include in New Scan →</button>
        <button className="gbtn" onClick={()=>navigate('speciesLib')}>Back to Library</button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   SCREEN — AI GARDEN LAYOUT (2D plan + metrics, post-analysis)
══════════════════════════════════════════════════════════════════ */
const ZONE_META={
  perimeter: {label:'Perimeter Beds', color:'#38BDF8',bg:'rgba(56,189,248,0.13)', icon:'🌿'},
  center:    {label:'Centre Beds',    color:'#22D3EE',bg:'rgba(34,211,238,0.13)', icon:'🌸'},
  north_wall:{label:'North Wall',     color:'#F9C74F',bg:'rgba(249,199,79,0.13)', icon:'🌾'},
  south_face:{label:'South Face',     color:'#E76F51',bg:'rgba(231,111,81,0.13)', icon:'🌺'},
  full_cover:{label:'Full Cover',     color:'#7DD3FC',bg:'rgba(116,198,157,0.13)',icon:'🍃'},
  container: {label:'Containers',     color:'#D4A373',bg:'rgba(251,191,36,0.13)',icon:'🪴'},
};
const DEFAULT_ZONE='perimeter';

/* ── Canvas rounded-rect helper (matches LiveAR) ── */
function _rr(ctx,x,y,w,h,r){
  if(typeof ctx.roundRect==='function'){ctx.roundRect(x,y,w,h,r);return;}
  const rv=Math.min(r,w/2,h/2);
  ctx.moveTo(x+rv,y);ctx.lineTo(x+w-rv,y);ctx.quadraticCurveTo(x+w,y,x+w,y+rv);
  ctx.lineTo(x+w,y+h-rv);ctx.quadraticCurveTo(x+w,y+h,x+w-rv,y+h);
  ctx.lineTo(x+rv,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-rv);
  ctx.lineTo(x,y+rv);ctx.quadraticCurveTo(x,y,x+rv,y);
}

/* ── Draw a single top-view plant symbol (landscape plan style) ── */
function _plantSymbol(ctx,px,py,r,color,phase){
  // Outer canopy ring
  ctx.save();
  ctx.globalAlpha=phase*0.22;
  ctx.beginPath();ctx.arc(px,py,r*1.55,0,Math.PI*2);
  ctx.fillStyle=color;ctx.fill();
  ctx.restore();
  // Canopy fill
  ctx.save();
  ctx.globalAlpha=phase*0.70;
  const g=ctx.createRadialGradient(px-r*0.2,py-r*0.2,r*0.05,px,py,r);
  g.addColorStop(0,'rgba(255,255,255,0.25)');
  g.addColorStop(0.4,color);
  g.addColorStop(1,color.replace(')',',0.55)').replace('rgb','rgba'));
  ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);
  ctx.fillStyle=g;ctx.fill();
  ctx.restore();
  // Canopy outline
  ctx.save();ctx.globalAlpha=phase*0.9;
  ctx.strokeStyle=color;ctx.lineWidth=0.9;
  ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.stroke();
  ctx.restore();
  // Trunk dot
  ctx.save();ctx.globalAlpha=phase;
  ctx.beginPath();ctx.arc(px,py,Math.max(1.5,r*0.22),0,Math.PI*2);
  ctx.fillStyle='rgba(4,9,22,0.9)';ctx.fill();
  ctx.restore();
}

/* ── Architectural dimension line ── */
function _dimLine(ctx,x1,y1,x2,y2,label,side){
  ctx.save();ctx.globalAlpha=0.55;
  ctx.strokeStyle='rgba(186,230,253,0.5)';ctx.lineWidth=0.7;ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.setLineDash([]);
  // Arrows
  const ang=Math.atan2(y2-y1,x2-x1);
  const arrLen=5;
  [[x1,y1],[x2,y2]].forEach(([ax,ay],i)=>{
    const dir=i===0?ang+Math.PI:ang;
    ctx.beginPath();
    ctx.moveTo(ax,ay);
    ctx.lineTo(ax+Math.cos(dir+0.4)*arrLen,ay+Math.sin(dir+0.4)*arrLen);
    ctx.moveTo(ax,ay);
    ctx.lineTo(ax+Math.cos(dir-0.4)*arrLen,ay+Math.sin(dir-0.4)*arrLen);
    ctx.stroke();
  });
  // Label
  const mx=(x1+x2)/2,my=(y1+y2)/2;
  ctx.font="bold 8.5px 'DM Sans',sans-serif";
  ctx.fillStyle='rgba(186,230,253,0.75)';
  ctx.textAlign='center';ctx.textBaseline='middle';
  const off=side==='top'?-9:side==='left'?-9:9;
  const offX=side==='left'?off:0,offY=side==='top'?off:0;
  ctx.fillText(label,mx+offX,my+offY);
  ctx.restore();
}

/* ══════════════════════════════════════════════════
   MAIN GARDEN PLAN RENDERER — architectural top-down
══════════════════════════════════════════════════ */
function drawLayoutPlan(canvas, plants, widthM, lengthM, phase){
  const ctx=canvas.getContext('2d');
  if(!ctx) return;
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);

  /* ── layout geometry ── */
  const padH=36, padV=30;
  const maxW=W-padH*2, maxH=H-padV*2;
  const scale=Math.min(maxW/Math.max(widthM,3), maxH/Math.max(lengthM,3));
  const rW=widthM*scale, rH=lengthM*scale;
  const ox=(W-rW)/2, oy=(H-rH)/2;

  const BED=Math.min(rW,rH)*0.14;   // perimeter bed width in px
  const PATH=Math.min(rW,rH)*0.08;  // walkway width in px

  /* ── 1. Paper background ── */
  ctx.fillStyle='#0a1a10';
  ctx.fillRect(0,0,W,H);
  // Subtle dot grid
  ctx.fillStyle='rgba(56,189,248,0.055)';
  for(let gx=12;gx<W;gx+=16) for(let gy=12;gy<H;gy+=16){
    ctx.beginPath();ctx.arc(gx,gy,0.9,0,Math.PI*2);ctx.fill();
  }

  if(phase<0.04) return;
  const a0=Math.min(1,phase*6);

  /* ── 2. Rooftop slab ── */
  ctx.save();ctx.globalAlpha=a0;
  // Shadow
  ctx.shadowColor='rgba(56,189,248,0.18)';ctx.shadowBlur=20;
  ctx.fillStyle='#112218';
  ctx.beginPath();_rr(ctx,ox,oy,rW,rH,5);ctx.fill();
  ctx.shadowBlur=0;
  // Subtle concrete texture (hatching)
  ctx.globalAlpha=a0*0.04;
  ctx.strokeStyle='#38BDF8';ctx.lineWidth=0.5;
  for(let gx=ox;gx<ox+rW;gx+=10){ctx.beginPath();ctx.moveTo(gx,oy);ctx.lineTo(gx,oy+rH);ctx.stroke();}
  for(let gy=oy;gy<oy+rH;gy+=10){ctx.beginPath();ctx.moveTo(ox,gy);ctx.lineTo(ox+rW,gy);ctx.stroke();}
  // Outer boundary
  ctx.globalAlpha=a0;
  ctx.strokeStyle='rgba(56,189,248,0.7)';ctx.lineWidth=2;
  ctx.beginPath();_rr(ctx,ox,oy,rW,rH,5);ctx.stroke();
  ctx.restore();

  if(phase<0.12) return;
  const a1=Math.min(1,(phase-0.12)*4);

  /* ── 3. Perimeter bed strip ── */
  ctx.save();ctx.globalAlpha=a1*0.9;
  // Fill around edges — top, bottom, left, right bands
  ctx.fillStyle='#1a3a20';
  // Top band
  ctx.beginPath();_rr(ctx,ox+1,oy+1,rW-2,BED,4);ctx.fill();
  // Bottom band
  ctx.beginPath();_rr(ctx,ox+1,oy+rH-BED-1,rW-2,BED,4);ctx.fill();
  // Left band (inner of top/bottom)
  ctx.fillRect(ox+1,oy+BED,BED,rH-BED*2);
  // Right band
  ctx.fillRect(ox+rW-BED-1,oy+BED,BED,rH-BED*2);
  // Bed border (inner)
  ctx.strokeStyle='rgba(56,189,248,0.35)';ctx.lineWidth=1;ctx.setLineDash([4,3]);
  ctx.beginPath();_rr(ctx,ox+BED,oy+BED,rW-BED*2,rH-BED*2,3);ctx.stroke();
  ctx.setLineDash([]);
  // "BORDER BEDS" label
  ctx.font="bold 7px 'DM Sans',sans-serif";ctx.fillStyle='rgba(56,189,248,0.5)';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('BORDER BEDS',ox+rW/2,oy+BED/2);
  ctx.restore();

  if(phase<0.25) return;
  const a2=Math.min(1,(phase-0.25)*4);

  /* ── 4. Interior: paths + raised beds ── */
  // Interior bounds (inside the perimeter bed)
  const ix=ox+BED, iy=oy+BED, iw=rW-BED*2, ih=rH-BED*2;

  ctx.save();ctx.globalAlpha=a2;
  // Paved walkway fill (lighter concrete)
  ctx.fillStyle='#162c1c';
  ctx.fillRect(ix,iy,iw,ih);

  // Decide bed layout based on aspect ratio
  const portrait=ih>iw;
  // Central path (horizontal or vertical)
  const centralPathFrac=0.5;

  // Two raised beds separated by a central path
  const pathW=Math.min(PATH,iw*0.15,ih*0.15);
  let beds=[];
  if(!portrait){
    // Landscape: left bed | path | right bed (plus horizontal path midway)
    const bw=(iw-pathW)/2;
    const bh1=(ih-pathW)/2;
    beds=[
      {x:ix,        y:iy,          w:bw,h:bh1, label:'BED A'},
      {x:ix+bw+pathW,y:iy,         w:bw,h:bh1, label:'BED B'},
      {x:ix,        y:iy+bh1+pathW,w:bw,h:ih-bh1-pathW, label:'BED C'},
      {x:ix+bw+pathW,y:iy+bh1+pathW,w:bw,h:ih-bh1-pathW,label:'BED D'},
    ];
  } else {
    // Portrait: top bed | path | bottom bed (2 columns)
    const bh=(ih-pathW)/2;
    const bw1=(iw-pathW)/2;
    beds=[
      {x:ix,         y:iy,          w:bw1,h:bh, label:'BED A'},
      {x:ix+bw1+pathW,y:iy,         w:iw-bw1-pathW,h:bh, label:'BED B'},
      {x:ix,         y:iy+bh+pathW, w:bw1,h:ih-bh-pathW, label:'BED C'},
      {x:ix+bw1+pathW,y:iy+bh+pathW,w:iw-bw1-pathW,h:ih-bh-pathW,label:'BED D'},
    ];
  }
  // Draw raised beds
  beds.forEach(b=>{
    if(b.w<4||b.h<4) return;
    ctx.fillStyle='#1d3d25';
    ctx.beginPath();_rr(ctx,b.x+1,b.y+1,b.w-2,b.h-2,3);ctx.fill();
    ctx.strokeStyle='rgba(34,211,238,0.3)';ctx.lineWidth=1;
    ctx.beginPath();_rr(ctx,b.x+1,b.y+1,b.w-2,b.h-2,3);ctx.stroke();
    // Bed label
    ctx.font="bold 6.5px 'DM Sans',sans-serif";
    ctx.fillStyle='rgba(34,211,238,0.45)';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(b.label,b.x+b.w/2,b.y+b.h/2);
  });

  // Path centre line dash decoration
  ctx.strokeStyle='rgba(56,189,248,0.18)';ctx.lineWidth=1;ctx.setLineDash([4,6]);
  if(!portrait){
    const midY=iy+ih/2;
    ctx.beginPath();ctx.moveTo(ix,midY);ctx.lineTo(ix+iw,midY);ctx.stroke();
    const midX=ix+iw/2;
    ctx.beginPath();ctx.moveTo(midX,iy);ctx.lineTo(midX,iy+ih);ctx.stroke();
  } else {
    const midX=ix+iw/2;
    ctx.beginPath();ctx.moveTo(midX,iy);ctx.lineTo(midX,iy+ih);ctx.stroke();
    const midY=iy+ih/2;
    ctx.beginPath();ctx.moveTo(ix,midY);ctx.lineTo(ix+iw,midY);ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  if(phase<0.4) return;

  /* ── 5. Plant symbols ── */
  const byZone={};
  plants.forEach(p=>{
    const z=p.placementZone||DEFAULT_ZONE;
    if(!byZone[z]) byZone[z]=[];
    byZone[z].push(p);
  });

  const plantPhase=Math.min(1,(phase-0.4)*2.5);

  // Perimeter plants — distribute around the 4 edges
  const perimPlants=(byZone.perimeter||byZone.north_wall||[]).concat(byZone.north_wall||[]).concat(byZone.south_face||[]);
  const allPerim=[...(byZone.perimeter||[]),...(byZone.south_face||[])];
  if(allPerim.length>0){
    const ZC=ZONE_META.perimeter.color;
    const perR=Math.max(3,Math.min(BED*0.32,8));
    const step=Math.max(perR*2.8,10);
    let pts=[];
    // Top strip
    for(let px2=ox+BED/2+perR;px2<ox+rW-BED/2-perR;px2+=step) pts.push([px2,oy+BED/2]);
    // Bottom strip
    for(let px2=ox+BED/2+perR;px2<ox+rW-BED/2-perR;px2+=step) pts.push([px2,oy+rH-BED/2]);
    // Left strip (skip corners)
    for(let py2=oy+BED+perR;py2<oy+rH-BED-perR;py2+=step) pts.push([ox+BED/2,py2]);
    // Right strip
    for(let py2=oy+BED+perR;py2<oy+rH-BED-perR;py2+=step) pts.push([ox+rW-BED/2,py2]);
    pts.slice(0,Math.max(8,allPerim.length*2)).forEach(([ppx,ppy],i)=>{
      const pa=Math.min(1,plantPhase*2-i*0.04);
      if(pa<=0) return;
      _plantSymbol(ctx,ppx,ppy,perR,ZC,pa);
    });
  }

  // North wall plants — row along top interior
  if(byZone.north_wall && byZone.north_wall.length>0){
    const ZC=ZONE_META.north_wall.color;
    const nR=Math.max(4,Math.min(BED*0.38,9));
    const step=Math.max(nR*2.8,11);
    for(let i=0;i<byZone.north_wall.length;i++){
      const px2=ix+nR+(i%Math.floor(iw/(step)))*step;
      if(px2>ix+iw-nR) break;
      const pa=Math.min(1,plantPhase*2-i*0.08);
      if(pa>0) _plantSymbol(ctx,px2,iy+nR,nR,ZC,pa);
    }
  }

  // Center bed plants — distributed across the 4 beds
  const centerPlants=byZone.center||byZone.full_cover||[];
  if(centerPlants.length>0 && beds.length>0){
    const ZC=ZONE_META.center.color;
    beds.forEach((b,bi)=>{
      if(b.w<8||b.h<8) return;
      const bPlants=centerPlants.slice(bi*2,(bi+1)*2);
      if(bPlants.length===0 && bi>0) return;
      const cR=Math.max(4,Math.min(Math.min(b.w,b.h)*0.18,10));
      const step=cR*2.6;
      const cols=Math.floor((b.w-cR*2)/step)+1;
      const rows=Math.floor((b.h-cR*2)/step)+1;
      let si=0;
      for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
        const ppx=b.x+cR+(col*step);
        const ppy=b.y+cR+(row*step);
        if(ppx>b.x+b.w-cR||ppy>b.y+b.h-cR||si>8) break;
        const pa=Math.min(1,plantPhase*2-(si*0.07)-(bi*0.15));
        if(pa>0) _plantSymbol(ctx,ppx,ppy,cR,ZC,pa);
        si++;
      }
    });
  }

  // Container plants — corners
  if(byZone.container && byZone.container.length>0){
    const ZC=ZONE_META.container.color;
    const cR=Math.max(4,Math.min(BED*0.35,8));
    const corners=[[ox+BED/2,oy+BED/2],[ox+rW-BED/2,oy+BED/2],[ox+BED/2,oy+rH-BED/2],[ox+rW-BED/2,oy+rH-BED/2]];
    byZone.container.slice(0,4).forEach((sp,i)=>{
      const pa=Math.min(1,plantPhase*2-i*0.1);
      if(pa>0 && corners[i]) _plantSymbol(ctx,corners[i][0],corners[i][1],cR,ZC,pa);
    });
  }

  /* ── 6. Compass rose ── */
  if(phase>0.7){
    const ca=Math.min(1,(phase-0.7)*5);
    ctx.save();ctx.globalAlpha=ca;
    const nx=ox+rW-13,ny=oy+14;
    // Circle
    ctx.strokeStyle='rgba(56,189,248,0.5)';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.arc(nx,ny,8,0,Math.PI*2);ctx.stroke();
    // N arrow
    ctx.fillStyle='rgba(56,189,248,0.9)';
    ctx.beginPath();ctx.moveTo(nx,ny-7);ctx.lineTo(nx-3,ny);ctx.lineTo(nx+3,ny);ctx.closePath();ctx.fill();
    // S arrow (hollow)
    ctx.strokeStyle='rgba(56,189,248,0.5)';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.moveTo(nx,ny+7);ctx.lineTo(nx-3,ny);ctx.lineTo(nx+3,ny);ctx.closePath();ctx.stroke();
    // N label
    ctx.font="bold 6px 'DM Sans',sans-serif";ctx.fillStyle='rgba(56,189,248,0.9)';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('N',nx,ny-11);
    ctx.restore();
  }

  /* ── 7. Dimension lines ── */
  if(phase>0.65){
    const da=Math.min(1,(phase-0.65)*5);
    ctx.globalAlpha=da;
    _dimLine(ctx, ox,oy-16,ox+rW,oy-16, `${widthM.toFixed(1)} m`,'top');
    _dimLine(ctx, ox-16,oy,ox-16,oy+rH, `${lengthM.toFixed(1)} m`,'left');
    ctx.globalAlpha=1;
  }

  /* ── 8. Scale bar ── */
  if(phase>0.8){
    const sa=Math.min(1,(phase-0.8)*5);
    ctx.save();ctx.globalAlpha=sa*0.65;
    const sbLen=scale*2; // 2m bar
    const sbX=ox+6,sbY=oy+rH+10;
    ctx.fillStyle='rgba(56,189,248,0.8)';
    ctx.fillRect(sbX,sbY,sbLen,3);
    ctx.fillRect(sbX,sbY-2,1.5,7);ctx.fillRect(sbX+sbLen,sbY-2,1.5,7);
    ctx.font="6px 'DM Sans',sans-serif";ctx.fillStyle='rgba(186,230,253,0.55)';
    ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillText('2 m',sbX+sbLen/2,sbY+5);
    ctx.restore();
  }

  /* ── 9. Scan line while generating ── */
  if(phase<0.95){
    const sl=oy+rH*phase;
    const slG=ctx.createLinearGradient(ox,sl,ox+rW,sl);
    slG.addColorStop(0,'rgba(56,189,248,0)');
    slG.addColorStop(0.5,'rgba(56,189,248,0.45)');
    slG.addColorStop(1,'rgba(56,189,248,0)');
    ctx.strokeStyle=slG;ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(ox,sl);ctx.lineTo(ox+rW,sl);ctx.stroke();
  }
}

const PLANT_TYPE_EMOJI={herb:'🌿',grass:'🌾',succulent:'🪴',cactus:'🌵',shrub:'🍃',foliage:'🌴',vegetable:'🥬',ornamental:'🌸',perennial:'🌺',creeper:'🍀',climber:'🌿',tree:'🌳',palm:'🌴',bamboo:'🎋',fern:'🌿'};

const GardenLayoutScreen=({navigate,selectedRecommendation,photoSession})=>{
  const [tab,setTab]=useState('plan');

  const heatSummary=selectedRecommendation?.heatReductionSummary||null;
  const scoredPlants=(selectedRecommendation?.candidate?.scoredPlants??[]).map(sp=>({
    ...sp.plant,
    placementZone:sp.placementZone||'perimeter',
    quantity:sp.quantity||1,
    relevanceScore:sp.relevanceScore||0,
  })).filter(Boolean);

  const widthM=photoSession?.widthM||8;
  const lengthM=photoSession?.lengthM||6;
  const areaM2=Math.round(widthM*lengthM);
  const dropC=heatSummary?.estimatedDropC??3.8;
  const coverage=Math.round((heatSummary?.plantCoverageRatio??0.6)*100);
  const co2=areaM2?(areaM2*0.021).toFixed(1):'1.2';
  const confidence=heatSummary?.confidence||'medium';
  const CONF_COLOR={high:'#4ADE80',medium:'#FBBF24',low:'#F97316'};
  const confPct=confidence==='high'?92:confidence==='medium'?72:48;

  // Group plants by zone
  const zones={};
  scoredPlants.forEach(sp=>{
    const z=sp.placementZone||'perimeter';
    if(!zones[z]) zones[z]=[];
    zones[z].push(sp);
  });
  const zoneList=Object.entries(zones);
  const ZONE_COLORS={
    perimeter:'#22C55E',center:'#38BDF8',north_wall:'#FBBF24',
    south_face:'#F97316',full_cover:'#7DD3FC',container:'#D4A373',
  };

  // CSS garden map — top-down zone view
  const ZoneMap=()=>{
    const aspect=Math.min(Math.max(widthM/lengthM,0.5),2);
    const mapH=Math.round(200/aspect);
    const perimPct=16; // perimeter band %
    const hasPerim=zones.perimeter||zones.north_wall||zones.south_face;
    const hasCent=zones.center||zones.full_cover;
    const hasCont=zones.container;
    return(
      <div style={{position:'relative',width:'100%',height:Math.min(mapH,220),background:'#0b1f10',borderRadius:14,overflow:'hidden',border:'1px solid rgba(56,189,248,0.18)'}}>
        {/* Dimension labels */}
        <div style={{position:'absolute',top:8,left:'50%',transform:'translateX(-50%)',fontSize:9,color:'rgba(186,230,253,0.45)',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'1px',pointerEvents:'none'}}>
          {widthM.toFixed(1)} m
        </div>
        <div style={{position:'absolute',top:'50%',left:8,transform:'translateY(-50%) rotate(-90deg)',fontSize:9,color:'rgba(186,230,253,0.45)',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'1px',pointerEvents:'none',transformOrigin:'center'}}>
          {lengthM.toFixed(1)} m
        </div>
        {/* Outer boundary */}
        <div style={{position:'absolute',inset:'20px 24px 12px 28px',border:'1.5px solid rgba(56,189,248,0.5)',borderRadius:8,overflow:'hidden'}}>
          {/* Perimeter planting band */}
          {hasPerim&&(
            <div style={{position:'absolute',inset:0,border:`${perimPct/2}px solid rgba(34,197,94,0.25)`,borderRadius:6,boxSizing:'border-box'}}>
              {/* Perimeter label */}
              <div style={{position:'absolute',top:4,right:8,fontSize:7,color:'rgba(34,197,94,0.7)',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'0.5px'}}>PERIMETER</div>
            </div>
          )}
          {/* Center planting area */}
          {hasCent&&(
            <div style={{position:'absolute',inset:`${perimPct+4}px`,background:'rgba(56,189,248,0.08)',borderRadius:4,border:'1px solid rgba(56,189,248,0.22)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontSize:7,color:'rgba(56,189,248,0.55)',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'0.5px'}}>RAISED BEDS</span>
            </div>
          )}
          {/* Container dots (corners) */}
          {hasCont&&[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy],ci)=>(
            <div key={ci} style={{position:'absolute',
              left:sx<0?6:undefined,right:sx>0?6:undefined,
              top:sy<0?6:undefined,bottom:sy>0?6:undefined,
              width:16,height:16,borderRadius:'50%',
              background:'rgba(212,163,115,0.25)',border:'1.5px solid rgba(212,163,115,0.6)',
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontSize:8}}>🪴</span>
            </div>
          ))}
          {/* Walkway centre lines */}
          <div style={{position:'absolute',top:'50%',left:`${perimPct}%`,right:`${perimPct}%`,height:1,background:'rgba(56,189,248,0.12)',transform:'translateY(-50%)'}}/>
          <div style={{position:'absolute',left:'50%',top:`${perimPct}%`,bottom:`${perimPct}%`,width:1,background:'rgba(56,189,248,0.12)',transform:'translateX(-50%)'}}/>
        </div>
        {/* Compass */}
        <div style={{position:'absolute',bottom:10,right:12,width:22,height:22,borderRadius:'50%',border:'1px solid rgba(56,189,248,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:8,fontWeight:700,color:'rgba(56,189,248,0.7)',fontFamily:"'JetBrains Mono',monospace"}}>N</span>
        </div>
        {/* Scale bar */}
        <div style={{position:'absolute',bottom:10,left:30,display:'flex',alignItems:'center',gap:4}}>
          <div style={{width:24,height:2,background:'rgba(186,230,253,0.4)',borderRadius:1}}/>
          <span style={{fontSize:7,color:'rgba(186,230,253,0.4)',fontFamily:"'JetBrains Mono',monospace"}}>2 m</span>
        </div>
      </div>
    );
  };

  return(
    <div style={{background:'rgba(242,243,247,0.92)',minHeight:'100%'}}>

      {/* ── Hero header with photo or gradient ── */}
      <div style={{position:'relative',height:180,overflow:'hidden'}}>
        {photoSession?.capturedPhoto?(
          <img src={photoSession.capturedPhoto} alt="your space" style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.6}}/>
        ):(
          <div style={{width:'100%',height:'100%',background:`linear-gradient(160deg,${T.greenDark} 0%,${T.green} 50%,${T.teal} 100%)`}}/>
        )}
        {/* Light gradient overlay */}
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(27,67,50,0.3) 0%,rgba(27,67,50,0.7) 100%)'}}/>
        {/* Nav row */}
        <div style={{position:'absolute',top:0,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'calc(env(safe-area-inset-top,44px) + 14px)',paddingBottom:14,paddingLeft:16,paddingRight:16}}>
          <button onClick={()=>navigate('home')} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'7px 10px',cursor:'pointer',display:'flex',alignItems:'center',backdropFilter:'blur(6px)'}}>
            <Ic n="back" s={18} c="#fff"/>
          </button>
          <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.18)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:20,padding:'5px 12px',backdropFilter:'blur(6px)'}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#4ADE80',boxShadow:'0 0 8px #4ADE80'}}/>
            <span style={{fontSize:9,color:'#fff',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'1.5px',fontWeight:700}}>PLAN READY</span>
          </div>
        </div>
        {/* Title block */}
        <div style={{position:'absolute',bottom:18,left:18,right:18}}>
          <div style={{fontSize:10,letterSpacing:'2px',color:'rgba(255,255,255,0.65)',fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>GARDEN DESIGN PLAN</div>
          <div style={{fontSize:20,fontWeight:800,color:'#fff',fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-0.3px'}}>
            {photoSession?.projectMeta?.name||'Your Rooftop Garden'}
          </div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.65)',fontFamily:"'DM Sans',sans-serif",marginTop:3}}>
            {widthM.toFixed(1)} m × {lengthM.toFixed(1)} m · {scoredPlants.length} species · {areaM2} m²
          </div>
        </div>
      </div>

      {/* ── Key metrics strip ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:1,background:T.border,borderTop:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`}}>
        {[
          {label:'COOLING', value:`−${dropC.toFixed(1)}°C`, color:T.teal,    bg:T.cardGreen},
          {label:'COVERAGE',value:`${coverage}%`,           color:'#16A34A', bg:'#F0FDF4'},
          {label:'CO₂/YR', value:`${co2}T`,                color:T.earth,   bg:T.cardAmber},
        ].map((m,i)=>(
          <div key={i} style={{padding:'14px 0',textAlign:'center',background:m.bg}}>
            <div style={{fontSize:20,fontWeight:800,color:m.color,fontFamily:"'Space Grotesk',sans-serif",lineHeight:1}}>{m.value}</div>
            <div style={{fontSize:8,letterSpacing:'1.5px',color:T.textDim,fontFamily:"'JetBrains Mono',monospace",marginTop:4}}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tab navigation ── */}
      <div style={{display:'flex',background:T.bgAlt,borderBottom:`1px solid ${T.border}`}}>
        {[['plan','Layout'],['plants','Plants'],['impact','Impact']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:'12px 0',background:'none',border:'none',
            borderBottom:`2px solid ${tab===id?T.green:'transparent'}`,
            color:tab===id?T.green:T.textDim,
            fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:tab===id?700:500,cursor:'pointer',transition:'all .2s',letterSpacing:'.3px'}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: LAYOUT PLAN ── */}
      {tab==='plan'&&(
        <div style={{padding:'16px'}}>

          {/* Garden map */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,letterSpacing:'1.5px',color:T.green,fontFamily:"'JetBrains Mono',monospace",marginBottom:10,opacity:0.7}}>TOP-DOWN VIEW</div>
            <ZoneMap/>
          </div>

          {/* Zone legend cards */}
          {zoneList.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,letterSpacing:'1.5px',color:T.green,fontFamily:"'JetBrains Mono',monospace",marginBottom:10,opacity:0.7}}>PLANTING ZONES</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {zoneList.map(([zk,zp])=>{
                  const zm=ZONE_META[zk]||ZONE_META.perimeter;
                  const zc=ZONE_COLORS[zk]||zm.color;
                  return(
                    <div key={zk} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:12,background:T.bgAlt,border:`1px solid ${T.border}`,boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
                      <div style={{width:40,height:40,borderRadius:10,background:`${zc}18`,border:`1.5px solid ${zc}50`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                        {zm.icon}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:T.textBright,fontFamily:"'DM Sans',sans-serif"}}>{zm.label}</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:5}}>
                          {zp.slice(0,4).map((sp,i)=>(
                            <span key={i} style={{fontSize:9,padding:'2px 7px',borderRadius:10,background:`${zc}18`,border:`1px solid ${zc}40`,color:`${zc}`,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                              {sp.name}{sp.quantity>1?` ×${sp.quantity}`:''}
                            </span>
                          ))}
                          {zp.length>4&&<span style={{fontSize:9,color:T.textDim,fontFamily:"'DM Sans',sans-serif",padding:'2px 4px'}}>+{zp.length-4} more</span>}
                        </div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:16,fontWeight:800,color:zc,fontFamily:"'Space Grotesk',sans-serif"}}>{zp.length}</div>
                        <div style={{fontSize:8,color:T.textDim,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'0.5px'}}>SPECIES</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI confidence bar */}
          <div style={{padding:'14px 16px',borderRadius:12,background:T.bgAlt,border:`1px solid ${T.border}`,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <span style={{fontSize:11,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>AI Confidence</span>
              <span style={{fontSize:12,fontWeight:700,color:CONF_COLOR[confidence],fontFamily:"'DM Sans',sans-serif",textTransform:'capitalize'}}>{confidence}</span>
            </div>
            <div style={{height:6,background:T.greenDim,borderRadius:5,overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:5,background:`linear-gradient(90deg,${CONF_COLOR[confidence]}99,${CONF_COLOR[confidence]})`,width:`${confPct}%`,transition:'width 1.2s cubic-bezier(.22,1,.36,1)'}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: PLANTS ── */}
      {tab==='plants'&&(
        <div style={{padding:'16px'}}>
          {scoredPlants.length===0?(
            <div style={{textAlign:'center',padding:'48px 0',color:T.textDim,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>No plant data — run analysis first.</div>
          ):(
            <>
              <div style={{fontSize:10,letterSpacing:'1.5px',color:T.green,fontFamily:"'JetBrains Mono',monospace",marginBottom:12,opacity:0.7}}>
                {scoredPlants.length} RECOMMENDED SPECIES
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {scoredPlants.map((sp,i)=>{
                  const zm=ZONE_META[sp.placementZone||DEFAULT_ZONE]||ZONE_META.perimeter;
                  const zc=ZONE_COLORS[sp.placementZone||DEFAULT_ZONE]||zm.color;
                  const emoji=PLANT_TYPE_EMOJI[sp.type||'herb']||'🌿';
                  const waterDots={low:'●○○',medium:'●●○',high:'●●●'};
                  const sun=(sp.sunRequirement||['full'])[0];
                  const sunLabel={full:'Full sun',partial:'Partial',shade:'Shade'};
                  return(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'14px',borderRadius:14,background:T.bgAlt,border:`1px solid ${T.border}`,boxShadow:'0 1px 4px rgba(0,0,0,0.04)',transition:'border-color .2s'}}>
                      <div style={{width:46,height:46,borderRadius:13,background:`${zc}18`,border:`1.5px solid ${zc}45`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>
                        {emoji}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                          <div style={{fontSize:14,fontWeight:700,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif"}}>{sp.name}</div>
                          {sp.quantity>1&&<div style={{fontSize:10,fontWeight:700,color:zc,background:`${zc}18`,padding:'1px 7px',borderRadius:8,fontFamily:"'DM Sans',sans-serif"}}>×{sp.quantity}</div>}
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:9,padding:'2px 8px',borderRadius:8,background:`${zc}18`,border:`1px solid ${zc}35`,color:zc,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{zm.label}</span>
                          <span style={{fontSize:10,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>{sunLabel[sun]||'Full sun'}</span>
                          <span style={{fontSize:10,color:T.green,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'1px',opacity:0.6}}>{waterDots[sp.waterNeeds||'medium']}</span>
                        </div>
                      </div>
                      <div style={{flexShrink:0,textAlign:'center'}}>
                        <div style={{fontSize:13,fontWeight:800,color:zc,fontFamily:"'Space Grotesk',sans-serif"}}>{Math.round((sp.relevanceScore||0.7)*10)}</div>
                        <div style={{fontSize:7,letterSpacing:'1px',color:T.textDim,fontFamily:"'JetBrains Mono',monospace"}}>SCORE</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: IMPACT ── */}
      {tab==='impact'&&(
        <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:12}}>
          <div style={{fontSize:10,letterSpacing:'1.5px',color:T.green,fontFamily:"'JetBrains Mono',monospace",marginBottom:4,opacity:0.7}}>ENVIRONMENTAL IMPACT</div>

          {/* Big metrics */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {[
              {label:'Heat Reduction',value:`−${dropC.toFixed(1)}°C`,sub:'Surface temp drop',color:T.teal,    bg:T.cardGreen,  emoji:'🌡️'},
              {label:'Green Coverage',value:`${coverage}%`,          sub:'Area with plants', color:'#16A34A', bg:'#F0FDF4',    emoji:'🌿'},
              {label:'CO₂ Offset',    value:`${co2}T`,               sub:'Per year',         color:T.earth,   bg:T.cardAmber,  emoji:'💨'},
              {label:'Species',       value:`${scoredPlants.length}`, sub:'Recommended plants',color:'#7C3AED',bg:T.cardPurple, emoji:'🌱'},
            ].map(m=>(
              <div key={m.label} style={{padding:'16px 14px',borderRadius:14,background:m.bg,border:`1px solid ${T.border}`}}>
                <div style={{fontSize:22,marginBottom:8}}>{m.emoji}</div>
                <div style={{fontSize:24,fontWeight:800,color:m.color,fontFamily:"'Space Grotesk',sans-serif",lineHeight:1}}>{m.value}</div>
                <div style={{fontSize:11,fontWeight:600,color:T.textBright,fontFamily:"'DM Sans',sans-serif",marginTop:4}}>{m.label}</div>
                <div style={{fontSize:10,color:T.textDim,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* AI explanation */}
          {selectedRecommendation?.explanation&&(
            <div style={{padding:'16px',borderRadius:14,background:T.bgAlt,border:`1px solid ${T.borderSky}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:T.green}}/>
                <span style={{fontSize:10,letterSpacing:'1.5px',color:T.green,fontFamily:"'JetBrains Mono',monospace",opacity:0.75}}>AI ANALYSIS</span>
              </div>
              <p style={{fontSize:13,color:T.text,lineHeight:1.7,margin:0,fontFamily:"'DM Sans',sans-serif"}}>
                {selectedRecommendation.explanation?.summary||selectedRecommendation.explanation?.rationale||'Personalised garden plan generated by HeatWise AI based on your rooftop conditions, microclimate, and selected species.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Sticky CTA footer ── */}
      <div style={{position:'sticky',bottom:0,background:'rgba(255,255,255,0.97)',borderTop:`1px solid ${T.border}`,padding:'14px 16px 32px',display:'flex',flexDirection:'column',gap:8,zIndex:50,marginTop:16,backdropFilter:'blur(12px)'}}>
        <button onClick={()=>navigate('result')} style={{width:'100%',padding:'15px 0',borderRadius:14,border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:15,background:`linear-gradient(135deg,${T.greenDark},${T.green},${T.teal})`,color:'#fff',boxShadow:'0 6px 20px rgba(45,106,79,0.35)',letterSpacing:'.3px'}}>
          View 3D Garden →
        </button>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <button onClick={()=>navigate('report')} style={{padding:'12px 0',borderRadius:12,border:`1px solid ${T.border}`,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,background:T.bgAlt,color:T.text}}>
            Full Report
          </button>
          <button onClick={()=>navigate('install')} style={{padding:'12px 0',borderRadius:12,border:`1px solid ${T.greenGlow}`,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,background:T.cardGreen,color:T.green}}>
            Get Quote
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   SCREEN 22 — INSTALL SUCCESS
══════════════════════════════════════════════════════════════════ */
const InstallSuccessScreen=({navigate})=>{
  const [burst,setBurst]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setBurst(true),100);return()=>clearTimeout(t);},[]);
  const particles=Array.from({length:18},(_,i)=>({
    angle:(i/18)*360,dist:60+Math.random()*40,color:i%3===0?T.green:i%3===1?T.sky:T.sun,size:5+Math.random()*5,
  }));
  return(
    <div style={{height:'100%',background:'rgba(5,8,18,0.90)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 28px',textAlign:'center',position:'relative',overflow:'hidden'}}>
      {/* Background glow */}
      <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 50% 45%,rgba(56,189,248,.14) 0%,transparent 65%)',pointerEvents:'none'}}/>
      {/* Particles */}
      {burst&&particles.map((p,i)=>{
        const rad=p.angle*Math.PI/180;
        const tx=`${Math.cos(rad)*p.dist}px`;const ty=`${Math.sin(rad)*p.dist}px`;
        return(
          <div key={i} style={{position:'absolute',top:'38%',left:'50%',width:p.size,height:p.size,borderRadius:'50%',background:p.color,
            '--tx':tx,'--ty':ty,animation:`particleBurst ${.6+Math.random()*.6}s ${i*.04}s ease-out forwards`}}/>
        );
      })}
      {/* Checkmark */}
      <div className="a1" style={{width:90,height:90,borderRadius:'50%',background:'linear-gradient(135deg,#0C4A6E,#38BDF8)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:24,boxShadow:'0 8px 40px rgba(56,189,248,.5)',animation:'celebratePop .7s .1s ease both',opacity:0,animationFillMode:'both'}}>
        <Ic n="check" s={40} c="#E0F2FE"/>
      </div>
      <h2 className="a2" style={{fontSize:26,fontWeight:800,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif",marginBottom:8}}>Request Confirmed!</h2>
      <p className="a3" style={{fontSize:14,color:T.textDim,lineHeight:1.7,fontFamily:"'DM Sans',sans-serif",marginBottom:32}}>
        Your installation quote request has been sent to verified local partners. Expect a response within 24 hours.
      </p>
      {/* Steps */}
      <div className="a4 hud" style={{width:'100%',padding:'16px 20px',marginBottom:28,textAlign:'left'}}>
        {[
          {n:'1',t:'Request Received',s:'Our system has logged your request',done:true},
          {n:'2',t:'Partner Matching',s:'Connecting with 2–3 certified installers nearby',done:false},
          {n:'3',t:'Quote Delivery',s:'Installer contacts you within 24h',done:false},
        ].map((step,i)=>(
          <div key={i} style={{display:'flex',gap:12,marginBottom:i<2?14:0,alignItems:'flex-start'}}>
            <div style={{width:26,height:26,borderRadius:'50%',background:step.done?T.green:'rgba(56,189,248,.12)',border:`1.5px solid ${step.done?T.green:'rgba(56,189,248,.25)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
              {step.done?<Ic n="check" s={12} c="#04091A"/>:<span style={{fontSize:10,fontWeight:700,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>{step.n}</span>}
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:step.done?T.textBright:T.text,fontFamily:"'DM Sans',sans-serif"}}>{step.t}</div>
              <div style={{fontSize:11,color:T.textDim,fontFamily:"'DM Sans',sans-serif",marginTop:1}}>{step.s}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{width:'100%',display:'flex',flexDirection:'column',gap:10}}>
        <button className="gbtn fill" onClick={()=>navigate('home')}>Back to Dashboard</button>
        <button className="gbtn" onClick={()=>navigate('impact')}>View Your Impact</button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   CARBON FOOTPRINT — constants & helpers
══════════════════════════════════════════════════════════════════ */
// All values in kg CO₂ per unit unless noted
const CF = {
  car:          0.210,   // per km (petrol avg)
  bike2w:       0.140,   // per km (2-wheeler)
  auto:         0.120,   // per km (auto-rickshaw)
  bus:          0.089,   // per km
  train:        0.041,   // per km
  flight:       0.255,   // per km (domestic avg)
  electricity:  0.820,   // per kWh (India grid avg)
  lpg_kg:       2.983,   // per kg of LPG
  diet: {                // kg CO₂ per year
    vegan:       1050,
    vegetarian:  1390,
    pescatarian: 1850,
    omnivore:    2630,
    heavy_meat:  3740,
  },
  clothes:      20,      // per garment (new)
  electronics:  70,      // per device (new)
  delivery:     0.5,     // per online order
};

function calcAnnualFootprint(cp) {
  if (!cp) return null;
  const t = {
    transport: (
      (cp.carKmWeek   || 0) * 52 * CF.car   +
      (cp.bikeKmWeek  || 0) * 52 * CF.bike2w +
      (cp.autoKmWeek  || 0) * 52 * CF.auto   +
      (cp.busKmWeek   || 0) * 52 * CF.bus    +
      (cp.trainKmWeek || 0) * 52 * CF.train  +
      (cp.flightsYear || 0) * 1500 * CF.flight
    ) / 1000, // → tonnes

    energy: (
      (cp.electricityKwhMonth || 0) * 12 * CF.electricity +
      (cp.lpgKgMonth          || 0) * 12 * CF.lpg_kg
    ) / 1000,

    diet: (CF.diet[cp.diet] || CF.diet.omnivore) / 1000,

    lifestyle: (
      (cp.clothesPerMonth  || 0) * 12 * CF.clothes   +
      (cp.electronicsYear  || 0)      * CF.electronics +
      (cp.deliveriesPerWeek|| 0) * 52 * CF.delivery
    ) / 1000,
  };
  t.total = t.transport + t.energy + t.diet + t.lifestyle;
  return t;
}

function carbonGrade(tCO2yr) {
  if (tCO2yr < 1.5) return { grade: 'A+', label: 'Carbon Hero',    col: '#38BDF8', bg: 'rgba(56,189,248,.12)' };
  if (tCO2yr < 2.5) return { grade: 'A',  label: 'Low Impact',     col: '#7DD3FC', bg: 'rgba(116,198,157,.1)'  };
  if (tCO2yr < 4.0) return { grade: 'B',  label: 'Moderate',       col: '#F9C74F', bg: 'rgba(249,199,79,.1)'   };
  if (tCO2yr < 6.0) return { grade: 'C',  label: 'Above Average',  col: '#F4A261', bg: 'rgba(244,162,97,.1)'   };
  if (tCO2yr < 9.0) return { grade: 'D',  label: 'High Impact',    col: '#E76F51', bg: 'rgba(231,111,81,.12)'  };
  return              { grade: 'F',  label: 'Very High',      col: '#E63946', bg: 'rgba(230,57,70,.12)'   };
}

const DIET_OPTIONS = [
  { id: 'vegan',      e: '🌱', l: 'Vegan',       s: '~1.05T CO₂/yr' },
  { id: 'vegetarian', e: '🥗', l: 'Vegetarian',  s: '~1.39T CO₂/yr' },
  { id: 'pescatarian',e: '🐟', l: 'Pescatarian', s: '~1.85T CO₂/yr' },
  { id: 'omnivore',   e: '🍽', l: 'Omnivore',    s: '~2.63T CO₂/yr' },
  { id: 'heavy_meat', e: '🥩', l: 'Meat-heavy',  s: '~3.74T CO₂/yr' },
];

/* ── Carbon Setup — single screen, 4 inputs ──────────────────────── */
const CarbonSetupScreen = ({ navigate, onSaved }) => {
  const existing = (() => { try { return JSON.parse(localStorage.getItem('hw_carbon_profile') || 'null'); } catch { return null; } })();
  const [carKmWeek,           setCarKmWeek]           = useState(existing?.carKmWeek           ?? 80);
  const [flightsYear,         setFlightsYear]         = useState(existing?.flightsYear         ?? 2);
  const [electricityKwhMonth, setElectricityKwhMonth] = useState(existing?.electricityKwhMonth ?? 100);
  const [diet,                setDiet]                = useState(existing?.diet                ?? 'omnivore');

  const preview = calcAnnualFootprint({ carKmWeek, flightsYear, electricityKwhMonth, diet,
    bikeKmWeek:0, autoKmWeek:0, busKmWeek:0, trainKmWeek:0, lpgKgMonth:3,
    clothesPerMonth:1, electronicsYear:1, deliveriesPerWeek:2 });
  const grade = carbonGrade(preview?.total || 0);

  const save = () => {
    const cp = {
      carKmWeek, flightsYear, electricityKwhMonth, diet,
      bikeKmWeek:0, autoKmWeek:0, busKmWeek:0, trainKmWeek:0, lpgKgMonth:3,
      clothesPerMonth:1, electronicsYear:1, deliveriesPerWeek:2,
      savedAt: new Date().toISOString(),
    };
    try { localStorage.setItem('hw_carbon_profile', JSON.stringify(cp)); } catch {}
    onSaved ? onSaved(cp) : navigate('carbon');
  };

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'rgba(4,9,26,.98)', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ padding:'52px 20px 16px', borderBottom:'1px solid rgba(56,189,248,.1)', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => navigate('carbon')} style={{ background:'none', border:'none', cursor:'pointer', color:T.green, fontSize:20 }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9, color:'rgba(56,189,248,.5)', letterSpacing:'2px', fontWeight:700 }}>CARBON FOOTPRINT</div>
          <div style={{ fontSize:15, fontWeight:800, color:"#E2E8F0" }}>Your lifestyle inputs</div>
        </div>
        <div style={{ padding:'4px 12px', borderRadius:20, background:grade.bg, border:`1px solid ${grade.col}50` }}>
          <span style={{ fontSize:13, fontWeight:800, color:grade.col }}>{(preview?.total||0).toFixed(1)}T</span>
          <span style={{ fontSize:9, color:'rgba(186,230,253,.35)' }}>/yr</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 20px 8px' }}>
        {/* Transport */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, color:'rgba(56,189,248,.5)', letterSpacing:'2px', fontWeight:700, marginBottom:14 }}>🚗 TRANSPORT</div>
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:13, color:T.textDim }}>Car / cab driven</span>
              <span style={{ fontSize:13, fontWeight:700, color:T.textBright }}>{carKmWeek} <span style={{ fontSize:10, color:T.textDim }}>km/week</span></span>
            </div>
            <input type="range" min={0} max={500} step={10} value={carKmWeek} onChange={e=>setCarKmWeek(+e.target.value)} style={{ width:'100%', accentColor:T.green }} />
            <div style={{ fontSize:10, color:'rgba(56,189,248,.4)', marginTop:3 }}>≈ {(carKmWeek*52*CF.car/1000).toFixed(2)} T CO₂/yr</div>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:13, color:T.textDim }}>Flights taken</span>
              <span style={{ fontSize:13, fontWeight:700, color:T.textBright }}>{flightsYear} <span style={{ fontSize:10, color:T.textDim }}>/year</span></span>
            </div>
            <input type="range" min={0} max={20} step={1} value={flightsYear} onChange={e=>setFlightsYear(+e.target.value)} style={{ width:'100%', accentColor:T.orange }} />
            <div style={{ fontSize:10, color:'rgba(56,189,248,.4)', marginTop:3 }}>≈ {(flightsYear*1500*CF.flight/1000).toFixed(2)} T CO₂/yr (avg 1500 km)</div>
          </div>
        </div>

        {/* Energy */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, color:'rgba(249,199,79,.5)', letterSpacing:'2px', fontWeight:700, marginBottom:14 }}>⚡ HOME ENERGY</div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:13, color:T.textDim }}>Electricity usage</span>
            <span style={{ fontSize:13, fontWeight:700, color:T.textBright }}>{electricityKwhMonth} <span style={{ fontSize:10, color:T.textDim }}>kWh/mo</span></span>
          </div>
          <input type="range" min={20} max={500} step={10} value={electricityKwhMonth} onChange={e=>setElectricityKwhMonth(+e.target.value)} style={{ width:'100%', accentColor:T.gold }} />
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'rgba(186,230,253,.3)', marginTop:4 }}>
            <span>Low (20)</span><span>Avg (100)</span><span>AC-heavy (300+)</span>
          </div>
          <div style={{ fontSize:10, color:'rgba(56,189,248,.4)', marginTop:3 }}>≈ {(electricityKwhMonth*12*CF.electricity/1000).toFixed(2)} T CO₂/yr</div>
        </div>

        {/* Diet */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, color:'rgba(34,211,238,.5)', letterSpacing:'2px', fontWeight:700, marginBottom:12 }}>🍽 DIET</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {DIET_OPTIONS.map(d => (
              <button key={d.id} onClick={() => setDiet(d.id)}
                style={{ padding:'8px 14px', borderRadius:20, border:`1px solid ${diet===d.id?T.green:'rgba(56,189,248,.18)'}`, background:diet===d.id?'rgba(56,189,248,.14)':'rgba(12,24,16,.7)', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:diet===d.id?700:400, color:diet===d.id?T.green:T.textDim, transition:'all .15s' }}>
                {d.e} {d.l}
              </button>
            ))}
          </div>
          <div style={{ fontSize:10, color:'rgba(56,189,248,.4)', marginTop:8 }}>≈ {(CF.diet[diet]/1000).toFixed(2)} T CO₂/yr from diet</div>
        </div>
      </div>

      <div style={{ padding:'12px 20px 40px', borderTop:'1px solid rgba(56,189,248,.1)' }}>
        <button onClick={save}
          style={{ width:'100%', padding:'15px', borderRadius:13, border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:14, background:'linear-gradient(135deg,#1B4332,#38BDF8)', color:'#BAE6FD', boxShadow:'0 4px 16px rgba(56,189,248,.3)' }}>
          Save · {(preview?.total||0).toFixed(1)}T CO₂/yr
        </button>
      </div>
    </div>
  );
};

/* ── Carbon Dashboard ────────────────────────────────────────────── */
const CarbonDashboardScreen = ({ navigate }) => {
  const [period, setPeriod] = useState('month');
  const [carbonProfile] = useState(() => { try { return JSON.parse(localStorage.getItem('hw_carbon_profile')||'null'); } catch { return null; } });
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    fetch('/api/projects').then(r=>r.ok?r.json():[]).then(d=>Array.isArray(d)?setProjects(d):null).catch(()=>{});
  }, []);

  const bd = calcAnnualFootprint(carbonProfile);
  const totalArea    = projects.reduce((s,p)=>s+(p.area||0), 0);
  const gardenOffset = totalArea * 0.021;          // T CO₂/yr
  const totalYr      = bd?.total ?? 0;
  const netYr        = Math.max(0, totalYr - gardenOffset);
  const grade        = carbonGrade(netYr);
  const offsetPct    = totalYr > 0 ? Math.min(99, Math.round((gardenOffset/totalYr)*100)) : 0;

  const mul  = period==='week' ? 1/52 : period==='month' ? 1/12 : 1;
  const fmtT = v => {
    const x = v * mul;
    return period==='week' ? `${(x*1000).toFixed(0)} kg` : `${x.toFixed(2)} T`;
  };

  // No profile yet
  if (!carbonProfile) return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'rgba(4,9,26,.98)',fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{padding:'52px 20px 14px',borderBottom:'1px solid rgba(56,189,248,.1)',display:'flex',alignItems:'center',gap:12}}>
        <button onClick={()=>navigate('home')} style={{background:'none',border:'none',cursor:'pointer',color:T.green,fontSize:20}}>←</button>
        <div style={{fontSize:16,fontWeight:800,color:"#E2E8F0"}}>Carbon Footprint</div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',gap:16,textAlign:'center'}}>
        <div style={{fontSize:56}}>🌍</div>
        <div style={{fontSize:18,fontWeight:800,color:"#E2E8F0"}}>How big is your footprint?</div>
        <div style={{fontSize:13,color:T.textDim,lineHeight:1.6,maxWidth:280}}>
          Answer 4 quick questions — transport, energy, diet — and see how your garden offsets it week by week.
        </div>
        <button onClick={()=>navigate('carbonSetup')}
          style={{marginTop:8,padding:'15px 32px',borderRadius:13,border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,background:'linear-gradient(135deg,#1B4332,#38BDF8)',color:'#BAE6FD',boxShadow:'0 4px 16px rgba(56,189,248,.3)'}}>
          Calculate mine →
        </button>
      </div>
    </div>
  );

  const CATS = bd ? [
    {e:'🚗',l:'Transport',val:bd.transport,col:'#E76F51'},
    {e:'⚡',l:'Energy',   val:bd.energy,   col:'#F9C74F'},
    {e:'🍽',l:'Diet',     val:bd.diet,     col:'#38BDF8'},
    {e:'🛍',l:'Other',    val:bd.lifestyle,col:'#22D3EE'},
  ] : [];
  const maxCat = Math.max(...CATS.map(c=>c.val), 0.01);

  return (
    <div style={{paddingBottom:90,fontFamily:"'DM Sans',sans-serif",background:'rgba(4,9,26,.98)',minHeight:'100%'}}>
      {/* Header */}
      <div style={{padding:'52px 20px 14px',borderBottom:'1px solid rgba(56,189,248,.1)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>navigate('home')} style={{background:'none',border:'none',cursor:'pointer',color:T.green,fontSize:20}}>←</button>
          <div style={{fontSize:16,fontWeight:800,color:"#E2E8F0"}}>Carbon Footprint</div>
        </div>
        <button onClick={()=>navigate('carbonSetup')}
          style={{padding:'6px 12px',borderRadius:10,background:'rgba(56,189,248,.08)',border:'1px solid rgba(56,189,248,.2)',cursor:'pointer',fontSize:11,color:T.green,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>
          Edit ✏️
        </button>
      </div>

      <div style={{padding:'16px 20px 0'}}>
        {/* Period switcher */}
        <div style={{display:'flex',gap:4,marginBottom:16,background:'rgba(12,24,16,.8)',padding:'3px',borderRadius:11,border:'1px solid rgba(56,189,248,.1)'}}>
          {[['week','Week'],['month','Month'],['year','Year']].map(([k,l])=>(
            <button key={k} onClick={()=>setPeriod(k)}
              style={{flex:1,padding:'8px 0',borderRadius:9,border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:12,background:period===k?T.green:'transparent',color:period===k?'#04091A':'rgba(186,230,253,.4)',transition:'all .2s'}}>
              {l}
            </button>
          ))}
        </div>

        {/* Main numbers row */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:16}}>
          {/* Gross */}
          <div style={{padding:'14px 12px',borderRadius:13,background:'rgba(12,24,16,.8)',border:`1px solid ${grade.col}30`,gridColumn:'span 2'}}>
            <div style={{fontSize:9,color:'rgba(186,230,253,.4)',letterSpacing:'1.5px',marginBottom:4}}>YOUR FOOTPRINT</div>
            <div style={{fontSize:32,fontWeight:800,color:grade.col,lineHeight:1}}>{fmtT(totalYr)}</div>
            <div style={{fontSize:10,color:T.textDim,marginTop:3}}>CO₂ · {period==='week'?'this week':period==='month'?'this month':'this year'}</div>
          </div>
          {/* Grade */}
          <div style={{padding:'14px 12px',borderRadius:13,background:grade.bg,border:`1px solid ${grade.col}40`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:26,fontWeight:900,color:grade.col}}>{grade.grade}</div>
            <div style={{fontSize:8,color:grade.col,letterSpacing:'1px',fontWeight:700,textAlign:'center',lineHeight:1.3,marginTop:2}}>{grade.label.toUpperCase()}</div>
          </div>
        </div>

        {/* Category bars */}
        <div style={{marginBottom:16,padding:'14px',borderRadius:13,background:'rgba(12,24,16,.7)',border:'1px solid rgba(56,189,248,.1)'}}>
          <div style={{fontSize:9,color:'rgba(56,189,248,.45)',letterSpacing:'2px',fontWeight:700,marginBottom:12}}>BREAKDOWN</div>
          {CATS.map(cat=>(
            <div key={cat.l} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:12,color:T.textDim}}>{cat.e} {cat.l}</span>
                <span style={{fontSize:12,fontWeight:700,color:cat.col}}>{fmtT(cat.val)}</span>
              </div>
              <div style={{height:4,background:'rgba(255,255,255,.05)',borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${(cat.val/maxCat)*100}%`,background:cat.col,borderRadius:2,transition:'width .8s ease'}}/>
              </div>
            </div>
          ))}
        </div>

        {/* Garden offset row */}
        <div style={{marginBottom:16,padding:'14px 16px',borderRadius:13,background:'rgba(27,67,50,.4)',border:'1px solid rgba(56,189,248,.25)',display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:28}}>🌿</span>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:'rgba(56,189,248,.6)',letterSpacing:'1.5px',fontWeight:700,marginBottom:3}}>GARDEN OFFSET</div>
            <div style={{fontSize:20,fontWeight:800,color:T.green}}>−{fmtT(gardenOffset)}</div>
            <div style={{fontSize:10,color:T.textDim,marginTop:1}}>
              {totalArea>0 ? `${Math.round(totalArea)} m² garden · ${offsetPct}% of your footprint` : 'No garden yet — tap + to start'}
            </div>
          </div>
          {totalArea===0 && (
            <button onClick={()=>navigate('create')}
              style={{padding:'8px 12px',borderRadius:10,border:'none',cursor:'pointer',background:T.green,color:'#04091A',fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:11,flexShrink:0}}>
              + Scan
            </button>
          )}
        </div>

        {/* Net */}
        <div style={{marginBottom:16,padding:'14px 16px',borderRadius:13,background:'rgba(12,24,16,.9)',border:'1px solid rgba(56,189,248,.15)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:9,color:'rgba(186,230,253,.35)',letterSpacing:'1.5px',marginBottom:3}}>NET AFTER GARDEN</div>
            <div style={{fontSize:26,fontWeight:800,color:netYr<totalYr*0.5?T.green:T.textBright}}>{fmtT(netYr)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:10,color:T.textDim,marginBottom:4}}>Offset progress</div>
            <div style={{fontSize:18,fontWeight:800,color:T.green}}>{offsetPct}%</div>
            <div style={{width:80,height:4,background:'rgba(56,189,248,.1)',borderRadius:2,marginTop:4,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${offsetPct}%`,background:`linear-gradient(90deg,#0C4A6E,#38BDF8)`,borderRadius:2}}/>
            </div>
          </div>
        </div>

        {/* India avg */}
        <div style={{padding:'12px 14px',borderRadius:12,background:'rgba(12,24,16,.6)',border:'1px solid rgba(56,189,248,.1)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:11,color:T.textDim}}>vs India avg (1.9 T/yr)</span>
          <span style={{fontSize:11,fontWeight:700,color:totalYr>1.9?T.heat:T.green}}>
            {totalYr>1.9?`+${((totalYr/1.9-1)*100).toFixed(0)}% above`:`${((1-totalYr/1.9)*100).toFixed(0)}% below`}
          </span>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   SCREEN 23 — IMPACT DASHBOARD
══════════════════════════════════════════════════════════════════ */
const ImpactDashboardScreen=({navigate})=>{
  const [pulse,setPulse]=useState(false);
  useEffect(()=>{const t=setInterval(()=>setPulse(p=>!p),1800);return()=>clearInterval(t);},[]);
  const COMING_FEATURES=[
    {icon:'🌱',label:'CO₂ Offset Tracker',desc:'Monthly carbon offset from your gardens',  bg:'rgba(34,197,94,0.18)',  border:'rgba(34,197,94,0.35)'},
    {icon:'🌡️',label:'Cooling Analytics',  desc:'Surface temperature reduction data',       bg:'rgba(56,189,248,0.18)', border:'rgba(56,189,248,0.35)'},
    {icon:'💧',label:'Water Conservation', desc:'Savings vs concrete/paved surfaces',        bg:'rgba(34,211,238,0.18)', border:'rgba(34,211,238,0.35)'},
    {icon:'🌍',label:'City Contribution',  desc:"Your share of the city-wide green goal",   bg:'rgba(52,211,153,0.18)', border:'rgba(52,211,153,0.35)'},
    {icon:'📈',label:'6-Month Trends',     desc:'Visual progress charts & milestones',       bg:'rgba(251,191,36,0.18)', border:'rgba(251,191,36,0.35)'},
    {icon:'🏆',label:'Impact Score',       desc:'Ranked vs other gardeners in your city',    bg:'rgba(249,115,22,0.18)', border:'rgba(249,115,22,0.35)'},
  ];
  return(
    <div style={{minHeight:'100%',background:'rgba(0,0,0,0.04)',paddingBottom:90}}>
      {/* Navbar */}
      <div className="navbar" style={{background:'rgba(10,45,18,0.72)',backdropFilter:'blur(24px)',borderBottom:'1px solid rgba(120,200,140,0.25)'}}>
        <button onClick={()=>navigate('home')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><Ic n="back" s={22} c="#FFFFFF"/></button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <div style={{fontSize:14,fontWeight:700,color:'#FFFFFF',fontFamily:"'Space Grotesk',sans-serif"}}>Your Impact</div>
        </div>
        <div style={{width:32}}/>
      </div>

      {/* Hero */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 28px 32px',textAlign:'center'}}>
        {/* Animated globe */}
        <div style={{position:'relative',width:120,height:120,marginBottom:24}}>
          {[0,1,2].map(i=>(
            <div key={i} style={{
              position:'absolute',
              inset: -i*14,
              borderRadius:'50%',
              border:`1.5px solid rgba(82,183,136,${0.5-i*0.14})`,
              animation:`breathe ${2.5+i*.6}s ease-in-out infinite`,
              animationDelay:`${i*0.4}s`,
            }}/>
          ))}
          <div style={{
            position:'absolute',inset:0,borderRadius:'50%',
            background:'linear-gradient(135deg,#1B4332,#40916C)',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 8px 32px rgba(45,106,79,0.5)',
            fontSize:52,
          }}>🌍</div>
        </div>

        {/* Coming Soon badge */}
        <div style={{
          background:'linear-gradient(135deg,rgba(251,191,36,0.22),rgba(249,115,22,0.18))',
          border:'1.5px solid rgba(251,191,36,0.55)',
          borderRadius:30,padding:'6px 20px',marginBottom:18,
          boxShadow:'0 2px 12px rgba(251,191,36,0.2)',
        }}>
          <span style={{fontSize:11,fontWeight:800,letterSpacing:'2.5px',color:'#F59E0B'}}>COMING SOON</span>
        </div>

        <div style={{fontSize:26,fontWeight:800,color:'#FFFFFF',fontFamily:"'Space Grotesk',sans-serif",marginBottom:10,textShadow:'0 2px 8px rgba(0,0,0,0.4)'}}>
          Track Your Green Impact
        </div>
        <div style={{fontSize:14,color:'rgba(255,255,255,0.75)',lineHeight:1.6,maxWidth:300,textShadow:'0 1px 4px rgba(0,0,0,0.4)'}}>
          Complete your first garden project to unlock detailed environmental impact analytics.
        </div>
      </div>

      {/* Feature preview cards */}
      <div style={{padding:'0 16px',marginBottom:24}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:'2px',color:'rgba(255,255,255,0.6)',marginBottom:12,textAlign:'center',textShadow:'0 1px 4px rgba(0,0,0,0.4)'}}>WHAT YOU'LL UNLOCK</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {COMING_FEATURES.map((f,i)=>(
            <div key={i} style={{
              background:'rgba(255,255,255,0.55)',
              backdropFilter:'blur(20px)',
              WebkitBackdropFilter:'blur(20px)',
              border:'1.5px solid rgba(255,255,255,0.75)',
              borderRadius:18,padding:'16px 14px 14px',
              boxShadow:'0 6px 20px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.8)',
              position:'relative',overflow:'hidden',
            }}>
              {/* lock badge */}
              <div style={{position:'absolute',top:8,right:8,background:'rgba(0,0,0,0.08)',borderRadius:8,padding:'2px 5px',fontSize:9,color:'rgba(0,0,0,0.35)',fontWeight:700}}>🔒</div>
              {/* Icon circle */}
              <div style={{
                width:44,height:44,borderRadius:14,
                background:f.bg,
                border:`1.5px solid ${f.border}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:22,marginBottom:10,
                boxShadow:`0 3px 10px ${f.bg}`,
              }}>{f.icon}</div>
              <div style={{fontSize:12,fontWeight:800,color:'#1B4332',marginBottom:4,lineHeight:1.2}}>{f.label}</div>
              <div style={{fontSize:10.5,color:'#40916C',lineHeight:1.45}}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{padding:'0 16px'}}>
        <button
          onClick={()=>navigate('create')}
          style={{
            width:'100%',padding:'15px',borderRadius:14,border:'none',cursor:'pointer',
            background:'linear-gradient(135deg,#2D6A4F,#52B788)',
            color:'#FFFFFF',fontSize:15,fontWeight:700,
            boxShadow:'0 6px 24px rgba(45,106,79,0.45)',
            letterSpacing:'0.3px',
          }}
        >
          Start Your First Garden →
        </button>
        <div style={{textAlign:'center',marginTop:12,fontSize:11,color:'rgba(255,255,255,0.55)',textShadow:'0 1px 4px rgba(0,0,0,0.4)'}}>
          Impact unlocks after your first completed project
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   SCREEN 24 — NOTIFICATIONS
══════════════════════════════════════════════════════════════════ */
const MOCK_NOTIFS=[
  {id:1,icon:'🤖',title:'AI Analysis Complete',body:'Your rooftop scan at Sector 12 is ready. 3 species recommended.',time:'2h ago',type:'scan',read:false},
  {id:2,icon:'🔧',title:'Installer Reply',body:'GreenBuild Solutions has sent a quote for your project.',time:'5h ago',type:'installer',read:false},
  {id:3,icon:'🌡',title:'Heat Alert',body:'Patiāla is experiencing extreme heat (46°C). Green cover is critical.',time:'1d ago',type:'alert',read:true},
  {id:4,icon:'🌿',title:'Tip of the Day',body:'Vetiver grass can reduce surface temperature by up to 4°C. Learn more.',time:'1d ago',type:'tip',read:true},
  {id:5,icon:'📊',title:'Monthly Report Ready',body:'Your February impact report is available to download.',time:'2d ago',type:'report',read:true},
  {id:6,icon:'🏆',title:'Impact Milestone',body:"Congratulations! You've offset 100kg CO₂ this year.",time:'3d ago',type:'achievement',read:true},
];
const NotificationsScreen=({navigate})=>{
  const [notifs,setNotifs]=useState(MOCK_NOTIFS);
  const [read,setRead]=useState(false);
  const typeColor={scan:T.green,installer:T.sky,alert:T.heat,tip:T.earth,report:T.sun,achievement:T.green};
  const unread=notifs.filter(n=>!n.read).length;
  return(
    <div style={{background:'rgba(242,243,247,0.92)',minHeight:'100%'}}>
      <div className="navbar">
        <button onClick={()=>navigate('home')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><Ic n="back" s={22} c={T.green}/></button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <div style={{fontSize:14,fontWeight:700,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif"}}>Notifications</div>
          {unread>0&&!read&&<div style={{fontSize:10,color:T.heat,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{unread} new</div>}
        </div>
        {(unread>0||!read)?
          <button onClick={()=>{setNotifs(n=>n.map(x=>({...x,read:true})));setRead(true);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:T.green,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
            Clear
          </button>
        :<div style={{width:40}}/>}
      </div>
      <div style={{paddingBottom:90}}>
        {notifs.length===0?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 32px',textAlign:'center'}}>
            <div style={{fontSize:52,marginBottom:16,animation:'leafFloat 3s ease-in-out infinite'}}>🌿</div>
            <div style={{fontSize:16,fontWeight:700,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif",marginBottom:8}}>All caught up!</div>
            <div style={{fontSize:13,color:T.textDim,fontFamily:"'DM Sans',sans-serif"}}>No new notifications</div>
          </div>
        ):(
          notifs.map((n,i)=>(
            <div key={n.id} className="notif-item" style={{animationDelay:`${i*.05}s`,background:n.read?'transparent':'rgba(56,189,248,.03)'}}
              onClick={()=>setNotifs(prev=>prev.map(x=>x.id===n.id?{...x,read:true}:x))}>
              <div style={{width:40,height:40,borderRadius:12,background:`${typeColor[n.type]||T.green}14`,border:`1px solid ${typeColor[n.type]||T.green}25`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,position:'relative'}}>
                {n.emoji||n.icon}
                {!n.read&&<div style={{position:'absolute',top:-2,right:-2,width:7,height:7,borderRadius:'50%',background:T.heat,border:`1.5px solid ${T.bg}`}}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:3}}>
                  <span style={{fontSize:13,fontWeight:n.read?500:700,color:n.read?T.text:T.textBright,fontFamily:"'DM Sans',sans-serif"}}>{n.title}</span>
                  <span style={{fontSize:9,color:T.textDim,fontFamily:"'DM Sans',sans-serif",flexShrink:0,marginLeft:8}}>{n.time}</span>
                </div>
                <div style={{fontSize:11,color:T.textDim,fontFamily:"'DM Sans',sans-serif",lineHeight:1.4}}>{n.body}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   SCREEN 25 — ECO TIPS
══════════════════════════════════════════════════════════════════ */
const ECO_TIPS=[
  {id:1,cat:'Watering',icon:'💧',title:'Water in the Golden Hour',body:'Water plants early morning (5–8am) or evening (6–8pm) to reduce evaporation by 40%. Avoid midday watering when temperatures exceed 35°C.',col:T.sky},
  {id:2,cat:'Species',icon:'🌿',title:'Choose Native Plants',body:'Indigenous species require 60% less water and support local pollinators. Tulsi and Curry Leaf are perfect examples of high-performance native plants.',col:T.green},
  {id:3,cat:'Climate',icon:'🌡',title:'Create Microclimates',body:"Group plants by similar water needs. Dense plantings create their own humid microclimate, reducing the need for irrigation and improving cooling.",col:T.earth},
  {id:4,cat:'Soil',icon:'🌱',title:'Organic Mulch Matters',body:'A 3cm layer of organic mulch retains soil moisture and reduces surface temperature by up to 5°C. Use coconut coir or leaf litter.',col:'#A8D5A2'},
  {id:5,cat:'Climate',icon:'☀',title:'Shade Strategically',body:'Tall plants on the west side can reduce afternoon heat gain by up to 30%. Use bamboo or areca palm as natural sun shields.',col:T.sun},
  {id:6,cat:'Species',icon:'🌾',title:'Vetiver: The Cooling Champion',body:"Vetiver grass has the highest cooling score in our catalog (9/10). It's drought-resilient, wind-resistant and reduces surface temperature by ~4°C.",col:T.green},
  {id:7,cat:'Watering',icon:'♻',title:'Collect Roof Rainwater',body:'Install a simple rainwater harvesting setup to water your rooftop garden. 100m² of roof can collect 900L from a single 10mm rainfall event.',col:T.sky},
  {id:8,cat:'Soil',icon:'🪱',title:'Vermicompost for Rooftops',body:'Lightweight vermicompost improves soil structure without adding excess weight. Replace 20% of soil mix with vermicompost for 2× plant vitality.',col:T.earth},
];
const TIP_CATS=['All','Watering','Species','Climate','Soil'];
const TipsScreen=({navigate})=>{
  const [cat,setCat]=useState('All');
  const filtered=ECO_TIPS.filter(t=>cat==='All'||t.cat===cat);
  const catColor={'Watering':T.sky,'Species':T.green,'Climate':T.earth,'Soil':'#A8D5A2'};
  const featured=ECO_TIPS[Math.floor(Date.now()/86400000)%ECO_TIPS.length];
  return(
    <div style={{paddingBottom:90,background:'rgba(242,243,247,0.92)'}}>
      <div className="navbar">
        <button onClick={()=>navigate('home')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><Ic n="back" s={22} c={T.green}/></button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <div style={{fontSize:14,fontWeight:700,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif"}}>Eco Tips</div>
        </div>
        <div style={{width:32}}/>
      </div>
      {/* Featured tip */}
      <div className="a1" style={{margin:'16px 20px',borderRadius:22,overflow:'hidden',position:'relative',minHeight:160}}>
        <div style={{position:'absolute',inset:0,background:`linear-gradient(135deg,${featured.col}22,#0E2A18)`}}/>
        <div style={{position:'absolute',top:-10,right:-10,fontSize:80,opacity:.12}}>{featured.icon}</div>
        <div style={{position:'relative',zIndex:2,padding:'20px 20px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:`${featured.col}20`,border:`1px solid ${featured.col}35`,borderRadius:20,padding:'4px 12px',marginBottom:10}}>
            <span style={{fontSize:12}}>{featured.icon}</span>
            <span style={{fontSize:10,color:featured.col,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Tip of the Day · {featured.cat}</span>
          </div>
          <div style={{fontSize:16,fontWeight:700,color:T.textBright,fontFamily:"'Space Grotesk',sans-serif",marginBottom:6}}>{featured.title}</div>
          <div style={{fontSize:12,color:T.text,lineHeight:1.6,fontFamily:"'DM Sans',sans-serif"}}>{featured.body.substring(0,100)}…</div>
        </div>
      </div>
      {/* Category filter */}
      <div className="scrx" style={{padding:'0 20px 12px',gap:8}}>
        {TIP_CATS.map(c=>(
          <button key={c} className={`chip${cat===c?' on':''}`} onClick={()=>setCat(c)}
            style={cat===c&&c!=='All'?{background:`${catColor[c]}18`,color:catColor[c],borderColor:`${catColor[c]}50`}:{}}>
            {c}
          </button>
        ))}
      </div>
      {/* Tips list */}
      <div style={{padding:'0 20px'}}>
        {filtered.map((tip,i)=>(
          <div key={tip.id} className="hud" style={{marginBottom:10,padding:'14px 16px',cursor:'pointer',animation:`cardEntrance .4s ${i*.06}s ease both`}}>
            <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{width:38,height:38,borderRadius:12,background:`${tip.col}14`,border:`1px solid ${tip.col}25`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                {tip.icon}
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:700,color:T.textBright,fontFamily:"'DM Sans',sans-serif"}}>{tip.title}</span>
                  <span style={{fontSize:9,background:`${tip.col}14`,color:tip.col,borderRadius:10,padding:'2px 8px',fontFamily:"'DM Sans',sans-serif",fontWeight:600,flexShrink:0,marginLeft:6}}>{tip.cat}</span>
                </div>
                <div style={{fontSize:12,color:T.textDim,lineHeight:1.5,fontFamily:"'DM Sans',sans-serif"}}>{tip.body.substring(0,95)}…</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   MEASURE & ENVIRONMENT (abbreviated for space)
══════════════════════════════════════════════════════════════════ */
const MeasureScreen = ({ navigate, setPhotoSession }) => {
  const [mode,setMode]=useState('ar');
  const [l,setL]=useState('8'); const [w,setW]=useState('6');
  const area=(parseFloat(l)||0)*(parseFloat(w)||0);
  const continueManual=()=>{
    setPhotoSession(prev=>({...prev,lengthM:parseFloat(l)||6,widthM:parseFloat(w)||7,floorLevel:prev.floorLevel??1}));
    navigate('photoCapture');
  };

  return(
    <div style={{height:'100%',background:'transparent',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <style>{`
        @keyframes arScanLine{0%,100%{top:12%}50%{top:84%}}
        @keyframes arCornerPulse{0%,100%{r:5;opacity:1}50%{r:8;opacity:.6}}
        @keyframes arDotBlink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes scanShimmer{0%{left:-100%}100%{left:110%}}
        @keyframes msEntrance{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Navbar */}
      <div className="navbar" style={{background:'rgba(10,45,18,0.72)',backdropFilter:'blur(24px)',borderBottom:'1px solid rgba(120,200,140,0.25)',flexShrink:0}}>
        <button onClick={()=>navigate('create')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><Ic n="back" s={22} c="#FFFFFF"/></button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <div style={{fontSize:13,fontWeight:800,color:'#FFFFFF',fontFamily:"'Space Grotesk',sans-serif"}}>Measure Space</div>
          <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:'1px'}}>Step 2 of 4</div>
        </div>
        <div style={{width:32}}/>
      </div>
      {/* Progress */}
      <div style={{height:3,background:'rgba(255,255,255,0.15)',flexShrink:0}}>
        <div style={{height:'100%',width:'50%',background:'linear-gradient(90deg,#52B788,#95D5B2)',borderRadius:3}}/>
      </div>

      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>

        {/* ── Mode tabs ── */}
        <div style={{display:'flex',margin:'16px 16px 0',background:'rgba(255,255,255,0.15)',backdropFilter:'blur(16px)',borderRadius:14,padding:4,border:'1px solid rgba(255,255,255,0.25)'}}>
          {[['ar','📷  AR Scan'],['manual','✏️  Manual']].map(([id,label])=>(
            <button key={id} onClick={()=>setMode(id)} style={{
              flex:1,padding:'9px 0',borderRadius:10,border:'none',cursor:'pointer',
              fontWeight:700,fontSize:13,transition:'all .2s',
              background:mode===id?'rgba(255,255,255,0.9)':'transparent',
              color:mode===id?'#1B4332':'rgba(255,255,255,0.75)',
              boxShadow:mode===id?'0 2px 8px rgba(0,0,0,0.15)':'none',
            }}>{label}</button>
          ))}
        </div>

        {/* ── AR MODE ── */}
        {mode==='ar'&&(
          <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:14,animation:'msEntrance .4s ease'}}>

            {/* AR Viewport hero */}
            <div style={{borderRadius:24,overflow:'hidden',background:'linear-gradient(145deg,#0E2A18,#1B4332)',boxShadow:'0 8px 32px rgba(0,0,0,0.4)',position:'relative'}}>
              {/* Live viewport */}
              <div style={{position:'relative',height:200,overflow:'hidden'}}>
                {/* Grid lines */}
                {[33,66].map(p=><div key={p} style={{position:'absolute',left:0,right:0,top:`${p}%`,height:1,background:'rgba(255,255,255,0.07)'}}/>)}
                {[25,50,75].map(p=><div key={p} style={{position:'absolute',top:0,bottom:0,left:`${p}%`,width:1,background:'rgba(255,255,255,0.07)'}}/>)}

                <svg style={{position:'absolute',inset:0,width:'100%',height:'100%'}} viewBox="0 0 360 200">
                  <defs>
                    <linearGradient id="pg2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(82,183,136,0.22)"/>
                      <stop offset="100%" stopColor="rgba(27,67,50,0.08)"/>
                    </linearGradient>
                  </defs>
                  <polygon points="60,168 105,42 255,42 300,168" fill="url(#pg2)" stroke="rgba(82,183,136,0.85)" strokeWidth="2" strokeDasharray="8,4"/>
                  <line x1="60" y1="182" x2="300" y2="182" stroke="rgba(82,183,136,0.4)" strokeWidth="1" strokeDasharray="4,3"/>
                  <text x="180" y="196" textAnchor="middle" fontSize="10" fill="rgba(149,213,178,0.85)" fontFamily="monospace">12.4 m</text>
                  <line x1="42" y1="42" x2="42" y2="168" stroke="rgba(82,183,136,0.4)" strokeWidth="1" strokeDasharray="4,3"/>
                  <text x="24" y="109" textAnchor="middle" fontSize="10" fill="rgba(149,213,178,0.85)" fontFamily="monospace" transform="rotate(-90,24,109)">8.2 m</text>
                  <rect x="134" y="96" width="92" height="22" rx="7" fill="rgba(15,40,25,0.82)"/>
                  <text x="180" y="111" textAnchor="middle" fontSize="11" fill="#74C69D" fontFamily="monospace" fontWeight="700">101.7 m²</text>
                  {[[60,168,'A',-16,14],[105,42,'B',6,-8],[255,42,'C',6,-8],[300,168,'D',6,14]].map(([cx,cy,lb,dx,dy],i)=>(
                    <g key={lb}>
                      <circle cx={cx} cy={cy} r="9" fill="rgba(82,183,136,0.18)" style={{animation:`arCornerPulse 1.8s ${i*0.4}s ease-in-out infinite`}}/>
                      <circle cx={cx} cy={cy} r="5" fill="#74C69D"/>
                      <text x={cx+dx} y={cy+dy} fontSize="9" fill="#D8F3DC" fontFamily="monospace" fontWeight="700">{lb}</text>
                    </g>
                  ))}
                </svg>

                {/* Scan line */}
                <div style={{position:'absolute',left:0,right:0,height:2,pointerEvents:'none',
                  background:'linear-gradient(90deg,transparent,rgba(82,183,136,0.9),transparent)',
                  animation:'arScanLine 2.8s ease-in-out infinite'}}/>

                {/* Badges */}
                <div style={{position:'absolute',top:10,left:10,background:'rgba(15,40,25,0.82)',borderRadius:8,padding:'3px 9px',border:'1px solid rgba(82,183,136,0.3)'}}>
                  <span style={{fontSize:9,color:'#74C69D',fontWeight:700}}>4 / 4 CORNERS</span>
                </div>
                <div style={{position:'absolute',top:10,right:10,background:'rgba(220,38,38,0.85)',borderRadius:8,padding:'3px 9px',display:'flex',alignItems:'center',gap:4}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:'#fff',animation:'arDotBlink 1s ease-in-out infinite'}}/>
                  <span style={{fontSize:9,color:'#fff',fontWeight:700}}>LIVE</span>
                </div>
              </div>

              {/* Stat pills row */}
              <div style={{display:'flex',gap:0,borderTop:'1px solid rgba(255,255,255,0.08)'}}>
                {[['🎯','±0.2m','Accuracy'],['⚡','~30s','Scan Time'],['🔄','360°','Any Angle']].map((s,i)=>(
                  <div key={s[1]} style={{flex:1,textAlign:'center',padding:'10px 4px',borderRight:i<2?'1px solid rgba(255,255,255,0.08)':'none'}}>
                    <div style={{fontSize:14}}>{s[0]}</div>
                    <div style={{fontSize:12,fontWeight:800,color:'#74C69D',marginTop:2}}>{s[1]}</div>
                    <div style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>{s[2]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps — compact icon row */}
            <div style={{background:'rgba(255,255,255,0.18)',backdropFilter:'blur(18px)',border:'1px solid rgba(255,255,255,0.32)',borderRadius:20,padding:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',position:'relative'}}>
                {/* Connector line */}
                <div style={{position:'absolute',top:20,left:'12%',right:'12%',height:2,background:'rgba(255,255,255,0.2)',zIndex:0}}/>
                {[['📷','Open'],['📍','Tap 4'],['📐','AI Calc'],['✅','Done']].map(([ic,lb],i)=>(
                  <div key={lb} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,zIndex:1}}>
                    <div style={{width:40,height:40,borderRadius:14,background:'rgba(255,255,255,0.25)',border:'1.5px solid rgba(255,255,255,0.5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
                      {ic}
                    </div>
                    <span style={{fontSize:9.5,fontWeight:700,color:'#FFFFFF',textAlign:'center'}}>{lb}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Primary CTA */}
            <button onClick={()=>navigate('liveARMeasure')} style={{
              width:'100%',padding:'16px',borderRadius:16,border:'none',cursor:'pointer',
              background:'linear-gradient(135deg,#2D6A4F,#52B788)',
              color:'#FFFFFF',fontSize:16,fontWeight:800,letterSpacing:'0.3px',
              boxShadow:'0 6px 28px rgba(45,106,79,0.5)',
              position:'relative',overflow:'hidden',
            }}>
              <div style={{position:'absolute',top:0,bottom:0,width:'50%',
                background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)',
                animation:'scanShimmer 2.2s ease-in-out infinite'}}/>
              <span style={{position:'relative',zIndex:1}}>📷  Open Camera & Scan →</span>
            </button>

            {/* Secondary: manual */}
            <button onClick={()=>setMode('manual')} style={{
              width:'100%',padding:'13px',borderRadius:14,border:'1.5px solid rgba(255,255,255,0.35)',cursor:'pointer',
              background:'rgba(255,255,255,0.12)',backdropFilter:'blur(12px)',
              color:'rgba(255,255,255,0.85)',fontSize:14,fontWeight:600,
            }}>
              ✏️  Enter Dimensions Manually
            </button>
          </div>
        )}

        {/* ── MANUAL MODE ── */}
        {mode==='manual'&&(
          <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:14,animation:'msEntrance .35s ease'}}>
            {/* Blueprint */}
            <div style={{background:'rgba(255,255,255,0.18)',backdropFilter:'blur(18px)',border:'1px solid rgba(255,255,255,0.35)',borderRadius:20,padding:'20px',display:'flex',justifyContent:'center'}}>
              <svg width="220" height="110" viewBox="0 0 220 110">
                <rect x="20" y="10" width="180" height="80" rx="6" fill="rgba(82,183,136,0.12)" stroke="rgba(82,183,136,0.7)" strokeWidth="2" strokeDasharray="8,4"/>
                <line x1="20" y1="100" x2="200" y2="100" stroke="rgba(82,183,136,0.5)" strokeWidth="1"/>
                <text x="110" y="110" textAnchor="middle" fontSize="11" fill="#74C69D" fontFamily="monospace">{l||'?'} m</text>
                <line x1="208" y1="10" x2="208" y2="90" stroke="rgba(82,183,136,0.5)" strokeWidth="1"/>
                <text x="218" y="54" textAnchor="middle" fontSize="11" fill="#74C69D" fontFamily="monospace" transform="rotate(90,218,54)">{w||'?'} m</text>
                {area>0&&<>
                  <text x="110" y="54" textAnchor="middle" fontSize="16" fill="#52B788" fontFamily="monospace" fontWeight="700">{area}</text>
                  <text x="110" y="68" textAnchor="middle" fontSize="10" fill="rgba(82,183,136,0.7)" fontFamily="monospace">m²</text>
                </>}
              </svg>
            </div>

            {/* Inputs */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[['Length','m',l,setL],['Width','m',w,setW]].map(([lab,u,v,sv])=>(
                <div key={lab}>
                  <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.7)',letterSpacing:'1px',marginBottom:6}}>{lab.toUpperCase()}</div>
                  <div style={{position:'relative'}}>
                    <input type="number" value={v} onChange={e=>sv(e.target.value)}
                      style={{width:'100%',boxSizing:'border-box',padding:'13px 36px 13px 14px',borderRadius:12,
                        border:'1.5px solid rgba(255,255,255,0.45)',background:'rgba(255,255,255,0.85)',
                        color:'#1B4332',fontSize:16,fontWeight:700,outline:'none'}}/>
                    <span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'#40916C',fontWeight:600}}>{u}</span>
                  </div>
                </div>
              ))}
            </div>

            {area>0&&(
              <div style={{background:'rgba(82,183,136,0.15)',border:'1.5px solid rgba(82,183,136,0.4)',borderRadius:14,padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:13,color:'rgba(255,255,255,0.7)',fontWeight:600}}>Total Area</span>
                <span style={{fontSize:28,fontWeight:900,color:'#74C69D'}}>{area} m²</span>
              </div>
            )}

            <button disabled={!parseFloat(l)||!parseFloat(w)} onClick={continueManual} style={{
              width:'100%',padding:'16px',borderRadius:16,border:'none',
              cursor:(!parseFloat(l)||!parseFloat(w))?'not-allowed':'pointer',
              background:(!parseFloat(l)||!parseFloat(w))?'rgba(255,255,255,0.2)':'linear-gradient(135deg,#2D6A4F,#52B788)',
              color:'#FFFFFF',fontSize:15,fontWeight:800,
              boxShadow:(!parseFloat(l)||!parseFloat(w))?'none':'0 6px 24px rgba(45,106,79,0.45)',
            }}>
              Continue →
            </button>

            <button onClick={()=>setMode('ar')} style={{
              background:'none',border:'none',cursor:'pointer',
              fontSize:13,color:'rgba(255,255,255,0.55)',fontWeight:600,padding:'4px',
            }}>← Use AR Scan instead</button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   PHOTO CAPTURE (Stage 1 of photo-to-garden pipeline)
══════════════════════════════════════════════════════════════════ */
const PhotoCaptureScreen = ({ navigate, photoSession, setPhotoSession }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(photoSession?.capturedPhoto ?? null);

  /** Parent `photoSession` is source of truth when navigating back/forth (gallery/WebView timing). */
  useEffect(() => {
    const url = photoSession?.capturedPhoto ?? null;
    if (url && url !== capturedPhoto) setCapturedPhoto(url);
  }, [photoSession?.capturedPhoto]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional sync from parent

  const stopCamera = useCallback(() => {
    try {
      if (videoRef.current) {
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onloadeddata = null;
        videoRef.current.oncanplay = null;
        videoRef.current.srcObject = null;
      }
      const s = streamRef.current || stream;
      if (s) s.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    } finally {
      streamRef.current = null;
      setStream(null);
      setVideoReady(false);
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    setError(null);
    setInitializing(true);
    setVideoReady(false);
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not available in this environment.");
      }

      // Stop any previous stream first
      stopCamera();

      // Low-latency constraints: reduce black screens + lag on mobile
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      };

      let s;
      try {
        s = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        // Fallback to any available camera
        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = s;
      setStream(s);
      if (videoRef.current) {
        // iOS Safari quirks
        try {
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.setAttribute("webkit-playsinline", "true");
        } catch {
          // ignore
        }
        videoRef.current.srcObject = s;

        const markReadyIfPossible = () => {
          const v = videoRef.current;
          if (!v) return;
          const hasFrames = (v.videoWidth ?? 0) > 0 && (v.videoHeight ?? 0) > 0;
          if (hasFrames) setVideoReady(true);
        };

        // iOS Safari: play after metadata/data is ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play?.().catch(() => {});
          markReadyIfPossible();
        };
        videoRef.current.onloadeddata = () => {
          markReadyIfPossible();
        };
        videoRef.current.oncanplay = () => {
          markReadyIfPossible();
        };

        videoRef.current.play().catch(() => {});

        // If iOS/Safari or OS revokes camera, the track can end abruptly.
        // Surface this to the user so they can retry.
        const [track] = s.getVideoTracks();
        if (track) {
          track.onended = () => {
            setVideoReady(false);
            setStream(null);
            streamRef.current = null;
            setError("Camera closed unexpectedly. Please tap OPEN CAMERA again and ensure camera permission is allowed.");
          };
        }

        // On iOS, frames can take a couple seconds to appear.
        // Poll briefly before declaring failure.
        const startAt = Date.now();
        const poll = () => {
          try {
            const v = videoRef.current;
            if (!v) return;
            // If the stream ended while waiting, stop polling.
            if (!streamRef.current) return;
            const hasFrames = (v.videoWidth ?? 0) > 0 && (v.videoHeight ?? 0) > 0;
            if (hasFrames) {
              setVideoReady(true);
              return;
            }
            if (Date.now() - startAt > 4500) {
              setError("Camera permission may be blocked for this site. On iPhone: Safari → aA → Website Settings → Camera → Allow, then retry.");
              return;
            }
            window.setTimeout(poll, 250);
          } catch {
            // ignore
          }
        };
        window.setTimeout(poll, 250);
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Unable to access camera.";
      setError(msg);
    } finally {
      setInitializing(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    // Stop camera when leaving screen
    return () => stopCamera();
  }, [stopCamera]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError("Capture failed. Please open the camera first.");
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth || 1080;
    const h = video.videoHeight || 1920;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    let dataUrl = "";
    try {
      dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    } catch {
      setError("Capture failed. Please try again.");
      return;
    }
    setCapturedPhoto(dataUrl);
    // Stop camera after capture to avoid lag / battery drain
    stopCamera();
    setPhotoSession(prev => ({
      ...prev,
      capturedPhoto: dataUrl,
      capturedAt: new Date().toISOString(),
      measurementStatus: "photo_captured",
    }));
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    stopCamera();
    setPhotoSession(prev => ({
      ...prev,
      capturedPhoto: null,
      capturedAt: null,
      measurementStatus: "not_started",
      widthM: null,
      lengthM: null,
      floorLevel: null,
      measurementCompletedAt: null,
      recommendationTelemetrySessionId: null,
      telemetryCandidateSnapshotIds: [],
    }));
  };

  const handlePickFromGallery = () => {
    setError(null);
    stopCamera();
    fileInputRef.current?.click?.();
  };

  const applyGalleryDataUrl = useCallback((dataUrl) => {
    if (!dataUrl || typeof dataUrl !== "string") {
      setError("Upload failed. Please try another photo.");
      return;
    }
    setCapturedPhoto(dataUrl);
    setPhotoSession(prev => ({
      ...prev,
      capturedPhoto: dataUrl,
      capturedAt: new Date().toISOString(),
      measurementStatus: "photo_captured",
    }));
  }, []);

  const handleFileSelected = (e) => {
    const file = e.target?.files?.[0];
    const input = e.target;
    if (!file) return;

    const nameOk = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i.test(file.name || "");
    const typeOk = Boolean(file.type && file.type.startsWith("image/"));
    if (!typeOk && !nameOk) {
      setError("Please select an image file (JPEG, PNG, HEIC, WebP…).");
      if (input) input.value = "";
      return;
    }

    const finish = (dataUrl) => {
      applyGalleryDataUrl(dataUrl);
      if (input) input.value = "";
    };

    void (async () => {
      try {
        const jpeg = await heatwiseFileToJpegDataUrl(file);
        finish(jpeg);
      } catch {
        setError(
          "Could not load this image in your browser. Try a JPEG or PNG (avoid HEIC if you use Chrome), or take a new photo."
        );
        if (input) input.value = "";
      }
    })();
  };

  const handleConfirm = () => {
    navigate("photoMeasureAR");
  };

  return (
    <div style={{paddingBottom:100,height:"100%",overflowY:"auto"}}>
      <div className="navbar">
        <button
          onClick={() => navigate("measure")}
          style={{background:"none",border:"none",cursor:"pointer",display:"flex"}}
        >
          <Ic n="back" s={22} c={T.green}/>
        </button>
        <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",textAlign:"center"}}>
          <div className="mono" style={{fontSize:12,fontWeight:700,letterSpacing:"3px",color:T.textBright}}>CAMERA CAPTURE</div>
          <div className="mono" style={{fontSize:9,color:"rgba(56,189,248,.4)",letterSpacing:"1px"}}>03 / 05</div>
        </div>
      </div>
      <div className="hprog"><div className="hprog-fill" style={{width:"60%"}}/></div>
      <div style={{padding:"0 20px 24px"}}>
        <div className="a1" style={{marginTop:16,marginBottom:16}}>
          <p style={{fontSize:12,color:T.textDim,marginTop:4}}>
            Frame the usable surface so HeatWise can align future layouts and visualizations to your real space.
          </p>
        </div>
        <div className="a2 hud" style={{padding:10,marginBottom:16}}>
          <div style={{position:"relative",border:"1px solid rgba(56,189,248,.25)",background:"rgba(0,0,0,.8)",minHeight:260,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
            {!capturedPhoto && (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{width:"100%",height:"100%",objectFit:"cover"}}
                />
                {initializing && (
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(4,9,26,.8)"}}>
                    <span className="mono" style={{fontSize:11,color:T.textDim,letterSpacing:"2px"}}>INITIALIZING CAMERA…</span>
                  </div>
                )}
                {error && !initializing && (
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(4,9,26,.9)",padding:20,textAlign:"center"}}>
                    <span className="mono" style={{fontSize:11,color:T.orange,letterSpacing:"1px"}}>
                      {error}
                    </span>
                  </div>
                )}
              </>
            )}
            {capturedPhoto && (
              <img
                src={capturedPhoto}
                alt="Captured rooftop"
                style={{width:"100%",height:"100%",objectFit:"cover"}}
              />
            )}
            <canvas ref={canvasRef} style={{display:"none"}} />
          </div>
        </div>
        <div className="a3" style={{fontSize:11,color:T.textDim,marginBottom:16}}>
          <ul style={{paddingLeft:18,lineHeight:1.7}}>
            <li>Stand where the space is fully visible.</li>
            <li>Keep the horizon level and include key edges of the roof or balcony.</li>
            <li>Avoid strong backlight so details of the surface remain clear.</li>
          </ul>
        </div>
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(4,9,26,.97)",padding:"10px 20px calc(18px + env(safe-area-inset-bottom))",borderTop:"1px solid rgba(56,189,248,.1)",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column",gap:10}}>
        {!capturedPhoto ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,image/heic,image/heif,.heic,.heif"
              onChange={handleFileSelected}
              style={{display:"none"}}
            />
            <button className="gbtn cyan" onClick={handlePickFromGallery}>
              UPLOAD FROM GALLERY
            </button>
            {!stream ? (
              <button
                className="gbtn fill"
                disabled={initializing}
                onClick={startCamera}
              >
                {initializing ? "OPENING CAMERA…" : "OPEN CAMERA →"}
              </button>
            ) : (
              <button
                className="gbtn fill"
                disabled={initializing}
                onClick={handleCapture}
              >
                {videoReady ? "CAPTURE PHOTO →" : "WAITING FOR CAMERA…"}
              </button>
            )}
            {stream && (
              <button className="gbtn" onClick={stopCamera}>
                CLOSE CAMERA
              </button>
            )}
            {error && (
              <div className="mono" style={{fontSize:10,color:T.orange,letterSpacing:'1px',marginTop:6,textAlign:'center'}}>
                {error}
              </div>
            )}
          </>
        ) : (
          <>
            <button className="gbtn fill" onClick={handleConfirm}>
              CONFIRM & CONTINUE →
            </button>
            <button className="gbtn" onClick={handleRetake}>
              RETAKE PHOTO
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   PHOTO MEASUREMENT (Stage 2)
   Uses captured photo (no camera re-open)
══════════════════════════════════════════════════════════════════ */

/** Android WebView often shows a broken image for long or strict `data:` URLs — `blob:` works reliably. */
function heatwiseDataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
  try {
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    const meta = dataUrl.slice(0, comma);
    const b64 = dataUrl.slice(comma + 1).replace(/\s/g, "");
    const mimeMatch = meta.match(/data:([^;,]+)/);
    const mime = (mimeMatch?.[1] ?? "image/jpeg").trim() || "image/jpeg";
    const bin = typeof atob === "function" ? atob(b64) : "";
    if (!bin) return null;
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Turn a gallery `File` into a JPEG data URL that reliably renders in `<img>` and canvas.
 * Chrome on localhost often shows a broken image for HEIC/HEIF and some `data:image/*` fallbacks;
 * re-encoding via bitmap / Image + canvas produces a normal JPEG when the browser can decode at all.
 */
async function heatwiseFileToJpegDataUrl(file, maxSide = 2048, quality = 0.88) {
  if (!(file instanceof Blob)) {
    throw new Error("not-a-blob");
  }

  const jpegFromDrawable = (drawable, w, h) => {
    let tw = w;
    let th = h;
    if (!tw || !th) throw new Error("zero-dims");
    if (tw > maxSide || th > maxSide) {
      const s = maxSide / Math.max(tw, th);
      tw = Math.max(1, Math.round(tw * s));
      th = Math.max(1, Math.round(th * s));
    }
    const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!c) throw new Error("no-document");
    c.width = tw;
    c.height = th;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("no-2d");
    ctx.drawImage(drawable, 0, 0, tw, th);
    const url = c.toDataURL("image/jpeg", quality);
    if (typeof url !== "string" || !url.startsWith("data:image/jpeg") || url.length < 128) {
      throw new Error("bad-jpeg");
    }
    return url;
  };

  const decodeHtmlImage = (src) =>
    new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => {
        const done = () => resolve(i);
        if (typeof i.decode === "function") {
          i.decode().then(done).catch(done);
        } else {
          done();
        }
      };
      i.onerror = () => reject(new Error("image-decode"));
      i.decoding = "async";
      i.src = src;
    });

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        return jpegFromDrawable(bitmap, bitmap.width, bitmap.height);
      } finally {
        bitmap.close?.();
      }
    } catch {
      /* fall through */
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await decodeHtmlImage(objectUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    return jpegFromDrawable(img, w, h);
  } catch {
    /* fall through */
  } finally {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      /* ignore */
    }
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => reject(new Error("read-fail"));
    reader.readAsDataURL(file);
  });

  const mimePart = (dataUrl.split(",")[0] || "").toLowerCase();
  if (/heic|heif/.test(mimePart)) {
    throw new Error("heic-unsupported");
  }
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("bad-data-url");
  }

  const img = await decodeHtmlImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  return jpegFromDrawable(img, w, h);
}

function heatwiseDrawImageCover(ctx, source, cw, ch) {
  const iw = "naturalWidth" in source && source.naturalWidth ? source.naturalWidth : source.width;
  const ih = "naturalHeight" in source && source.naturalHeight ? source.naturalHeight : source.height;
  if (!iw || !ih) return;
  const ir = iw / ih;
  const cr = cw / ch;
  let dw;
  let dh;
  let ox;
  let oy;
  if (ir > cr) {
    dh = ch;
    dw = ch * ir;
    ox = (cw - dw) / 2;
    oy = 0;
  } else {
    dw = cw;
    dh = cw / ir;
    ox = 0;
    oy = (ch - dh) / 2;
  }
  ctx.drawImage(source, ox, oy, dw, dh);
}

/**
 * Map native file / content URLs to a WebView-loadable http(s) URL when Capacitor is present.
 * @param {string} url
 */
function heatwiseNormalizePhotoUrlForWebView(url) {
  if (typeof url !== "string" || !url) return url;
  if (url.startsWith("data:") || /^https?:/i.test(url) || /^blob:/i.test(url)) return url;
  if (typeof window === "undefined" || !window.Capacitor?.convertFileSrc) return url;
  const looksNative =
    /^file:/i.test(url) ||
    /^content:/i.test(url) ||
    /^capacitor:/i.test(url) ||
    /^cdvfile:/i.test(url);
  if (!looksNative) return url;
  try {
    return window.Capacitor.convertFileSrc(url);
  } catch {
    return url;
  }
}

/**
 * Decode photo for measurement preview. Canvas drawing avoids many WebView `<img src=data:` / blob bugs.
 * @returns {Promise<HTMLImageElement|ImageBitmap>}
 */
async function heatwiseLoadPhotoDisplaySource(photoDataUrl) {
  const normalized = heatwiseNormalizePhotoUrlForWebView(photoDataUrl);

  const decodeWithImage = (src) =>
    new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => {
        const finish = () => resolve(i);
        if (typeof i.decode === "function") {
          i.decode().then(finish).catch(finish);
        } else {
          finish();
        }
      };
      i.onerror = () => reject(new Error("image-decode"));
      i.decoding = "async";
      i.src = src;
    });

  if (/^(https?:|blob:)/i.test(normalized)) {
    return decodeWithImage(normalized);
  }
  if (!normalized.startsWith("data:")) {
    return decodeWithImage(normalized);
  }

  let blob = heatwiseDataUrlToBlob(normalized);
  if (!blob && typeof fetch === "function") {
    try {
      blob = await (await fetch(normalized)).blob();
    } catch {
      blob = null;
    }
  }
  if (blob) {
    let bUrl = null;
    try {
      bUrl = URL.createObjectURL(blob);
      const img = await decodeWithImage(bUrl);
      URL.revokeObjectURL(bUrl);
      bUrl = null;
      return img;
    } catch {
      if (bUrl) try { URL.revokeObjectURL(bUrl); } catch { /* ignore */ }
    }
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(blob);
      } catch {
        /* fall through */
      }
    }
  }

  return decodeWithImage(normalized);
}

const PhotoScanMeasurement = ({
  photoDataUrl,
  initialWidthM = 0,
  initialLengthM = 0,
  onApply,
}) => {
  const containerRef = useRef(null);
  const measureCanvasRef = useRef(null);
  const displaySourceRef = useRef(null);
  const [photoDisplayReady, setPhotoDisplayReady] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!photoDataUrl || typeof photoDataUrl !== "string") {
      setPhotoDisplayReady(false);
      setImgFailed(false);
      const prev = displaySourceRef.current;
      if (prev && typeof prev.close === "function") {
        try {
          prev.close();
        } catch {
          /* ignore */
        }
      }
      displaySourceRef.current = null;
      return undefined;
    }

    let cancelled = false;
    setImgFailed(false);
    setPhotoDisplayReady(false);
    const prev = displaySourceRef.current;
    if (prev && typeof prev.close === "function") {
      try {
        prev.close();
      } catch {
        /* ignore */
      }
    }
    displaySourceRef.current = null;

    void (async () => {
      try {
        const src = await heatwiseLoadPhotoDisplaySource(photoDataUrl);
        if (cancelled) {
          if (typeof src.close === "function") try { src.close(); } catch { /* */ }
          return;
        }
        displaySourceRef.current = src;
        setPhotoDisplayReady(true);
      } catch {
        if (!cancelled) setImgFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      const s = displaySourceRef.current;
      if (s && typeof s.close === "function") {
        try {
          s.close();
        } catch {
          /* ignore */
        }
      }
      displaySourceRef.current = null;
    };
  }, [photoDataUrl]);

  useLayoutEffect(() => {
    if (!photoDisplayReady || !photoDataUrl) return undefined;
    const container = containerRef.current;
    const canvas = measureCanvasRef.current;
    const source = displaySourceRef.current;
    if (!container || !canvas || !source) return undefined;

    let raf1 = 0;
    let raf2 = 0;

    const paint = () => {
      const r = container.getBoundingClientRect();
      const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
      const cw = Math.max(1, Math.floor(r.width * dpr));
      const ch = Math.max(1, Math.floor(r.height * dpr));
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, cw, ch);
      heatwiseDrawImageCover(ctx, source, cw, ch);
    };

    const paintSoon = () => {
      paint();
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(paint);
      });
    };

    paintSoon();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(paintSoon) : null;
    if (ro) ro.observe(container);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (ro) ro.disconnect();
    };
  }, [photoDataUrl, photoDisplayReady]);

  const [corners, setCorners] = useState({ tl: null, tr: null, br: null, bl: null });
  const [active, setActive] = useState("tl");
  const [dragging, setDragging] = useState(null); // CornerID | null
  const [refSide, setRefSide] = useState("width"); // "width" | "length"
  const [refWidthMeters, setRefWidthMeters] = useState(initialWidthM > 0 ? String(initialWidthM) : "");
  const [refLengthMeters, setRefLengthMeters] = useState(initialLengthM > 0 ? String(initialLengthM) : "");
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [showRecalibrate, setShowRecalibrate] = useState(false);
  const [recalibrated, setRecalibrated] = useState(false);

  const order = ["tl", "tr", "br", "bl"];
  // For photo-based estimation we only require the two measured edges:
  // width edge  = TL ↔ TR
  // length edge = TL ↔ BL
  const hasWidthEdge = !!corners.tl && !!corners.tr;
  const hasLengthEdge = !!corners.tl && !!corners.bl;

  const visibleCorners = refSide === "width"
    ? ["tl", "tr"]
    : ["tl", "bl"];

  useEffect(() => {
    // Keep the active marker meaningful for the chosen reference mode
    if (refSide === "width" && active !== "tl" && active !== "tr") setActive("tl");
    if (refSide === "length" && active !== "tl" && active !== "bl") setActive("tl");
  }, [refSide]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default visible positions (fractions of the photo box)
  const DEFAULT_FRACS = {
    tl: [0.18, 0.22],
    tr: [0.82, 0.22],
    br: [0.82, 0.80],
    bl: [0.18, 0.80],
  };

  // Ensure all 4 dots are visible immediately (even before user taps).
  useEffect(() => {
    if (!containerRef.current) return;
    setCorners(prev => {
      const alreadyAny = Object.values(prev).some(Boolean);
      if (alreadyAny) return prev;
      const r = containerRef.current.getBoundingClientRect();
      const make = (id) => ({
        x: DEFAULT_FRACS[id][0] * r.width,
        y: DEFAULT_FRACS[id][1] * r.height,
      });
      return { tl: make("tl"), tr: make("tr"), br: make("br"), bl: make("bl") };
    });
  }, [photoDataUrl]);

  const getNext = (c) => {
    for (const k of order) if (!c[k]) return k;
    return null;
  };

  const dist = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const computeConfidence = () => {
    // Confidence is purely UX guidance; it never changes the measurement math.
    // Signals:
    //  - Orthogonality of the two measured edges (near 90° is best)
    //  - If both references are provided, scale consistency between width & length
    //  - Edge length sanity (avoid tiny edges)
    if (!hasWidthEdge || !hasLengthEdge) {
      return {
        score: 0,
        label: "PLACE EDGES",
        hint: "Drag TL+TR for width and TL+BL for length.",
      };
    }

    const tl = corners.tl, tr = corners.tr, bl = corners.bl;
    const wx = tr.x - tl.x;
    const wy = tr.y - tl.y;
    const lx = bl.x - tl.x;
    const ly = bl.y - tl.y;
    const wLen = Math.sqrt(wx * wx + wy * wy);
    const lLen = Math.sqrt(lx * lx + ly * ly);
    if (wLen < 10 || lLen < 10) {
      return {
        score: 0.15,
        label: "LOW",
        hint: "Edges are very short in the photo—zoom/retake for better accuracy.",
      };
    }

    // Angle confidence: 1.0 when ~90°, down to 0.0 by ~45° away.
    const dot = wx * lx + wy * ly;
    const cos = dot / (wLen * lLen);
    const ang = Math.acos(Math.max(-1, Math.min(1, cos))); // radians
    const angDeg = (ang * 180) / Math.PI;
    const angErr = Math.abs(90 - angDeg); // degrees away from orthogonal
    const angleConf = clamp01(1 - (angErr / 45));

    // Scale drift confidence (only if both references are provided).
    const wRef = parseFloat(refWidthMeters);
    const lRef = parseFloat(refLengthMeters);
    let scaleConf = 0.7; // neutral
    let scaleHint = null;
    if (wRef > 0 && lRef > 0) {
      const scaleW = wRef / wLen;
      const scaleL = lRef / lLen;
      const drift = Math.abs(scaleW - scaleL) / Math.max(scaleW, scaleL);
      scaleConf = clamp01(1 - drift / 0.25); // drift 25% → 0
      if (drift > 0.15) {
        scaleHint = "Width/Length references disagree—recheck taps or one of the measurements.";
      }
    }

    // Weighted overall score (0–1).
    const score = clamp01((0.65 * angleConf) + (0.35 * scaleConf));
    const label =
      score >= 0.85 ? "HIGH" :
      score >= 0.65 ? "MED" :
      score >= 0.45 ? "LOW" : "VERY LOW";
    const hint =
      scaleHint ||
      (angErr > 18 ? "Try aligning edges closer to a rectangle (≈90° corner)." : "Looks consistent. You can proceed.");

    return { score, label, hint };
  };

  const confidence = computeConfidence();

  const getEventXY = (e) => {
    if (!containerRef.current) return null;
    const r = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.min(r.width, Math.max(0, clientX - r.left)),
      y: Math.min(r.height, Math.max(0, clientY - r.top)),
    };
  };

  const moveCorner = (id, pt) => {
    setCorners(prev => ({ ...prev, [id]: { x: pt.x, y: pt.y } }));
  };

  const handleContainerPointerMove = (e) => {
    if (!dragging) return;
    const pt = getEventXY(e);
    if (!pt) return;
    moveCorner(dragging, pt);
  };

  const handleContainerPointerUp = () => {
    if (dragging) setDragging(null);
  };

  const handleReset = () => {
    // Reset back to default visible positions (so user always has 4 dots)
    if (!containerRef.current) {
      setCorners({ tl: null, tr: null, br: null, bl: null });
      setActive("tl");
      setError(null);
      setWarning(null);
      setShowRecalibrate(false);
      setRecalibrated(false);
      return;
    }
    const r = containerRef.current.getBoundingClientRect();
    const make = (id) => ({
      x: DEFAULT_FRACS[id][0] * r.width,
      y: DEFAULT_FRACS[id][1] * r.height,
    });
    setCorners({ tl: make("tl"), tr: make("tr"), br: make("br"), bl: make("bl") });
    setActive("tl");
    setError(null);
    setWarning(null);
    setShowRecalibrate(false);
    setRecalibrated(false);
  };

  const applyEstimate = () => {
    setError(null);
    setWarning(null);
    const wRef = parseFloat(refWidthMeters);
    const lRef = parseFloat(refLengthMeters);
    if ((!wRef || wRef <= 0) && (!lRef || lRef <= 0)) {
      setError("Enter a real-world reference width and/or length (meters) to scale the photo.");
      return;
    }
    if (!hasWidthEdge || !hasLengthEdge) {
      setError("Set both edges first: drag TL+TR for width, then TL+BL for length.");
      return;
    }

    const tl = corners.tl, tr = corners.tr, bl = corners.bl;
    const widthPx = dist(tl, tr);
    const lengthPx = dist(tl, bl);
    if (widthPx < 5 || lengthPx < 5) {
      setError("Corners are too close — zoom/retake photo and try again.");
      return;
    }

    // If user provides one reference, estimate the other.
    // If user provides both, keep both and sanity-check scaling consistency.
    const ratio = lengthPx / widthPx;
    const widthM = (wRef && wRef > 0) ? wRef : (lRef * (1 / ratio));
    const lengthM = (lRef && lRef > 0) ? lRef : (wRef * ratio);

    if (wRef && wRef > 0 && lRef && lRef > 0) {
      const scaleW = wRef / widthPx;
      const scaleL = lRef / lengthPx;
      const drift = Math.abs(scaleW - scaleL) / Math.max(scaleW, scaleL);
      if (drift > 0.15) {
        setWarning("Width/Length references don’t match the corner shape perfectly — double-check your corner taps or the reference measurements.");
      }
    }

    onApply({
      widthM: Math.max(0.5, Math.round(widthM * 10) / 10),
      lengthM: Math.max(0.5, Math.round(lengthM * 10) / 10),
    });
  };

  const Marker = ({ id }) => {
    const p = corners[id];
    const isActive = active === id;
    const color = isActive ? T.gold : T.green;
    if (!p) return null;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setActive(id);
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setActive(id);
          setDragging(id);
        }}
        style={{
          position: "absolute",
          left: p.x,
          top: p.y,
          transform: "translate(-50%, -50%)",
          width: 30,
          height: 30,
          borderRadius: 999,
          border: `2px solid ${color}`,
          background: "rgba(0,0,0,.6)",
          boxShadow: `0 0 16px ${color}60`,
          color: "#fff",
          cursor: "pointer",
          touchAction: "none",
        }}
        aria-label={`Corner ${id}`}
      >
        <span className="mono" style={{fontSize:10,fontWeight:800}}>
          {id.toUpperCase()}
        </span>
      </button>
    );
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Guidance + confidence */}
      <div className="a1 hud" style={{padding:"12px 12px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div className="mono" style={{fontSize:10,letterSpacing:"2px",color:"rgba(56,189,248,.65)"}}>
            PHOTO SCAN · ESTIMATE
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "1px",
              color: confidence.score >= 0.65 ? T.green : confidence.score >= 0.45 ? T.gold : T.orange,
              border: `1px solid ${confidence.score >= 0.65 ? "rgba(56,189,248,.35)" : confidence.score >= 0.45 ? "rgba(255,184,0,.35)" : "rgba(255,68,0,.35)"}`,
              padding: "6px 10px",
              background: "rgba(0,0,0,.35)",
            }}
          >
            CONFIDENCE {Math.round(confidence.score * 100)}% · {confidence.label}
          </div>
        </div>
        <div style={{height:2,background:"rgba(56,189,248,.10)",marginTop:10}}>
          <div
            style={{
              height:"100%",
              width:`${Math.round(confidence.score * 100)}%`,
              background: confidence.score >= 0.65
                ? `linear-gradient(90deg,${T.greenDark},${T.green})`
                : confidence.score >= 0.45
                  ? `linear-gradient(90deg,${T.gold},${T.green})`
                  : `linear-gradient(90deg,${T.orange},${T.gold})`,
              boxShadow: `0 0 10px ${confidence.score >= 0.65 ? T.green : confidence.score >= 0.45 ? T.gold : T.orange}60`,
              transition: "width .2s ease",
            }}
          />
        </div>
        <div className="mono" style={{fontSize:10,color:T.textDim,letterSpacing:"1px",marginTop:10,lineHeight:1.6}}>
          {confidence.hint}
          <div style={{marginTop:8}}>
            - Keep the phone parallel to the ground (avoid steep tilt)<br/>
            - Include the full usable area edges in frame<br/>
            - Prefer straight edges (parapet/tiles) for corner alignment<br/>
            - If unsure, tap <span style={{color:T.cyan}}>RECALIBRATE</span> before applying
          </div>
        </div>
        <div className="mono" style={{fontSize:10,color:"rgba(186,230,253,.55)",letterSpacing:"1px",marginTop:10}}>
          Output is an <span style={{color:T.gold}}>estimate</span> (not guaranteed exact metric measurement).
        </div>
      </div>

      {/* Optional recalibration flow */}
      {showRecalibrate && (
        <div className="a2 hud" style={{padding:"12px 12px"}}>
          <div className="mono" style={{fontSize:10,letterSpacing:"2px",color:T.cyan,marginBottom:6}}>
            RECALIBRATION
          </div>
          <div style={{fontSize:12,color:T.textDim,lineHeight:1.6}}>
            Reset corners and re-place both edges (width then length) before applying.
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button
              className="gbtn cyan"
              onClick={() => {
                handleReset();
                setRefSide("width");
                setRecalibrated(true);
                setShowRecalibrate(false);
              }}
              style={{padding:"12px 12px"}}
            >
              START RECALIBRATION
            </button>
            <button className="gbtn" onClick={() => setShowRecalibrate(false)} style={{padding:"12px 12px"}}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      <div className="a2 hud" style={{padding:10,overflow:"hidden"}}>
        <div
          ref={containerRef}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
          onPointerCancel={handleContainerPointerUp}
          onPointerLeave={handleContainerPointerUp}
          style={{
            position:"relative",
            border:"1px solid rgba(56,189,248,.18)",
            background:"rgba(0,0,0,.7)",
            height:280,
            overflow:"hidden",
            touchAction:"none",
          }}
        >
          {!photoDataUrl ? (
            <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span className="mono" style={{fontSize:10,color:T.textDim}}>No photo found.</span>
            </div>
          ) : imgFailed ? (
            <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:16,textAlign:"center"}}>
              <span className="mono" style={{fontSize:10,color:T.orange,lineHeight:1.6}}>
                Could not decode this image in the WebView. Go back and pick a JPEG/PNG, or retake with the camera.
              </span>
            </div>
          ) : !photoDisplayReady ? (
            <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span className="mono" style={{fontSize:10,color:T.textDim,letterSpacing:"1px"}}>LOADING PHOTO…</span>
            </div>
          ) : (
            <canvas
              ref={measureCanvasRef}
              aria-label="Photo preview for corner measurement"
              style={{
                position:"absolute",
                inset:0,
                width:"100%",
                height:"100%",
                objectFit:"cover",
                opacity:1,
                pointerEvents:"none",
              }}
            />
          )}

          {/* Corner markers */}
          {visibleCorners.includes("tl") && <Marker id="tl" />}
          {visibleCorners.includes("tr") && <Marker id="tr" />}
          {visibleCorners.includes("br") && <Marker id="br" />}
          {visibleCorners.includes("bl") && <Marker id="bl" />}

          {/* Guide line */}
          {refSide === "width" && corners.tl && corners.tr && (
            <div
              style={{
                position:"absolute",
                left: corners.tl.x,
                top: corners.tl.y,
                width: Math.max(1, Math.abs(corners.tr.x - corners.tl.x)),
                height: 1,
                transformOrigin: "0 0",
                transform: `rotate(${Math.atan2(corners.tr.y - corners.tl.y, corners.tr.x - corners.tl.x)}rad)`,
                background: "rgba(56,189,248,.55)",
                boxShadow: "0 0 10px rgba(56,189,248,.35)",
                pointerEvents: "none",
              }}
            />
          )}
          {refSide === "length" && corners.tl && corners.bl && (
            <div
              style={{
                position:"absolute",
                left: corners.tl.x,
                top: corners.tl.y,
                width: Math.max(1, Math.abs(corners.bl.x - corners.tl.x)),
                height: 1,
                transformOrigin: "0 0",
                transform: `rotate(${Math.atan2(corners.bl.y - corners.tl.y, corners.bl.x - corners.tl.x)}rad)`,
                background: "rgba(34,211,238,.55)",
                boxShadow: "0 0 10px rgba(34,211,238,.35)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button className="gbtn" onClick={handleReset} style={{flex:"0 0 auto"}}>
          RESET CORNERS
        </button>
        <button
          className="gbtn"
          onClick={() => setShowRecalibrate(true)}
          style={{flex:"0 0 auto",borderColor:"rgba(34,211,238,.35)",color:T.cyan}}
        >
          RECALIBRATE
        </button>
        <div style={{flex:1,display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button
            className={`gbtn ${refSide === "width" ? "fill" : ""}`}
            onClick={() => setRefSide("width")}
            style={{padding:"10px 12px"}}
          >
            REFERENCE = WIDTH
          </button>
          <button
            className={`gbtn ${refSide === "length" ? "fill" : ""}`}
            onClick={() => setRefSide("length")}
            style={{padding:"10px 12px"}}
          >
            REFERENCE = LENGTH
          </button>
        </div>
      </div>

      <div className="a3" style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div className="mono" style={{fontSize:10,color:T.textDim,letterSpacing:"1px",minWidth:120}}>
            {refSide === "width" ? "KNOWN WIDTH (m)" : "KNOWN LENGTH (m)"}
          </div>
          <input
            value={refSide === "width" ? refWidthMeters : refLengthMeters}
            onChange={(e) => {
              if (refSide === "width") setRefWidthMeters(e.target.value);
              else setRefLengthMeters(e.target.value);
            }}
            inputMode="decimal"
            placeholder="e.g. 4.0"
            style={{
              flex:1,
              background:"rgba(255,255,255,.04)",
              border:"1px solid rgba(255,255,255,.10)",
              borderRadius:12,
              padding:"12px 12px",
              color:T.textBright,
              outline:"none",
            }}
          />
          <button className="gbtn cyan" onClick={applyEstimate} style={{whiteSpace:"nowrap"}}>
            APPLY ESTIMATE
          </button>
        </div>
        {error && (
          <div className="mono" style={{fontSize:10,color:T.orange,letterSpacing:"1px"}}>
            {error}
          </div>
        )}
        {warning && (
          <div className="mono" style={{fontSize:10,color:T.gold,letterSpacing:"1px"}}>
            {warning}
          </div>
        )}
        {recalibrated && (
          <div className="mono" style={{fontSize:10,color:T.cyan,letterSpacing:"1px"}}>
            Recalibration started — set width edge, then length edge, then apply.
          </div>
        )}
        <div className="mono" style={{fontSize:10,color:T.textDim,letterSpacing:"1px",lineHeight:1.6}}>
          Tip: you can enter width and length separately. If you enter only one, we’ll estimate the other from the photo.
        </div>
      </div>
    </div>
  );
};

const PhotoARMeasurementScreen = ({ navigate, photoSession, setPhotoSession }) => {
  const [mode, setMode] = useState("photoScan"); // "photoScan" | "manual"
  const [draftDims, setDraftDims] = useState({
    widthM: photoSession?.widthM ?? 0,
    lengthM: photoSession?.lengthM ?? 0,
  });

  useEffect(() => {
    setDraftDims({
      widthM: photoSession?.widthM ?? 0,
      lengthM: photoSession?.lengthM ?? 0,
    });
  }, [photoSession?.widthM, photoSession?.lengthM]);

  const handleComplete = (widthM, lengthM) => {
    setPhotoSession(prev => ({
      ...prev,
      measurementStatus: "ar_complete",
      widthM,
      lengthM,
      floorLevel: prev?.floorLevel ?? 1,
      measurementCompletedAt: new Date().toISOString(),
    }));
    navigate("environment");
  };

  const handleCancel = () => {
    navigate("photoCapture");
  };

  return (
    <div style={{paddingBottom:100,height:"100%",overflowY:"auto"}}>
      <div className="navbar">
        <button
          onClick={handleCancel}
          style={{background:"none",border:"none",cursor:"pointer",display:"flex"}}
        >
          <Ic n="back" s={22} c={T.green}/>
        </button>
        <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",textAlign:"center"}}>
          <div className="mono" style={{fontSize:12,fontWeight:700,letterSpacing:"3px",color:T.textBright}}>MEASURE SPACE</div>
          <div className="mono" style={{fontSize:9,color:"rgba(56,189,248,.4)",letterSpacing:"1px"}}>04 / 05</div>
        </div>
      </div>
      <div className="hprog"><div className="hprog-fill" style={{width:"70%"}}/></div>
      <div style={{padding:"0 20px 90px"}}>
        <div className="a1" style={{marginTop:16,marginBottom:12}}>
          <div className="slabel">CONFIRM DIMENSIONS</div>
          <p style={{fontSize:12,color:T.textDim,marginTop:4}}>
            Use the photo you captured on the previous step. You can either scan corners on the photo (AR-style) or enter dimensions manually.
          </p>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button
            className={`gbtn ${mode === "photoScan" ? "fill" : ""}`}
            onClick={() => setMode("photoScan")}
            style={{flex:1}}
          >
            PHOTO SCAN (AR‑STYLE)
          </button>
          <button
            className={`gbtn ${mode === "manual" ? "fill" : ""}`}
            onClick={() => setMode("manual")}
            style={{flex:1}}
          >
            MANUAL ENTRY
          </button>
        </div>

        {mode === "photoScan" ? (
          <PhotoScanMeasurement
            photoDataUrl={photoSession?.capturedPhoto ?? null}
            initialWidthM={draftDims.widthM}
            initialLengthM={draftDims.lengthM}
            onApply={({ widthM, lengthM }) => {
              setDraftDims({ widthM, lengthM });
            }}
          />
        ) : null}

        <div className="a3" style={{marginTop:12}}>
          <ManualMeasurement
            initialWidthM={draftDims.widthM}
            initialLengthM={draftDims.lengthM}
            onComplete={handleComplete}
          />
        </div>
        <div className="a3" style={{fontSize:11,color:T.textDim,marginTop:12}}>
          <ul style={{paddingLeft:18,lineHeight:1.7}}>
            <li>If you don't know exact size, estimate by steps (1 step ≈ 0.8m).</li>
            <li>Include parapet walls and permanent obstacles in your usable footprint.</li>
            <li>You can go back to recapture the photo anytime.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const SPACE_TYPES=[
  {id:'outdoor_rooftop', icon:'🏠', label:'ROOFTOP', sub:'Open rooftop / terrace'},
  {id:'outdoor_terrace', icon:'🌿', label:'TERRACE', sub:'Ground-level or podium terrace'},
  {id:'outdoor_balcony', icon:'🏙', label:'BALCONY', sub:'Balcony or deck'},
  {id:'semi_outdoor',   icon:'⛩',  label:'SEMI-OPEN', sub:'Covered porch or pergola'},
  {id:'indoor',         icon:'🪴',  label:'INDOOR', sub:'Indoor with natural light'},
];

const HEAT_META={
  low:     {label:'LOW HEAT',    color:'#38BDF8', icon:'🌤', sub:'Under 28°C daily max'},
  medium:  {label:'MODERATE',   color:'#F9C74F', icon:'☀️', sub:'28–33°C daily max'},
  high:    {label:'HIGH HEAT',  color:'#F4845F', icon:'🔆', sub:'33–38°C daily max'},
  extreme: {label:'EXTREME',    color:'#E63946', icon:'🌡', sub:'Above 38°C daily max'},
};
const WIND_META={
  sheltered:{label:'SHELTERED',  color:'#38BDF8', icon:'🌬'},
  moderate: {label:'MODERATE',   color:'#F9C74F', icon:'💨'},
  windy:    {label:'WINDY',      color:'#F4845F', icon:'🌪'},
  severe:   {label:'SEVERE',     color:'#E63946', icon:'⛈'},
};

const EnvironmentScreen = ({ navigate, photoSession, setPhotoSession, persistPhotoSession }) => {
  // Detection state
  const [detectPhase, setDetectPhase] = useState('idle'); // idle|detecting|detected|error
  const [detectedEnv, setDetectedEnv] = useState(null);
  const [detectErr, setDetectErr] = useState(null);

  // Space type selection
  const [spaceType, setSpaceType] = useState('outdoor_rooftop');

  // Manual override controls (always editable)
  const [showManual, setShowManual] = useState(true);
  const [manualOverridden, setManualOverridden] = useState(false);
  const [sun, setSun] = useState('full');
  const [wind, setWind] = useState('moderate');
  const [temp, setTemp] = useState(65);
  const dispTemp = Math.round(25 + (temp / 100) * 20);
  const tc = dispTemp < 32 ? T.green : dispTemp < 38 ? T.gold : T.orange;
  const slRef = useRef(null);
  const handleSlider = e => {
    const r = slRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    setTemp(Math.min(100, Math.max(0, (x / r.width) * 100)));
    setManualOverridden(true);
  };

  // Sync manual controls from auto-detected values (once)
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!detectedEnv || syncedRef.current || manualOverridden) return;
    syncedRef.current = true;
    // Sun exposure
    if (detectedEnv.sunExposure === 'shade') setSun('shaded');
    else if (detectedEnv.sunExposure === 'partial') setSun('partial');
    else setSun('full');
    // Wind
    if (detectedEnv.windLevel === 'low') setWind('low');
    else if (detectedEnv.windLevel === 'high') setWind('high');
    else setWind('moderate');
    // Temp: map currentTempC to slider 0-100 over 25-45°C range
    const t = detectedEnv.dailyMaxTempC ?? detectedEnv.currentTempC ?? 35;
    setTemp(Math.min(100, Math.max(0, ((t - 25) / 20) * 100)));
  }, [detectedEnv, manualOverridden]);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  // ── Auto-detect ──────────────────────────────────────────────────────────
  const detectLocation = useCallback(async () => {
    setDetectPhase('detecting');
    setDetectErr(null);
    try {
      const { getCurrentPosition: getPos } = await import('../lib/geolocation.js');
      const { latitude: lat, longitude: lon } = await getPos();
      const res = await fetch('/api/env/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || `Detection failed (${res.status})`);
      }
      const data = await res.json();
      setDetectedEnv(data);
      setDetectPhase('detected');
      syncedRef.current = false; // allow sync to run
    } catch (err) {
      setDetectErr(err?.message || 'Could not detect location');
      setDetectPhase('error');
    }
  }, []);

  // ── Confirm & proceed ────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    setSaveErr(null);
    setSaving(true);

    // Build the final environment object
    const sunExposure = sun === 'shaded' ? 'shade' : sun === 'partial' ? 'partial' : 'full';
    const windLevel = wind === 'moderate' ? 'medium' : wind === 'low' ? 'low' : 'high';
    const summerTempC = dispTemp;
    const environmentSource = (detectedEnv && !manualOverridden) ? 'auto' : 'manual';

    const environment = {
      sunExposure,
      windLevel,
      summerTempC,
      spaceType,
      environmentSource,
      // Auto-detected fields (null if manual)
      latitude:      detectedEnv?.latitude ?? null,
      longitude:     detectedEnv?.longitude ?? null,
      locationLabel: detectedEnv?.locationLabel ?? null,
      currentTempC:  detectedEnv?.currentTempC ?? null,
      dailyMaxTempC: detectedEnv?.dailyMaxTempC ?? null,
      windSpeedKmh:  detectedEnv?.windSpeedKmh ?? null,
      uvIndex:       detectedEnv?.uvIndex ?? null,
      heatExposure:  detectedEnv?.heatExposure ?? null,
      windExposure:  detectedEnv?.windExposure ?? null,
    };

    setPhotoSession(prev => {
      const merged = { ...prev, environment };
      queueMicrotask(async () => {
        try {
          if (typeof persistPhotoSession === 'function') await persistPhotoSession(merged);
        } catch (e) {
          setSaveErr(e instanceof Error ? e.message : 'Could not save environment');
        } finally {
          navigate('analysis');
          setSaving(false);
        }
      });
      return merged;
    });
  }, [sun, wind, dispTemp, spaceType, detectedEnv, manualOverridden, navigate, persistPhotoSession, setPhotoSession]);

  const hm = detectedEnv ? HEAT_META[detectedEnv.heatExposure] : null;
  const wm = detectedEnv ? WIND_META[detectedEnv.windExposure] : null;

  return (
    <div style={{paddingBottom: 8}}>
      <div className="navbar">
        <button onClick={()=>navigate('measure')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}>
          <Ic n="back" s={22} c={T.green}/>
        </button>
        <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',textAlign:'center'}}>
          <div className="mono" style={{fontSize:12,fontWeight:700,letterSpacing:'3px',color:T.textBright}}>ENVIRONMENT</div>
          <div className="mono" style={{fontSize:9,color:'rgba(56,189,248,.4)',letterSpacing:'1px'}}>03 / 04</div>
        </div>
      </div>
      <div className="hprog"><div className="hprog-fill" style={{width:'75%'}}/></div>

      <div style={{padding:'0 20px'}}>

        {/* ── Location Detection Card ── */}
        <div className="a1 hud" style={{padding:16,marginBottom:16}}>
          {detectPhase === 'idle' && (
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{fontSize:28}}>📍</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:T.textBright,marginBottom:2}}>Auto-detect conditions</div>
                <div className="mono" style={{fontSize:9,color:T.textDim,letterSpacing:'1px'}}>Uses your location + live weather data</div>
              </div>
              <button
                className="gbtn"
                style={{padding:'9px 14px',fontSize:10,width:'auto',whiteSpace:'nowrap'}}
                onClick={detectLocation}
              >
                DETECT
              </button>
            </div>
          )}

          {detectPhase === 'detecting' && (
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:28,height:28,border:'2px solid #38BDF8',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite',flexShrink:0}}/>
              <div>
                <div style={{fontSize:12,color:T.textBright,fontWeight:600}}>Detecting location…</div>
                <div className="mono" style={{fontSize:9,color:T.textDim,letterSpacing:'1px'}}>Fetching live weather data</div>
              </div>
            </div>
          )}

          {detectPhase === 'detected' && detectedEnv && (
            <div>
              {/* Location header */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:18}}>📍</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:T.textBright}}>{detectedEnv.locationLabel}</div>
                    <div className="mono" style={{fontSize:8,color:T.green,letterSpacing:'1.5px'}}>LIVE · {new Date(detectedEnv.fetchedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
                <button
                  onClick={detectLocation}
                  style={{background:'none',border:'1px solid rgba(56,189,248,.25)',color:T.green,fontSize:9,padding:'5px 10px',cursor:'pointer',fontFamily:"'DM Mono',monospace",letterSpacing:'1px'}}
                >
                  REFRESH
                </button>
              </div>

              {/* Live weather grid */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                <div style={{background:'rgba(56,189,248,.06)',border:'1px solid rgba(56,189,248,.14)',padding:'10px 12px',borderRadius:8}}>
                  <div className="mono" style={{fontSize:8,color:T.textDim,letterSpacing:'1.5px',marginBottom:4}}>NOW</div>
                  <div className="mono" style={{fontSize:22,fontWeight:700,color:T.textBright}}>{detectedEnv.currentTempC}°C</div>
                  <div className="mono" style={{fontSize:9,color:T.textDim}}>Current temp</div>
                </div>
                <div style={{background:'rgba(56,189,248,.06)',border:'1px solid rgba(56,189,248,.14)',padding:'10px 12px',borderRadius:8}}>
                  <div className="mono" style={{fontSize:8,color:T.textDim,letterSpacing:'1.5px',marginBottom:4}}>DAILY MAX</div>
                  <div className="mono" style={{fontSize:22,fontWeight:700,color:tc}}>{detectedEnv.dailyMaxTempC}°C</div>
                  <div className="mono" style={{fontSize:9,color:T.textDim}}>Peak today</div>
                </div>
                {detectedEnv.annualAvgTempC > 0 && (
                  <div style={{background:'rgba(82,183,136,.08)',border:'1px solid rgba(82,183,136,.22)',padding:'10px 12px',borderRadius:8}}>
                    <div className="mono" style={{fontSize:8,color:T.textDim,letterSpacing:'1.5px',marginBottom:4}}>ANNUAL AVG</div>
                    <div className="mono" style={{fontSize:22,fontWeight:700,color:T.green}}>{detectedEnv.annualAvgTempC}°C</div>
                    <div className="mono" style={{fontSize:9,color:T.textDim}}>Used for species match</div>
                  </div>
                )}
                <div style={{background:'rgba(56,189,248,.06)',border:'1px solid rgba(56,189,248,.14)',padding:'10px 12px',borderRadius:8}}>
                  <div className="mono" style={{fontSize:8,color:T.textDim,letterSpacing:'1.5px',marginBottom:4}}>WIND</div>
                  <div className="mono" style={{fontSize:18,fontWeight:700,color:T.textBright}}>{detectedEnv.windSpeedKmh} <span style={{fontSize:10}}>km/h</span></div>
                  <div className="mono" style={{fontSize:9,color:T.textDim}}>Speed at 10 m</div>
                </div>
                {detectedEnv.uvIndex != null && (
                  <div style={{background:'rgba(56,189,248,.06)',border:'1px solid rgba(56,189,248,.14)',padding:'10px 12px',borderRadius:8}}>
                    <div className="mono" style={{fontSize:8,color:T.textDim,letterSpacing:'1.5px',marginBottom:4}}>UV INDEX</div>
                    <div className="mono" style={{fontSize:18,fontWeight:700,color:detectedEnv.uvIndex>=6?T.orange:T.gold}}>{detectedEnv.uvIndex}</div>
                    <div className="mono" style={{fontSize:9,color:T.textDim}}>{detectedEnv.uvIndex>=8?'Very high':detectedEnv.uvIndex>=6?'High':detectedEnv.uvIndex>=3?'Moderate':'Low'}</div>
                  </div>
                )}
              </div>

              {/* Derived signal pills */}
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {hm && (
                  <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,background:`${hm.color}18`,border:`1px solid ${hm.color}50`}}>
                    <span style={{fontSize:14}}>{hm.icon}</span>
                    <div>
                      <div className="mono" style={{fontSize:9,color:hm.color,letterSpacing:'1.5px',fontWeight:700}}>{hm.label}</div>
                      <div className="mono" style={{fontSize:7,color:T.textDim}}>{hm.sub}</div>
                    </div>
                  </div>
                )}
                {wm && (
                  <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,background:`${wm.color}18`,border:`1px solid ${wm.color}50`}}>
                    <span style={{fontSize:14}}>{wm.icon}</span>
                    <div className="mono" style={{fontSize:9,color:wm.color,letterSpacing:'1.5px',fontWeight:700}}>{wm.label}</div>
                  </div>
                )}
                {!manualOverridden && (
                  <div className="mono" style={{fontSize:8,color:'rgba(56,189,248,.5)',alignSelf:'center',letterSpacing:'1px'}}>AUTO · manual controls synced</div>
                )}
              </div>
            </div>
          )}

          {detectPhase === 'error' && (
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:20}}>⚠️</span>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:T.orange,fontWeight:600,marginBottom:2}}>Detection failed</div>
                <div className="mono" style={{fontSize:9,color:T.textDim}}>{detectErr}</div>
              </div>
              <button className="gbtn" style={{padding:'7px 12px',fontSize:9,width:'auto'}} onClick={detectLocation}>
                RETRY
              </button>
            </div>
          )}
        </div>

        {/* ── Space Type ── */}
        <div className="a2" style={{marginBottom:18}}>
          <div className="slabel">SPACE TYPE</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {SPACE_TYPES.map(st=>(
              <div
                key={st.id}
                onClick={()=>setSpaceType(st.id)}
                style={{
                  background: spaceType===st.id?'rgba(56,189,248,.1)':'rgba(56,189,248,.03)',
                  border:`1px solid ${spaceType===st.id?T.green:'rgba(56,189,248,.14)'}`,
                  padding:'12px 10px',
                  cursor:'pointer',
                  transition:'all .2s',
                  borderRadius:8,
                  display:'flex',
                  alignItems:'center',
                  gap:10,
                }}
              >
                <span style={{fontSize:20}}>{st.icon}</span>
                <div>
                  <div className="mono" style={{fontSize:10,letterSpacing:'1.5px',color:spaceType===st.id?T.green:T.textBright,fontWeight:700}}>{st.label}</div>
                  <div className="mono" style={{fontSize:8,color:T.textDim,marginTop:1}}>{st.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Manual Controls ── */}
        <div className="a3" style={{marginBottom:18}}>
          <div
            style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,cursor:'pointer'}}
            onClick={()=>setShowManual(v=>!v)}
          >
            <div className="slabel" style={{margin:0}}>
              MANUAL CONTROLS
              {detectedEnv && !manualOverridden && (
                <span className="mono" style={{marginLeft:8,fontSize:8,color:T.green,letterSpacing:'1px'}}>AUTO-FILLED</span>
              )}
            </div>
            <div className="mono" style={{fontSize:10,color:T.green}}>{showManual?'▲ COLLAPSE':'▼ EXPAND'}</div>
          </div>

          {showManual && (
            <>
              {/* Sun exposure */}
              <div style={{marginBottom:14}}>
                <div className="slabel" style={{marginBottom:8}}>SUN EXPOSURE</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                  {[{id:'shaded',e:'🌑',l:'SHADED'},{id:'partial',e:'⛅',l:'PARTIAL'},{id:'full',e:'☀️',l:'FULL SUN'}].map(s=>(
                    <div
                      key={s.id}
                      onClick={()=>{setSun(s.id);setManualOverridden(true);}}
                      style={{
                        background: sun===s.id?'rgba(56,189,248,.1)':'rgba(56,189,248,.03)',
                        border:`1px solid ${sun===s.id?T.green:'rgba(56,189,248,.14)'}`,
                        padding:'12px 8px',
                        textAlign:'center',
                        cursor:'pointer',
                        transition:'all .2s',
                        borderRadius:8,
                      }}
                    >
                      <div style={{fontSize:22,marginBottom:4}}>{s.e}</div>
                      <div className="mono" style={{fontSize:9,letterSpacing:'1.5px',color:sun===s.id?T.green:T.textDim}}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Temperature slider */}
              <div style={{marginBottom:14}}>
                <div className="slabel" style={{marginBottom:8}}>SUMMER TEMPERATURE</div>
                <div style={{textAlign:'center',margin:'10px 0'}}>
                  <span className="mono" style={{fontSize:44,fontWeight:700,color:tc,textShadow:`0 0 20px ${tc}60`,transition:'color .3s'}}>{dispTemp}°C</span>
                </div>
                <div
                  ref={slRef}
                  style={{height:4,background:`linear-gradient(90deg,${T.green},${T.gold},${T.orange})`,position:'relative',cursor:'pointer',boxShadow:'0 0 8px rgba(56,189,248,.3)',borderRadius:4}}
                  onClick={handleSlider}
                  onMouseMove={e=>e.buttons&&handleSlider(e)}
                  onTouchMove={handleSlider}
                >
                  <div style={{width:20,height:20,background:T.bg,border:`2px solid ${tc}`,boxShadow:`0 0 12px ${tc}80`,position:'absolute',top:-8,left:`${temp}%`,transform:'translateX(-50%)',cursor:'grab',transition:'border-color .3s',borderRadius:'50%'}}/>
                </div>
                <div className="mono" style={{display:'flex',justifyContent:'space-between',marginTop:8,fontSize:9,color:T.textDim}}>
                  <span>25°C (cool)</span><span>45°C (extreme)</span>
                </div>
              </div>

              {/* Wind */}
              <div>
                <div className="slabel" style={{marginBottom:8}}>WIND LEVEL</div>
                <div style={{display:'flex',gap:8}}>
                  {[['low','LOW','🌬'],['moderate','MODERATE','💨'],['high','HIGH','🌪']].map(([wid,wl,e])=>(
                    <button
                      key={wid}
                      onClick={()=>{setWind(wid);setManualOverridden(true);}}
                      style={{flex:1,padding:'10px 6px',background:wind===wid?'rgba(56,189,248,.1)':'rgba(56,189,248,.03)',border:`1px solid ${wind===wid?T.green:'rgba(56,189,248,.14)'}`,cursor:'pointer',transition:'all .2s',textAlign:'center',borderRadius:8}}
                    >
                      <div style={{fontSize:18,marginBottom:3}}>{e}</div>
                      <div className="mono" style={{fontSize:8,letterSpacing:'1.5px',color:wind===wid?T.green:T.textDim}}>{wl}</div>
                    </button>
                  ))}
                </div>
              </div>

              {manualOverridden && detectedEnv && (
                <div className="mono" style={{fontSize:9,color:T.textDim,marginTop:10,letterSpacing:'1px'}}>
                  SOURCE: MANUAL OVERRIDE
                  <span
                    onClick={()=>{setManualOverridden(false);syncedRef.current=false;}}
                    style={{marginLeft:10,color:T.green,cursor:'pointer'}}
                  >
                    Reset to auto
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {saveErr && (
          <div className="mono" style={{fontSize:10,color:T.orange,marginBottom:12}}>{saveErr}</div>
        )}
      </div>

      <div style={{position:'sticky',bottom:0,background:'rgba(4,9,26,.97)',padding:'16px 20px 32px',borderTop:'1px solid rgba(56,189,248,.1)',zIndex:50,marginTop:8}}>
        <button
          className="gbtn fill"
          disabled={saving}
          onClick={handleConfirm}
        >
          {saving ? 'SAVING…' : '🤖 USE THESE CONDITIONS →'}
        </button>
        <div className="mono" style={{textAlign:'center',marginTop:8,fontSize:9,color:T.textDim,letterSpacing:'1px'}}>
          {detectedEnv && !manualOverridden
            ? `AUTO · ${detectedEnv.locationLabel} · ${detectedEnv.heatExposure?.toUpperCase()} heat · ${detectedEnv.windExposure?.toUpperCase()} wind`
            : `MANUAL · ${spaceType.replace(/_/g,' ').toUpperCase()}`}
        </div>
      </div>
    </div>
  );
};

/* BottomNav moved to `components/heatwise/ui/BottomNav.jsx` */

function AuthShell({ children }) {
  return (
    <>
      <style>{CSS}</style>
      <div className="auth-shell">
        <div className="auth-shell-bg" aria-hidden />
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440 }}>
          {children}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   APP ROOT
══════════════════════════════════════════════════════════════════ */
const NAV=['home','saved','report','settings','cityHeat','speciesLib','speciesDetail','impact','notifications','tips'];
export default function App(){
  const { status } = useSession();
  const [me, setMe] = useState(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [projects, setProjects] = useState([]);
  const [onboarding, setOnboarding] = useState({ step: "phone", phoneNumber: "", debugOtp: null });

  const [screen,setScreen]=useState(()=>{
    // On reload, restore last screen for authenticated flows (avoids re-showing splash)
    try{
      const saved=sessionStorage.getItem('hw_screen');
      const safeScreens=['home','settings','cityHeat','impact','saved','speciesLib','tips','notifications','create','climateSpecies'];
      if(saved&&safeScreens.includes(saved)) return saved;
    }catch{}
    return 'splash';
  });
  const [anim,setAnim]=useState('screen-in');
  const [selectedSpecies,setSelectedSpecies]=useState(null);
  const hist=useRef([]);
  const [photoSession, setPhotoSession] = useState({
    id: null,
    projectId: null,
    projectMeta: null,
    environment: null,
    capturedPhoto: null,
    capturedAt: null,
    measurementStatus: "not_started",
    widthM: null,
    lengthM: null,
    floorLevel: null,
    measurementCompletedAt: null,
    selectedRecommendation: null,
    generatedVisualization: null,
    recommendations: [],
    recommendationTelemetrySessionId: null,
    telemetryCandidateSnapshotIds: [],
    // ── Garden visualization pipeline artifacts ──────────────
    frameCrop: null,          // CropFrac {x,y,w,h} — user-selected garden area (fractions 0-1)
    frameMask: null,          // base64 PNG mask — white=transform, black=preserve
    runwareVisualization: null, // {imageUrl, prompt, mode, hadSeedImage, hadLayoutSchema, hadMask, createdAt}
    regenerationHistory: [],  // [{imageUrl, prompt, mode, createdAt}] — past Runware outputs
  });

  // Ref so navigate can read current photoSession.projectId without stale closure
  const photoSessionRef = useRef(null);
  useEffect(() => { photoSessionRef.current = photoSession; }, [photoSession]);

  // Screens that belong to a project flow and are safe to resume
  const PROJECT_SCREENS = new Set(['result','gardenLayout','beforeAfter','report','install','environment','photoMeasureAR','analysis']);

  const navigate=useCallback((to)=>{
    const isBack=hist.current.length>0&&hist.current[hist.current.length-1]===to;
    setAnim(isBack?'screen-back':'screen-in');
    if(!isBack) hist.current.push(screen); else hist.current.pop();
    setScreen(to);
    try{ sessionStorage.setItem('hw_screen', to); }catch{}
    // Persist last screen per project so "resume" can reopen from here
    try{
      const pid = photoSessionRef.current?.projectId;
      if(pid && PROJECT_SCREENS.has(to)){
        localStorage.setItem(`hw_proj_screen_${pid}`, to);
      }
    }catch{}
  },[screen]);

  const resumeProject = useCallback(async (projectId) => {
    const res = await fetch(`/api/projects/${projectId}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || "Could not load project");
    const project = data;
    const ps = data.latestPhotoSession;
    const projectMeta = {
      name: project.name,
      location: project.location,
      surfaceType: project.surfaceType,
      primaryGoal: project.primaryGoal,
    };
    const telEmpty = {
      recommendationTelemetrySessionId: null,
      telemetryCandidateSnapshotIds: [],
    };
    if (!ps) {
      setPhotoSession({
        id: null,
        projectId: project.id,
        projectMeta,
        environment: null,
        capturedPhoto: null,
        capturedAt: null,
        measurementStatus: "not_started",
        widthM: null,
        lengthM: null,
        floorLevel: 1,
        measurementCompletedAt: null,
        selectedRecommendation: null,
        generatedVisualization: null,
        recommendations: [],
        frameCrop: null,
        frameMask: null,
        runwareVisualization: null,
        regenerationHistory: [],
        ...telEmpty,
      });
      navigate("measure");
      return;
    }
    let rec = ps.recommendationJson ? JSON.parse(ps.recommendationJson) : null;
    const layout = ps.layoutSchema ? JSON.parse(ps.layoutSchema) : null;
    const mapping = ps.spatialMapping ? JSON.parse(ps.spatialMapping) : null;
    if (rec && layout) {
      rec = { ...rec, layoutSchema: rec.layoutSchema ?? layout };
    }
    if (rec && mapping && !rec.spatialMapping) {
      rec = { ...rec, spatialMapping: mapping };
    }
    const recommendations = rec ? [rec] : [];
    const hasSavedMeta =
      ps.projectMeta &&
      typeof ps.projectMeta === "object" &&
      Object.keys(ps.projectMeta).length > 0;
    const mergedProjectMeta = hasSavedMeta ? { ...projectMeta, ...ps.projectMeta } : projectMeta;
    setPhotoSession({
      id: ps.id,
      projectId: ps.projectId ?? project.id,
      projectMeta: mergedProjectMeta,
      environment: ps.environment ?? null,
      capturedPhoto: ps.photoData ?? null,
      capturedAt: ps.capturedAt ? new Date(ps.capturedAt).toISOString() : null,
      measurementStatus: ps.measurementStatus ?? null,
      widthM: ps.widthM ?? null,
      lengthM: ps.lengthM ?? null,
      floorLevel: ps.floorLevel ?? null,
      measurementCompletedAt: ps.measurementCompletedAt
        ? new Date(ps.measurementCompletedAt).toISOString()
        : null,
      selectedRecommendation: rec,
      generatedVisualization: ps.visualizationImageUrl
        ? {
            imageUrl: ps.visualizationImageUrl,
            prompt: ps.visualizationPrompt ?? "",
            createdAt: new Date().toISOString(),
          }
        : null,
      recommendations,
      ...telEmpty,
    });
    // Resume from the last screen the user was on for this project
    let savedScreen = null;
    try{ savedScreen = localStorage.getItem(`hw_proj_screen_${project.id}`); }catch{}
    const RESUMABLE = new Set(['result','gardenLayout','beforeAfter','report','install','environment']);
    if(savedScreen && RESUMABLE.has(savedScreen)){
      navigate(savedScreen);
    } else if (rec) navigate("result");
    else if (ps.measurementStatus === "ar_complete") navigate("environment");
    else if (ps.photoData) navigate("photoMeasureAR");
    else navigate("measure");
  }, [navigate]);

  // Load user profile once authenticated
  useEffect(() => {
    let alive = true;
    (async () => {
      if (status !== "authenticated") {
        if (alive) {
          setMe(null);
          setMeLoaded(false);
        }
        return;
      }
      try {
        const res = await fetch("/api/user/me");
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) {
          setMe(null);
          setMeLoaded(true);
          return;
        }
        setMe(data);
        setMeLoaded(true);
        // Fetch projects alongside me
        fetch("/api/projects").then(r => r.ok ? r.json() : []).then(d => { if (alive && Array.isArray(d)) setProjects(d); }).catch(() => {});
      } catch {
        if (!alive) return;
        setMe(null);
        setMeLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [status]);

  // Skip splash/onboarding for already-authenticated users (e.g. after page reload)
  useEffect(() => {
    if (status === 'authenticated' && (screen === 'splash' || screen === 'onboarding')) {
      setScreen('home');
    }
  }, [status, screen]);

  const persistPhotoSession = useCallback(async (snapshot) => {
    const ps = snapshot ?? photoSession;
    try {
      const res = await fetch("/api/photo-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ps.id,
          photoSession: ps,
        }),
      });
      if (!res.ok) return ps;
      const data = await res.json();
      if (data.id) {
        setPhotoSession(prev => ({ ...prev, id: data.id }));
        return { ...ps, id: data.id };
      }
    } catch {
      // best-effort persistence; ignore failures in UI
    }
    return ps;
  }, [photoSession, setPhotoSession]);

  const markRecommendationSelection = useCallback(async (sessionAfterSelect, optionIndex) => {
    const persisted = await persistPhotoSession(sessionAfterSelect);
    let base = persisted;
    let telId = base.recommendationTelemetrySessionId;
    let telSnaps = base.telemetryCandidateSnapshotIds ?? [];
    if (!telId || !telSnaps.length || telSnaps.length !== base.recommendations?.length) {
      const created = await createRecommendationTelemetrySessionFromClient(
        base,
        base.recommendations ?? [],
        me?.id,
      );
      if (created) {
        telId = created.recommendationSessionId;
        telSnaps = created.candidateSnapshotIds ?? [];
        setPhotoSession((p) => ({
          ...p,
          recommendationTelemetrySessionId: telId,
          telemetryCandidateSnapshotIds: telSnaps,
        }));
      }
    }
    const snapId = telSnaps[optionIndex];
    if (!telId || !base.projectId || !me?.id || !snapId) return;
    try {
      await fetch("/api/recommendations/mark-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackEventId: `hw-${telId}-sel-${optionIndex}-${Date.now()}`,
          sessionId: telId,
          projectId: base.projectId,
          userId: me.id,
          candidateSnapshotId: snapId,
          eventSource: "heatwise_app",
          screenName: "result",
          uiPosition: optionIndex + 1,
          metadata: {
            speciesCatalogCodes: extractSpeciesCatalogCodesFromRecommendation(
              base.recommendations?.[optionIndex],
            ),
          },
        }),
      });
    } catch {
      /* non-blocking */
    }
  }, [me?.id, persistPhotoSession, setPhotoSession]);

  const loadRecommendation = useCallback(async ()=> {
    if (photoSession?.selectedRecommendation) return photoSession.selectedRecommendation;
    try {
      const { recommendations: recs, telemetryMeta, generateLatencyMs } =
        await fetchLayoutRecommendationsForSession(photoSession, me?.id);
      const rec = recs?.[0] ?? null;
      if (rec) {
        setPhotoSession(prev => {
          const next = {
            ...prev,
            selectedRecommendation: rec,
            recommendations: prev?.recommendations?.length ? prev.recommendations : [rec],
            recommendationGenerateTelemetryMeta: telemetryMeta ?? prev.recommendationGenerateTelemetryMeta,
            recommendationGenerateLatencyMs:
              generateLatencyMs ?? prev.recommendationGenerateLatencyMs,
          };
          queueMicrotask(() => {
            void (async () => {
              const merged = await persistPhotoSession(next);
              const created = await createRecommendationTelemetrySessionFromClient(
                merged,
                merged.recommendations,
                me?.id,
              );
              if (created) {
                setPhotoSession((p) => ({
                  ...p,
                  recommendationTelemetrySessionId: created.recommendationSessionId,
                  telemetryCandidateSnapshotIds: created.candidateSnapshotIds ?? [],
                }));
              }
            })();
          });
          return next;
        });
      }
      return rec;
    } catch {
      return null;
    }
  },[photoSession, photoSession?.selectedRecommendation, persistPhotoSession, me?.id]);

  const ensureRecommendation = useCallback(async ()=> {
    if (photoSession?.selectedRecommendation) return photoSession.selectedRecommendation;
    return loadRecommendation();
  },[photoSession?.selectedRecommendation, loadRecommendation]);

  const generatePhotoRecommendations = useCallback(async () => {
    try {
      const { recommendations: recs, telemetryMeta, generateLatencyMs } =
        await fetchLayoutRecommendationsForSession(photoSession, me?.id);
      if (recs.length === 0) return null;
      const first = recs[0];
      setPhotoSession(prev => {
        const next = {
          ...prev,
          selectedRecommendation: first,
          recommendations: recs,
          recommendationGenerateTelemetryMeta: telemetryMeta ?? prev.recommendationGenerateTelemetryMeta,
          recommendationGenerateLatencyMs:
            generateLatencyMs ?? prev.recommendationGenerateLatencyMs,
        };
        queueMicrotask(() => {
          void (async () => {
            const merged = await persistPhotoSession(next);
            const created = await createRecommendationTelemetrySessionFromClient(merged, recs, me?.id);
            if (created) {
              setPhotoSession((p) => ({
                ...p,
                recommendationTelemetrySessionId: created.recommendationSessionId,
                telemetryCandidateSnapshotIds: created.candidateSnapshotIds ?? [],
              }));
            }
          })();
        });
        return next;
      });
      return recs;
    } catch {
      return null;
    }
  }, [photoSession, persistPhotoSession, me?.id]);

  const setActivePhotoRecommendation = useCallback((index) => {
    setPhotoSession(prev => {
      const rec = prev?.recommendations?.[index];
      if (!rec) return prev;
      const next = { ...prev, selectedRecommendation: rec };
      queueMicrotask(() => { void markRecommendationSelection(next, index); });
      return next;
    });
  },[markRecommendationSelection]);

  const generatePhotoVisualization = useCallback(async () => {
    if (!photoSession.capturedPhoto || !photoSession.selectedRecommendation) {
      return null;
    }
    const rec = photoSession.selectedRecommendation;
    const spatialMapping =
      rec.spatialMapping ??
      (rec.layoutSchema ? createSpatialMappingFromRecommendation(rec) : null);
    if (!spatialMapping) return null;

    try {
      const res = await fetch("/api/generate-garden-visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo: photoSession.capturedPhoto,
          recommendation: rec,
          spatialMapping,
          photoSessionId: photoSession.id ?? null,
          sessionMeta: {
            widthM:     photoSession.widthM   ?? null,
            lengthM:    photoSession.lengthM  ?? null,
            floorLevel: photoSession.floorLevel ?? null,
            environment: photoSession.environment ?? null,
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      setPhotoSession(prev => {
        const next = {
          ...prev,
          generatedVisualization: {
            imageUrl: data.imageUrl ?? null,
            prompt: data.prompt ?? "",
            createdAt: new Date().toISOString(),
          },
        };
        queueMicrotask(() => { void persistPhotoSession(next); });
        return next;
      });
      const sid = photoSession.recommendationTelemetrySessionId;
      const pid = photoSession.projectId;
      const recList = photoSession.recommendations ?? [];
      const vidx = recList.findIndex((r) => r === rec);
      const vSnap = photoSession.telemetryCandidateSnapshotIds?.[vidx >= 0 ? vidx : 0] ?? null;
      if (sid && pid && me?.id) {
        void postLearningTelemetryEvent({
          sessionId: sid,
          projectId: pid,
          userId: me.id,
          eventType: "visualization_requested",
          screenName: "result",
          candidateSnapshotId: vSnap,
          metadata: { speciesCatalogCodes: extractSpeciesCatalogCodesFromRecommendation(rec) },
        });
      }
      return data;
    } catch {
      return null;
    }
  }, [
    photoSession.capturedPhoto,
    photoSession.selectedRecommendation,
    photoSession.recommendationTelemetrySessionId,
    photoSession.projectId,
    photoSession.recommendations,
    photoSession.telemetryCandidateSnapshotIds,
    me?.id,
    setPhotoSession,
    persistPhotoSession,
  ]);

  const generateRunwareVisualization = useCallback(async (overrides = {}) => {
    const rec = photoSession.selectedRecommendation;

    // Allow caller to pass scoredPlants directly (e.g. when selectedRecommendation is null
    // but fallback species are available from the result screen)
    let scoredPlants;
    if (Array.isArray(overrides.scoredPlants) && overrides.scoredPlants.length > 0) {
      scoredPlants = overrides.scoredPlants;
    } else if (rec) {
      scoredPlants = (rec?.candidate?.scoredPlants ?? rec?.scoredPlants ?? [])
        .map((sp) => ({
          plant: {
            name:    sp?.plant?.name    ?? sp?.name    ?? null,
            type:    sp?.plant?.type    ?? sp?.type    ?? "herb",
            heightM: sp?.plant?.heightM ?? sp?.heightM ?? null,
            catalogCode: sp?.plant?.catalogCode ?? sp?.catalogCode ?? null,
          },
          quantity:      sp?.quantity      ?? 1,
          placementZone: sp?.placementZone ?? "perimeter",
          relevanceScore: sp?.relevanceScore ?? 0,
        }))
        .filter(sp => sp.plant.name);
    } else {
      return null;
    }

    const widthM  = photoSession.widthM  ?? null;
    const lengthM = photoSession.lengthM ?? null;

    // Frame artifacts — prefer overrides (from FrameSelectModal), fall back to persisted values
    const frameCrop   = overrides.frameCrop   ?? photoSession.frameCrop   ?? null;
    const frameMask   = overrides.frameMask   ?? photoSession.frameMask   ?? null;
    const userPrompt  = overrides.userPrompt  ?? null;

    // Persist crop + mask into session so they survive re-renders
    if (frameCrop || frameMask) {
      setPhotoSession(prev => ({
        ...prev,
        ...(frameCrop ? { frameCrop } : {}),
        ...(frameMask ? { frameMask } : {}),
      }));
    }

    try {
      const res = await fetch("/api/generate-runware-visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation: rec,
          scoredPlants,
          sessionMeta: {
            widthM,
            lengthM,
            areaM2:     (widthM && lengthM) ? Math.round(widthM * lengthM) : null,
            floorLevel:  photoSession.floorLevel  ?? null,
            environment: photoSession.environment ?? null,
          },
          // Send captured photo so Runware transforms the actual measured space
          seedImage: photoSession.capturedPhoto ?? null,
          // User's garden vision prompt (from frame select modal step 2)
          userPrompt: userPrompt ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: data?.message || `API error ${res.status}` };
      if (!data.imageUrl) return { error: data?.message || "No image returned" };
      const newVis = {
        imageUrl:         data.imageUrl,
        prompt:           data.prompt ?? "",
        mode:             data.mode ?? "generation",
        hadLayoutSchema:  data.hadLayoutSchema ?? false,
        createdAt:        new Date().toISOString(),
      };
      setPhotoSession(prev => ({
        ...prev,
        runwareVisualization: newVis,
        regenerationHistory: [
          ...(prev.regenerationHistory ?? []).slice(-4),
          ...(prev.runwareVisualization?.imageUrl ? [{ ...prev.runwareVisualization }] : []),
        ],
      }));
      return data;
    } catch (err) {
      return { error: err?.message || "Network error" };
    }
  }, [
    photoSession.selectedRecommendation,
    photoSession.widthM,
    photoSession.lengthM,
    photoSession.floorLevel,
    photoSession.environment,
    photoSession.capturedPhoto,
    photoSession.frameCrop,
    photoSession.frameMask,
    setPhotoSession,
  ]);

  // Auth gate (keeps existing session handling via NextAuth)
  if (status === "unauthenticated") {
    if (onboarding.step === "otp") {
      return (
        <AuthShell>
          <OTPVerificationScreen
            phoneNumber={onboarding.phoneNumber}
            initialDebugOtp={onboarding.debugOtp}
            otpDelivery={onboarding.otpDelivery}
            otpNotice={onboarding.otpNotice}
            devToken={onboarding.devToken ?? null}
            expiresAt={onboarding.expiresAt ?? null}
            onBack={() =>
              setOnboarding({
                step: "phone",
                phoneNumber: "",
                debugOtp: null,
                otpDelivery: undefined,
                otpNotice: null,
                devToken: null,
                expiresAt: null,
              })}
            onAuthed={() => { /* session will update */ }}
          />
        </AuthShell>
      );
    }
    return (
      <AuthShell>
        <PhoneLoginScreen
          onOtpSent={({ phoneNumber, debugOtp, otpDelivery, otpNotice, devToken, expiresAt }) =>
            setOnboarding({
              step: "otp",
              phoneNumber,
              debugOtp:    debugOtp    ?? null,
              otpDelivery: otpDelivery ?? "console",
              otpNotice:   otpNotice   ?? null,
              devToken:    devToken    ?? null,
              expiresAt:   expiresAt   ?? null,
            })}
        />
      </AuthShell>
    );
  }

  // Profile completion gate (skipped if user chose "Setup later")
  const profileSkipped = (() => { try { return localStorage.getItem('hw_profile_skip') === '1'; } catch { return false; } })();
  if (status === "authenticated" && meLoaded && me && me.profileCompleted === false && !profileSkipped) {
    return (
      <AuthShell>
        <CompleteProfileScreen
          initialProfile={me}
          onCompleted={() => {
            try { localStorage.removeItem('hw_profile_skip'); } catch {}
            setMeLoaded(false);
            fetch("/api/user/me")
              .then(r => r.json())
              .then(d => { setMe(d); setMeLoaded(true); })
              .catch(() => setMeLoaded(true));
          }}
          onSkip={() => {
            try { localStorage.setItem('hw_profile_skip', '1'); } catch {}
            setMe(m => m ? { ...m, profileCompleted: true } : m);
          }}
        />
      </AuthShell>
    );
  }

  const showNav=NAV.includes(screen);

  const render=()=>{
    const selectedRecommendation = photoSession?.selectedRecommendation ?? null;
    const p={
      navigate,
      selectedRecommendation,
      ensureRecommendation,
      photoSession,
      setPhotoSession,
      generatePhotoRecommendations,
      setActivePhotoRecommendation,
      generatePhotoVisualization,
      generateRunwareVisualization,
      me,
      projects,
      persistPhotoSession,
      resumeProject,
    };
    switch(screen){
      case 'splash':       return <SplashScreen onDone={()=>navigate('onboarding')}/>;
      case 'onboarding':   return <Onboarding {...p} onDone={()=>{
        // Check if profile exists in localStorage; skip setup if already done
        const hasProfile = (() => { try { return !!localStorage.getItem('hw_profile'); } catch { return false; } })();
        navigate(hasProfile ? 'home' : 'profileSetup');
      }}/>;
      case 'profileSetup': return <ProfileSetupScreen onDone={()=>navigate('home')}/>;
      case 'home':         return <HomeDashboardLight {...p}/>;
      case 'create':      return <ProjectCreation {...p}/>;
      case 'measure':     return <MeasureScreen {...p}/>;
      case 'liveARMeasure':
        return (
          <LiveARMeasurementScreen
            projectId={photoSession.projectId}
            photoSessionId={photoSession.id}
            onApplied={({ measurement, projectInput, capturedPhoto }) => {
              setPhotoSession(prev => ({
                ...prev,
                widthM: projectInput.widthM,
                lengthM: projectInput.lengthM,
                floorLevel: projectInput.floorLevel,
                measurementStatus: "measured_live_ar",
                measurementCompletedAt: new Date().toISOString(),
                // Use the frame captured at the moment of AR confirmation — no separate photo step needed
                capturedPhoto: capturedPhoto ?? prev.capturedPhoto,
                capturedAt: new Date().toISOString(),
              }));
              navigate('environment');
            }}
            onCancel={() => navigate('measure')}
          />
        );
      case 'photoCapture':return <PhotoCaptureScreen {...p}/>;
      case 'photoMeasureAR': return <PhotoARMeasurementScreen {...p}/>;
      case 'environment': return <EnvironmentScreen {...p}/>;
      case 'climateSpecies': return <ClimateSpeciesScreen {...p}/>;
      case 'analysis':    return <AnalysisScreen {...p}/>;
      case 'gardenLayout':return <GardenLayoutScreen {...p}/>;
      case 'result':      return <ResultScreen {...p}/>;
      case 'beforeAfter': return <BeforeAfterVisualizationScreen {...p}/>;
      case 'report':      return <ReportScreen {...p}/>;
      case 'install':     return <InstallScreen {...p}/>;
      case 'saved':         return <SavedScreen {...p}/>;
      case 'settings':      return <SettingsScreen {...p}/>;
      case 'cityHeat':      return <CityHeatScreen {...p}/>;
      case 'speciesLib':    return <SpeciesLibraryScreen {...p} setSelectedSpecies={setSelectedSpecies}/>;
      case 'speciesDetail': return <SpeciesDetailScreen {...p} selectedSpecies={selectedSpecies}/>;
      case 'installDone':   return <InstallSuccessScreen {...p}/>;
      case 'impact':        return <ImpactDashboardScreen {...p}/>;
      case 'carbon':        return <CarbonDashboardScreen {...p}/>;
      case 'carbonSetup':   return <CarbonSetupScreen {...p} onSaved={()=>navigate('carbon')}/>;
      case 'notifications': return <NotificationsScreen {...p}/>;
      case 'tips':          return <TipsScreen {...p}/>;
      default:              return <HomeDashboardLight {...p}/>;
    }
  };

  return(
    <>
      <style>{CSS}</style>
      <GlobalBg />
      <div style={{width:'100%',height:'100vh',overflow:'hidden',position:'relative',background:'transparent',display:'flex',flexDirection:'column'}}>
        <div className="hw-phone-bg" aria-hidden="true" />
        {/* Screen container — use scr-fixed for screens that manage their own internal scroll */}
        <div className={`${screen==='home'?'scr-fixed':'scr'} ${anim}`} key={screen} style={{position:'absolute',top:0,bottom:showNav?56:0,left:0,right:0}}>
          {render()}
        </div>
        {/* Bottom nav */}
        {showNav&&(
          <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:100}}>
            <BottomNav active={screen} navigate={navigate}/>
          </div>
        )}
      </div>
    </>
  );
}

