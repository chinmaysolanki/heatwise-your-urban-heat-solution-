import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hero scene — realistic city skyline at golden hour.
 * Dense varied buildings, hazy sun backdrop, rising heat shimmer,
 * progressive rooftop greening. Transparent canvas.
 */
export function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xfbe7c6, 35, 90);

    const camera = new THREE.PerspectiveCamera(
      38,
      mount.clientWidth / mount.clientHeight,
      0.1,
      300,
    );
    camera.position.set(22, 14, 28);
    camera.lookAt(0, 4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    // === SKY BACKDROP — gradient from hot peach near horizon to soft cream up top ===
    const skyGeo = new THREE.PlaneGeometry(220, 140);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0xfff4dc) },
        midColor: { value: new THREE.Color(0xffd29a) },
        botColor: { value: new THREE.Color(0xff9b6a) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 botColor;
        void main() {
          vec3 c = mix(botColor, midColor, smoothstep(0.0, 0.55, vUv.y));
          c = mix(c, topColor, smoothstep(0.55, 1.0, vUv.y));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.set(0, 25, -55);
    scene.add(sky);

    // === SUN — soft glowing disc with halo ===
    const sunGroup = new THREE.Group();
    sunGroup.position.set(-14, 16, -50);
    scene.add(sunGroup);

    const sunCore = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 64),
      new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.95 }),
    );
    sunGroup.add(sunCore);

    // Layered halos for hazy bloom
    for (let i = 0; i < 4; i++) {
      const halo = new THREE.Mesh(
        new THREE.CircleGeometry(3.2 + (i + 1) * 2.2, 64),
        new THREE.MeshBasicMaterial({
          color: i < 2 ? 0xffd089 : 0xffa66b,
          transparent: true,
          opacity: 0.22 - i * 0.045,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      halo.position.z = -0.01 * (i + 1);
      sunGroup.add(halo);
    }

    // === LIGHTS — golden hour ===
    scene.add(new THREE.AmbientLight(0xfff0d8, 0.55));
    const sunLight = new THREE.DirectionalLight(0xffc98a, 1.4);
    sunLight.position.set(-14, 16, -10);
    scene.add(sunLight);
    const fill = new THREE.DirectionalLight(0xa6d4ff, 0.35);
    fill.position.set(10, 8, 10);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff8a5c, 0.5);
    rim.position.set(-20, 4, -8);
    scene.add(rim);

    // === GROUND — warm asphalt disc ===
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(28, 64),
      new THREE.MeshStandardMaterial({
        color: 0x8a7a66,
        roughness: 1,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Street grid lines (subtle)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x6b5d4d, transparent: true, opacity: 0.35 });
    for (let i = -5; i <= 5; i++) {
      const g1 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i * 2.6, 0.02, -16),
        new THREE.Vector3(i * 2.6, 0.02, 16),
      ]);
      const g2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-16, 0.02, i * 2.6),
        new THREE.Vector3(16, 0.02, i * 2.6),
      ]);
      scene.add(new THREE.Line(g1, lineMat));
      scene.add(new THREE.Line(g2, lineMat));
    }

    // === BUILDINGS — varied heights, materials, window grids ===
    type B = { roof: THREE.Mesh; greened: boolean };
    const buildings: B[] = [];
    const heatColor = new THREE.Color(0xe85a3c);
    const greenColor = new THREE.Color(0x52b788);

    // Concrete-ish palette
    const facadePalette = [0xc9c0b3, 0xb8aea0, 0xd6cfc2, 0xa89e90, 0xe2dccf, 0x9a9081];

    const grid = 5;
    const spacing = 2.5;
    for (let x = -grid; x <= grid; x++) {
      for (let z = -grid; z <= grid; z++) {
        if (Math.random() < 0.18) continue;
        const dist = Math.sqrt(x * x + z * z);
        if (dist > grid + 0.5) continue;

        // Taller buildings near center
        const heightBoost = Math.max(0, 1 - dist / (grid + 1));
        const h = 1.8 + Math.random() * 4 + heightBoost * 4;
        const w = 1.4 + Math.random() * 0.5;
        const d = 1.4 + Math.random() * 0.5;

        const facadeColor = facadePalette[Math.floor(Math.random() * facadePalette.length)];

        // Window grid as a baked texture (canvas)
        const cvs = document.createElement("canvas");
        cvs.width = 64; cvs.height = 128;
        const ctx = cvs.getContext("2d")!;
        ctx.fillStyle = `#${facadeColor.toString(16).padStart(6, "0")}`;
        ctx.fillRect(0, 0, 64, 128);
        const cols = 4, rows = 10;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const lit = Math.random();
            ctx.fillStyle = lit > 0.7
              ? `rgba(255, 198, 113, ${0.6 + Math.random() * 0.4})`
              : `rgba(60, 55, 50, ${0.55 + Math.random() * 0.25})`;
            ctx.fillRect(6 + c * 13, 8 + r * 11, 8, 6);
          }
        }
        const tex = new THREE.CanvasTexture(cvs);
        tex.colorSpace = THREE.SRGBColorSpace;
        const winMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
        const plain = new THREE.MeshStandardMaterial({ color: facadeColor, roughness: 0.9 });

        const body = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          [winMat, winMat, plain, plain, winMat, winMat],
        );
        body.position.set(
          x * spacing + (Math.random() - 0.5) * 0.3,
          h / 2,
          z * spacing + (Math.random() - 0.5) * 0.3,
        );
        scene.add(body);

        // Roof slab — heat by default, ~20% greened
        const greened = Math.random() < 0.22;
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w * 1.04, 0.2, d * 1.04),
          new THREE.MeshStandardMaterial({
            color: greened ? greenColor : heatColor,
            emissive: greened ? greenColor : heatColor,
            emissiveIntensity: greened ? 0.25 : 0.55,
            roughness: 0.55,
          }),
        );
        roof.position.set(body.position.x, h + 0.1, body.position.z);
        scene.add(roof);

        // Optional rooftop unit
        if (Math.random() < 0.4) {
          const unit = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.25, 0.35),
            new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 0.8 }),
          );
          unit.position.set(
            body.position.x + (Math.random() - 0.5) * (w - 0.5),
            h + 0.32,
            body.position.z + (Math.random() - 0.5) * (d - 0.5),
          );
          scene.add(unit);
        }

        buildings.push({ roof, greened });
      }
    }

    // === HEAT SHIMMER PARTICLES — rising warm specks ===
    const pCount = 380;
    const positions = new Float32Array(pCount * 3);
    const speeds = new Float32Array(pCount);
    const drifts = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 32;
      positions[i * 3 + 1] = Math.random() * 14;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 32;
      speeds[i] = 0.008 + Math.random() * 0.025;
      drifts[i] = Math.random() * Math.PI * 2;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xffb27a,
      size: 0.09,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    // === DISTANT BIRDS / DUST SPECKS for depth ===
    const distCount = 60;
    const distPos = new Float32Array(distCount * 3);
    for (let i = 0; i < distCount; i++) {
      distPos[i * 3] = (Math.random() - 0.5) * 80;
      distPos[i * 3 + 1] = 12 + Math.random() * 14;
      distPos[i * 3 + 2] = -30 - Math.random() * 15;
    }
    const distGeo = new THREE.BufferGeometry();
    distGeo.setAttribute("position", new THREE.BufferAttribute(distPos, 3));
    const distPoints = new THREE.Points(
      distGeo,
      new THREE.PointsMaterial({ color: 0x8a6a4a, size: 0.18, transparent: true, opacity: 0.5 }),
    );
    scene.add(distPoints);

    // === GREENING WAVE ===
    const greenInterval = window.setInterval(() => {
      const reds = buildings.filter((b) => !b.greened);
      if (reds.length === 0) return;
      const target = reds[Math.floor(Math.random() * reds.length)];
      target.greened = true;
      const mat = target.roof.material as THREE.MeshStandardMaterial;
      const startC = mat.color.clone();
      const startE = mat.emissive.clone();
      const startI = mat.emissiveIntensity;
      const t0 = performance.now();
      const animate = () => {
        const t = Math.min(1, (performance.now() - t0) / 1400);
        mat.color.lerpColors(startC, greenColor, t);
        mat.emissive.lerpColors(startE, greenColor, t);
        mat.emissiveIntensity = startI + (0.25 - startI) * t;
        if (t < 1) requestAnimationFrame(animate);
      };
      animate();
    }, 700);

    // === ANIMATION LOOP ===
    let raf = 0;
    let theta = Math.PI / 5;
    const tick = () => {
      theta += 0.0009;
      const radius = 28;
      camera.position.x = Math.sin(theta) * radius;
      camera.position.z = Math.cos(theta) * radius;
      camera.position.y = 13 + Math.sin(theta * 1.5) * 0.6;
      camera.lookAt(0, 4, 0);

      // Sky/sun stay fixed relative to camera-ish: keep sun on backdrop
      sunGroup.lookAt(camera.position);
      sky.lookAt(camera.position.x, sky.position.y, camera.position.z);

      // Heat shimmer rise + drift
      const t = performance.now() * 0.001;
      const pos = pGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pCount; i++) {
        pos[i * 3 + 1] += speeds[i];
        pos[i * 3] += Math.sin(t + drifts[i]) * 0.003;
        if (pos[i * 3 + 1] > 14) {
          pos[i * 3 + 1] = 0;
          pos[i * 3] = (Math.random() - 0.5) * 32;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 32;
        }
      }
      pGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(greenInterval);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      pGeo.dispose();
      pMat.dispose();
      distGeo.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        const m = (obj as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else if (m) (m as THREE.Material).dispose();
      });
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}
