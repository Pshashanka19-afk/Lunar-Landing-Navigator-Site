import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { IMAGES } from '../data/images';

export const ThreeSunEarthMoon: React.FC<{ className?: string }> = ({ className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x08090C, 0.006);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(22, 10, 32);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // Prevent context loss from dropping WebGL canvas
    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    // 2. Texture Loader & Official NASA Planetary Imagery
    const textureLoader = new THREE.TextureLoader();
    const SUN_POSITION = new THREE.Vector3(-84, 5, 0);

    // Official NASA Blue Marble, Black Marble Night Lights & Clouds
    const earthDayTex = textureLoader.load(IMAGES.nasaEarthDay);
    earthDayTex.colorSpace = THREE.SRGBColorSpace;
    const earthNightTex = textureLoader.load(IMAGES.nasaEarthNight);
    earthNightTex.colorSpace = THREE.SRGBColorSpace;
    const earthCloudsTex = textureLoader.load(IMAGES.nasaEarthClouds);

    // Official NASA CGI Moon Kit (LROC 4K Color & LOLA 4K Elevation Bump)
    const moonColorTex = textureLoader.load(IMAGES.nasaMoonColor);
    moonColorTex.colorSpace = THREE.SRGBColorSpace;
    const moonBumpTex = textureLoader.load(IMAGES.nasaMoonBump);

    // 3. Celestial System Hierarchy
    const systemGroup = new THREE.Group();
    scene.add(systemGroup);

    // -------------------------------------------------------------
    // PHOTOREALISTIC NASA EARTH GLOBE (Day/Night Terminator & City Lights)
    // -------------------------------------------------------------
    const earthRadius = 4.4;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);

    // Advanced Day/Night Surface Shader Material
    const earthShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: earthDayTex },
        uNightMap: { value: earthNightTex },
        uSunPos: { value: SUN_POSITION },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        void main() {
          vUv = uv;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uDayMap;
        uniform sampler2D uNightMap;
        uniform vec3 uSunPos;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        void main() {
          vec3 sunDir = normalize(uSunPos - vWorldPosition);
          float nDotL = dot(vWorldNormal, sunDir);

          // Natural planetary terminator transition
          float dayFactor = smoothstep(-0.15, 0.25, nDotL);

          vec3 dayColor = texture2D(uDayMap, vUv).rgb;
          vec3 nightColor = texture2D(uNightMap, vUv).rgb;

          // Day side: illuminated continents, oceans and polar caps
          vec3 litDay = dayColor * (dayFactor * 1.18 + 0.04);

          // Night side: dark oceans with glowing city lights of civilization
          vec3 litNight = nightColor * (1.0 - dayFactor) * 2.2;

          // Realistic specular sun reflection on oceans
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 halfVec = normalize(sunDir + viewDir);
          float specFactor = pow(max(dot(vWorldNormal, halfVec), 0.0), 32.0);
          float isOcean = step(0.04, dayColor.b - dayColor.r);
          vec3 specular = vec3(1.0, 0.95, 0.8) * specFactor * isOcean * dayFactor * 0.75;

          gl_FragColor = vec4(litDay + litNight + specular, 1.0);
        }
      `,
    });

    const earthMesh = new THREE.Mesh(earthGeo, earthShaderMat);
    earthMesh.rotation.z = THREE.MathUtils.degToRad(23.4); // Earth's true 23.4° axial inclination
    systemGroup.add(earthMesh);

    // Realistic Atmospheric Clouds Layer
    const cloudGeo = new THREE.SphereGeometry(earthRadius * 1.025, 64, 64);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: earthCloudsTex,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      roughness: 1.0,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    earthMesh.add(cloudMesh);

    // -------------------------------------------------------------
    // PHOTOREALISTIC NASA LUNAR GLOBE (LROC 4K Color & LOLA 4K Bump)
    // -------------------------------------------------------------
    const ORBIT_A = 21.2; // Semi-major axis
    const ORBIT_B = 18.0; // Semi-minor axis (elliptical eccentricity)
    const ORBIT_INCLINATION = THREE.MathUtils.degToRad(5.14); // True 5.14° lunar orbital inclination
    const ORBIT_SEGMENTS = 256;

    const moonOrbitGroup = new THREE.Group();
    moonOrbitGroup.rotation.x = ORBIT_INCLINATION;
    moonOrbitGroup.rotation.z = THREE.MathUtils.degToRad(8.0);
    systemGroup.add(moonOrbitGroup);

    // Complete Elliptical Revolutionary Path Line
    const orbitPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
      const theta = (i / ORBIT_SEGMENTS) * Math.PI * 2;
      orbitPoints.push(
        new THREE.Vector3(
          ORBIT_A * Math.cos(theta),
          0,
          ORBIT_B * Math.sin(theta)
        )
      );
    }
    const orbitPathGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitPathMat = new THREE.LineBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    const orbitPathLine = new THREE.Line(orbitPathGeo, orbitPathMat);
    moonOrbitGroup.add(orbitPathLine);

    // Dynamic Glowing Revolutionary Motion Trail
    const TRAIL_LENGTH = 48;
    const trailPositions = new Float32Array(TRAIL_LENGTH * 3);
    const trailColors = new Float32Array(TRAIL_LENGTH * 3);

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const alpha = Math.pow(1 - i / TRAIL_LENGTH, 1.8);
      trailColors[i * 3] = 0.0 * alpha;
      trailColors[i * 3 + 1] = 1.0 * alpha;
      trailColors[i * 3 + 2] = 0.62 * alpha;
    }

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));

    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    moonOrbitGroup.add(trailLine);

    // Genuine 3D NASA Moon Globe
    const moonRadius = 1.65;
    const moonGeo = new THREE.SphereGeometry(moonRadius, 64, 64);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xd8dbe0, // Solid baseline tone so Moon is immediately visible
      map: moonColorTex,
      bumpMap: moonBumpTex,
      bumpScale: 0.12,
      roughness: 0.94,
      metalness: 0.0,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(ORBIT_A, 0, 0);
    moonMesh.rotation.z = THREE.MathUtils.degToRad(1.54); // Moon's true 1.54° axial tilt
    moonOrbitGroup.add(moonMesh);

    // 4. Photorealistic Incandescent Sun & Multi-Tier Solar Corona (NASA / SpaceX Aesthetic)
    const sunGroup = new THREE.Group();
    sunGroup.position.copy(SUN_POSITION);
    scene.add(sunGroup);

    // High-Resolution Radial Solar Corona Glare Texture
    const createSunCoronaTexture = (): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;
      const center = 512;

      // Multi-stop photorealistic radiance gradient (blinding white to deep incandescent space fade)
      const grad = ctx.createRadialGradient(center, center, 0, center, center, 512);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');     // Pure white-hot nuclear core
      grad.addColorStop(0.09, 'rgba(255, 252, 235, 0.98)');   // Incandescent white-gold
      grad.addColorStop(0.19, 'rgba(255, 225, 125, 0.75)');   // Chromosphere gold
      grad.addColorStop(0.34, 'rgba(255, 155, 35, 0.42)');    // Solar plasma amber
      grad.addColorStop(0.52, 'rgba(255, 85, 10, 0.16)');     // Outer corona orange
      grad.addColorStop(0.75, 'rgba(210, 40, 0, 0.05)');      // Deep corona fade
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');              // Space vacuum

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 1024);

      // Delicate solar diffraction spikes / corona rays (SpaceX / James Webb telescope glare)
      ctx.save();
      ctx.translate(center, center);
      const spikeCount = 8;
      for (let i = 0; i < spikeCount; i++) {
        ctx.rotate(Math.PI / (spikeCount / 2));
        const spikeGrad = ctx.createLinearGradient(-512, 0, 512, 0);
        spikeGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
        spikeGrad.addColorStop(0.35, 'rgba(255, 190, 80, 0.03)');
        spikeGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
        spikeGrad.addColorStop(0.65, 'rgba(255, 190, 80, 0.03)');
        spikeGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = spikeGrad;
        ctx.fillRect(-512, -2.0, 1024, 4.0);
      }
      ctx.restore();

      return new THREE.CanvasTexture(canvas);
    };

    // Soft Anamorphic Optical Flare Streak
    const createAnamorphicFlareTexture = (): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;

      const grad = ctx.createRadialGradient(512, 64, 0, 512, 64, 512);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(0.2, 'rgba(255, 215, 130, 0.35)');
      grad.addColorStop(0.5, 'rgba(255, 140, 40, 0.12)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 128);

      return new THREE.CanvasTexture(canvas);
    };

    const sunCoronaTex = createSunCoronaTexture();
    const anamorphicTex = createAnamorphicFlareTexture();

    // 1. Central White-Hot Solar Core Sphere
    const sunRadius = 8.5;
    const sunGeo = new THREE.SphereGeometry(sunRadius, 48, 48);

    // Advanced Solar Plasma View-Space Shader (Never breaks when orbiting in 3D)
    const sunShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vViewNormal;
        varying vec3 vViewPosition;

        void main() {
          vUv = uv;
          vViewNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vViewNormal;
        varying vec3 vViewPosition;

        // Procedural solar turbulence
        float snoise(vec2 p) {
          return sin(p.x * 14.0 + uTime * 0.9) * cos(p.y * 14.0 + uTime * 0.7) * 0.5 + 0.5;
        }

        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = 1.0 - max(dot(vViewNormal, viewDir), 0.0);

          // Moving plasma convection cells
          vec2 uv1 = vUv * 6.0 + vec2(uTime * 0.035, uTime * 0.02);
          vec2 uv2 = vUv * 12.0 - vec2(uTime * 0.025, uTime * 0.04);
          float plasma = snoise(uv1) * 0.6 + snoise(uv2) * 0.4;

          // Pure white-hot nuclear core with incandescent golden limb
          vec3 coreColor = mix(vec3(1.0, 0.99, 0.96), vec3(1.0, 0.90, 0.55), plasma * 0.35);
          vec3 limbColor = vec3(1.0, 0.52, 0.12);

          vec3 finalColor = mix(coreColor, limbColor, pow(fresnel, 2.0));
          float rimEmission = pow(fresnel, 1.6) * 1.8;

          gl_FragColor = vec4(finalColor + vec3(1.0, 0.75, 0.35) * rimEmission, 1.0);
        }
      `,
    });

    const sunMesh = new THREE.Mesh(sunGeo, sunShaderMat);
    sunGroup.add(sunMesh);

    // 2. Primary Solar Corona Sprite (Always camera-facing, blinding optical glare)
    const coronaMat = new THREE.SpriteMaterial({
      map: sunCoronaTex,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coronaSprite = new THREE.Sprite(coronaMat);
    coronaSprite.scale.set(48, 48, 1);
    sunGroup.add(coronaSprite);

    // 3. Expansive Outer Atmosphere Halo Sprite
    const outerHaloMat = new THREE.SpriteMaterial({
      map: sunCoronaTex,
      color: 0xff8811,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerHaloSprite = new THREE.Sprite(outerHaloMat);
    outerHaloSprite.scale.set(88, 88, 1);
    sunGroup.add(outerHaloSprite);

    // 4. Subtle Anamorphic Cinematic Lens Flare
    const anamorphicMat = new THREE.SpriteMaterial({
      map: anamorphicTex,
      color: 0xffe6b0,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const anamorphicSprite = new THREE.Sprite(anamorphicMat);
    anamorphicSprite.scale.set(110, 14, 1);
    sunGroup.add(anamorphicSprite);

    // Physical Directional Sunlight
    const sunLight = new THREE.DirectionalLight(0xfffaea, 3.6);
    sunLight.position.copy(SUN_POSITION);
    sunLight.target.position.set(0, 0, 0);
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Radiant Omni PointLight inside the Sun's core
    const sunPointLight = new THREE.PointLight(0xfff2d4, 3.0, 350, 0.35);
    sunPointLight.position.copy(SUN_POSITION);
    scene.add(sunPointLight);

    // Subtle Earthshine ambient
    const ambientLight = new THREE.AmbientLight(0x1a2638, 0.4);
    scene.add(ambientLight);

    // Deep-space back fill light ensuring Moon is visible in all orbital phases
    const backFillLight = new THREE.DirectionalLight(0x243248, 0.65);
    backFillLight.position.set(84, -5, 0);
    scene.add(backFillLight);

    // 5. Background Starfield
    const starCount = 1800;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 300;
      starPos[i + 1] = (Math.random() - 0.5) * 300;
      starPos[i + 2] = (Math.random() - 0.5) * 300;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.85,
      transparent: true,
      opacity: 0.65,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // 6. Interactive 3D OrbitControls (Left-Click & Drag around Earth reference point)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.75;
    controls.enablePan = false; // Reference point locked strictly to Earth (0, 0, 0)
    controls.target.set(0, 0, 0);
    controls.enableZoom = true;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 12;
    controls.maxDistance = 140;

    // 7. Resize Handling
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // 8. Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    const startTime = performance.now();
    let orbitAngle = 0;
    let isTabVisible = !document.hidden;

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        lastTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isTabVisible) return;

      const now = performance.now();
      const delta = (now - lastTime) * 0.001;
      lastTime = now;
      const safeDelta = Math.min(delta, 0.1);
      const elapsed = (now - startTime) * 0.001;

      // Earth rotation
      earthMesh.rotation.y += safeDelta * 0.12;
      cloudMesh.rotation.y += safeDelta * 0.16;

      // Sun plasma turbulence animation & corona breathing
      sunShaderMat.uniforms.uTime.value = elapsed;
      const pulse = 1.0 + Math.sin(elapsed * 1.5) * 0.02;
      coronaSprite.scale.set(48 * pulse, 48 * pulse, 1);
      outerHaloSprite.scale.set(88 * pulse, 88 * pulse, 1);
      anamorphicSprite.scale.set(110 * pulse, 14 * pulse, 1);

      // Continuous Elliptical Revolutionary Motion of the Moon
      orbitAngle += safeDelta * 0.09;

      // Position Moon dynamically on its 3D elliptical revolutionary path
      moonMesh.position.set(
        ORBIT_A * Math.cos(orbitAngle),
        0,
        ORBIT_B * Math.sin(orbitAngle)
      );

      // Synchronous rotation (tidally locked revolution)
      moonMesh.rotation.y += safeDelta * 0.09;

      // Update dynamic glowing revolutionary trail following the Moon
      const posAttr = trailGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < TRAIL_LENGTH; i++) {
        const trailAngle = orbitAngle - (i / TRAIL_LENGTH) * 0.88;
        posAttr.setXYZ(
          i,
          ORBIT_A * Math.cos(trailAngle),
          0,
          ORBIT_B * Math.sin(trailAngle)
        );
      }
      posAttr.needsUpdate = true;

      // Update OrbitControls smoothly (damping & 3D orientation around Earth)
      controls.update();

      // Starfield slow drift
      starPoints.rotation.y += safeDelta * 0.008;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      earthGeo.dispose();
      cloudGeo.dispose();
      moonGeo.dispose();
      orbitPathGeo.dispose();
      orbitPathMat.dispose();
      trailGeo.dispose();
      trailMat.dispose();
      sunGeo.dispose();
      sunShaderMat.dispose();
      sunCoronaTex.dispose();
      anamorphicTex.dispose();
      coronaMat.dispose();
      outerHaloMat.dispose();
      anamorphicMat.dispose();
      starGeo.dispose();
      earthDayTex.dispose();
      earthNightTex.dispose();
      earthCloudsTex.dispose();
      moonColorTex.dispose();
      moonBumpTex.dispose();
      earthShaderMat.dispose();
      cloudMat.dispose();
      moonMat.dispose();
      starMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing pointer-events-auto select-none ${className}`}
    >
      {/* 3D Drag Telemetry Hint */}
      <div className="absolute bottom-6 right-6 z-10 hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-mono text-white/60 tracking-[0.2em] uppercase select-none pointer-events-none">
        <span className="w-1.5 h-1.5 bg-[#FFFFFF] rounded-full animate-pulse" />
        <span>LEFT-CLICK & DRAG TO ROTATE 3D PERSPECTIVE // EARTH DATUM</span>
      </div>
    </div>
  );
};

