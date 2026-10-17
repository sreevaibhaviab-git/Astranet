"""ASTRANET — Dynamic Inter-Satellite Communication Network Module.

Builds and dynamically updates an undirected graph of inter-satellite communication
links (ISL) based on:
1. True Euclidean separation between spacecraft in ECI coordinates.
2. Configurable maximum RF communication range.
3. Geometric Earth line-of-sight (LOS) occlusion testing.
4. Subsystem health and satellite operational status.

Units:
    Distances: meters (m) internally; kilometers (km) in telemetry exports.
    Speeds: meters per second (m/s).
    Speed of light c: 299,792,458 m/s (for theoretical latency estimation).
"""

from typing import List, Tuple, Dict, Any, Set, Optional
import math
import numpy as np
import networkx as nx

from backend.app.core.orbit import EARTH_RADIUS_M
from backend.app.core.satellite import CubeSat, SatelliteState, SubsystemStatus


# Physical Constants
SPEED_OF_LIGHT_M_S: float = 299_792_458.0  # Speed of light in vacuum (m/s)

# Default Maximum Inter-Satellite Communication Range
# Note: In real CubeSat missions with patch or diplexer antennas, ISL ranges typically
# span 1,000 to 5,000 km. We default to 5,000 km (configurable).
DEFAULT_MAX_ISL_RANGE_M: float = 5_000_000.0  # 5,000 km in meters

# Optional atmospheric absorption/refraction buffer around spherical Earth
DEFAULT_ATMOSPHERIC_BUFFER_M: float = 20_000.0  # 20 km grazing altitude buffer


def compute_euclidean_distance(pos_a: np.ndarray, pos_b: np.ndarray) -> float:
    """Calculate Euclidean distance between two ECI position vectors in meters."""
    return float(np.linalg.norm(pos_b - pos_a))


def check_earth_line_of_sight(
    pos_a: np.ndarray,
    pos_b: np.ndarray,
    earth_radius_m: float = EARTH_RADIUS_M,
    atmosphere_buffer_m: float = DEFAULT_ATMOSPHERIC_BUFFER_M,
) -> Tuple[bool, float]:
    """Test whether the straight line segment between two spacecraft intersects Earth.

    Computes the minimum distance from the center of Earth (origin [0, 0, 0])
    to the finite line segment connecting pos_a and pos_b.

    Args:
        pos_a: ECI position vector of satellite A [x, y, z] in meters.
        pos_b: ECI position vector of satellite B [x, y, z] in meters.
        earth_radius_m: Physical radius of spherical Earth in meters.
        atmosphere_buffer_m: Grazing altitude buffer in meters.

    Returns:
        Tuple of (has_line_of_sight: bool, min_distance_to_earth_center_m: float).
    """
    d_vec = pos_b - pos_a
    d_mag_sq = float(np.dot(d_vec, d_vec))

    # Identical position edge-case
    if d_mag_sq < 1e-6:
        r = float(np.linalg.norm(pos_a))
        return (r > (earth_radius_m + atmosphere_buffer_m)), r

    # Parameter t* on infinite line closest to origin [0, 0, 0]:
    # r(t) = pos_a + t * d_vec
    # d/dt |r(t)|^2 = 2 * (pos_a + t * d_vec) . d_vec = 0
    t_star = -float(np.dot(pos_a, d_vec)) / d_mag_sq

    # Clamp t to the finite line segment [0, 1]
    t_clamped = max(0.0, min(1.0, t_star))

    # Closest point on the finite segment to Earth center
    closest_point = pos_a + t_clamped * d_vec
    min_dist_to_center = float(np.linalg.norm(closest_point))

    occlusion_radius = earth_radius_m + atmosphere_buffer_m
    has_los = min_dist_to_center > occlusion_radius

    return has_los, min_dist_to_center


def is_satellite_eligible_for_isl(satellite: CubeSat) -> bool:
    """Check if a satellite is functionally capable of maintaining inter-satellite links.

    A satellite cannot communicate if:
    - Its overall state is FAILED or ISOLATED.
    - Its communications subsystem is FAILED.
    - Its relay capability has been explicitly disabled.
    """
    if satellite.state in (SatelliteState.FAILED, SatelliteState.ISOLATED):
        return False
    if satellite.subsystems.communications == SubsystemStatus.FAILED:
        return False
    if not satellite.capabilities.relay:
        return False
    return True


class NetworkTopology:
    """Maintains and evaluates the dynamic inter-satellite communication graph."""

    def __init__(
        self,
        max_range_m: float = DEFAULT_MAX_ISL_RANGE_M,
        earth_radius_m: float = EARTH_RADIUS_M,
        atmosphere_buffer_m: float = DEFAULT_ATMOSPHERIC_BUFFER_M,
    ) -> None:
        """Initialize the network topology engine.

        Args:
            max_range_m: Maximum direct RF link range in meters (configurable).
            earth_radius_m: Earth radius convention in meters.
            atmosphere_buffer_m: Minimum grazing altitude for unobstructed RF line of sight.
        """
        self.max_range_m: float = float(max_range_m)
        self.earth_radius_m: float = float(earth_radius_m)
        self.atmosphere_buffer_m: float = float(atmosphere_buffer_m)
        self._graph: nx.Graph = nx.Graph()

    @property
    def graph(self) -> nx.Graph:
        """Underlying NetworkX undirected graph instance."""
        return self._graph

    @property
    def active_link_count(self) -> int:
        """Number of active bidirectional communication links."""
        return self._graph.number_of_edges()

    @property
    def node_count(self) -> int:
        """Total number of nodes registered in the network graph."""
        return self._graph.number_of_nodes()

    def update(self, satellites: List[CubeSat]) -> None:
        """Recompute all nodes and edges from current satellite positions and health states.

        Args:
            satellites: List of all CubeSat agent instances in the constellation.
        """
        self._graph.clear()

        # 1. Register all satellites as graph nodes
        for sat in satellites:
            eligible = is_satellite_eligible_for_isl(sat)
            self._graph.add_node(
                sat.id,
                name=sat.name,
                plane=sat.plane,
                role=sat.role.value,
                state=sat.state.value,
                eligible=eligible,
            )

        # 2. Evaluate all pairwise candidate edges (O(N^2) where N=12 is lightweight)
        n = len(satellites)
        for i in range(n):
            sat_a = satellites[i]
            if not is_satellite_eligible_for_isl(sat_a):
                continue

            pos_a = sat_a.position_eci_m

            for j in range(i + 1, n):
                sat_b = satellites[j]
                if not is_satellite_eligible_for_isl(sat_b):
                    continue

                pos_b = sat_b.position_eci_m

                # Condition 1: Euclidean Distance within max range
                dist_m = compute_euclidean_distance(pos_a, pos_b)
                if dist_m > self.max_range_m:
                    continue

                # Condition 2: Clear geometric Earth Line-of-Sight
                has_los, min_clearance_m = check_earth_line_of_sight(
                    pos_a, pos_b, self.earth_radius_m, self.atmosphere_buffer_m
                )
                if not has_los:
                    continue

                # Theoretical speed-of-light one-way latency (ms)
                latency_ms = (dist_m / SPEED_OF_LIGHT_M_S) * 1000.0

                self._graph.add_edge(
                    sat_a.id,
                    sat_b.id,
                    distance_m=dist_m,
                    distance_km=round(dist_m / 1000.0, 2),
                    latency_ms=round(latency_ms, 2),
                    min_clearance_km=round(min_clearance_m / 1000.0, 2),
                )

    def get_active_links(self) -> List[Tuple[str, str]]:
        """Return a sorted list of all active edge pairs [("SAT-01", "SAT-02"), ...]."""
        links: List[Tuple[str, str]] = []
        for u, v in self._graph.edges():
            pair = (u, v) if u < v else (v, u)
            links.append(pair)
        return sorted(links)

    def get_neighbor_count(self, satellite_id: str) -> int:
        """Return the number of active communication links for a specific satellite."""
        if satellite_id in self._graph:
            return int(self._graph.degree(satellite_id))
        return 0

    def get_neighbor_counts(self) -> Dict[str, int]:
        """Return a dictionary of satellite_id -> degree for all nodes."""
        return {node: int(deg) for node, deg in self._graph.degree()}

    def get_connected_components(self) -> List[Set[str]]:
        """Return list of connected component node sets."""
        if self._graph.number_of_nodes() == 0:
            return []
        return [c for c in nx.connected_components(self._graph)]

    def partition_count(self) -> int:
        """Return the number of disconnected subgraphs/partitions."""
        if self._graph.number_of_nodes() == 0:
            return 0
        return int(nx.number_connected_components(self._graph))

    def is_connected(self) -> bool:
        """Whether the entire network forms a single connected component."""
        if self._graph.number_of_nodes() == 0:
            return False
        return bool(nx.is_connected(self._graph))

    def average_latency_ms(self) -> float:
        """Calculate mean one-way propagation latency across all active links."""
        if self._graph.number_of_edges() == 0:
            return 0.0
        latencies = [d["latency_ms"] for _, _, d in self._graph.edges(data=True)]
        return float(np.mean(latencies))

    def to_dict(self) -> Dict[str, Any]:
        """Export network topology summary metrics for telemetry frames."""
        return {
            "activeLinks": self.active_link_count,
            "connected": self.is_connected(),
            "partitionCount": self.partition_count(),
            "averageLatencyMs": round(self.average_latency_ms(), 2),
            "maxRangeKm": round(self.max_range_m / 1000.0, 1),
        }
