import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';

// Avant-Garde Liquid Glass Shader
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float uTime;

  void main() {
    vUv = uv;
    vPosition = position;
    
    // Very subtle breathing - slow
    vec3 pos = position;
    pos.z += sin(uTime * 0.15) * 0.02;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;
  varying vec3 vPosition;

  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = vUv;
    
    // Subtle liquid distortion - slow and elegant
    float noiseVal = snoise(uv * 2.0 + uTime * 0.08);
    float flow = snoise(uv * 1.0 - uTime * 0.05);
    
    // Gentle glass distortion
    vec2 distortedUv = uv + vec2(noiseVal, flow) * 0.008;
    
    // Subtle Chromatic Aberration
    float r = texture2D(uTexture, distortedUv + vec2(0.0015, 0.0)).r;
    float g = texture2D(uTexture, distortedUv).g;
    float b = texture2D(uTexture, distortedUv - vec2(0.0015, 0.0)).b;
    float a = texture2D(uTexture, distortedUv).a;
    
    // Soft shimmer - very slow
    float light = snoise(uv * 2.0 + uTime * 0.15);
    float highlight = smoothstep(0.3, 0.5, light) * smoothstep(0.7, 0.5, light);
    
    vec3 color = vec3(r, g, b);
    
    // Very subtle cyan-purple tint
    vec3 tint = mix(vec3(0.3, 0.9, 1.0), vec3(0.6, 0.3, 1.0), uv.x);
    color += tint * 0.05 * a;
    
    // Soft highlight
    color += vec3(1.0) * highlight * 0.15 * a;
    
    // Subtle rim glow
    float edge = texture2D(uTexture, distortedUv + vec2(0.008)).a;
    float rim = (a - edge) * 1.5;
    color += vec3(0.5, 0.8, 1.0) * max(0.0, rim) * 0.5;

    gl_FragColor = vec4(color, a);
  }
`;

function LiquidLogoMesh({ isAnimating }: { isAnimating: boolean }) {
  const texture = useTexture('/logo.png');
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();

  // Get actual aspect ratio from the loaded texture
  const textureImage = texture.image as { width: number; height: number };
  const aspect = textureImage.width / textureImage.height;
  
  // Use a fixed large size and let the camera frame it
  // This ensures consistent sizing regardless of canvas size
  const meshWidth = 4;
  const meshHeight = meshWidth / aspect;

  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
    }),
    [texture, size]
  );

  useFrame((state) => {
    if (meshRef.current && isAnimating) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
      
      // Very gentle floating - slow and subtle
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.02;
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.1) * 0.005;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[meshWidth, meshHeight, 32, 32]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}

interface AnimatedLogoProps {
  /** Width of the logo container */
  width?: number | string;
  /** Whether to show animated background effects */
  showBackground?: boolean;
  /** Callback when initial animation completes */
  onAnimationComplete?: () => void;
  /** Control animation playback */
  isAnimating?: boolean;
  /** Custom class name */
  className?: string;
}

export function AnimatedLogo({
  width = 320,
  showBackground = true,
  onAnimationComplete,
  isAnimating = true,
  className = ''
}: AnimatedLogoProps) {
  return (
    <motion.div
      className={`relative flex items-center justify-center ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      style={{ 
        width, 
        height: typeof width === 'number' ? width * 0.35 : undefined,
        aspectRatio: typeof width === 'string' ? '2.8/1' : undefined,
        minHeight: 90
      }}
      onAnimationComplete={onAnimationComplete}
    >
      {/* Background Glows - Slow and subtle */}
      {showBackground && isAnimating && (
        <>
           <motion.div
            className="absolute inset-0 rounded-full bg-cyan-500/15 blur-[60px]"
            animate={{ opacity: [0.3, 0.5, 0.3], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
           <motion.div
            className="absolute inset-0 rounded-full bg-purple-500/10 blur-[50px] translate-x-4"
            animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.08, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
        </>
      )}

      {/* 3D Liquid Logo */}
      <div className="absolute inset-0 z-10 w-full h-full">
        <Canvas camera={{ position: [0, 0, 1.8], fov: 50 }} dpr={[1, 2]} resize={{ scroll: false }}>
          <React.Suspense fallback={null}>
            <LiquidLogoMesh isAnimating={isAnimating} />
          </React.Suspense>
        </Canvas>
      </div>
    </motion.div>
  );
}

export default AnimatedLogo;
