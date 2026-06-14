import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function InstrumentStage() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x050716, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.dataset.testid = 'instrument-canvas';
    renderer.domElement.setAttribute('aria-label', 'Abstract World Instrument visual surface');
    mount.append(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050716, 4, 9);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.1, 5.2);

    const geometry = new THREE.IcosahedronGeometry(1.35, 3);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x6ee7f9,
      emissive: 0x162759,
      emissiveIntensity: 0.72,
      metalness: 0.34,
      roughness: 0.28,
    });
    const body = new THREE.Mesh(geometry, bodyMaterial);
    scene.add(body);

    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0xd8b4fe,
      transparent: true,
      opacity: 0.18,
      wireframe: true,
    });
    const wire = new THREE.Mesh(geometry, wireMaterial);
    wire.scale.setScalar(1.018);
    scene.add(wire);

    const innerGeometry = new THREE.TorusKnotGeometry(0.62, 0.035, 160, 12, 3, 5);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
    });
    const innerPulse = new THREE.Mesh(innerGeometry, innerMaterial);
    scene.add(innerPulse);

    const keyLight = new THREE.PointLight(0x87f3ff, 4.8, 12);
    keyLight.position.set(2.6, 2.1, 3.8);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0xff8bd2, 2.2, 10);
    fillLight.position.set(-3.4, -1.6, 2.8);
    scene.add(fillLight);

    const ambient = new THREE.AmbientLight(0x394875, 0.82);
    scene.add(ambient);

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const startTime = window.performance.now();
    let animationFrameId = 0;

    const renderFrame = () => {
      const elapsed = (window.performance.now() - startTime) / 1000;
      const pulse = Math.sin(elapsed * 1.7) * 0.08;

      body.rotation.x = elapsed * 0.21;
      body.rotation.y = elapsed * 0.34;
      body.scale.setScalar(1 + pulse);

      wire.rotation.x = body.rotation.x + 0.12;
      wire.rotation.y = body.rotation.y - 0.18;

      innerPulse.rotation.x = -elapsed * 0.43;
      innerPulse.rotation.z = elapsed * 0.52;
      innerPulse.scale.setScalar(1.2 - pulse);

      renderer.render(scene, camera);
      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      geometry.dispose();
      bodyMaterial.dispose();
      wireMaterial.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="instrument-stage" />;
}
