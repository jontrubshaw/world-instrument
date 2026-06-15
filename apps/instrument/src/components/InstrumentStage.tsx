import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import {
  serializeVisualParametersForCanvas,
  type InstrumentVisualParameters,
} from '../visualParameters.ts';

interface InstrumentStageProps {
  readonly visualParameters: InstrumentVisualParameters;
}

export function InstrumentStage({ visualParameters }: InstrumentStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const visualParametersRef = useRef(visualParameters);

  useEffect(() => {
    visualParametersRef.current = visualParameters;
  }, [visualParameters]);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.dataset.testid = 'instrument-canvas';
    renderer.domElement.setAttribute('aria-label', 'Weather score-driven World Instrument surface');
    mount.append(renderer.domElement);

    const scene = new THREE.Scene();

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
    let appliedParametersKey = '';

    const applyVisualParameters = (parameters: InstrumentVisualParameters) => {
      appliedParametersKey = visualParametersKey(parameters);

      renderer.setClearColor(new THREE.Color(parameters.backgroundColor), 1);
      renderer.domElement.dataset.scoreId = parameters.scoreId;
      renderer.domElement.dataset.scoreVersion = parameters.scoreVersion;
      renderer.domElement.dataset.scoreFrameIndex = String(parameters.frameIndex);
      renderer.domElement.dataset.scoreGeneratedAt = parameters.generatedAt;
      renderer.domElement.dataset.scoreSignature = parameters.signature;
      renderer.domElement.dataset.weatherCondition = parameters.condition;
      renderer.domElement.dataset.visualParameters = serializeVisualParametersForCanvas(parameters);
      mount.dataset.scoreSignature = parameters.signature;

      const fogColor = new THREE.Color(parameters.backgroundColor);
      scene.fog = new THREE.Fog(fogColor, parameters.fogNear, parameters.fogFar);

      bodyMaterial.color.set(parameters.bodyColor);
      bodyMaterial.emissive.set(parameters.emissiveColor);
      bodyMaterial.emissiveIntensity = parameters.emissiveIntensity;
      wireMaterial.color.set(parameters.accentColor);
      wireMaterial.opacity = parameters.wireOpacity;
      innerMaterial.color.set(parameters.innerColor);
      innerMaterial.opacity = parameters.innerOpacity;

      keyLight.color.set(parameters.bodyColor);
      keyLight.intensity = parameters.keyLightIntensity;
      fillLight.color.set(parameters.accentColor);
      fillLight.intensity = parameters.fillLightIntensity;
      ambient.intensity = parameters.ambientIntensity;
    };

    const renderFrame = () => {
      const parameters = visualParametersRef.current;
      const elapsed = (window.performance.now() - startTime) / 1000;
      const pulse = Math.sin(elapsed * parameters.pulseRate) * parameters.pulseAmplitude;

      if (appliedParametersKey !== visualParametersKey(parameters)) {
        applyVisualParameters(parameters);
      }

      body.rotation.x = elapsed * parameters.rotationSpeedX + parameters.tensionTilt;
      body.rotation.y = elapsed * parameters.rotationSpeedY;
      body.scale.setScalar(parameters.bodyScale + pulse);

      wire.rotation.x = body.rotation.x + 0.12;
      wire.rotation.y = body.rotation.y - 0.18;
      wire.scale.setScalar(1.018 + parameters.tensionTilt * 0.08);

      innerPulse.rotation.x = -elapsed * parameters.innerRotationSpeed;
      innerPulse.rotation.z = elapsed * (parameters.innerRotationSpeed + 0.09);
      innerPulse.scale.setScalar(parameters.innerScale - pulse);

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

function visualParametersKey(parameters: InstrumentVisualParameters): string {
  return [
    parameters.scoreId,
    parameters.scoreVersion,
    String(parameters.frameIndex),
    parameters.generatedAt,
    parameters.signature,
  ].join(':');
}
