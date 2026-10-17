"""ASTRANET — Orbital Mechanics and Propagation Module.

Implements two-body Keplerian orbital propagation with extensible J2 perturbation
support, deterministic coordinate transformations between perifocal, ECI
(Earth-Centered Inertial), and geographic (Latitude, Longitude, Altitude) frames.

Coordinate System:
    Frame: Earth-Centered Inertial (ECI / J2000-aligned)
    Origin: Center of mass of the Earth
    +X: Vernal Equinox
    +Z: Earth rotational axis (North)
    +Y: Completes right-handed orthogonal frame (+Z x +X)

Units:
    Position: meters (m) internally; kilometers (km) in exported telemetry
    Velocity: meters per second (m/s) internally; km/s in exported telemetry
    Angles: radians internally; degrees in constructors/exports
    Time: seconds (s)
"""

from dataclasses import dataclass
from typing import Dict, Any, Tuple, Optional
import math
import numpy as np


# Physical and Geodetic Constants (WGS84 / IERS)
MU_EARTH: float = 3.986004418e14  # Standard gravitational parameter (m^3/s^2)
EARTH_RADIUS_M: float = 6378137.0  # Equatorial radius (m)
EARTH_ROTATION_RATE_RAD_S: float = 7.2921159e-5  # Earth rotation rate (rad/s)
J2_PERTURBATION: float = 1.08262668e-3  # Second zonal harmonic coefficient (dimensionless)
DEFAULT_ORBIT_ALTITUDE_M: float = 550000.0  # Baseline CubeSat altitude (550 km)


@dataclass(frozen=True)
class OrbitalPlane:
    """Configuration for an orbital plane in the constellation."""
    name: str
    plane_index: int
    inclination_deg: float
    raan_deg: float

    @property
    def inclination_rad(self) -> float:
        return math.radians(self.inclination_deg)

    @property
    def raan_rad(self) -> float:
        return math.radians(self.raan_deg)


@dataclass
class OrbitState:
    """State vector of a spacecraft in ECI and geographic coordinates at a given epoch."""
    time_sec: float
    r_eci: np.ndarray  # [x, y, z] in meters
    v_eci: np.ndarray  # [vx, vy, vz] in meters/second

    @property
    def radius_m(self) -> float:
        """Geocentric distance in meters."""
        return float(np.linalg.norm(self.r_eci))

    @property
    def radius_km(self) -> float:
        """Geocentric distance in kilometers."""
        return self.radius_m / 1000.0

    @property
    def altitude_km(self) -> float:
        """Geometric altitude above mean spherical Earth in kilometers."""
        return (self.radius_m - EARTH_RADIUS_M) / 1000.0

    @property
    def speed_m_s(self) -> float:
        """Instantaneous inertial orbital speed in meters/second."""
        return float(np.linalg.norm(self.v_eci))

    @property
    def speed_km_s(self) -> float:
        """Instantaneous inertial orbital speed in kilometers/second."""
        return self.speed_m_s / 1000.0

    @property
    def x_km(self) -> float:
        return float(self.r_eci[0]) / 1000.0

    @property
    def y_km(self) -> float:
        return float(self.r_eci[1]) / 1000.0

    @property
    def z_km(self) -> float:
        return float(self.r_eci[2]) / 1000.0

    @property
    def vx_km_s(self) -> float:
        return float(self.v_eci[0]) / 1000.0

    @property
    def vy_km_s(self) -> float:
        return float(self.v_eci[1]) / 1000.0

    @property
    def vz_km_s(self) -> float:
        return float(self.v_eci[2]) / 1000.0

    def to_geographic(self, gmst_offset_rad: float = 0.0) -> Tuple[float, float, float]:
        """Convert ECI position to spherical geographic coordinates.

        Args:
            gmst_offset_rad: Initial Greenwich Mean Sidereal Time offset at t=0.

        Returns:
            Tuple of (latitude_deg, longitude_deg, altitude_km).
        """
        r = self.radius_m
        if r < 1.0:
            return 0.0, 0.0, 0.0

        # Geocentric latitude
        lat_rad = math.asin(np.clip(self.r_eci[2] / r, -1.0, 1.0))

        # Right ascension
        ra_rad = math.atan2(self.r_eci[1], self.r_eci[0])

        # Earth rotation angle since t=0
        earth_angle = (gmst_offset_rad + EARTH_ROTATION_RATE_RAD_S * self.time_sec) % (2.0 * math.pi)

        # Geographic longitude
        lon_rad = (ra_rad - earth_angle) % (2.0 * math.pi)
        if lon_rad > math.pi:
            lon_rad -= 2.0 * math.pi

        return math.degrees(lat_rad), math.degrees(lon_rad), self.altitude_km

    def to_dict(self) -> Dict[str, Any]:
        """Serialize state vector to dictionary format."""
        lat, lon, alt = self.to_geographic()
        return {
            "position": {
                "x": round(self.x_km, 3),
                "y": round(self.y_km, 3),
                "z": round(self.z_km, 3),
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "altKm": round(alt, 2),
            },
            "velocity": {
                "vx": round(self.vx_km_s, 4),
                "vy": round(self.vy_km_s, 4),
                "vz": round(self.vz_km_s, 4),
                "speedKmS": round(self.speed_km_s, 4),
            },
        }


class KeplerianOrbit:
    """Propagates two-body Keplerian orbits with optional J2 secular perturbations.

    Configured via classical Keplerian orbital elements:
        a: Semi-major axis (meters)
        e: Eccentricity (dimensionless, 0 <= e < 1)
        i: Inclination (radians)
        raan: Right Ascension of Ascending Node (radians)
        arg_perigee: Argument of perigee (radians)
        true_anomaly_0: True anomaly at t=0 (radians)
    """

    def __init__(
        self,
        semi_major_axis_m: float = EARTH_RADIUS_M + DEFAULT_ORBIT_ALTITUDE_M,
        eccentricity: float = 0.0,
        inclination_deg: float = 48.0,
        raan_deg: float = 0.0,
        arg_perigee_deg: float = 0.0,
        initial_phase_deg: float = 0.0,
        enable_j2: bool = False,
    ) -> None:
        """Initialize Keplerian orbit propagator.

        Args:
            semi_major_axis_m: Semi-major axis in meters (must be > Earth radius).
            eccentricity: Orbital eccentricity (0.0 for circular).
            inclination_deg: Orbital inclination in degrees.
            raan_deg: Right Ascension of Ascending Node in degrees.
            arg_perigee_deg: Argument of perigee in degrees.
            initial_phase_deg: Initial mean/true anomaly phase angle at t=0 in degrees.
            enable_j2: Whether to include secular J2 nodal regression and perigee precession.
        """
        if semi_major_axis_m <= EARTH_RADIUS_M:
            raise ValueError(
                f"Semi-major axis must exceed Earth radius ({EARTH_RADIUS_M} m), got {semi_major_axis_m} m"
            )
        if not (0.0 <= eccentricity < 1.0):
            raise ValueError(f"Eccentricity must be in range [0, 1), got {eccentricity}")

        self._a: float = float(semi_major_axis_m)
        self._e: float = float(eccentricity)
        self._inc: float = math.radians(inclination_deg)
        self._raan_0: float = math.radians(raan_deg)
        self._arg_p_0: float = math.radians(arg_perigee_deg)
        self._phase_0: float = math.radians(initial_phase_deg)
        self._enable_j2: bool = enable_j2

        # Derived two-body orbital constants
        self._mean_motion: float = math.sqrt(MU_EARTH / (self._a ** 3))
        self._period_sec: float = 2.0 * math.pi / self._mean_motion

        # J2 Secular Drift Rates (rad/s)
        p = self._a * (1.0 - self._e ** 2)
        factor = 1.5 * J2_PERTURBATION * ((EARTH_RADIUS_M / p) ** 2) * self._mean_motion
        self._raan_dot_j2: float = -factor * math.cos(self._inc)
        self._arg_p_dot_j2: float = 0.5 * factor * (5.0 * (math.cos(self._inc) ** 2) - 1.0)

    @property
    def semi_major_axis_m(self) -> float:
        return self._a

    @property
    def altitude_km(self) -> float:
        """Nominal altitude in kilometers."""
        return (self._a - EARTH_RADIUS_M) / 1000.0

    @property
    def eccentricity(self) -> float:
        return self._e

    @property
    def inclination_deg(self) -> float:
        return math.degrees(self._inc)

    @property
    def raan_deg(self) -> float:
        return math.degrees(self._raan_0)

    @property
    def period_seconds(self) -> float:
        """Orbital period in seconds."""
        return self._period_sec

    @property
    def period_minutes(self) -> float:
        """Orbital period in minutes."""
        return self._period_sec / 60.0

    @property
    def mean_motion_rad_s(self) -> float:
        """Orbital mean motion in radians/second."""
        return self._mean_motion

    @property
    def nominal_speed_m_s(self) -> float:
        """Circular orbital speed in meters/second."""
        return math.sqrt(MU_EARTH / self._a)

    def _solve_kepler(self, mean_anomaly: float) -> float:
        """Solve Kepler's equation M = E - e*sin(E) for Eccentric Anomaly E."""
        m = mean_anomaly % (2.0 * math.pi)
        if self._e < 1e-12:
            return m

        # Initial guess
        e_curr = m + self._e * math.sin(m)
        for _ in range(15):
            f = e_curr - self._e * math.sin(e_curr) - m
            f_prime = 1.0 - self._e * math.cos(e_curr)
            delta = f / f_prime
            e_curr -= delta
            if abs(delta) < 1e-12:
                break
        return e_curr

    def propagate(self, elapsed_sec: float) -> OrbitState:
        """Compute the ECI position and velocity state vector at a given elapsed time.

        Args:
            elapsed_sec: Time in seconds since initial epoch t=0.

        Returns:
            OrbitState instance with position and velocity in ECI meters and m/s.
        """
        t = float(elapsed_sec)

        # Evaluate RAAN and Argument of Perigee with optional J2 secular drift
        if self._enable_j2:
            raan = (self._raan_0 + self._raan_dot_j2 * t) % (2.0 * math.pi)
            arg_p = (self._arg_p_0 + self._arg_p_dot_j2 * t) % (2.0 * math.pi)
        else:
            raan = self._raan_0
            arg_p = self._arg_p_0

        # Mean anomaly at time t
        mean_anomaly = self._phase_0 + self._mean_motion * t

        if self._e < 1e-12:
            # High-performance closed-form circular propagation
            u = (arg_p + mean_anomaly) % (2.0 * math.pi)
            r = self._a
            v = self.nominal_speed_m_s

            cos_raan = math.cos(raan)
            sin_raan = math.sin(raan)
            cos_inc = math.cos(self._inc)
            sin_inc = math.sin(self._inc)
            cos_u = math.cos(u)
            sin_u = math.sin(u)

            # ECI Position (m)
            x = r * (cos_raan * cos_u - sin_raan * sin_u * cos_inc)
            y = r * (sin_raan * cos_u + cos_raan * sin_u * cos_inc)
            z = r * (sin_u * sin_inc)

            # ECI Velocity (m/s)
            vx = v * (-cos_raan * sin_u - sin_raan * cos_u * cos_inc)
            vy = v * (-sin_raan * sin_u + cos_raan * cos_u * cos_inc)
            vz = v * (cos_u * sin_inc)

        else:
            # General Keplerian orbit propagation
            ecc_anomaly = self._solve_kepler(mean_anomaly)
            sin_e = math.sin(ecc_anomaly)
            cos_e = math.cos(ecc_anomaly)

            r = self._a * (1.0 - self._e * cos_e)
            true_anomaly = 2.0 * math.atan2(
                math.sqrt(1.0 + self._e) * math.sin(ecc_anomaly / 2.0),
                math.sqrt(1.0 - self._e) * math.cos(ecc_anomaly / 2.0),
            )
            u = (arg_p + true_anomaly) % (2.0 * math.pi)

            # Velocity components in orbital perifocal plane
            p = self._a * (1.0 - self._e ** 2)
            v_const = math.sqrt(MU_EARTH / p)
            vr = v_const * self._e * math.sin(true_anomaly)
            vt = v_const * (1.0 + self._e * math.cos(true_anomaly))

            # Transform perifocal to ECI
            cos_raan = math.cos(raan)
            sin_raan = math.sin(raan)
            cos_inc = math.cos(self._inc)
            sin_inc = math.sin(self._inc)
            cos_u = math.cos(u)
            sin_u = math.sin(u)

            x = r * (cos_raan * cos_u - sin_raan * sin_u * cos_inc)
            y = r * (sin_raan * cos_u + cos_raan * sin_u * cos_inc)
            z = r * (sin_u * sin_inc)

            # Direction unit vectors in radial and transverse directions
            r_hat = np.array([
                cos_raan * cos_u - sin_raan * sin_u * cos_inc,
                sin_raan * cos_u + cos_raan * sin_u * cos_inc,
                sin_u * sin_inc,
            ])
            t_hat = np.array([
                -cos_raan * sin_u - sin_raan * cos_u * cos_inc,
                -sin_raan * sin_u + cos_raan * cos_u * cos_inc,
                cos_u * sin_inc,
            ])
            v_vec = vr * r_hat + vt * t_hat
            vx, vy, vz = float(v_vec[0]), float(v_vec[1]), float(v_vec[2])

        return OrbitState(
            time_sec=t,
            r_eci=np.array([x, y, z], dtype=np.float64),
            v_eci=np.array([vx, vy, vz], dtype=np.float64),
        )
