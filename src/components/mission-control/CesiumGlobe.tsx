import { useEffect, useRef, useState, useCallback } from "react";
import { SatelliteTelemetry, SatelliteState } from "../../data/mockMissionControl";
import { Focus, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

declare const Cesium: any;

export type ViewMode = "ORBIT" | "NETWORK" | "MISSION";

interface CesiumGlobeProps {
  satellites: SatelliteTelemetry[];
  selectedSatelliteId: string;
  onSelectSatellite: (id: string) => void;
  missionTime: string;
  coordinatorId: string;
}

// 3 Orbital Planes configurations (semi-major axis, inclination, RAAN)
// 3 Planes x 4 Satellites = 12 CubeSats
const ORBITAL_PLANES = [
  {
    name: "Plane A",
    inclination: (48 * Math.PI) / 180,
    raan: 0,
    color: "rgba(137, 170, 204, 0.28)",
    strokeDash: [],
  },
  {
    name: "Plane B",
    inclination: (53 * Math.PI) / 180,
    raan: (120 * Math.PI) / 180,
    color: "rgba(92, 159, 214, 0.38)",
    strokeDash: [6, 4],
  },
  {
    name: "Plane C",
    inclination: (60 * Math.PI) / 180,
    raan: (240 * Math.PI) / 180,
    color: "rgba(100, 150, 190, 0.28)",
    strokeDash: [3, 4],
  },
];

export default function CesiumGlobe({
  satellites,
  selectedSatelliteId,
  onSelectSatellite,
  missionTime,
  coordinatorId,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<any>(null);

  // Default view mode is ORBIT
  const [viewMode, setViewMode] = useState<ViewMode>("ORBIT");
  const [hoveredSatelliteId, setHoveredSatelliteId] = useState<string | null>(null);
  const [isCesiumActive, setIsCesiumActive] = useState<boolean>(false);

  // 3D Camera Controls State
  const cameraStateRef = useRef({
    rotX: 0.28, // Pitch
    rotY: -0.5, // Yaw
    distance: 420,
    targetRotX: 0.28,
    targetRotY: -0.5,
    targetDistance: 420,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
  });

  const simTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // Pre-generate detailed procedural Earth texture with visible continents & blue oceans
  const earthTextureRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Generate realistic 1024x512 equirectangular Earth texture
    const texCanvas = document.createElement("canvas");
    texCanvas.width = 1024;
    texCanvas.height = 512;
    const tCtx = texCanvas.getContext("2d");
    if (!tCtx) return;

    // 1. Deep realistic blue ocean base
    const oceanGrad = tCtx.createLinearGradient(0, 0, 0, 512);
    oceanGrad.addColorStop(0, "#0E2442");
    oceanGrad.addColorStop(0.5, "#153E6B");
    oceanGrad.addColorStop(1, "#0A1B33");
    tCtx.fillStyle = oceanGrad;
    tCtx.fillRect(0, 0, 1024, 512);

    // 2. Continental shelf shallow turquoise water outlines
    tCtx.fillStyle = "rgba(35, 105, 155, 0.35)";

    // Function to render continent landmasses
    const drawLandmass = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      rot: number
    ) => {
      tCtx.save();
      tCtx.translate(cx, cy);
      tCtx.rotate(rot);
      tCtx.beginPath();
      tCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.restore();
    };

    // Realistic continent silhouettes (Earthy green & terra-cotta tones)
    tCtx.fillStyle = "#2D5A42"; // Eurasia / North America green

    // North America
    drawLandmass(260, 160, 120, 80, -0.2);
    drawLandmass(220, 110, 80, 50, 0.1);
    // South America
    tCtx.fillStyle = "#2B523B";
    drawLandmass(340, 330, 70, 110, 0.3);
    // Europe
    tCtx.fillStyle = "#335C44";
    drawLandmass(520, 140, 60, 45, -0.1);
    drawLandmass(560, 120, 50, 40, 0.2);
    // Africa
    tCtx.fillStyle = "#5A5432"; // Sahara & savanna brown/green
    drawLandmass(540, 260, 80, 100, 0.1);
    drawLandmass(550, 340, 50, 70, -0.1);
    // Asia
    tCtx.fillStyle = "#365942";
    drawLandmass(720, 150, 150, 90, 0.05);
    drawLandmass(780, 220, 90, 70, -0.2);
    drawLandmass(680, 230, 50, 60, 0.3); // India
    // Australia
    tCtx.fillStyle = "#5A4E32";
    drawLandmass(860, 360, 65, 50, -0.1);
    // Antarctica (Ice cap)
    tCtx.fillStyle = "#DDEAF5";
    drawLandmass(512, 490, 480, 30, 0);
    // Greenland (Ice cap)
    drawLandmass(380, 70, 45, 30, -0.3);

    // 3. Clouds & Atmospheric Swirls
    tCtx.fillStyle = "rgba(255, 255, 255, 0.18)";
    for (let i = 0; i < 20; i++) {
      const cx = (i * 58) % 1024;
      const cy = 80 + (i * 27) % 360;
      drawLandmass(cx, cy, 60 + (i % 5) * 20, 15 + (i % 3) * 8, (i % 4) * 0.2);
    }

    earthTextureRef.current = texCanvas;
  }, []);

  // Cesium Viewer Initialization
  useEffect(() => {
    let checkInterval: any = null;

    const tryInitCesium = () => {
      if (typeof Cesium === "undefined" || !cesiumContainerRef.current) return false;
      if (cesiumViewerRef.current) return true;

      try {
        // High-resolution Earth imagery provider with visible continents and oceans
        let baseLayer: any;
        try {
          baseLayer = new Cesium.ArcGisMapServerImageryProvider({
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
            enablePickFeatures: false,
          });
        } catch {
          baseLayer = undefined;
        }

        const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          navigationInstructionsInitiallyVisible: false,
          creditContainer: document.createElement("div"),
          skyBox: false,
          baseLayer: baseLayer ? new Cesium.ImageryLayer(baseLayer) : undefined,
        });

        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#05080D");
        if (viewer.scene.globe) {
          viewer.scene.globe.enableLighting = false; // Keep entire Earth vibrantly visible
          viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#132D4B");
          viewer.scene.globe.atmosphereHueShift = -0.05;
          viewer.scene.globe.atmosphereSaturationShift = 0.25;
          viewer.scene.globe.atmosphereBrightnessShift = 0.15;
        }

        // Position camera to view full Earth and constellation
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(20, 15, 18500000), // ~18,500 km view
        });

        cesiumViewerRef.current = viewer;
        setIsCesiumActive(true);
        return true;
      } catch (err) {
        console.warn("Cesium initialization fallback to 3D Canvas", err);
        return false;
      }
    };

    if (!tryInitCesium()) {
      checkInterval = setInterval(() => {
        if (tryInitCesium()) {
          clearInterval(checkInterval);
        }
      }, 300);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (cesiumViewerRef.current) {
        try {
          cesiumViewerRef.current.destroy();
        } catch {}
        cesiumViewerRef.current = null;
      }
    };
  }, []);

  // Focus Camera smoothly on selected satellite
  const handleFocusSelected = useCallback(() => {
    const selected = satellites.find((s) => s.id === selectedSatelliteId);
    if (!selected) return;

    const plane = ORBITAL_PLANES[selected.planeIndex];
    cameraStateRef.current.targetRotY = -plane.raan + 0.2;
    cameraStateRef.current.targetRotX = plane.inclination * 0.42;
    cameraStateRef.current.targetDistance = 410;

    if (cesiumViewerRef.current && typeof Cesium !== "undefined") {
      try {
        const viewer = cesiumViewerRef.current;
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            (selected.phaseDeg + 30) % 360,
            selected.planeIndex === 0 ? 30 : selected.planeIndex === 1 ? 40 : 45,
            17500000
          ),
          duration: 1.2,
        });
      } catch {}
    }
  }, [selectedSatelliteId, satellites]);

  const handleResetCamera = () => {
    cameraStateRef.current.targetRotX = 0.28;
    cameraStateRef.current.targetRotY = -0.5;
    cameraStateRef.current.targetDistance = 420;

    if (cesiumViewerRef.current && typeof Cesium !== "undefined") {
      try {
        cesiumViewerRef.current.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(20, 15, 18500000),
          duration: 1.0,
        });
      } catch {}
    }
  };

  const handleZoom = (delta: number) => {
    cameraStateRef.current.targetDistance = Math.min(
      580,
      Math.max(280, cameraStateRef.current.targetDistance + delta)
    );
  };

  // State color helper: Strictly purposeful
  const getStateColor = (state: SatelliteState) => {
    switch (state) {
      case "NOMINAL":
        return "#10B981"; // Emerald
      case "WARNING":
      case "SUSPECTED":
        return "#F59E0B"; // Amber
      case "DEGRADED":
        return "#F97316"; // Orange
      case "FAILED":
      case "ISOLATED":
        return "#EF4444"; // Red
      case "RECOVERING":
        return "#5C9FD6"; // Blue
      default:
        return "#10B981";
    }
  };

  // Compute 3D Coordinates of satellite in its orbital plane
  const getSatellitePosition = useCallback(
    (
      sat: SatelliteTelemetry,
      timeOffset: number,
      globeRadius: number
    ): { x: number; y: number; z: number; phase: number } => {
      const plane = ORBITAL_PLANES[sat.planeIndex];
      const orbitRadius = globeRadius * 1.52; // LEO 550 km
      const speed = (2 * Math.PI) / 90; // Smooth, observable orbital speed
      const currentPhase =
        ((sat.phaseDeg * Math.PI) / 180 + timeOffset * speed) % (2 * Math.PI);

      const ox = orbitRadius * Math.cos(currentPhase);
      const oy = orbitRadius * Math.sin(currentPhase);
      const oz = 0;

      // Inclination
      const inc = plane.inclination;
      const x1 = ox;
      const y1 = oy * Math.cos(inc) - oz * Math.sin(inc);
      const z1 = oy * Math.sin(inc) + oz * Math.cos(inc);

      // RAAN
      const raan = plane.raan;
      const x2 = x1 * Math.cos(raan) - y1 * Math.sin(raan);
      const y2 = x1 * Math.sin(raan) + y1 * Math.cos(raan);
      const z2 = z1;

      return { x: x2, y: y2, z: z2, phase: currentPhase };
    },
    []
  );

  // 3D Orbital Canvas & Space Environment Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let isRunning = true;
    let lastTimestamp = performance.now();

    const resize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const render = (now: number) => {
      if (!isRunning) return;

      const dt = Math.min((now - lastTimestamp) / 1000, 0.1);
      lastTimestamp = now;
      simTimeRef.current += dt;

      // Smooth camera interpolation
      const cam = cameraStateRef.current;
      cam.rotX += (cam.targetRotX - cam.rotX) * 0.1;
      cam.rotY += (cam.targetRotY - cam.rotY) * 0.1;
      cam.distance += (cam.targetDistance - cam.distance) * 0.1;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Center Composition: Earth sits slightly lower than dead center for deep space scale
      const cx = width * 0.5;
      const cy = height * 0.52;

      // Earth is large: ~66% of stage height
      const globeRadius = Math.min(width, height) * 0.36;

      ctx.clearRect(0, 0, width, height);

      // 1. If Cesium is not active, render rich space background and photorealistic Earth
      if (!isCesiumActive) {
        // Deep space background gradient
        const spaceGrad = ctx.createRadialGradient(cx, cy, globeRadius, cx, cy, width * 0.8);
        spaceGrad.addColorStop(0, "#070E18");
        spaceGrad.addColorStop(0.6, "#050910");
        spaceGrad.addColorStop(1, "#03060B");
        ctx.fillStyle = spaceGrad;
        ctx.fillRect(0, 0, width, height);

        // Faint realistic starfield
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        const stars = [
          [0.05, 0.12, 1], [0.88, 0.08, 1.2], [0.18, 0.78, 1], [0.82, 0.85, 1.5],
          [0.12, 0.45, 0.8], [0.94, 0.52, 1], [0.45, 0.06, 1.2], [0.72, 0.18, 0.8],
          [0.32, 0.94, 1], [0.65, 0.88, 1], [0.08, 0.65, 1.2], [0.85, 0.68, 0.8],
          [0.28, 0.22, 1], [0.62, 0.35, 1.2], [0.78, 0.42, 0.8], [0.15, 0.88, 1.4],
        ];
        stars.forEach(([sx, sy, size]) => {
          ctx.fillRect(sx * width, sy * height, size, size);
        });

        // 2. Photorealistic Earth Globe (Recognizable Continents & Deep Blue Oceans)
        // Atmospheric Rim Glow (Subtle soft cyan Rayleigh scattering)
        const atmoRim = ctx.createRadialGradient(
          cx,
          cy,
          globeRadius * 0.92,
          cx,
          cy,
          globeRadius * 1.08
        );
        atmoRim.addColorStop(0, "rgba(92, 159, 214, 0)");
        atmoRim.addColorStop(0.7, "rgba(92, 159, 214, 0.32)");
        atmoRim.addColorStop(0.9, "rgba(137, 170, 204, 0.15)");
        atmoRim.addColorStop(1, "rgba(92, 159, 214, 0)");

        ctx.beginPath();
        ctx.arc(cx, cy, globeRadius * 1.08, 0, Math.PI * 2);
        ctx.fillStyle = atmoRim;
        ctx.fill();

        // Realistic Sunlit Earth Body
        const sunX = cx - globeRadius * 0.38;
        const sunY = cy - globeRadius * 0.38;

        const oceanBase = ctx.createRadialGradient(
          sunX,
          sunY,
          globeRadius * 0.05,
          cx,
          cy,
          globeRadius
        );
        oceanBase.addColorStop(0, "#1F548A"); // Sunlit oceanic azure
        oceanBase.addColorStop(0.35, "#153E6B"); // Deep Atlantic blue
        oceanBase.addColorStop(0.75, "#0E2442"); // Pacific maritime blue
        oceanBase.addColorStop(0.95, "#071221"); // Twilight terminator
        oceanBase.addColorStop(1, "#040912"); // Night side

        ctx.beginPath();
        ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
        ctx.fillStyle = oceanBase;
        ctx.fill();

        // Texture Mapping: Continents and Landmasses
        if (earthTextureRef.current) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
          ctx.clip();

          // Render rotating equirectangular continent texture
          const rotOffset = ((simTimeRef.current * 0.015 + cam.rotY * 0.4) % 1) * globeRadius * 4;
          ctx.globalAlpha = 0.85;

          ctx.drawImage(
            earthTextureRef.current,
            cx - globeRadius * 2 + (rotOffset % (globeRadius * 4)),
            cy - globeRadius,
            globeRadius * 4,
            globeRadius * 2
          );
          ctx.drawImage(
            earthTextureRef.current,
            cx - globeRadius * 2 + (rotOffset % (globeRadius * 4)) - globeRadius * 4,
            cy - globeRadius,
            globeRadius * 4,
            globeRadius * 2
          );

          // Day/Night Shading overlay
          const dayNight = ctx.createRadialGradient(
            sunX,
            sunY,
            globeRadius * 0.1,
            cx,
            cy,
            globeRadius
          );
          dayNight.addColorStop(0, "rgba(255, 255, 255, 0.08)");
          dayNight.addColorStop(0.4, "rgba(0, 0, 0, 0)");
          dayNight.addColorStop(0.85, "rgba(3, 7, 14, 0.65)");
          dayNight.addColorStop(1, "rgba(2, 5, 10, 0.92)");

          ctx.fillStyle = dayNight;
          ctx.fillRect(cx - globeRadius, cy - globeRadius, globeRadius * 2, globeRadius * 2);

          ctx.restore();
        }
      }

      // 3D Perspective Projection Matrix
      const project = (x: number, y: number, z: number) => {
        const cosY = Math.cos(cam.rotY);
        const sinY = Math.sin(cam.rotY);
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;

        const cosX = Math.cos(cam.rotX);
        const sinX = Math.sin(cam.rotX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        const fov = 1000;
        const zDist = cam.distance + z2;
        const scale = fov / Math.max(120, zDist);
        const px = cx + x1 * scale;
        const py = cy - y2 * scale;

        return { px, py, pz: z2, scale, visible: zDist > 0 };
      };

      // 3. Render 3 Coherent Orbital Planes
      // (Visualized clearly: 3 PLANES x 4 SATELLITES = 12 CUBESATS)
      ORBITAL_PLANES.forEach((plane, pIdx) => {
        ctx.beginPath();
        ctx.strokeStyle = plane.color;
        ctx.lineWidth = pIdx === 1 ? 1.4 : 1.0;
        ctx.setLineDash(plane.strokeDash);

        const segments = 90;
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const orbitR = globeRadius * 1.52;

          const ox = orbitR * Math.cos(angle);
          const oy = orbitR * Math.sin(angle);
          const oz = 0;

          const y1 = oy * Math.cos(plane.inclination) - oz * Math.sin(plane.inclination);
          const z1 = oy * Math.sin(plane.inclination) + oz * Math.cos(plane.inclination);

          const x2 = ox * Math.cos(plane.raan) - y1 * Math.sin(plane.raan);
          const y2 = ox * Math.sin(plane.raan) + y1 * Math.cos(plane.raan);
          const z2 = z1;

          const pt = project(x2, y2, z2);
          if (i === 0) ctx.moveTo(pt.px, pt.py);
          else ctx.lineTo(pt.px, pt.py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Calculate all 12 CubeSat positions in 3D orbit
      const satPositions = satellites.map((sat) => {
        const pos = getSatellitePosition(sat, simTimeRef.current, globeRadius);
        const screen = project(pos.x, pos.y, pos.z);
        return { sat, pos, screen };
      });

      // 4. Communication Links (ISL): Visible ONLY in NETWORK mode!
      // In ORBIT mode: default calm view, zero mesh link clutter
      if (viewMode === "NETWORK") {
        ctx.save();
        satPositions.forEach((nodeA, i) => {
          satPositions.forEach((nodeB, j) => {
            if (j <= i) return;

            const isSamePlane = nodeA.sat.planeIndex === nodeB.sat.planeIndex;
            const slotDiff = Math.abs(nodeA.sat.slotIndex - nodeB.sat.slotIndex);
            const isRingNeighbor = isSamePlane && (slotDiff === 1 || slotDiff === 3);

            const isCrossPlane =
              !isSamePlane &&
              Math.abs(nodeA.sat.planeIndex - nodeB.sat.planeIndex) === 1 &&
              nodeA.sat.slotIndex === nodeB.sat.slotIndex;

            if (isRingNeighbor || isCrossPlane) {
              const midX = (nodeA.pos.x + nodeB.pos.x) / 2;
              const midY = (nodeA.pos.y + nodeB.pos.y) / 2;
              const midZ = (nodeA.pos.z + nodeB.pos.z) / 2;
              const distFromCenter = Math.sqrt(midX * midX + midY * midY + midZ * midZ);

              // Occlusion check: Links don't pass through Earth body
              if (distFromCenter >= globeRadius * 0.94) {
                const isSelectedRoute =
                  nodeA.sat.id === selectedSatelliteId ||
                  nodeB.sat.id === selectedSatelliteId;
                const isDegraded =
                  nodeA.sat.state === "DEGRADED" || nodeB.sat.state === "DEGRADED";
                const isFailed =
                  nodeA.sat.state === "FAILED" || nodeB.sat.state === "FAILED";

                ctx.beginPath();
                if (isFailed) {
                  ctx.strokeStyle = "#EF4444";
                  ctx.lineWidth = 1.2;
                  ctx.setLineDash([4, 4]);
                } else if (isDegraded) {
                  ctx.strokeStyle = "rgba(245, 158, 11, 0.75)";
                  ctx.lineWidth = 1.0;
                  ctx.setLineDash([6, 3]);
                } else if (isSelectedRoute) {
                  ctx.strokeStyle = "rgba(92, 159, 214, 0.9)";
                  ctx.lineWidth = 1.5;
                  ctx.setLineDash([]);
                } else {
                  ctx.strokeStyle = "rgba(100, 150, 190, 0.35)";
                  ctx.lineWidth = 0.9;
                  ctx.setLineDash([]);
                }

                ctx.moveTo(nodeA.screen.px, nodeA.screen.py);
                ctx.lineTo(nodeB.screen.px, nodeB.screen.py);
                ctx.stroke();
              }
            }
          });
        });
        ctx.restore();
      }

      // 5. Mission Mode: Observation footprints & sensing cones
      if (viewMode === "MISSION") {
        ctx.save();
        satPositions.forEach(({ screen }) => {
          ctx.beginPath();
          ctx.arc(screen.px, screen.py, 34, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(92, 159, 214, 0.05)";
          ctx.strokeStyle = "rgba(92, 159, 214, 0.22)";
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      }

      // Sort satellites by z-depth so foreground nodes layer over Earth properly
      satPositions.sort((a, b) => a.screen.pz - b.screen.pz);

      // 6. Render 12 CubeSat Spacecraft Entities
      satPositions.forEach(({ sat, screen, pos }) => {
        const isSelected = sat.id === selectedSatelliteId;
        const isHovered = sat.id === hoveredSatelliteId;
        const isCoordinator = sat.role === "COORDINATOR";
        const isFaulted = sat.state === "FAILED" || sat.state === "DEGRADED";
        const stateColor = getStateColor(sat.state);

        // Check 3D Earth Occlusion (passes behind Earth)
        const distFromCenter = Math.hypot(screen.px - cx, screen.py - cy);
        const isBehindEarth = screen.pz < 0 && distFromCenter < globeRadius * 0.98;

        ctx.save();
        ctx.translate(screen.px, screen.py);

        // Translucency for satellites passing behind the planetary body
        if (isBehindEarth) {
          ctx.globalAlpha = 0.18;
        }

        // Selected Satellite Halo (Crisp, subtle blue halo)
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.strokeStyle = "#5C9FD6";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Coordinator SAT-07 Halo (Subtle emerald/blue ring)
        if (isCoordinator && !isSelected) {
          ctx.beginPath();
          ctx.arc(0, 0, 13, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // RECOGNIZABLE CUBESAT ICON WITH SOLAR PANELS
        // Central 1U bus chassis
        ctx.fillStyle = isSelected ? "#FFFFFF" : "#1A2634";
        ctx.strokeStyle = isSelected ? "#5C9FD6" : "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.fillRect(-3, -3, 6, 6);
        ctx.strokeRect(-3, -3, 6, 6);

        // Deployed solar array wings (Photovoltaic blue panels)
        ctx.fillStyle = "#2D6898";
        ctx.strokeStyle = "rgba(92, 159, 214, 0.6)";
        ctx.lineWidth = 0.8;
        ctx.fillRect(-9, -2, 5, 4); // Left wing
        ctx.strokeRect(-9, -2, 5, 4);
        ctx.fillRect(4, -2, 5, 4); // Right wing
        ctx.strokeRect(4, -2, 5, 4);

        // Status indicator dot
        ctx.beginPath();
        ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = stateColor;
        ctx.fill();

        // 7. SELECTED SATELLITE FLOATING LEADER LABEL:
        // When SAT-07 is selected: thin line from satellite to small floating label
        if (isSelected && !isBehindEarth) {
          ctx.font = "500 11px Inter, system-ui, sans-serif";

          const lineEndX = 28;
          const lineEndY = -24;

          // Thin leader line
          ctx.beginPath();
          ctx.strokeStyle = "rgba(92, 159, 214, 0.7)";
          ctx.lineWidth = 1;
          ctx.moveTo(8, -6);
          ctx.lineTo(lineEndX, lineEndY);
          ctx.lineTo(lineEndX + 45, lineEndY);
          ctx.stroke();

          // Compact floating label pill
          const labelBoxX = lineEndX + 4;
          const labelBoxY = lineEndY - 34;

          ctx.fillStyle = "rgba(8, 13, 21, 0.92)";
          ctx.strokeStyle = "rgba(92, 159, 214, 0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(labelBoxX, labelBoxY, 110, 48, 6);
          ctx.fill();
          ctx.stroke();

          // Label content (SAT-07 / Coordinator / 550 km / Nominal)
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "600 11px Inter, sans-serif";
          ctx.fillText(sat.name, labelBoxX + 8, labelBoxY + 14);

          ctx.fillStyle = isCoordinator ? "#5C9FD6" : "#7F8C9A";
          ctx.font = "500 10px Inter, sans-serif";
          ctx.fillText(sat.role, labelBoxX + 54, labelBoxY + 14);

          ctx.fillStyle = "#7F8C9A";
          ctx.fillText("550 km", labelBoxX + 8, labelBoxY + 30);

          ctx.fillStyle = stateColor;
          ctx.fillText(sat.state, labelBoxX + 54, labelBoxY + 30);
        } else if ((isHovered || isFaulted) && !isBehindEarth) {
          // Hover / Anomaly compact label
          ctx.font = "500 10px Inter, system-ui, sans-serif";
          const labelText = isFaulted ? `${sat.name} · ${sat.state}` : sat.name;
          const textWidth = ctx.measureText(labelText).width;

          ctx.fillStyle = "rgba(8, 13, 21, 0.9)";
          ctx.strokeStyle = isFaulted ? "rgba(239, 68, 68, 0.7)" : "rgba(255, 255, 255, 0.2)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(12, -9, textWidth + 12, 18, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isFaulted ? "#EF4444" : "#F3F6F8";
          ctx.fillText(labelText, 18, 4);
        }

        ctx.restore();
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [
    satellites,
    selectedSatelliteId,
    hoveredSatelliteId,
    viewMode,
    isCesiumActive,
    getSatellitePosition,
  ]);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    cameraStateRef.current.isDragging = true;
    cameraStateRef.current.lastMouseX = e.clientX;
    cameraStateRef.current.lastMouseY = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (cameraStateRef.current.isDragging) {
      const dx = e.clientX - cameraStateRef.current.lastMouseX;
      const dy = e.clientY - cameraStateRef.current.lastMouseY;
      cameraStateRef.current.lastMouseX = e.clientX;
      cameraStateRef.current.lastMouseY = e.clientY;

      cameraStateRef.current.targetRotY += dx * 0.005;
      cameraStateRef.current.targetRotX = Math.max(
        -Math.PI / 2.6,
        Math.min(Math.PI / 2.6, cameraStateRef.current.targetRotX - dy * 0.005)
      );
    } else {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const cx = width * 0.5;
      const cy = height * 0.52;
      const globeRadius = Math.min(width, height) * 0.36;

      let foundId: string | null = null;
      for (const sat of satellites) {
        const pos = getSatellitePosition(sat, simTimeRef.current, globeRadius);

        const cosY = Math.cos(cameraStateRef.current.rotY);
        const sinY = Math.sin(cameraStateRef.current.rotY);
        const x1 = pos.x * cosY - pos.z * sinY;
        const z1 = pos.x * sinY + pos.z * cosY;

        const cosX = Math.cos(cameraStateRef.current.rotX);
        const sinX = Math.sin(cameraStateRef.current.rotX);
        const y2 = pos.y * cosX - z1 * sinX;
        const z2 = pos.y * sinX + z1 * cosX;

        const fov = 1000;
        const zDist = cameraStateRef.current.distance + z2;
        const scale = fov / Math.max(120, zDist);
        const px = cx + x1 * scale;
        const py = cy - y2 * scale;

        const dist = Math.hypot(mouseX - px, mouseY - py);
        if (dist < 22) {
          foundId = sat.id;
          break;
        }
      }
      setHoveredSatelliteId(foundId);
    }
  };

  const handleMouseUp = () => {
    cameraStateRef.current.isDragging = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * 0.3;
    handleZoom(zoomDelta);
  };

  const handleClick = () => {
    if (hoveredSatelliteId) {
      onSelectSatellite(hoveredSatelliteId);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] bg-[#05080D] overflow-hidden select-none"
    >
      {/* Actual CesiumJS Viewer Stage */}
      <div
        ref={cesiumContainerRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
          isCesiumActive ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* High-Fidelity 3D Planetary Canvas Stage */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        className="w-full h-full block cursor-grab active:cursor-grabbing relative z-10"
      />

      {/* MINIMAL CENTER HUD (Upper-Left: Calm, clean, no boxes) */}
      <div className="absolute top-6 left-6 z-20 pointer-events-none">
        <div className="space-y-1.5 text-xs font-sans">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#7F8C9A]">Mission</span>
            <span className="text-white font-medium">EO-01</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#7F8C9A]">State</span>
            <span className="text-[#10B981] font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              Nominal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#7F8C9A]">Swarm</span>
            <span className="text-white font-medium">12 / 12</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#7F8C9A]">Coordinator</span>
            <span className="text-[#5C9FD6] font-medium">{coordinatorId}</span>
          </div>
          <div className="pt-1 text-[11px] text-[#7F8C9A] tabular-nums">
            T+ {missionTime}
          </div>
        </div>
      </div>

      {/* VIEW CONTROLS & CAMERA TOOLS (Top-Right: Orbit | Network | Mission) */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-white/8 bg-[#080D15]/85 p-0.5 text-xs backdrop-blur-md">
          {(["ORBIT", "NETWORK", "MISSION"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer font-medium text-xs ${
                viewMode === mode
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-[#7F8C9A] hover:text-[#F3F6F8]"
              }`}
            >
              {mode === "ORBIT" ? "Orbit" : mode === "NETWORK" ? "Network" : "Mission"}
            </button>
          ))}
        </div>

        {/* Minimal Camera Controls */}
        <div className="inline-flex rounded-lg border border-white/8 bg-[#080D15]/85 p-0.5 text-xs backdrop-blur-md">
          <button
            onClick={handleFocusSelected}
            title="Focus on selected satellite"
            className="p-1.5 rounded-md text-[#7F8C9A] hover:text-white transition-colors cursor-pointer"
          >
            <Focus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetCamera}
            title="Reset perspective"
            className="p-1.5 rounded-md text-[#7F8C9A] hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(-40)}
            title="Zoom In"
            className="p-1.5 rounded-md text-[#7F8C9A] hover:text-white transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(40)}
            title="Zoom Out"
            className="p-1.5 rounded-md text-[#7F8C9A] hover:text-white transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
