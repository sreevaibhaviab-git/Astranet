import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RotateCcw } from "lucide-react";
import type {
  SatelliteSubsystems,
  SubsystemStatus,
} from "../../data/mockMissionControl";

type PartKey = "bus" | "solar" | "payload" | "comms" | "propulsion";

interface Satellite3DPreviewProps {
  satelliteName: string;
  role?: string;
  state?: string;
  subsystems: SatelliteSubsystems;
}

const PART_INFO: Record<
  PartKey,
  {
    label: string;
    function: string;
    subsystem: keyof SatelliteSubsystems;
  }
> = {
  bus: {
    label: "Main Bus",
    function:
      "Houses onboard computing, avionics, power distribution and core spacecraft electronics.",
    subsystem: "compute",
  },
  solar: {
    label: "Solar Arrays",
    function:
      "Generates electrical power for spacecraft systems and recharges onboard batteries.",
    subsystem: "power",
  },
  payload: {
    label: "Payload",
    function:
      "Performs Earth-observation sensing and collects mission data for the swarm.",
    subsystem: "payload",
  },
  comms: {
    label: "Communications",
    function:
      "Maintains inter-satellite links, telemetry exchange and swarm coordination traffic.",
    subsystem: "communications",
  },
  propulsion: {
    label: "Propulsion",
    function:
      "Supports orbital corrections, formation maintenance and autonomous reconfiguration.",
    subsystem: "propulsion",
  },
};

const PART_BUTTONS: Array<{ key: PartKey; label: string }> = [
  { key: "bus", label: "Bus" },
  { key: "solar", label: "Solar" },
  { key: "payload", label: "Payload" },
  { key: "comms", label: "Comms" },
  { key: "propulsion", label: "Propulsion" },
];

export default function Satellite3DPreview({
  satelliteName,
  role,
  state,
  subsystems,
}: Satellite3DPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const selectPartRef = useRef<((key: PartKey) => void) | null>(null);

  const [selectedPart, setSelectedPart] = useState<PartKey | null>(null);

  const selectedInfo = useMemo(() => {
    if (!selectedPart) return null;

    const info = PART_INFO[selectedPart];

    return {
      ...info,
      status: subsystems[info.subsystem],
    };
  }, [selectedPart, subsystems]);

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
    renderer.domElement.style.touchAction = "none";

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    mount.appendChild(renderer.domElement);

    // ---------------------------------------------------------
    // LIGHTING
    // ---------------------------------------------------------

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const keyLight = new THREE.DirectionalLight(0xdcefff, 3.3);
    keyLight.position.set(5, 6, 7);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(-5, 2, -5);
    scene.add(rimLight);

    // ---------------------------------------------------------
    // SATELLITE
    // ---------------------------------------------------------

    const satellite = new THREE.Group();

    satellite.rotation.x = THREE.MathUtils.degToRad(-10);
    satellite.rotation.y = THREE.MathUtils.degToRad(18);

    scene.add(satellite);

    const partTargets: Record<PartKey, THREE.Object3D[]> = {
      bus: [],
      solar: [],
      payload: [],
      comms: [],
      propulsion: [],
    };

    const registerPart = (key: PartKey, object: THREE.Object3D) => {
      object.userData.partKey = key;
      partTargets[key].push(object);
    };

    // ---------------------------------------------------------
    // MAIN BUS
    // ---------------------------------------------------------

    const busMaterial = new THREE.MeshStandardMaterial({
      color: 0x424a55,
      metalness: 0.78,
      roughness: 0.3,
    });

    const bus = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.8, 1.15),
      busMaterial
    );

    registerPart("bus", bus);
    satellite.add(bus);

    const frontPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.25, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0x171d25,
        metalness: 0.7,
        roughness: 0.35,
      })
    );

    frontPanel.position.z = 0.605;
    registerPart("bus", frontPanel);
    satellite.add(frontPanel);

    // ---------------------------------------------------------
    // PAYLOAD
    // ---------------------------------------------------------

    const payloadGroup = new THREE.Group();
    registerPart("payload", payloadGroup);

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

    payloadGroup.add(payloadRing, lens);
    satellite.add(payloadGroup);

    // ---------------------------------------------------------
    // CUBESAT RAILS
    // ---------------------------------------------------------

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
      registerPart("bus", rail);
      satellite.add(rail);
    });

    // ---------------------------------------------------------
    // SOLAR ARRAYS
    // ---------------------------------------------------------

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

    const createSolarPanel = () => {
      const group = new THREE.Group();
      registerPart("solar", group);

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

    const leftPanel = createSolarPanel();
    leftPanel.position.x = -1.85;

    const rightPanel = createSolarPanel();
    rightPanel.position.x = 1.85;

    satellite.add(leftPanel, rightPanel);

    const armGeometry = new THREE.BoxGeometry(0.75, 0.11, 0.11);

    const leftArm = new THREE.Mesh(armGeometry, railMaterial);
    leftArm.position.x = -0.95;
    registerPart("solar", leftArm);

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.95;
    registerPart("solar", rightArm);

    satellite.add(leftArm, rightArm);

    // ---------------------------------------------------------
    // COMMUNICATIONS ANTENNA
    // ---------------------------------------------------------

    const antennaGroup = new THREE.Group();
    registerPart("comms", antennaGroup);

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.0, 16),
      railMaterial
    );

    antenna.position.set(0.35, 1.38, 0);

    const antennaTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 18, 18),
      railMaterial
    );

    antennaTip.position.set(0.35, 1.9, 0);

    antennaGroup.add(antenna, antennaTip);
    satellite.add(antennaGroup);

    // ---------------------------------------------------------
    // PROPULSION
    // ---------------------------------------------------------

    const propulsionGroup = new THREE.Group();
    registerPart("propulsion", propulsionGroup);

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
      propulsionGroup.add(thruster);
    });

    satellite.add(propulsionGroup);

    // ---------------------------------------------------------
    // ORBIT CONTROLS
    // ---------------------------------------------------------

    const controls = new OrbitControls(camera, renderer.domElement);

    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.enableZoom = true;

    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.65;

    // ---------------------------------------------------------
    // AUTO-FIT CAMERA
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // CLICKABLE PART SELECTION
    // ---------------------------------------------------------

    const selectionBounds = new THREE.Box3();

    const selectionHelper = new THREE.Box3Helper(
      selectionBounds,
      new THREE.Color(0x22d3ee)
    );

    selectionHelper.visible = false;
    scene.add(selectionHelper);

    const focusPart = (key: PartKey) => {
      selectionBounds.makeEmpty();

      partTargets[key].forEach((target) => {
        target.updateWorldMatrix(true, true);
        selectionBounds.expandByObject(target);
      });

      selectionHelper.visible = !selectionBounds.isEmpty();
      selectionHelper.updateMatrixWorld(true);

      setSelectedPart(key);

      controls.autoRotate = false;
    };

    selectPartRef.current = focusPart;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const getPartFromObject = (
      object: THREE.Object3D
    ): PartKey | null => {
      let current: THREE.Object3D | null = object;

      while (current && current !== scene) {
        const key = current.userData.partKey as PartKey | undefined;

        if (key) {
          return key;
        }

        current = current.parent;
      }

      return null;
    };

    const getPointerPart = (
      event: PointerEvent
    ): PartKey | null => {
      const rect = renderer.domElement.getBoundingClientRect();

      pointer.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;

      pointer.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      const intersections = raycaster.intersectObject(
        satellite,
        true
      );

      for (const intersection of intersections) {
        const key = getPartFromObject(intersection.object);

        if (key) {
          return key;
        }
      }

      return null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const part = getPointerPart(event);

      renderer.domElement.style.cursor = part
        ? "pointer"
        : "grab";
    };

    const handlePointerDown = (event: PointerEvent) => {
      const part = getPointerPart(event);

      if (part) {
        focusPart(part);
      }
    };

    renderer.domElement.addEventListener(
      "pointermove",
      handlePointerMove
    );

    renderer.domElement.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    // ---------------------------------------------------------
    // RESET
    // ---------------------------------------------------------

    resetRef.current = () => {
      satellite.rotation.set(
        THREE.MathUtils.degToRad(-10),
        THREE.MathUtils.degToRad(18),
        0
      );

      selectionHelper.visible = false;
      setSelectedPart(null);

      controls.autoRotate = true;

      fitSatelliteToView();
    };

    // ---------------------------------------------------------
    // USER ROTATION
    // ---------------------------------------------------------

    let resumeTimer: number | undefined;

    const handleStart = () => {
      controls.autoRotate = false;

      if (resumeTimer) {
        window.clearTimeout(resumeTimer);
      }
    };

    const handleEnd = () => {
      resumeTimer = window.setTimeout(() => {
        if (!selectedPart) {
          controls.autoRotate = true;
        }
      }, 1800);
    };

    controls.addEventListener("start", handleStart);
    controls.addEventListener("end", handleEnd);

    // ---------------------------------------------------------
    // RESIZE
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // RENDER LOOP
    // ---------------------------------------------------------

    let animationFrame = 0;

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------

    return () => {
      cancelAnimationFrame(animationFrame);

      if (resumeTimer) {
        window.clearTimeout(resumeTimer);
      }

      resizeObserver.disconnect();

      renderer.domElement.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      renderer.domElement.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      controls.removeEventListener("start", handleStart);
      controls.removeEventListener("end", handleEnd);

      controls.dispose();

      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;

        object.geometry.dispose();

        if (Array.isArray(object.material)) {
          object.material.forEach((material) =>
            material.dispose()
          );
        } else {
          object.material.dispose();
        }
      });

      selectionHelper.geometry.dispose();
      selectionHelper.material.dispose();

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

  const getStatusClass = (status: SubsystemStatus) => {
    switch (status) {
      case "NOMINAL":
        return "text-[#10B981]";
      case "WARNING":
        return "text-[#F59E0B]";
      case "DEGRADED":
        return "text-[#F97316]";
      case "FAILED":
        return "text-[#EF4444]";
      default:
        return "text-[#7F8C9A]";
    }
  };

  return (
    <div className="space-y-2">
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
              <span
                className={`text-[9px] uppercase ${stateColor}`}
              >
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
            Click component · Drag to rotate · Scroll to zoom
          </span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {PART_BUTTONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectPartRef.current?.(key)}
            className={`py-1.5 rounded-md border text-[8px] uppercase tracking-[0.08em] transition-colors ${
              selectedPart === key
                ? "border-[#22D3EE]/45 bg-[#22D3EE]/10 text-[#67E8F9]"
                : "border-white/[0.05] bg-white/[0.02] text-[#657383] hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selectedInfo ? (
        <div className="rounded-lg border border-[#22D3EE]/15 bg-[#07111A] px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-medium text-white">
              {selectedInfo.label}
            </span>

            <span
              className={`text-[9px] font-medium uppercase ${getStatusClass(
                selectedInfo.status
              )}`}
            >
              {selectedInfo.status}
            </span>
          </div>

          <p className="mt-1.5 text-[9px] leading-relaxed text-[#7F8C9A]">
            {selectedInfo.function}
          </p>
        </div>
      ) : (
        <div className="text-[9px] text-[#536170] text-center py-1">
          Select a spacecraft component to inspect its function and health.
        </div>
      )}
    </div>
  );
}
