# GoLive Drone Field Agent — integration boundary

This repository now contains the React UI, a Supabase schema/RLS migration and a browser client adapter. It **does not** contain an executable MAVSDK process, a DJI Android/iOS app, a registered vehicle, field credentials, or a running MediaMTX server. The browser is not a vehicle driver.

## Adapter contract

An on-site agent must implement the same camera-only contract using separate vendor adapters:

```text
getCapabilities() -> capability list
getStatus() -> connection and camera status
capturePhoto() -> media result
startVideo() / stopVideo() -> camera recording result
setZoom(level) -> result, only when reported as supported
```

- MAVLink: implement with MAVSDK Camera against a specific supported camera; test in SITL first.
- DJI: implement separately in an approved Android/iOS field app using the DJI Mobile SDK version and models confirmed for the product.
- Neither adapter exposes arming, takeoff, movement, speed, altitude, or mission-flight operations in this MVP.
- Agent authentication, server-side approval, mission-active check, capability check, command expiry, deduplication and audit must all pass immediately before camera execution.
- Video is published to an authenticated MediaMTX path. The web app receives an HTTPS, mission-authorized playback URL; it never publishes to MediaMTX or receives admin credentials.

## Not delivered here

There is no executable MAVSDK or DJI bridge in this web repository. Those runtimes must be implemented and tested in their target field-app repositories after hardware, supported model, mobile platform, SDK version, field operator approval flow and credentials are available. Never put device, DJI or MediaMTX admin credentials in the browser bundle.
