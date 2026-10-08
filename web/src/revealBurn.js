import * as THREE from "three";
import gsap from "gsap";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform float uAspect;
  uniform float uNoiseScale;
  uniform float uNoiseAmp;
  uniform float uSoftness;
  uniform float uGlowWidth;
  uniform float uGlowStrength;
  uniform vec3 uColor;
  uniform vec3 uGlowColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += amp * valueNoise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return sum;
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float d = length(p);

    // Two noise fields drifting in different directions keep the edge churning
    // while it expands, instead of looking like a scaled-up static shape.
    float n = fbm(p * uNoiseScale + vec2(uTime * 0.22, uTime * -0.15));
    n = mix(n, fbm(p * uNoiseScale * 1.9 - vec2(uTime * 0.11, uTime * 0.19)), 0.5);
    float offset = (n - 0.5) * uNoiseAmp;

    // Start/end radii are derived from the worst-case noise offset so the cover
    // is guaranteed fully opaque at progress 0 and fully clear at progress 1.
    float maxR = length(vec2(uAspect, 1.0)) * 0.5;
    float r0 = -(0.5 * uNoiseAmp + uSoftness);
    float r1 = maxR + 0.5 * uNoiseAmp;
    float radius = mix(r0, r1, uProgress);

    float edge = d + offset - radius;
    float coverAlpha = smoothstep(0.0, uSoftness, edge);

    // Falloff centred on the burn edge rather than clamped to the covered side.
    // The inward half is what makes it glow: there the cover is fully
    // transparent, so without this nothing would be drawn over the scene at all.
    float glow = exp(-abs(edge) / uGlowWidth) * uGlowStrength;

    float alpha = clamp(max(coverAlpha, glow), 0.0, 1.0);
    // How much of what is drawn here is glow rather than cover.
    float glowMix = clamp(glow / max(alpha, 0.0001), 0.0, 1.0);
    vec3 color = mix(uColor, uGlowColor, glowMix);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function createRevealBurn({
  color = 0x000000,
  glowColor = 0xffffff,
  glowStrength = 0.85,
  glowWidth = 0.07,
  noiseScale = 3.2,
  noiseAmp = 0.45,
  softness = 0.05,
} = {}) {
  const uniforms = {
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: window.innerWidth / window.innerHeight },
    uNoiseScale: { value: noiseScale },
    uNoiseAmp: { value: noiseAmp },
    uSoftness: { value: softness },
    uGlowWidth: { value: glowWidth },
    uGlowStrength: { value: glowStrength },
    uColor: { value: new THREE.Color(color) },
    uGlowColor: { value: new THREE.Color(glowColor) },
  };

  const overlayScene = new THREE.Scene();
  const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  quad.frustumCulled = false;
  overlayScene.add(quad);

  let active = true;

  return {
    setAspect(aspect) {
      uniforms.uAspect.value = aspect;
    },

    setTime(seconds) {
      uniforms.uTime.value = seconds;
    },

    // Drawn after the main scene, so clearing has to be suppressed or it wipes
    // the frame that was just rendered.
    render(renderer) {
      if (!active) return;
      const previousAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(overlayScene, overlayCamera);
      renderer.autoClear = previousAutoClear;
    },

    play({ duration = 2.76, revealAt = 0.55, onReveal, onComplete } = {}) {
      if (onReveal) gsap.delayedCall(duration * revealAt, onReveal);
      gsap.to(uniforms.uProgress, {
        value: 1,
        duration,
        ease: "power2.inOut",
        onComplete: () => {
          active = false;
          if (onComplete) onComplete();
        },
      });
    },
  };
}
