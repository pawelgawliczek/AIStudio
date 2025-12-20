# THE_PLAN - ST-351 Verification Test

This file tests that ArtifactWatcher picks up existing files on restart.

## Test Created
Date: 2025-12-20T19:45:00Z

## Expected Behavior
1. Agent restart should detect this file
2. File should be queued with throttling
3. Cache should be updated after upload
