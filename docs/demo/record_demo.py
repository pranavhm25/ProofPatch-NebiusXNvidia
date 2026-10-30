"""
ProofPatch Screen Capture Recorder
==================================
Records a clean screen-capture demo video of ProofPatch for voiceover sync.
Target duration: 2:50 to 3:00 (silent, 1920x1080, 30fps, light theme).

Scenes:
  Scene 1: The Problem & Core Axiom (0:00 to 0:20)
  Scene 2: What It Is & Sidebar Navigation (0:20 to 0:40)
  Scene 3: Live Run 1 Start & Pipeline Progress (0:40 to 1:10)
  Scene 4: Result VERIFIED & Evidence Inspection (1:10 to 1:50)
  Scene 5: Live Run 2 Honest Failure Inspection (1:50 to 2:25)
  Scene 6: Trust, Limits & Models Architecture (2:25 to 2:45)
  Scene 7: Empirical Benchmark Close & Return (2:45 to 3:00)
"""

import json
import logging
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import urllib.request

from playwright.sync_api import BrowserContext, Locator, Page, sync_playwright

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("record_demo")

# Paths
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEMO_DIR = REPO_ROOT / "docs" / "demo"
DEMO_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR = DEMO_DIR / "raw_video"
RAW_DIR.mkdir(parents=True, exist_ok=True)

FIXTURE_BUGGY = REPO_ROOT / "backend" / "tests" / "fixtures" / "sample_buggy_repo.zip"
FIXTURE_UNFIXABLE = REPO_ROOT / "backend" / "tests" / "fixtures" / "fixture_unfixable.zip"
BENCHMARK_HTML = DEMO_DIR / "benchmark.html"

FRONTEND_URL = "http://127.0.0.1:5173"
BACKEND_BASE = "http://127.0.0.1:8000"

# Custom Injected Cursor Script (60fps hardware accelerated, SVG arrow + ripple)
CURSOR_OVERLAY_SCRIPT = """
(() => {
  if (document.getElementById('demo-cursor-overlay')) return;

  const style = document.createElement('style');
  style.id = 'demo-cursor-style';
  style.textContent = `
    #demo-cursor-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      overflow: hidden !important;
    }
    #demo-cursor-pointer {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 22px !important;
      height: 22px !important;
      pointer-events: none !important;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35)) !important;
      will-change: transform !important;
      z-index: 2147483647 !important;
    }
    .demo-ripple {
      position: absolute !important;
      width: 34px !important;
      height: 34px !important;
      border-radius: 50% !important;
      border: 2px solid rgba(30, 107, 60, 0.9) !important;
      background: rgba(30, 107, 60, 0.22) !important;
      transform: translate(-50%, -50%) scale(0.2) !important;
      animation: demoRippleAnim 0.45s cubic-bezier(0.1, 0.8, 0.3, 1) forwards !important;
      pointer-events: none !important;
      z-index: 2147483646 !important;
    }
    @keyframes demoRippleAnim {
      0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
    }
    body {
      zoom: 1.1 !important;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'demo-cursor-overlay';
  overlay.innerHTML = `
    <div id="demo-cursor-pointer">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 2L19 12L11.5 13.5L8.5 21L4 2Z" fill="#1A1816" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
      </svg>
    </div>
  `;
  document.documentElement.appendChild(overlay);

  const ptr = document.getElementById('demo-cursor-pointer');
  let curX = 960, curY = 540;
  ptr.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;

  window.addEventListener('mousemove', (e) => {
    ptr.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  }, { passive: true });

  window.addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    r.className = 'demo-ripple';
    r.style.left = e.clientX + 'px';
    r.style.top = e.clientY + 'px';
    overlay.appendChild(r);
    setTimeout(() => r.remove(), 450);
  }, { passive: true });
})();
"""


class DemoRecorder:
  """Manages the full recording lifecycle and timestamp tracking."""

  def __init__(self):
    self.start_wall_clock: float = 0.0
    self.scene_timestamps: List[Dict[str, Any]] = []
    self.current_cursor: Tuple[float, float] = (960.0, 540.0)
    self.verified_timestamp_offset: float = 0.0
    self.job1_id: Optional[str] = None
    self.job2_id: Optional[str] = None
    self.job1_verdict: Optional[str] = None
    self.job2_verdict: Optional[str] = None

  def mark_scene_start(self, scene_number: int, name: str) -> float:
    now = time.monotonic()
    if self.start_wall_clock == 0.0:
      self.start_wall_clock = now
    elapsed = round(now - self.start_wall_clock, 2)
    logger.info(f"--- START SCENE {scene_number}: {name} (T+{elapsed}s) ---")
    self.scene_timestamps.append({
        "scene": scene_number,
        "name": name,
        "raw_start_seconds": elapsed,
        "raw_end_seconds": None,
    })
    return elapsed

  def mark_scene_end(self, scene_number: int):
    now = time.monotonic()
    elapsed = round(now - self.start_wall_clock, 2)
    for s in self.scene_timestamps:
      if s["scene"] == scene_number and s["raw_end_seconds"] is None:
        s["raw_end_seconds"] = elapsed
        duration = round(elapsed - s["raw_start_seconds"], 2)
        logger.info(
            f"--- END SCENE {scene_number} (T+{elapsed}s, duration="
            f" {duration}s) ---"
        )
        break

  def smooth_move(
      self,
      page: Page,
      target_x: float,
      target_y: float,
      steps: int = 32,
      pause_after: float = 0.2,
  ):
    """Move cursor with humanlike easing over multiple steps."""
    start_x, start_y = self.current_cursor
    for i in range(1, steps + 1):
      t = i / steps
      eased = 3 * (t**2) - 2 * (t**3)
      x = start_x + (target_x - start_x) * eased
      y = start_y + (target_y - start_y) * eased
      page.mouse.move(x, y)
      time.sleep(0.008)
    self.current_cursor = (target_x, target_y)
    if pause_after > 0:
      time.sleep(pause_after)

  def move_to_element(
      self,
      page: Page,
      target: Union[str, Locator],
      steps: int = 32,
      pause_after: float = 0.3,
  ) -> bool:
    """Find visible element and smoothly move cursor to its center."""
    try:
      elem = page.locator(target).first if isinstance(target, str) else target
      elem.wait_for(state="visible", timeout=8000)
      box = elem.bounding_box()
      if box:
        tx = box["x"] + box["width"] / 2
        ty = box["y"] + box["height"] / 2
        self.smooth_move(
            page, tx, ty, steps=steps, pause_after=pause_after
        )
        return True
    except Exception as e:
      logger.warning(f"Could not move to element: {e}")
    return False

  def click_element(
      self,
      page: Page,
      target: Union[str, Locator],
      steps: int = 30,
      pause_after: float = 0.4,
  ):
    """Smoothly move to an element and click with visible ripple."""
    elem = page.locator(target).first if isinstance(target, str) else target
    elem.wait_for(state="visible", timeout=8000)
    box = elem.bounding_box()
    if box:
      tx = box["x"] + box["width"] / 2
      ty = box["y"] + box["height"] / 2
      self.smooth_move(page, tx, ty, steps=steps, pause_after=0.15)
      page.mouse.down()
      time.sleep(0.12)
      page.mouse.up()
      if pause_after > 0:
        time.sleep(pause_after)

  def type_text(
      self,
      page: Page,
      target: Union[str, Locator],
      text: str,
      delay_ms: float = 35.0,
  ):
    """Focus element and type text with humanlike rhythm."""
    self.click_element(page, target, steps=25, pause_after=0.2)
    for char in text:
      page.keyboard.type(char, delay=delay_ms)


# ─── SCENE IMPLEMENTATIONS ───────────────────────────────────────────────────


def scene_1_the_problem(page: Page, rec: DemoRecorder):
  """Scene 1 (0:00 to 0:20): Open New Repair page empty, hold 3s, move over title and tagline."""
  rec.mark_scene_start(1, "The Problem & Core Axiom")
  page.goto(FRONTEND_URL, wait_until="networkidle")
  page.wait_for_selector("h1", timeout=10000)

  # Hold still for 3s
  logger.info("Holding still for 3s on empty New Repair page...")
  time.sleep(3.0)

  # Slowly move cursor over the title
  title_elem = page.locator("h1").first
  box = title_elem.bounding_box()
  if box:
    rec.smooth_move(page, box["x"] + 60, box["y"] + 15, steps=35)
    time.sleep(1.5)
    rec.smooth_move(page, box["x"] + 140, box["y"] + 15, steps=30)
    time.sleep(1.0)

  # Slowly move over tagline / description
  desc_elem = page.get_by_text("Submit a Python repository archive").first
  box_desc = desc_elem.bounding_box()
  if box_desc:
    rec.smooth_move(
        page,
        box_desc["x"] + 100,
        box_desc["y"] + box_desc["height"] / 2,
        steps=35,
    )
    time.sleep(2.0)
    rec.smooth_move(
        page,
        box_desc["x"] + 350,
        box_desc["y"] + box_desc["height"] / 2,
        steps=35,
    )
    time.sleep(2.5)

  # Move over badge "Python MVP"
  badge = page.get_by_text("Python MVP").first
  b_box = badge.bounding_box()
  if b_box:
    rec.smooth_move(
        page, b_box["x"] + b_box["width"] / 2, b_box["y"] + b_box["height"] / 2
    )
    time.sleep(2.0)

  # Hold until 20s
  elapsed = time.monotonic() - rec.start_wall_clock
  rem = 20.0 - elapsed
  if rem > 0:
    time.sleep(rem)
  rec.mark_scene_end(1)


def scene_2_what_it_is(page: Page, rec: DemoRecorder):
  """Scene 2 (0:20 to 0:40): Privacy notice & hover sidebar items 1s each."""
  rec.mark_scene_start(2, "What It Is & Sidebar Navigation")

  # Move cursor over privacy and security notice
  sec_notice = page.get_by_text("Isolated Workspace & Retention Policy").first
  box = sec_notice.bounding_box()
  if box:
    rec.smooth_move(
        page, box["x"] + 150, box["y"] + box["height"] / 2, steps=35
    )
    time.sleep(2.5)
    rec.smooth_move(
        page, box["x"] + 350, box["y"] + box["height"] / 2, steps=35
    )
    time.sleep(2.5)

  # Hover sidebar items one by one (~1s each)
  # 1. New Repair
  rec.move_to_element(page, page.locator('nav a[href="/"]').first, steps=30)
  time.sleep(1.2)

  # 2. Jobs
  rec.move_to_element(page, page.locator('nav a[href="/jobs"]').first, steps=30)
  time.sleep(1.2)

  # 3. Models & Roles
  rec.move_to_element(
      page, page.locator('nav a[href="/models"]').first, steps=30
  )
  time.sleep(1.2)

  # 4. Security Boundaries
  rec.move_to_element(
      page, page.locator('nav a[href="/security"]').first, steps=30
  )
  time.sleep(1.4)

  # Move cursor back into main workspace
  rec.smooth_move(page, 750, 400, steps=30)

  # Pad to 40s
  elapsed = time.monotonic() - rec.start_wall_clock
  rem = 40.0 - elapsed
  if rem > 0:
    time.sleep(rem)
  rec.mark_scene_end(2)


def scene_3_live_run_1_start(page: Page, rec: DemoRecorder) -> str:
  """Scene 3 (0:40 to 1:10): Upload sample_buggy_repo.zip, type bug report, click Analyze & Repair, watch stage timeline."""
  rec.mark_scene_start(3, "Live Run 1 Start & Pipeline Progress")

  # Move to Dropzone area
  rec.move_to_element(
      page,
      page.get_by_text("1. Repository Archive").first,
      steps=30,
  )
  time.sleep(0.6)

  # Set files on file input
  logger.info(f"Setting input file: {FIXTURE_BUGGY}")
  page.locator('input[data-testid="dropzone-file-input"]').set_input_files(
      str(FIXTURE_BUGGY)
  )

  # Wait for project validation card
  page.wait_for_selector("text=Valid Project", timeout=10000)
  time.sleep(1.0)

  # Move cursor over validated project card
  rec.move_to_element(page, page.get_by_text("Valid Project").first, steps=28)
  time.sleep(1.0)

  # Move cursor to Defect Description textarea
  rec.move_to_element(page, "#bug-report", steps=30)
  time.sleep(0.4)

  # Type bug report: "absolute_value(-15) returns -15 instead of 15."
  bug_text = "absolute_value(-15) returns -15 instead of 15."
  logger.info(f"Typing bug description: {bug_text}")
  rec.type_text(page, "#bug-report", bug_text, delay_ms=35.0)

  # Pause 1s
  time.sleep(1.0)

  # Move to Analyze and Repair button
  submit_btn = page.locator('button[type="submit"]').first
  rec.move_to_element(page, submit_btn, steps=30)
  time.sleep(0.5)

  # Click Analyze and Repair
  rec.click_element(page, submit_btn, steps=15)
  logger.info("Clicked Analyze and Repair. Waiting for progress redirect...")

  # Wait for redirect to Progress Page (/jobs/<job_id>)
  page.wait_for_url("**/jobs/*", timeout=15000)
  job_id = page.url.split("/jobs/")[1].split("/")[0].split("?")[0]
  rec.job1_id = job_id
  logger.info(f"Job 1 active with ID: {job_id}")

  # Keep stage timeline in view while job runs. Hover gently across timeline stages
  start_poll = time.monotonic()
  reached_terminal = False
  while time.monotonic() - start_poll < 120.0:
    if "/result" in page.url:
      reached_terminal = True
      break

    # Move cursor along the stage timeline to highlight progress
    try:
      stages = page.locator("ol li, [role='listitem']").all()
      for stage in stages[:4]:
        box = stage.bounding_box()
        if box:
          rec.smooth_move(
              page,
              box["x"] + box["width"] / 2,
              box["y"] + box["height"] / 2,
              steps=20,
              pause_after=0.4,
          )
        if "/result" in page.url:
          reached_terminal = True
          break
    except Exception:
      pass

    time.sleep(0.5)

  if not reached_terminal:
    page.wait_for_url("**/result", timeout=20000)

  logger.info("Job 1 reached terminal result page!")
  rec.mark_scene_end(3)
  return job_id


def scene_4_result_verified(page: Page, rec: DemoRecorder, job_id: str):
  """Scene 4 (1:10 to 1:50): Result VERIFIED: badge, stats, diff, test evidence, download .patch, honesty line."""
  rec.mark_scene_start(4, "Result VERIFIED & Evidence Inspection")

  # Wait for result content to load
  page.wait_for_selector("text=Repair Verification Result", timeout=15000)
  time.sleep(1.0)

  # Record the exact timestamp when VERIFIED badge is in view for thumbnail
  rec.verified_timestamp_offset = round(
      time.monotonic() - rec.start_wall_clock, 2
  )

  # Verify verdict from backend API
  api_res = json.loads(
      urllib.request.urlopen(f"{BACKEND_BASE}/api/jobs/{job_id}/result")
      .read()
      .decode()
  )
  verdict_api = api_res.get("verdict", "")
  logger.info(f"Scene 4 Backend API verdict: '{verdict_api}'")
  rec.job1_verdict = verdict_api

  if verdict_api != "VERIFIED":
    logger.error(f"Expected VERIFIED verdict from API, got '{verdict_api}'!")
    raise RuntimeError(
        f"Job {job_id} did not reach VERIFIED! Found: {verdict_api}"
    )

  # 1. Verdict badge: hover and hold 4s
  rec.move_to_element(page, page.get_by_text("Verified", exact=True).first, steps=32)
  time.sleep(4.0)

  # 2. Stat cards: hover across them, hold 4s total
  stat_cards = [
      page.get_by_text("Tests Passed").first,
      page.get_by_text("Tests Failed").first,
      page.get_by_text("Execution Duration").first,
      page.get_by_text("Files Changed").first,
  ]
  for card in stat_cards:
    rec.move_to_element(page, card, steps=25)
    time.sleep(0.9)

  # 3. Code diff: scroll down smoothly, inspect diff
  page.evaluate("window.scrollBy({top: 320, behavior: 'smooth'})")
  time.sleep(0.8)
  rec.move_to_element(
      page, page.get_by_text("Generated Code Diff").first, steps=28
  )
  time.sleep(1.0)
  # Move across the diff additions/deletions
  rec.smooth_move(page, 700, 520, steps=30)
  time.sleep(2.0)
  rec.smooth_move(page, 850, 560, steps=30)
  time.sleep(1.5)

  # 4. Sandbox Test Evidence panel: scroll down, inspect exit code and stdout
  page.evaluate("window.scrollBy({top: 360, behavior: 'smooth'})")
  time.sleep(0.8)
  rec.move_to_element(
      page,
      page.get_by_text("Sandbox Test Execution Evidence").first,
      steps=28,
  )
  time.sleep(1.0)
  rec.move_to_element(page, page.get_by_text("Exit Code").first, steps=25)
  time.sleep(1.5)
  # Hover over pytest stdout
  rec.move_to_element(page, page.get_by_text("pytest stdout").first, steps=25)
  time.sleep(2.0)

  # 5. Hover .patch download button and click it (let download happen)
  page.evaluate("window.scrollBy({top: 200, behavior: 'smooth'})")
  time.sleep(0.8)
  patch_btn = page.get_by_text("Download .patch").first
  rec.move_to_element(page, patch_btn, steps=30)
  time.sleep(1.2)
  # Download
  try:
    with page.expect_download(timeout=8000) as download_info:
      rec.click_element(page, patch_btn, steps=15)
    download = download_info.value
    download_path = DEMO_DIR / download.suggested_filename
    download.save_as(str(download_path))
    logger.info(f"Downloaded patch artifact to {download_path}")
  except Exception as e:
    logger.warning(f"Download trigger note: {e}")
  time.sleep(2.5)

  # 6. Scroll back up and point at honesty line
  page.evaluate("window.scrollTo({top: 100, behavior: 'smooth'})")
  time.sleep(0.8)
  honesty_line = page.get_by_text(
      "Evidence Invariant: Verdict is derived only from executed test results"
  ).first
  rec.move_to_element(page, honesty_line, steps=32)
  time.sleep(4.5)

  rec.mark_scene_end(4)


def scene_5_live_run_2_honest_failure(page: Page, rec: DemoRecorder):
  """Scene 5 (1:50 to 2:25): Live run 2 honest failure: fixture_unfixable.zip, run, show FAILED, attempt cards, failing logs."""
  rec.mark_scene_start(5, "Live Run 2 Honest Failure Inspection")

  # Click New Repair
  new_repair_btn = page.locator('header a[href="/"], nav a[href="/"]').first
  rec.move_to_element(page, new_repair_btn, steps=30)
  rec.click_element(page, new_repair_btn, steps=15)
  page.wait_for_selector("h1", timeout=10000)
  time.sleep(0.8)

  # Upload fixture_unfixable.zip
  logger.info(f"Uploading negative control fixture: {FIXTURE_UNFIXABLE}")
  page.locator('input[data-testid="dropzone-file-input"]').set_input_files(
      str(FIXTURE_UNFIXABLE)
  )
  page.wait_for_selector("text=Valid Project", timeout=10000)
  time.sleep(1.0)

  # Move to Defect Description textarea
  rec.move_to_element(page, "#bug-report", steps=30)
  time.sleep(0.4)

  # Type bug report
  unfixable_text = (
      "compute() in src/core.py returns 'alpha' instead of expected external"
      " secret in test_compute_impossible."
  )
  logger.info(f"Typing unfixable bug description: {unfixable_text}")
  rec.type_text(page, "#bug-report", unfixable_text, delay_ms=35.0)
  time.sleep(1.0)

  # Click Analyze and Repair
  submit_btn = page.locator('button[type="submit"]').first
  rec.move_to_element(page, submit_btn, steps=30)
  rec.click_element(page, submit_btn, steps=15)
  logger.info("Submitted run 2. Waiting for Progress page...")

  # Wait for progress redirect
  page.wait_for_url("**/jobs/*", timeout=15000)
  job2_id = page.url.split("/jobs/")[1].split("/")[0].split("?")[0]
  rec.job2_id = job2_id
  logger.info(f"Job 2 active with ID: {job2_id}")

  # Stay on Progress page, watch the pipeline through Attempt 1 and Attempt 2 (retrying)
  start_poll = time.monotonic()
  reached_terminal = False
  while time.monotonic() - start_poll < 120.0:
    if "/result" in page.url:
      reached_terminal = True
      break
    time.sleep(0.8)

  if not reached_terminal:
    page.wait_for_url("**/result", timeout=25000)

  logger.info("Job 2 reached terminal result page!")
  time.sleep(1.0)

  # Check verdict from API: must be FAILED or NOT_VERIFIED, never VERIFIED!
  api_res = json.loads(
      urllib.request.urlopen(f"{BACKEND_BASE}/api/jobs/{job2_id}/result")
      .read()
      .decode()
  )
  verdict_api = api_res.get("verdict", "")
  logger.info(f"Scene 5 Backend API verdict: '{verdict_api}'")
  rec.job2_verdict = verdict_api

  if verdict_api == "VERIFIED":
    logger.critical(
        f"FATAL: fixture_unfixable unexpectedly achieved VERIFIED! This"
        f" violates safety."
    )
    raise RuntimeError(
        "Negative control fixture_unfixable was marked VERIFIED!"
    )

  # Show FAILED verdict badge (hold 4s)
  rec.move_to_element(page, page.get_by_text("Failed", exact=True).first, steps=32)
  time.sleep(4.0)

  # Scroll down to Attempt Cards (Attempt 1 and Attempt 2 Retry)
  page.evaluate("window.scrollBy({top: 400, behavior: 'smooth'})")
  time.sleep(1.0)
  rec.move_to_element(
      page, page.get_by_text("Repair Attempts History").first, steps=28
  )
  time.sleep(2.0)
  rec.smooth_move(page, 750, 480, steps=25)
  time.sleep(2.5)

  # Scroll down to failing test logs in Test Evidence Panel
  page.evaluate("window.scrollBy({top: 350, behavior: 'smooth'})")
  time.sleep(1.0)
  rec.move_to_element(
      page,
      page.get_by_text("Sandbox Test Execution Evidence").first,
      steps=28,
  )
  time.sleep(1.5)
  rec.move_to_element(page, page.get_by_text("Exit Code").first, steps=25)
  time.sleep(2.0)
  # Scroll slowly through failing test output
  page.evaluate("window.scrollBy({top: 250, behavior: 'smooth'})")
  time.sleep(3.0)

  rec.mark_scene_end(5)


def scene_6_trust_and_limits(page: Page, rec: DemoRecorder):
  """Scene 6 (2:25 to 2:45): Open Security page, scroll slowly (10s), open Models page (4s)."""
  rec.mark_scene_start(6, "Trust, Limits & Models Architecture")

  # Move to sidebar, click Security Boundaries
  sec_link = page.locator('nav a[href="/security"]').first
  rec.move_to_element(page, sec_link, steps=30)
  rec.click_element(page, sec_link, steps=15)
  page.wait_for_selector(
      "text=Security & Sandbox Boundaries, h1", timeout=10000
  )
  time.sleep(1.0)

  # Scroll slowly through isolation list (about 10s total)
  logger.info("Scrolling slowly through Security page isolation list...")
  for i in range(5):
    page.evaluate("window.scrollBy({top: 180, behavior: 'smooth'})")
    rec.smooth_move(page, 700 + (i % 2) * 50, 400 + i * 40, steps=20)
    time.sleep(1.8)

  # Move cursor to sidebar, click Models & Roles
  page.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
  time.sleep(0.5)
  models_link = page.locator('nav a[href="/models"]').first
  rec.move_to_element(page, models_link, steps=30)
  rec.click_element(page, models_link, steps=15)
  page.wait_for_selector(
      "text=Models & Role Architecture, h1", timeout=10000
  )

  # Inspect FAST, REASONING, ADVANCED roles for about 4s
  time.sleep(1.0)
  rec.move_to_element(
      page, page.get_by_text("Planning & Source Inspection").first, steps=25
  )
  time.sleep(1.2)
  rec.move_to_element(
      page, page.get_by_text("Unified Diff Patch Generation").first, steps=25
  )
  time.sleep(1.2)
  rec.move_to_element(
      page,
      page.get_by_text("Bounded Retry & Failure Revision").first,
      steps=25,
  )
  time.sleep(1.6)

  rec.mark_scene_end(6)


def scene_7_close(page: Page, rec: DemoRecorder):
  """Scene 7 (2:45 to 3:00): Open benchmark page, hold 8s, return to New Repair, hold 3s."""
  rec.mark_scene_start(7, "Empirical Benchmark Close & Return")

  # Open rendered benchmark HTML
  benchmark_file_url = BENCHMARK_HTML.as_uri()
  logger.info(f"Opening Benchmark page at {benchmark_file_url}")
  page.goto(benchmark_file_url, wait_until="networkidle")
  page.wait_for_selector(
      "text=Empirical Model Verification & Pipeline Benchmark", timeout=10000
  )

  # Hover 95.7% badge and stats
  rec.move_to_element(
      page, page.get_by_text("95.7% Verified Pass Rate").first, steps=28
  )
  time.sleep(2.5)

  # Move across Nemotron-550B table
  rec.smooth_move(page, 700, 450, steps=30)
  time.sleep(3.0)
  rec.smooth_move(page, 800, 600, steps=30)
  time.sleep(2.5)

  # Return to ProofPatch New Repair page
  logger.info("Returning to ProofPatch New Repair dashboard...")
  page.goto(FRONTEND_URL, wait_until="networkidle")
  page.wait_for_selector("h1", timeout=10000)

  # Hold on title for 3s
  rec.move_to_element(page, page.locator("h1").first, steps=30)
  time.sleep(3.5)

  rec.mark_scene_end(7)


# ─── POST-PROCESSING WITH FFMPEG ─────────────────────────────────────────────


def post_process_video(rec: DemoRecorder, raw_video_path: Path) -> Path:
  """Slices scene clips, adjusts timing to hit 2:50 to 3:00, and concatenates final MP4."""
  logger.info("Starting post-processing with ffmpeg...")

  # Move raw recording to docs/demo/full_take.webm
  full_take_path = DEMO_DIR / "full_take.webm"
  if full_take_path.exists():
    full_take_path.unlink()
  shutil.copy2(str(raw_video_path), str(full_take_path))
  logger.info(f"Saved continuous full take to {full_take_path}")

  # Target durations for the final cut (Total: 175s = 2m 55s)
  target_durations = {
      1: 20.0,  # 0:00 to 0:20
      2: 20.0,  # 0:20 to 0:40
      3: 30.0,  # 0:40 to 1:10
      4: 40.0,  # 1:10 to 1:50
      5: 35.0,  # 1:50 to 2:25
      6: 18.0,  # 2:25 to 2:43
      7: 12.0,  # 2:43 to 2:55
  }

  final_scenes_mp4 = []
  final_timeline_data = []
  current_timeline_sec = 0.0

  for item in rec.scene_timestamps:
    sc_num = item["scene"]
    raw_start = item["raw_start_seconds"]
    raw_end = item["raw_end_seconds"]
    raw_dur = max(0.1, raw_end - raw_start)
    target_dur = target_durations.get(sc_num, raw_dur)

    # 1. Extract raw scene clip: scene{N}.webm
    scene_webm = DEMO_DIR / f"scene{sc_num}.webm"
    cmd_extract = [
        "ffmpeg",
        "-y",
        "-ss",
        str(raw_start),
        "-i",
        str(full_take_path),
        "-t",
        str(raw_dur),
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "0",
        "-crf",
        "28",
        "-an",
        str(scene_webm),
    ]
    subprocess.run(
        cmd_extract,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    logger.info(
        f"Extracted docs/demo/scene{sc_num}.webm (raw duration: {raw_dur:.2f}s)"
    )

    # 2. Convert to standardized MP4 (1920x1080, 30fps, yuv420p)
    scene_mp4 = DEMO_DIR / f"scene{sc_num}_norm.mp4"

    # Scale PTS so that duration equals target_dur exactly
    speed_factor = target_dur / raw_dur
    vf_filter = (
        f"setpts={speed_factor:.6f}*PTS,scale=1920:1080,fps=30,format=yuv420p"
    )

    cmd_norm = [
        "ffmpeg",
        "-y",
        "-ss",
        str(raw_start),
        "-i",
        str(full_take_path),
        "-t",
        str(raw_dur),
        "-vf",
        vf_filter,
        "-t",
        str(target_dur),
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-an",
        str(scene_mp4),
    ]
    subprocess.run(
        cmd_norm,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    final_scenes_mp4.append(scene_mp4)

    # Timeline entry for final cut
    end_sec = current_timeline_sec + target_dur
    start_m, start_s = divmod(int(current_timeline_sec), 60)
    end_m, end_s = divmod(int(end_sec), 60)

    final_timeline_data.append({
        "scene": sc_num,
        "name": item["name"],
        "start_time": f"{start_m}:{start_s:02d}",
        "end_time": f"{end_m}:{end_s:02d}",
        "start_seconds": round(current_timeline_sec, 2),
        "end_seconds": round(end_sec, 2),
        "duration_seconds": round(target_dur, 2),
        "raw_scene_clip": f"docs/demo/scene{sc_num}.webm",
    })
    current_timeline_sec = end_sec

  # 3. Concatenate all normalized scenes into proofpatch_demo_silent.mp4
  concat_list_file = DEMO_DIR / "concat_list.txt"
  with open(concat_list_file, "w") as f:
    for sc_path in final_scenes_mp4:
      f.write(f"file '{sc_path.name}'\n")

  final_mp4 = DEMO_DIR / "proofpatch_demo_silent.mp4"
  cmd_concat = [
      "ffmpeg",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      str(concat_list_file),
      "-c",
      "copy",
      str(final_mp4),
  ]
  subprocess.run(
      cmd_concat,
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
      check=True,
  )
  logger.info(f"Concatenated final master video to {final_mp4}")

  # Clean up temporary normalized mp4 files and concat list
  for sc_path in final_scenes_mp4:
    if sc_path.exists():
      sc_path.unlink()
  if concat_list_file.exists():
    concat_list_file.unlink()

  # 4. Generate Thumbnail at the VERIFIED moment in Scene 4
  thumbnail_path = DEMO_DIR / "thumbnail.png"
  # Scene 4 starts at 70s in the final cut
  thumb_offset = 70.0 + 3.0  # 3s into Scene 4
  cmd_thumb = [
      "ffmpeg",
      "-y",
      "-ss",
      str(thumb_offset),
      "-i",
      str(final_mp4),
      "-vframes",
      "1",
      "-q:v",
      "2",
      str(thumbnail_path),
  ]
  subprocess.run(
      cmd_thumb,
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
      check=True,
  )
  logger.info(f"Saved VERIFIED thumbnail to {thumbnail_path}")

  # 5. Save timeline.json
  total_m, total_s = divmod(int(current_timeline_sec), 60)
  timeline_output = {
      "project": "ProofPatch",
      "branch": "release/final",
      "resolution": "1920x1080",
      "frame_rate": 30,
      "audio": "silent (voiceover ready)",
      "total_duration": f"{total_m}:{total_s:02d}",
      "total_seconds": round(current_timeline_sec, 2),
      "jobs": {
          "run_1_verified": {
              "job_id": rec.job1_id,
              "verdict": rec.job1_verdict,
              "fixture": "sample_buggy_repo.zip",
          },
          "run_2_honest_failure": {
              "job_id": rec.job2_id,
              "verdict": rec.job2_verdict,
              "fixture": "fixture_unfixable.zip",
          },
      },
      "scenes": final_timeline_data,
  }

  timeline_file = DEMO_DIR / "timeline.json"
  with open(timeline_file, "w") as f:
    json.dump(timeline_output, f, indent=2)
  logger.info(f"Wrote timeline metadata to {timeline_file}")

  return final_mp4


# ─── MAIN EXECUTION ──────────────────────────────────────────────────────────


def run_full_recording(max_attempts: int = 3):
  logger.info("Initializing ProofPatch demo recording session...")

  for attempt in range(1, max_attempts + 1):
    logger.info(f"=== RECORDING ATTEMPT {attempt}/{max_attempts} ===")

    # Clear any previous raw files
    shutil.rmtree(RAW_DIR, ignore_errors=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
      browser = p.chromium.launch(
          headless=False,  # Headed as requested
          args=[
              "--disable-infobars",
              "--no-default-browser-check",
              "--force-device-scale-factor=1",
              "--disable-extensions",
              "--disable-blink-features=AutomationControlled",
          ],
      )

      ctx = browser.new_context(
          viewport={"width": 1920, "height": 1080},
          device_scale_factor=1,
          record_video_dir=str(RAW_DIR),
          record_video_size={"width": 1920, "height": 1080},
          color_scheme="light",
      )
      ctx.add_init_script(CURSOR_OVERLAY_SCRIPT)

      page = ctx.new_page()

      # Track console errors
      console_errors = []
      page.on(
          "console",
          lambda msg: (
              console_errors.append(msg.text) if msg.type == "error" else None
          ),
      )

      recorder = DemoRecorder()

      try:
        # Scene 1: The Problem
        scene_1_the_problem(page, recorder)

        # Scene 2: What It Is
        scene_2_what_it_is(page, recorder)

        # Scene 3: Live Run 1 Start
        job1_id = scene_3_live_run_1_start(page, recorder)

        # Scene 4: Result VERIFIED
        scene_4_result_verified(page, recorder, job1_id)

        # Scene 5: Live Run 2 Honest Failure
        scene_5_live_run_2_honest_failure(page, recorder)

        # Scene 6: Trust & Limits
        scene_6_trust_and_limits(page, recorder)

        # Scene 7: Close
        scene_7_close(page, recorder)

        logger.info("All 7 scenes executed successfully!")
        run_success = True

      except Exception as exc:
        logger.error(f"Attempt {attempt} encountered error: {exc}")
        run_success = False

      finally:
        page.close()
        ctx.close()
        browser.close()

      if console_errors:
        logger.warning(
            f"Console errors noted during recording: {console_errors}"
        )

      # Locate raw recorded video
      raw_videos = list(RAW_DIR.glob("*.webm"))

      if not run_success:
        if raw_videos:
          failed_video = DEMO_DIR / f"attempt_failed_{attempt}.webm"
          shutil.copy2(str(raw_videos[-1]), str(failed_video))
          logger.info(f"Saved failed attempt recording to {failed_video}")
        if attempt < max_attempts:
          logger.info(f"Retrying recording (attempt {attempt + 1})...")
          time.sleep(2.0)
          continue
        else:
          logger.critical("All recording attempts failed!")
          raise RuntimeError("Recording could not achieve VERIFIED result.")

      raw_video = raw_videos[-1]

      # Post-process
      final_video = post_process_video(recorder, raw_video)

      # Clean raw_video directory
      shutil.rmtree(RAW_DIR, ignore_errors=True)

      logger.info("=== DEMO RECORDING & POST-PROCESSING COMPLETE ===")
      return recorder, final_video


if __name__ == "__main__":
  run_full_recording()
