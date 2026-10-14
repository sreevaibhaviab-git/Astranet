import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RotateCcw } from "lucide-react";

interface Satellite3DPreviewProps {
  satelliteName: string;
  role?: string;
  state?: string;
}

export default function Satellite3DPreview({
  satelliteName,
  role,
  state,
}: Satellite3DPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const resetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );

    const cameraDirection = new THREE.Vector3(1, 0.55, 1.3).normalize();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight, true);
    renderer.setClearColor(0x000000, 0);

    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    mount.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const keyLight = new THREE.DirectionalLight(0xdcefff, 3.3);
    keyLight.position.set(5, 6, 7);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(-5, 2, -5);
    scene.add(rimLight);

    // Main satellite group
    const satellite = new THREE.Group();
    satellite.rotation.x = THREE.MathUtils.degToRad(-10);
    satellite.rotation.y = THREE.MathUtils.degToRad(18);
    scene.add(satellite);

    // ----------------------------------
    // MAIN BUS
    // ----------------------------------

    const bus = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.8, 1.15),
      new THREE.MeshStandardMaterial({
        color: 0x424a55,
        metalness: 0.78,
        roughness: 0.3,
      })
    );

    bus.name = "Main Bus";
    satellite.add(bus);

    // Front panel
    const frontPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.25, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0x171d25,
        metalness: 0.7,
        roughness: 0.35,
      })
    );

    frontPanel.position.z = 0.605;
    satellite.add(frontPanel);

    // Payload / camera
    const payloadRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.18, 32),
      new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        metalness: 0.9,
        roughness: 0.2,
      })
    );

    payloadRing.rotation.x = Math.PI / 2;
    payloadRing.position.set(0, 0.2, 0.72);
    payloadRing.name = "Payload";
    satellite.add(payloadRing);

    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.2, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0x22d3ee,
        emissive: 0x083344,
        emissiveIntensity: 0.9,
        metalness: 0.25,
        roughness: 0.12,
      })
    );

    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.2, 0.8);
    satellite.add(lens);

    // ----------------------------------
    // CUBE SAT RAILS
    // ----------------------------------

    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0xc5ccd4,
      metalness: 0.92,
      roughness: 0.18,
    });

    const railGeometry = new THREE.BoxGeometry(0.055, 1.96, 0.055);

    [
      [-0.68, 0, 0.6],
      [0.68, 0, 0.6],
      [-0.68, 0, -0.6],
      [0.68, 0, -0.6],
    ].forEach(([x, y, z]) => {
      const rail = new THREE.Mesh(railGeometry, railMaterial);
      rail.position.set(x, y, z);
      satellite.add(rail);
    });

    // ----------------------------------
    // SOLAR PANELS
    // ----------------------------------

    const solarCellMaterial = new THREE.MeshStandardMaterial({
      color: 0x0d426d,
      metalness: 0.35,
      roughness: 0.34,
    });

    const panelFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x9ba6b2,
      metalness: 0.9,
      roughness: 0.22,
    });

    const createSolarPanel = (name: string) => {
      const group = new THREE.Group();
      group.name = name;

      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(2.15, 0.07, 0.95),
        solarCellMaterial
      );

      group.add(panel);

      for (let i = -3; i <= 3; i++) {
        const separator = new THREE.Mesh(
          new THREE.BoxGeometry(0.018, 0.085, 0.91),
          panelFrameMaterial
        );

        separator.position.x = i * 0.29;
        group.add(separator);
      }

      [-0.47, 0.47].forEach((z) => {
        const edge = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.09, 0.025),
          panelFrameMaterial
        );

        edge.position.z = z;
        group.add(edge);
      });

      return group;
    };

    const leftPanel = createSolarPanel("Solar Array Left");
    leftPanel.position.x = -1.85;
    satellite.add(leftPanel);

    const rightPanel = createSolarPanel("Solar Array Right");
    rightPanel.position.x = 1.85;
    satellite.add(rightPanel);

    const armGeometry = new THREE.BoxGeometry(0.75, 0.11, 0.11);

    const leftArm = new THREE.Mesh(armGeometry, railMaterial);
    leftArm.position.x = -0.95;

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.95;

    satellite.add(leftArm, rightArm);

    // ----------------------------------
    // ANTENNA
    // ----------------------------------

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.0, 16),
      railMaterial
    );

    antenna.position.set(0.35, 1.38, 0);
    antenna.name = "Communications Antenna";
    satellite.add(antenna);

    const antennaTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 18, 18),
      railMaterial
    );

    antennaTip.position.set(0.35, 1.9, 0);
    satellite.add(antennaTip);

    // ----------------------------------
    // THRUSTERS
    // ----------------------------------

    const thrusterMaterial = new THREE.MeshStandardMaterial({
      color: 0x202630,
      metalness: 0.9,
      roughness: 0.25,
    });

    [-0.34, 0.34].forEach((x) => {
      const thruster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.21, 0.3, 20),
        thrusterMaterial
      );

      thruster.position.set(x, -1.04, 0);
      thruster.name = "Propulsion";

      satellite.add(thruster);
    });

    // ----------------------------------
    // ORBIT CONTROLS
    // ----------------------------------

    const controls = new OrbitControls(camera, renderer.domElement);

    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;

    controls.enableZoom = true;

    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.65;

    const fitSatelliteToView = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;

      if (!width || !height) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      satellite.updateMatrixWorld(true);

      const bounds = new THREE.Box3().setFromObject(satellite);
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());

      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov =
        2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);

      const limitingFov = Math.min(verticalFov, horizontalFov);

      // Padding keeps solar arrays away from card edges.
      const distance =
        (sphere.radius / Math.sin(limitingFov / 2)) * 1.32;

      controls.target.copy(sphere.center);

      camera.position
        .copy(sphere.center)
        .addScaledVector(cameraDirection, distance);

      camera.near = Math.max(0.1, distance / 100);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();

      controls.minDistance = distance * 0.72;
      controls.maxDistance = distance * 2.3;

      controls.update();
    };

    fitSatelliteToView();

    resetRef.current = () => {
      satellite.rotation.set(
        THREE.MathUtils.degToRad(-10),
        THREE.MathUtils.degToRad(18),
        0
      );

      fitSatelliteToView();
    };

    let resumeTimer: number | undefined;

    const handleStart = () => {
      controls.autoRotate = false;

      if (resumeTimer) {
        window.clearTimeout(resumeTimer);
      }
    };

    const handleEnd = () => {
      resumeTimer = window.setTimeout(() => {
        controls.autoRotate = true;
      }, 1800);
    };

    controls.addEventListener("start", handleStart);
    controls.addEventListener("end", handleEnd);

    // Responsive sizing
    const resizeObserver = new ResizeObserver(() => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;

      if (!width || !height) return;

      renderer.setSize(width, height, true);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      fitSatelliteToView();
    });

    resizeObserver.observe(mount);

    // Render loop
    let animationFrame = 0;

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);

      if (resumeTimer) {
        window.clearTimeout(resumeTimer);
      }

      resizeObserver.disconnect();

      controls.removeEventListener("start", handleStart);
      controls.removeEventListener("end", handleEnd);
      controls.dispose();

      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;

        object.geometry.dispose();

        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      });

      renderer.dispose();

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  const stateColor =
    state === "FAILED"
      ? "text-[#EF4444]"
      : state === "NOMINAL"
      ? "text-[#10B981]"
      : "text-[#F59E0B]";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-medium text-[#7F8C9A] uppercase tracking-[0.16em]">
            Spacecraft Inspector
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-white">
              {satelliteName}
            </span>

            {role && (
              <span className="text-[9px] text-[#607080] uppercase">
                {role}
              </span>
            )}

            {state && (
              <span className={`text-[9px] uppercase ${stateColor}`}>
                {state}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => resetRef.current?.()}
          title="Reset spacecraft view"
          className="w-7 h-7 rounded-md border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.06] text-[#7F8C9A] hover:text-white flex items-center justify-center transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="relative h-[175px] rounded-xl overflow-hidden border border-white/[0.07] bg-[#03070C]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, rgba(32,73,108,0.23), transparent 60%)",
          }}
        />

        <div ref={mountRef} className="absolute inset-0 z-10" />

        <div className="absolute left-3 top-3 z-20 pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
        </div>

        <div className="absolute bottom-1.5 left-0 right-0 z-20 text-center pointer-events-none">
          <span className="text-[8px] uppercase tracking-[0.16em] text-[#536170]">
            Drag to rotate · Scroll to zoom
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-[8px] uppercase tracking-wide text-[#657383]">
        <div className="text-center">Solar</div>
        <div className="text-center">Payload</div>
        <div className="text-center">Comms</div>
        <div className="text-center">Propulsion</div>
      </div>
    </div>
  );
}
