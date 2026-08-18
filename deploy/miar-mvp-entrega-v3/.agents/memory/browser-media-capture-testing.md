---
name: Browser media capture testing
description: Browser-native screen and camera capture needs a real browser permission flow for end-to-end validation.
---

The recording feature depends on a user gesture plus browser-owned permission dialogs. In this workspace, automated browser validation is not available when Chrome/Chromium and a browser automation driver are absent, so code-level checks and container validation cannot replace a real desktop/mobile browser test.

**Why:** `getDisplayMedia()` and `getUserMedia()` intentionally cannot be granted or bypassed by application code; claiming an end-to-end capture test without the chooser and permissions would be misleading.

**How to apply:** When validating future media changes, run a short real take in desktop Chrome and Android Chrome, stop it, download it, and inspect playback; report iPhone/Safari separately because screen capture support differs.