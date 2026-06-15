import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import type { InstrumentSceneParameters } from '../weatherInstrument.ts';

interface InstrumentStageProps {
  readonly visual: InstrumentSceneParameters;
}

export function InstrumentStage({ visual }: InstrumentStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const backgroundColor = new THREE.Color(visual.palette.background);
    const bodyColor = new THREE.Color(visual.palette.body);
    const accentColor = new THREE.Color(visual.palette.accent);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(backgroundColor, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.dataset.testid = 'instrument-canvas';
    renderer.domElement.setAttribute('aria-label', 'Abstract World Instrument visual surface');
    mount.append(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(backgroundColor, visual.fog.near, visual.fog.far);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.1, 5.2);

    const geometry = new THREE.IcosahedronGeometry(1.35, 3);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColor,
      emissive: accentColor,
      emissiveIntensity: visual.emissiveIntensity,
      metalness: visual.metalness,
      roughness: visual.roughness,
    });
    const body = new THREE.Mesh(geometry, bodyMaterial);
    scene.add(body);

    const wireMaterial = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: visual.wireOpacity,
      wireframe: true,
    });
    const wire = new THREE.Mesh(geometry, wireMaterial);
    wire.scale.setScalar(1.018);
    scene.add(wire);

    const innerGeometry = new THREE.TorusKnotGeometry(0.62, 0.035, 160, 12, 3, 5);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: bodyColor,
      transparent: true,
      opacity: visual.innerOpacity,
    });
    const innerPulse = new THREE.Mesh(innerGeometry, innerMaterial);
    scene.add(innerPulse);

    const keyLight = new THREE.PointLight(bodyColor, visual.keyLightIntensity, 12);
    keyLight.position.set(2.6, 2.1, 3.8);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(accentColor, visual.fillLightIntensity, 10);
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
      const pulse = Math.sin(elapsed * visual.pulseRate) * visual.pulseAmplitude;

      body.rotation.x = elapsed * visual.rotationRate.x;
      body.rotation.y = elapsed * visual.rotationRate.y;
      body.scale.setScalar(visual.bodyScale + pulse);

      wire.rotation.x = body.rotation.x + 0.12;
      wire.rotation.y = body.rotation.y - 0.18;

      innerPulse.rotation.x = -elapsed * visual.rotationRate.inner;
      innerPulse.rotation.z = elapsed * (visual.rotationRate.inner + visual.rotationRate.y);
      innerPulse.scale.setScalar(visual.innerScale - pulse);

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
  }, [visual]);

  return (
    <div
      ref={mountRef}
      className="instrument-stage"
      data-testid="instrument-stage"
      data-weather-condition={visual.condition}
      data-score-input-hash={visual.inputHash}
      data-scene-body-color={visual.palette.body}
      data-scene-pulse-rate={String(visual.pulseRate)}
    />
  );
}
