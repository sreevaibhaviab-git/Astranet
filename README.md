# ASTRANET

## Autonomous Self-Healing CubeSat Swarm

ASTRANET is a research-oriented mission-resilience platform for autonomous CubeSat swarms.

Instead of treating a spacecraft as simply alive or failed, ASTRANET reasons about which capability was lost, how that failure affects the mission, what resources remain across the swarm, and which recovery strategy best preserves both current mission performance and future survivability.

**ASTRANET chooses the best future for the swarm, not just the fastest fix for the current failure.**

## Current Demonstrator

- 12 CubeSats
- 3 orbital planes
- Earth Observation + inter-satellite relay mission
- Real CesiumJS Earth
- Satellite selection and telemetry
- Subsystem health monitoring
- Fault injection interface
- Interactive 3D CubeSat inspector
- Clickable spacecraft components
- Autonomous recovery architecture

## Core Pipeline

Observe → Suspect → Verify → Diagnose → Assess Mission Impact → Generate Recovery Futures → Simulate → Stress-Test → Rank → Explain → Execute → Learn

## Technology Stack

Frontend: React, TypeScript, Vite, CesiumJS, Three.js, Tailwind CSS

Backend: Python, FastAPI, WebSockets, NumPy, SciPy, NetworkX, SGP4 and Basilisk where appropriate

## Team — Ctrl Freaks

- Vaibhavi — Mission Control UI, visualization and integration
- Hari — Simulation and digital-twin backend
- Zahid — Autonomy, resilience and recovery engine
- Rits — Scenario integration, validation and QA

## Branches

- main — stable integration
- vaibhavi — frontend
- hari — simulation
- zahid — autonomy and recovery
- rits — scenarios and validation

## Run Locally

    npm install --legacy-peer-deps
    npm run dev

## Project Status

**Frontend Base v0.1 complete.**

ASTRANET is currently a research-grade simulation and mission-resilience demonstrator. The CubeSats displayed in the application are simulated spacecraft unless explicitly stated otherwise.
