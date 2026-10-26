#!/usr/bin/env python3
"""
Nebius Token Factory Connectivity Verification Script
======================================================
Usage:
    python3 scripts/test_nebius_connection.py

Validates that:
1. NEBIUS_API_KEY is present in environment or .env.
2. NEBIUS_BASE_URL and NEBIUS_MODEL are set.
3. A live test completion request succeeds against the official endpoint.
4. Response time and model output structure are recorded.

Never outputs the API key or secret values.
"""
import os
import sys
import time
from pathlib import Path

# Add backend to path to import config
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

try:
    from app.core.config import settings
    import httpx
except ImportError as exc:
    print(f"Error: Missing dependency ({exc}). Run from repository root.")
    sys.exit(1)


def main():
    print("=" * 60)
    print("ProofPatch — Nebius Token Factory Connectivity Check")
    print("=" * 60)

    if not settings.nebius_api_key:
        print("[FAIL] NEBIUS_API_KEY is not configured.")
        print("       Set NEBIUS_API_KEY in .env or as an environment variable.")
        sys.exit(1)

    if not settings.nebius_model:
        print("[FAIL] NEBIUS_MODEL is not configured.")
        print("       Set NEBIUS_MODEL in .env (e.g. nvidia/llama-3.1-nemotron-70b-instruct).")
        sys.exit(1)

    print(f"[INFO] Endpoint Base URL: {settings.nebius_base_url}")
    print(f"[INFO] Target Model:      {settings.nebius_model}")
    print(f"[INFO] API Key:           [CONFIGURED, {len(settings.nebius_api_key)} chars]")

    url = f"{settings.nebius_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.nebius_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.nebius_model,
        "messages": [
            {"role": "system", "content": "You are a test responder. Output valid JSON: {\"status\": \"ok\"}"},
            {"role": "user", "content": "Respond now."},
        ],
        "temperature": 0.1,
        "max_tokens": 50,
    }

    print("\n[INFO] Sending test inference request...")
    start = time.monotonic()
    try:
        with httpx.Client(timeout=settings.provider_timeout_seconds) as client:
            resp = client.post(url, headers=headers, json=payload)
        elapsed = time.monotonic() - start

        if resp.status_code == 200:
            data = resp.json()
            reply = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            print(f"[SUCCESS] Inference succeeded in {elapsed:.2f}s!")
            print(f"          Model response: {reply.strip()[:80]}")
            print(f"          Tokens: prompt={usage.get('prompt_tokens', '?')}, completion={usage.get('completion_tokens', '?')}")
            print("\nGate D1-01 (Token Factory verification) PASSED.")
            sys.exit(0)
        else:
            print(f"[FAIL] HTTP Status {resp.status_code}: {resp.text[:200]}")
            sys.exit(1)

    except httpx.TimeoutException:
        print(f"[FAIL] Request timed out after {settings.provider_timeout_seconds}s.")
        sys.exit(1)
    except Exception as exc:
        print(f"[FAIL] Network or request error: {type(exc).__name__}: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
