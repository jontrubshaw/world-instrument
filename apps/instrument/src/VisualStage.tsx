import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type RenderMode = "starting" | "webgl" | "fallback";

export function VisualStage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>("starting");

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let animationFrame = 0;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 4.5;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x050510, 0);
      host.appendChild(renderer.domElement);

      const field = new THREE.Group();
      scene.add(field);

      const ringGeometry = new THREE.TorusKnotGeometry(1.05, 0.21, 160, 18);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x84e1ff,
        transparent: true,
        opacity: 0.62,
        wireframe: true,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      field.add(ring);

      const coreGeometry = new THREE.IcosahedronGeometry(0.78, 2);
      const coreMaterial = new THREE.MeshBasicMaterial({
        color: 0xf2c7ff,
        transparent: true,
        opacity: 0.34,
        wireframe: true,
      });
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      field.add(core);

      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        const safeWidth = Math.max(width, 1);
        const safeHeight = Math.max(height, 1);

        camera.aspect = safeWidth / safeHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(safeWidth, safeHeight, false);
      };

      const startTime = performance.now();
      const animate = (timestamp: number) => {
        const elapsed = (timestamp - startTime) / 1000;

        field.rotation.y = elapsed * 0.13;
        ring.rotation.x = elapsed * 0.08;
        core.rotation.z = -elapsed * 0.1;

        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(animate);
      };

      resize();
      animationFrame = window.requestAnimationFrame(animate);
      window.addEventListener("resize", resize);
      setRenderMode("webgl");

      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.removeEventListener("resize", resize);
        ringGeometry.dispose();
        ringMaterial.dispose();
        coreGeometry.dispose();
        coreMaterial.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch (error) {
      console.warn("WebGL visual stage could not start.", error);
      setRenderMode("fallback");
      return;
    }
  }, []);

  return (
    <div className="visual-stage" aria-label="Generative visual stage">
      <div ref={hostRef} className="visual-stage__canvas" />
      <div className="visual-stage__aura" aria-hidden="true" />
      <div className="visual-stage__rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="visual-stage__status" aria-live="polite">
        {renderMode === "fallback"
          ? "Fallback visual field ready"
          : "Three.js visual field ready"}
      </p>
    </div>
  );
}
