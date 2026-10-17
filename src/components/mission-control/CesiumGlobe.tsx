import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { Focus, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { SatelliteState, SatelliteTelemetry } from "../../data/mockMissionControl";

export type ViewMode = "ORBIT" | "NETWORK" | "MISSION";

interface CesiumGlobeProps {
  satellites: SatelliteTelemetry[];
  selectedSatelliteId: string;
  onSelectSatellite: (id: string) => void;
  missionTime: string;
  coordinatorId: string;
  activeLinks?: Array<[string, string]>;
}

type PlaneConfig = {
  name: string;
  inclinationDeg: number;
  raanDeg: number;
  color: Cesium.Color;
};

const EARTH_RADIUS_M = 6_378_137;
const ORBIT_ALTITUDE_M = 550_000;
const ORBIT_RADIUS_M = EARTH_RADIUS_M + ORBIT_ALTITUDE_M;

const ORBITAL_PLANES: PlaneConfig[] = [
  {
    name: "Plane A",
    inclinationDeg: 48,
    raanDeg: 0,
    color: Cesium.Color.fromCssColorString("#5B84A5").withAlpha(0.48),
  },
  {
    name: "Plane B",
    inclinationDeg: 53,
    raanDeg: 120,
    color: Cesium.Color.fromCssColorString("#6CA6D9").withAlpha(0.58),
  },
  {
    name: "Plane C",
    inclinationDeg: 60,
    raanDeg: 240,
    color: Cesium.Color.fromCssColorString("#8AA4B8").withAlpha(0.42),
  },
];

const NETWORK_LINKS: Array<[string, string]> = [
  // Ring links inside each orbital plane (12)
  ["SAT-01", "SAT-02"], ["SAT-02", "SAT-03"], ["SAT-03", "SAT-04"], ["SAT-04", "SAT-01"],
  ["SAT-05", "SAT-06"], ["SAT-06", "SAT-07"], ["SAT-07", "SAT-08"], ["SAT-08", "SAT-05"],
  ["SAT-09", "SAT-10"], ["SAT-10", "SAT-11"], ["SAT-11", "SAT-12"], ["SAT-12", "SAT-09"],
  // Cross-plane links (12) => 24 total nominal links
  ["SAT-01", "SAT-05"], ["SAT-02", "SAT-06"], ["SAT-03", "SAT-07"], ["SAT-04", "SAT-08"],
  ["SAT-05", "SAT-09"], ["SAT-06", "SAT-10"], ["SAT-07", "SAT-11"], ["SAT-08", "SAT-12"],
  ["SAT-09", "SAT-01"], ["SAT-10", "SAT-02"], ["SAT-11", "SAT-03"], ["SAT-12", "SAT-04"],
];

function stateColor(state: SatelliteState): Cesium.Color {
  switch (state) {
    case "WARNING":
    case "SUSPECTED":
      return Cesium.Color.fromCssColorString("#F59E0B");
    case "DEGRADED":
      return Cesium.Color.fromCssColorString("#F97316");
    case "FAILED":
    case "ISOLATED":
      return Cesium.Color.fromCssColorString("#EF4444");
    case "RECOVERING":
      return Cesium.Color.fromCssColorString("#5C9FD6");
    default:
      return Cesium.Color.fromCssColorString("#10B981");
  }
}

function satelliteSvgDataUri(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="42" height="22" viewBox="0 0 42 22">
      <rect x="0.8" y="6" width="12" height="10" rx="1.5" fill="#234E73" stroke="#7FB4DD" stroke-width="1"/>
      <line x1="4.8" y1="6" x2="4.8" y2="16" stroke="#5C9FD6" stroke-width="0.7" opacity="0.9"/>
      <line x1="8.8" y1="6" x2="8.8" y2="16" stroke="#5C9FD6" stroke-width="0.7" opacity="0.9"/>
      <rect x="14.5" y="4.5" width="13" height="13" rx="2" fill="#D7E0E8" stroke="#8EA2B5" stroke-width="1"/>
      <rect x="18" y="7.5" width="6" height="6" rx="1" fill="#485C6D"/>
      <circle cx="21" cy="10.5" r="1" fill="#D8F0FF"/>
      <rect x="29.2" y="6" width="12" height="10" rx="1.5" fill="#234E73" stroke="#7FB4DD" stroke-width="1"/>
      <line x1="33.2" y1="6" x2="33.2" y2="16" stroke="#5C9FD6" stroke-width="0.7" opacity="0.9"/>
      <line x1="37.2" y1="6" x2="37.2" y2="16" stroke="#5C9FD6" stroke-width="0.7" opacity="0.9"/>
      <line x1="21" y1="4.5" x2="21" y2="1" stroke="#AFC6D8" stroke-width="1"/>
      <circle cx="21" cy="1" r="1" fill="#AFC6D8"/>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function orbitCartesian(planeIndex: number, phaseRad: number, altitudeM = ORBIT_ALTITUDE_M): Cesium.Cartesian3 {
  const plane = ORBITAL_PLANES[planeIndex];
  const inclination = Cesium.Math.toRadians(plane.inclinationDeg);
  const raan = Cesium.Math.toRadians(plane.raanDeg);
  const radius = EARTH_RADIUS_M + altitudeM;

  const cosO = Math.cos(raan);
  const sinO = Math.sin(raan);
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  const cosT = Math.cos(phaseRad);
  const sinT = Math.sin(phaseRad);

  return new Cesium.Cartesian3(
    radius * (cosO * cosT - sinO * sinT * cosI),
    radius * (sinO * cosT + cosO * sinT * cosI),
    radius * (sinT * sinI)
  );
}

function fullOrbitPositions(planeIndex: number): Cesium.Cartesian3[] {
  const positions: Cesium.Cartesian3[] = [];
  for (let i = 0; i <= 180; i += 1) {
    positions.push(orbitCartesian(planeIndex, (i / 180) * Math.PI * 2));
  }
  return positions;
}

export default function CesiumGlobe({
  satellites,
  selectedSatelliteId,
  onSelectSatellite,
  missionTime,
  coordinatorId,
  activeLinks,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const creditRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const satellitesRef = useRef(satellites);
  const activeLinksRef = useRef(activeLinks);
  const selectedRef = useRef(selectedSatelliteId);
  const hoveredRef = useRef<string | null>(null);
  const viewModeRef = useRef<ViewMode>("ORBIT");
  const startTimeRef = useRef(performance.now());
  const mountedRef = useRef(true);

  const [viewMode, setViewMode] = useState<ViewMode>("ORBIT");
  const [isReady, setIsReady] = useState(false);
  const [imageryStatus, setImageryStatus] = useState<"loading" | "arcgis" | "fallback" | "error">("loading");

  satellitesRef.current = satellites;
  activeLinksRef.current = activeLinks;
  selectedRef.current = selectedSatelliteId;
  viewModeRef.current = viewMode;

  const satelliteIcon = useMemo(() => satelliteSvgDataUri(), []);

  const getSatellitePosition = useCallback((sat: SatelliteTelemetry) => {
    // If live digital-twin geographic coordinates are provided by backend, use them directly
    if (sat.position && typeof sat.position.lat === "number" && typeof sat.position.lon === "number") {
      return Cesium.Cartesian3.fromDegrees(
        sat.position.lon,
        sat.position.lat,
        (sat.position.altKm || 550) * 1000
      );
    }
    // Fallback parametric formula when running in standalone mock mode
    const elapsedSec = (performance.now() - startTimeRef.current) / 1000;
    const periodSec = Math.max(60, sat.orbitPeriodSec || 95.5);
    const phase = Cesium.Math.toRadians(sat.phaseDeg) + (elapsedSec / periodSec) * Math.PI * 2;
    return orbitCartesian(sat.planeIndex, phase, sat.altitudeKm * 1000);
  }, []);

  // Keep React state changes visible in Cesium without rebuilding the Viewer.
  // Faulted spacecraft remain visible so the operator can see exactly which node failed.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.scene.requestRender();
  }, [satellites, viewMode]);

  // Update native Cesium layer visibility when user changes mode.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    for (const entity of viewer.entities.values) {
      if (entity.id.startsWith("orbit:")) entity.show = viewMode !== "MISSION";
      if (entity.id.startsWith("link:")) entity.show = viewMode === "NETWORK";
      if (entity.id.startsWith("mission:")) entity.show = viewMode === "MISSION";
    }
    viewer.scene.requestRender();
  }, [viewMode]);

  useEffect(() => {
    mountedRef.current = true;
    const container = containerRef.current;
    if (!container) return;

    let viewer: Cesium.Viewer | null = null;
    let handler: Cesium.ScreenSpaceEventHandler | null = null;

    const init = async () => {
      try {
        // Do not depend on Cesium ion for the base globe. ArcGIS World Imagery works
        // directly and gives the same photographic Earth style used by the X1 reference.
        viewer = new Cesium.Viewer(container, {
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          baseLayer: false,
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          shouldAnimate: true,
          scene3DOnly: true,
          creditContainer: creditRef.current ?? undefined,
        });

        viewerRef.current = viewer;

        // Real photographic Earth imagery. If ArcGIS is unavailable, fall back to
        // Cesium's bundled Natural Earth tiles instead of drawing a fake planet.
        try {
          const provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
            { enablePickFeatures: false }
          );
          if (viewer && !viewer.isDestroyed()) {
            viewer.imageryLayers.addImageryProvider(provider);
            if (mountedRef.current) setImageryStatus("arcgis");
          }
        } catch (arcGisError) {
          console.warn("ASTRANET: ArcGIS World Imagery unavailable, using local Natural Earth fallback.", arcGisError);
          try {
            const fallbackProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
              `${window.CESIUM_BASE_URL || "/cesium/"}Assets/Textures/NaturalEarthII`
            );
            if (viewer && !viewer.isDestroyed()) {
              viewer.imageryLayers.addImageryProvider(fallbackProvider);
              if (mountedRef.current) setImageryStatus("fallback");
            }
          } catch (fallbackError) {
            console.error("ASTRANET: no Cesium imagery provider could be loaded.", fallbackError);
            if (mountedRef.current) setImageryStatus("error");
          }
        }

        if (!viewer || viewer.isDestroyed()) return;

        const scene = viewer.scene;
        scene.backgroundColor = Cesium.Color.fromCssColorString("#03070C");
        scene.globe.baseColor = Cesium.Color.fromCssColorString("#07111C");
        scene.globe.enableLighting = true;
        scene.globe.showGroundAtmosphere = true;
        scene.globe.depthTestAgainstTerrain = false;
        scene.highDynamicRange = true;
        scene.fog.enabled = true;
        scene.fog.density = 0.0002;
        scene.sun.show = true;
        scene.moon.show = false;

        if (scene.skyAtmosphere) {
          scene.skyAtmosphere.show = true;
          scene.skyAtmosphere.hueShift = -0.04;
          scene.skyAtmosphere.saturationShift = -0.08;
          scene.skyAtmosphere.brightnessShift = -0.03;
        }

        // Darker, less intrusive default stars/skybox while still keeping depth.
        if (scene.skyBox) scene.skyBox.show = true;

        // X1-like initial framing: complete Earth, India/Asia facing the user,
        // with enough surrounding space for the three orbital planes.
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(78, 21, 17_800_000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        });

        // Keep camera controls natural and predictable.
        scene.screenSpaceCameraController.minimumZoomDistance = 7_200_000;
        scene.screenSpaceCameraController.maximumZoomDistance = 35_000_000;
        scene.screenSpaceCameraController.enableTilt = false;

        // Orbital plane paths.
        ORBITAL_PLANES.forEach((plane, planeIndex) => {
          viewer!.entities.add({
            id: `orbit:${planeIndex}`,
            polyline: {
              positions: fullOrbitPositions(planeIndex),
              width: planeIndex === 1 ? 1.35 : 1,
              material: plane.color,
              arcType: Cesium.ArcType.NONE,
            },
          });
        });

        // 12 moving CubeSat entities, all rendered by Cesium (no overlay canvas).
        satellitesRef.current.forEach((sat) => {
          viewer!.entities.add({
            id: `sat:${sat.id}`,
            position: new Cesium.CallbackPositionProperty(() => getSatellitePosition(
              satellitesRef.current.find((candidate) => candidate.id === sat.id) ?? sat
            ), false),
            billboard: {
              image: satelliteIcon,
              width: 31,
              height: 17,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              scaleByDistance: new Cesium.NearFarScalar(7_000_000, 1.25, 30_000_000, 0.72),
              translucencyByDistance: new Cesium.NearFarScalar(7_000_000, 1, 32_000_000, 0.72),
            },
            point: {
              pixelSize: new Cesium.CallbackProperty(() => {
                const current = satellitesRef.current.find((candidate) => candidate.id === sat.id) ?? sat;
                const selected = selectedRef.current === sat.id;
                const hovered = hoveredRef.current === sat.id;
                const coordinator = current.id === coordinatorId;
                return selected ? 17 : hovered ? 13 : coordinator ? 11 : 5;
              }, false),
              color: new Cesium.CallbackProperty(() => {
                const current = satellitesRef.current.find((candidate) => candidate.id === sat.id) ?? sat;
                return stateColor(current.state).withAlpha(0.22);
              }, false),
              outlineColor: new Cesium.CallbackProperty(() => {
                const current = satellitesRef.current.find((candidate) => candidate.id === sat.id) ?? sat;
                return selectedRef.current === sat.id
                  ? Cesium.Color.fromCssColorString("#84C5F4")
                  : stateColor(current.state).withAlpha(current.id === coordinatorId ? 0.9 : 0.55);
              }, false),
              outlineWidth: new Cesium.CallbackProperty(() => selectedRef.current === sat.id ? 2 : 1, false),
            },
            label: {
              text: new Cesium.CallbackProperty(() => {
                const current = satellitesRef.current.find((candidate) => candidate.id === sat.id) ?? sat;
                return current.id === coordinatorId
                  ? `${current.id}  ·  COORDINATOR`
                  : `${current.id}  ·  ${current.state}`;
              }, false),
              show: new Cesium.CallbackProperty(() => {
                const current = satellitesRef.current.find((candidate) => candidate.id === sat.id) ?? sat;
                return (
                  selectedRef.current === sat.id ||
                  hoveredRef.current === sat.id ||
                  current.id === coordinatorId ||
                  current.state !== "NOMINAL"
                );
              }, false),
              font: "500 12px Inter, system-ui, sans-serif",
              fillColor: Cesium.Color.fromCssColorString("#EAF2F8"),
              outlineColor: Cesium.Color.fromCssColorString("#05080D"),
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(20, -17),
              horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              scaleByDistance: new Cesium.NearFarScalar(7_000_000, 1, 30_000_000, 0.72),
            },
          });
        });

        // Network links are native Cesium polylines and are hidden in the default Orbit view.
        // Generate entities for all satellite pairs and display only those active in backend telemetry.
        const allSats = satellitesRef.current;
        for (let i = 0; i < allSats.length; i++) {
          for (let j = i + 1; j < allSats.length; j++) {
            const aId = allSats[i].id;
            const bId = allSats[j].id;
            viewer!.entities.add({
              id: `link:${aId}-${bId}`,
              show: false,
              polyline: {
                positions: new Cesium.CallbackProperty(() => {
                  const links = activeLinksRef.current;
                  const isActive = links
                    ? links.some(([u, v]) => (u === aId && v === bId) || (u === bId && v === aId))
                    : NETWORK_LINKS.some(([u, v]) => (u === aId && v === bId) || (u === bId && v === aId));

                  if (!isActive) return [];

                  const a = satellitesRef.current.find((sat) => sat.id === aId);
                  const b = satellitesRef.current.find((sat) => sat.id === bId);
                  if (!a || !b) return [];
                  return [getSatellitePosition(a), getSatellitePosition(b)];
                }, false),
                width: 1,
                material: new Cesium.ColorMaterialProperty(
                  Cesium.Color.fromCssColorString("#5C9FD6").withAlpha(0.34)
                ),
                arcType: Cesium.ArcType.NONE,
              },
            });
          }
        }

        // Mission-mode overlay: a restrained observation target over India, not fake continents.
        viewer.entities.add({
          id: "mission:target-india",
          show: false,
          position: Cesium.Cartesian3.fromDegrees(78.5, 22.5, 0),
          ellipse: {
            semiMajorAxis: 1_050_000,
            semiMinorAxis: 720_000,
            material: Cesium.Color.fromCssColorString("#5C9FD6").withAlpha(0.06),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#6CA6D9").withAlpha(0.5),
            height: 0,
          },
          label: {
            text: "EO-01 OBSERVATION REGION",
            font: "500 11px Inter, system-ui, sans-serif",
            fillColor: Cesium.Color.fromCssColorString("#B8D6EA"),
            outlineColor: Cesium.Color.fromCssColorString("#05080D"),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -26),
          },
        });

        handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
          const picked = scene.pick(movement.endPosition);
          const entity = picked?.id as Cesium.Entity | undefined;
          const satId = entity?.id?.startsWith("sat:") ? entity.id.slice(4) : null;
          hoveredRef.current = satId;
          scene.canvas.style.cursor = satId ? "pointer" : "grab";
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
          const picked = scene.pick(movement.position);
          const entity = picked?.id as Cesium.Entity | undefined;
          const satId = entity?.id?.startsWith("sat:") ? entity.id.slice(4) : null;
          if (satId) onSelectSatellite(satId);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Apply current view mode after all entities exist.
        for (const entity of viewer.entities.values) {
          if (entity.id.startsWith("orbit:")) entity.show = viewModeRef.current !== "MISSION";
          if (entity.id.startsWith("link:")) entity.show = viewModeRef.current === "NETWORK";
          if (entity.id.startsWith("mission:")) entity.show = viewModeRef.current === "MISSION";
        }

        if (mountedRef.current) setIsReady(true);
      } catch (error) {
        console.error("ASTRANET: Cesium Viewer failed to initialize.", error);
        if (mountedRef.current) {
          setImageryStatus("error");
          setIsReady(false);
        }
      }
    };

    void init();

    return () => {
      mountedRef.current = false;
      handler?.destroy();
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
  }, [coordinatorId, getSatellitePosition, onSelectSatellite, satelliteIcon]);

  const focusSelected = () => {
    const viewer = viewerRef.current;
    const selected = satellitesRef.current.find((sat) => sat.id === selectedRef.current);
    if (!viewer || !selected) return;

    const position = getSatellitePosition(selected);
    const direction = Cesium.Cartesian3.normalize(position, new Cesium.Cartesian3());
    const destination = Cesium.Cartesian3.multiplyByScalar(direction, EARTH_RADIUS_M + 5_300_000, new Cesium.Cartesian3());

    viewer.camera.flyTo({
      destination,
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 1.15,
    });
  };

  const resetCamera = () => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(78, 21, 17_800_000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 1.1,
    });
  };

  const zoom = (amount: number) => {
    const camera = viewerRef.current?.camera;
    if (!camera) return;
    if (amount > 0) camera.zoomIn(amount);
    else camera.zoomOut(Math.abs(amount));
  };

  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#03070C] overflow-hidden select-none">
      {/* The actual Cesium canvas. There is deliberately NO second/fallback Earth canvas. */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Imagery/engine status — only visible while loading or if the photographic tiles fail. */}
      {!isReady && (
        <div className="absolute inset-0 z-20 grid place-items-center pointer-events-none bg-[#03070C]">
          <div className="text-center">
            <div className="w-5 h-5 mx-auto mb-3 rounded-full border border-[#5C9FD6]/30 border-t-[#5C9FD6] animate-spin" />
            <p className="text-xs text-[#7F8C9A]">Initializing Cesium Earth…</p>
          </div>
        </div>
      )}

      {isReady && imageryStatus === "fallback" && (
        <div className="absolute left-5 bottom-5 z-20 px-2.5 py-1.5 rounded-md bg-[#080D15]/85 border border-white/10 text-[10px] text-[#AAB7C4] pointer-events-none">
          Local Earth imagery · ArcGIS temporarily unavailable
        </div>
      )}

      {imageryStatus === "error" && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#03070C]/95 p-8">
          <div className="max-w-md text-center">
            <p className="text-sm font-medium text-[#F3F6F8]">Cesium Earth could not load</p>
            <p className="mt-2 text-xs leading-5 text-[#7F8C9A]">
              Check the browser console and requests under /cesium/. ASTRANET will not draw a fake replacement globe.
            </p>
          </div>
        </div>
      )}

      {/* Compact mission context. */}
      <div className="absolute top-6 left-6 z-20 pointer-events-none rounded-xl border border-white/[0.07] bg-[#05080D]/72 backdrop-blur-md px-4 py-3 shadow-2xl shadow-black/20">
        <div className="space-y-1.5 text-xs font-sans">
          <div className="flex items-center gap-3">
            <span className="w-20 text-[11px] text-[#7F8C9A]">Mission</span>
            <span className="text-white font-medium">EO-01</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-20 text-[11px] text-[#7F8C9A]">State</span>
            <span className="text-[#10B981] font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> Nominal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-20 text-[11px] text-[#7F8C9A]">Swarm</span>
            <span className="text-white font-medium">12 / 12</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-20 text-[11px] text-[#7F8C9A]">Coordinator</span>
            <span className="text-[#75AFE0] font-medium">{coordinatorId}</span>
          </div>
          <div className="pt-1 text-[11px] text-[#7F8C9A] tabular-nums">T+ {missionTime}</div>
        </div>
      </div>

      {/* Orbit / Network / Mission — one visualization at a time. */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
        <div className="flex p-1 rounded-lg border border-white/[0.08] bg-[#080D15]/78 backdrop-blur-md">
          {(["ORBIT", "NETWORK", "MISSION"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-md text-[11px] transition-colors ${
                viewMode === mode
                  ? "bg-white/[0.10] text-white"
                  : "text-[#7F8C9A] hover:text-[#D9E4EC]"
              }`}
            >
              {mode[0] + mode.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex p-1 rounded-lg border border-white/[0.08] bg-[#080D15]/78 backdrop-blur-md">
          <button onClick={focusSelected} title="Focus selected satellite" className="p-2 text-[#8A98A6] hover:text-white transition-colors"><Focus className="w-4 h-4" /></button>
          <button onClick={resetCamera} title="Reset Earth view" className="p-2 text-[#8A98A6] hover:text-white transition-colors"><RotateCcw className="w-4 h-4" /></button>
          <button onClick={() => zoom(1_000_000)} title="Zoom in" className="p-2 text-[#8A98A6] hover:text-white transition-colors"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => zoom(-1_000_000)} title="Zoom out" className="p-2 text-[#8A98A6] hover:text-white transition-colors"><ZoomOut className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Small plane legend, visually secondary to Earth. */}
      <div className="absolute left-6 bottom-6 z-20 flex items-center gap-5 rounded-lg border border-white/[0.07] bg-[#05080D]/68 backdrop-blur-md px-3 py-2 text-[10px] text-[#8A98A6] pointer-events-none">
        {ORBITAL_PLANES.map((plane) => (
          <span key={plane.name} className="flex items-center gap-2">
            <span className="w-4 h-px bg-[#6CA6D9]/70" />
            {plane.name} ({plane.inclinationDeg}°)
          </span>
        ))}
      </div>

      {/* Cesium / ArcGIS attribution is kept visible but unobtrusive. */}
      <div ref={creditRef} className="absolute right-5 bottom-4 z-20 max-w-[48%] text-[9px] opacity-45 hover:opacity-80 transition-opacity" />
    </div>
  );
}

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}
