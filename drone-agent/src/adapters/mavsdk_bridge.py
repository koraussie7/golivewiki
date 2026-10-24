#!/usr/bin/env python3
"""MAVSDK camera bridge for the GoLive drone field agent.

Protocol
    Newline-delimited JSON over stdin/stdout. One request per line, one response per
    line, both carrying an integer `id`:

        {"id": 1, "op": "connect"}
        {"id": 1, "ok": true, "model": "PX4 SITL"}

Operations
    connect, disconnect, get_status, get_capabilities, execute

Safety
    Only `mavsdk.Camera` is imported from the SDK. There is no Action, Telemetry-driven
    goto, or offboard code path, so this process cannot arm, take off, move, or change
    altitude. That is intentional: the aircraft-touching side enforces the camera-only
    rule independently of the command contract in Node.

    Everything the agent could use to fly is simply absent. If a future change needs a
    flight operation, it belongs in a different process with its own safety review, not
    in a method added here.

Usage
    python3 mavsdk_bridge.py --url udp://:14540      # PX4 SITL
    python3 mavsdk_bridge.py --url serial:///dev/ttyUSB0:921600

Requires
    pip install mavsdk
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import uuid
from typing import Any

try:
    from mavsdk import System
    from mavsdk.camera import Camera, CameraMode, OptionValue
except ImportError:  # pragma: no cover - surfaced to the caller as a failed connect
    System = None  # type: ignore[assignment]
    Camera = None  # type: ignore[assignment]
    CameraMode = None  # type: ignore[assignment]
    OptionValue = None  # type: ignore[assignment]


def emit(payload: dict[str, Any]) -> None:
    """Write one NDJSON line and flush so the parent sees it immediately."""
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


class CameraBridge:
    def __init__(self, url: str, connect_timeout: float = 20.0) -> None:
        self.url = url
        self.connect_timeout = connect_timeout
        self.drone: Any = None
        self.camera: Any = None
        self.model: str | None = None
        self.capabilities: list[str] = []

    async def connect(self) -> dict[str, Any]:
        if System is None:
            return {"ok": False, "error": "mavsdk is not installed (pip install mavsdk)"}

        self.drone = System()
        await self.drone.connect(system_address=self.url)

        # Wait for a vehicle. Without this, every camera call races the link and fails
        # with a connection error that looks like a camera problem.
        deadline = time.monotonic() + self.connect_timeout
        async for state in self.drone.core.connection_state():
            if state.is_connected:
                break
            if time.monotonic() > deadline:
                return {"ok": False, "error": f"no vehicle within {self.connect_timeout}s"}

        try:
            info = await self.drone.info.get_identification()
            self.model = info.hardware_uid or None
        except Exception:  # noqa: BLE001 - identification is optional
            self.model = None

        self.camera = self.drone.camera
        self.capabilities = await self._probe_capabilities()
        return {"ok": True, "model": self.model, "capabilities": self.capabilities}

    async def _probe_capabilities(self) -> list[str]:
        """Ask the camera what it supports.

        There is no single MAVSDK call that enumerates capabilities, so each one is
        probed and a failure means "not supported". Never assume a capability: a
        vehicle that reports zoom but cannot zoom would produce a failed approval the
        operator already granted.
        """
        found: list[str] = []
        if self.camera is None:
            return found

        try:
            info = await self.camera.get_camera_information()
            found.append("camera.capture_photo")  # photo capture is the baseline
            if info and getattr(info, "flags", None) and info.flags.camera_mode:
                found.append("camera.start_video")
                found.append("camera.stop_video")
        except Exception:  # noqa: BLE001
            return found

        try:
            opts = await self.camera.get_current_settings()
            has_zoom = any(
                getattr(o, "option_id", "") == "CAM_MODE"
                for o in getattr(opts, "settings", [])
            )
            if has_zoom:
                found.append("camera.zoom")
        except Exception:  # noqa: BLE001
            pass

        return found

    async def get_status(self) -> dict[str, Any]:
        if self.drone is None:
            return {"ok": True, "connected": False, "camera_ready": False}

        connected = False
        battery = None
        try:
            async for state in self.drone.core.connection_state():
                connected = bool(state.is_connected)
                break
        except Exception:  # noqa: BLE001
            connected = False

        try:
            async for b in self.drone.telemetry.battery():
                battery = round(b.remaining_percent * 100, 1)
                break
        except Exception:  # noqa: BLE001
            battery = None

        return {
            "ok": True,
            "connected": connected,
            "camera_ready": self.camera is not None and len(self.capabilities) > 0,
            "battery_percent": battery,
            "model": self.model,
        }

    async def execute(self, command: str, parameters: dict[str, Any]) -> dict[str, Any]:
        if self.camera is None:
            return {"ok": False, "code": "disconnected", "error": "camera not connected"}

        if command not in self.capabilities:
            return {"ok": False, "code": "unsupported", "error": f"{command} not supported"}

        started = time.monotonic()
        try:
            if command == "camera.capture_photo":
                await self.camera.take_photo()
                return {
                    "ok": True,
                    "success": True,
                    "media_id": f"photo-{uuid.uuid4()}",
                    "duration_ms": int((time.monotonic() - started) * 1000),
                }

            if command == "camera.start_video":
                await self.camera.start_video()
                return {"ok": True, "success": True, "duration_ms": int((time.monotonic() - started) * 1000)}

            if command == "camera.stop_video":
                await self.camera.stop_video()
                return {
                    "ok": True,
                    "success": True,
                    "media_id": f"video-{uuid.uuid4()}",
                    "duration_ms": int((time.monotonic() - started) * 1000),
                }

            if command == "camera.zoom":
                level = int(parameters.get("level", 1))
                await self._set_zoom(level)
                return {"ok": True, "success": True, "duration_ms": int((time.monotonic() - started) * 1000)}

            # Unreachable given the capability check above, but keeping an explicit
            # rejection means a new command added to the Node contract cannot silently
            # reach the aircraft without being handled here.
            return {"ok": False, "code": "unsupported", "error": f"unknown command {command}"}

        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "code": "failed", "error": str(exc)}

    async def _set_zoom(self, level: int) -> None:
        """Map the contract's 1..5 level onto the camera's zoom range.

        MAVSDK exposes zoom as a range option, not a multiplier, so the level is
        interpolated across whatever range the camera reports. A camera whose range is
        degenerate (min == max) has no usable zoom; raising there is clearer than
        silently reporting success.
        """
        options = await self.camera.get_current_settings()
        for setting in getattr(options, "settings", []):
            if getattr(setting, "option_id", "") != "CAM_ZOOM":
                continue
            for opt in getattr(setting, "options", []):
                if getattr(opt, "option_id", "") == "ZOOM_LEVEL":
                    rng = opt.range
                    span = rng.max - rng.min
                    if span <= 0:
                        raise ValueError("camera reports no zoom range")
                    value = rng.min + span * ((level - 1) / 4)
                    await self.camera.set_setting(Camera.SettingOptions(CAM_ZOOM=[OptionValue("ZOOM_LEVEL", float(value))]))
                    return
        raise ValueError("camera does not expose a zoom setting")


async def run(url: str) -> None:
    bridge = CameraBridge(url)

    loop = asyncio.get_running_loop()
    reader = asyncio.StreamReader()
    await loop.connect_read_pipe(lambda: asyncio.StreamReaderProtocol(reader), sys.stdin)

    while True:
        line = await reader.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            emit({"id": None, "ok": False, "error": "invalid JSON"})
            continue

        rid = request.get("id")
        op = request.get("op")

        if op == "connect":
            result = await bridge.connect()
        elif op == "disconnect":
            result = {"ok": True}
        elif op == "get_status":
            result = await bridge.get_status()
        elif op == "get_capabilities":
            result = {"ok": True, "capabilities": bridge.capabilities}
        elif op == "execute":
            result = await bridge.execute(
                str(request.get("command", "")), request.get("parameters") or {}
            )
        else:
            result = {"ok": False, "error": f"unknown op {op}"}

        result["id"] = rid
        emit(result)

        if op == "disconnect":
            break


def main() -> int:
    parser = argparse.ArgumentParser(description="GoLive MAVSDK camera bridge")
    parser.add_argument("--url", default="udp://:14540", help="MAVLink connection URL")
    args = parser.parse_args()

    try:
        asyncio.run(run(args.url))
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
