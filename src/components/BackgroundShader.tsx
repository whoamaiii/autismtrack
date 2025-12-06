import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

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
    
    // Create a flowing liquid effect using domain warping
    // Create a smooth, luxurious flowing effect
    float t = uTime * 0.015;
    
    float noise1 = snoise(uv * 1.8 + t);
    float noise2 = snoise(uv * 3.5 - t * 1.2 + noise1);
    
    // Color palette - Premium Dark Mode
    // Deep void base with subtle neon undercurrents
    vec3 color1 = vec3(0.02, 0.02, 0.05); // Deepest void
    vec3 color2 = vec3(0.05, 0.1, 0.25);  // Dark Midnight Blue
    vec3 color3 = vec3(0.15, 0.05, 0.3);  // Deep Royal Purple
    vec3 color4 = vec3(0.0, 0.5, 0.9);    // Electric Blue Highlight
    
    // Mix colors with smoother steps for varied depth
    vec3 finalColor = mix(color1, color2, smoothstep(-0.6, 0.6, noise1));
    finalColor = mix(finalColor, color3, smoothstep(-0.6, 0.6, noise2));
    
    // Refined veins/highlights - sharper but less frequent
    float vein = 1.0 - abs(noise2);
    vein = pow(vein, 5.0); // Higher power = thinner veins
    finalColor += color4 * vein * 0.3; // Reduced intensity for subtlety
    
    // Soft Vignette for focus
    float dist = distance(uv, vec2(0.5));
    finalColor *= 1.0 - dist * 0.6;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const ShaderPlane = () => {
    const mesh = useRef<THREE.Mesh>(null);

    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        }),
        []
    );

    useFrame((state) => {
        const { clock } = state;
        if (mesh.current) {
            (mesh.current.material as THREE.ShaderMaterial).uniforms.uTime.value = clock.getElapsedTime();
        }
    });

    return (
        <mesh ref={mesh} scale={[10, 10, 1]}>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial
                fragmentShader={FragmentShader}
                vertexShader={VertexShader}
                uniforms={uniforms}
            />
        </mesh>
    );
};

const BackgroundShader = () => {
    return (
        <div className="fixed inset-0 z-[-1] pointer-events-none">
            <Canvas camera={{ position: [0, 0, 1] }}>
                <ShaderPlane />
            </Canvas>
        </div>
    );
};

export default BackgroundShader;
