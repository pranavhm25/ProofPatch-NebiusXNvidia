#!/usr/bin/env python3
"""Verify configured Token Factory model IDs and make one live inference request."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

try:
    from app.core.config import settings
    from app.core.errors import ProofPatchError
    from app.services.model_registry import ModelRole, model_registry
    from app.services.nebius_client import call_model
except ImportError:
    print("[FAIL] Backend dependencies are missing. Install backend/requirements.txt.")
    sys.exit(1)


def main() -> int:
    if not settings.nebius_api_key:
        print("[FAIL] NEBIUS_API_KEY is not configured.")
        return 1

    configured = {
        role: model_registry.get_configured_model(role)
        for role in ModelRole
        if model_registry.get_configured_model(role)
    }
    if not configured:
        print("[FAIL] No Token Factory model roles are configured.")
        return 1

    print("[STEP 1] Checking configured model IDs against the live catalog.")
    try:
        catalog = set(model_registry.fetch_available_models())
    except ProofPatchError as exc:
        print(f"[FAIL] Catalog request failed: {exc.code} ({exc.message})")
        return 1

    all_in_catalog = True
    for role, model_id in configured.items():
        found = model_id in catalog
        print(f"[{'PASS' if found else 'FAIL'}] {role.value}: {model_id} ({'in catalog' if found else 'not in catalog'})")
        all_in_catalog = all_in_catalog and found

    print("[STEP 2] Sending one real inference request with the configured reasoning model.")
    expected_model = model_registry.get_configured_model(ModelRole.REASONING)
    if not expected_model:
        print("[FAIL] No reasoning model is configured for the live inference request.")
        return 1
    try:
        content, actual_model = call_model(
            system_prompt="Respond concisely.",
            user_prompt="Reply with the exact text PROOFPATCH_LIVE_OK.",
            role=ModelRole.REASONING,
        )
    except ProofPatchError as exc:
        print(f"[FAIL] Inference request failed: {exc.code} ({exc.message})")
        return 1

    inference_ok = bool(content.strip()) and actual_model == expected_model
    print(
        f"[{'PASS' if inference_ok else 'FAIL'}] "
        f"requested_model={expected_model}; actual_model={actual_model}; "
        f"response={'non-empty' if content.strip() else 'empty'}"
    )

    if all_in_catalog and inference_ok:
        print("[SUCCESS] Configured model access and real inference were verified.")
        return 0
    print("[FAIL] One or more configured model IDs or the requested inference did not verify.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
