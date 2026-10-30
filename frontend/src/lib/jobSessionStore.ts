import type { JobStatus, FinalVerdict } from '../types/api';

export interface SessionJob {
  jobId: string;
  projectName: string;
  bugReport: string;
  createdAt: string;
  status: JobStatus;
  stage?: string;
  verdict: FinalVerdict | null;
  attemptCount: number;
  durationSeconds: number | null;
  modelId: string | null;
}

const STORAGE_KEY = 'proofpatch_session_jobs';

// In-memory array initialized from sessionStorage if present
let memoryJobs: SessionJob[] = [];

try {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    memoryJobs = JSON.parse(saved);
  }
} catch {
  // Ignore sessionStorage errors
}

type Listener = (jobs: SessionJob[]) => void;
const listeners = new Set<Listener>();

function notify() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memoryJobs));
  } catch {
    // Ignore storage quota errors
  }
  listeners.forEach((fn) => fn([...memoryJobs]));
}

export const jobSessionStore = {
  getJobs(): SessionJob[] {
    return [...memoryJobs];
  },

  addJob(job: SessionJob) {
    const existingIndex = memoryJobs.findIndex((j) => j.jobId === job.jobId);
    if (existingIndex >= 0) {
      memoryJobs[existingIndex] = { ...memoryJobs[existingIndex], ...job };
    } else {
      memoryJobs.unshift(job);
    }
    notify();
  },

  updateJob(jobId: string, updates: Partial<SessionJob>) {
    const existingIndex = memoryJobs.findIndex((j) => j.jobId === jobId);
    if (existingIndex >= 0) {
      memoryJobs[existingIndex] = { ...memoryJobs[existingIndex], ...updates };
      notify();
    }
  },

  getJob(jobId: string): SessionJob | undefined {
    return memoryJobs.find((j) => j.jobId === jobId);
  },

  getLastJobId(): string | null {
    return memoryJobs[0]?.jobId ?? null;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener([...memoryJobs]);
    return () => {
      listeners.delete(listener);
    };
  },
};
