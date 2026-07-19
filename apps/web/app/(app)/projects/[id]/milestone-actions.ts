'use server';

import { requireUserOrRedirect } from '@/lib/auth';
import * as milestonesQ from '@compass/db/queries/milestones';
import * as projectsQ from '@compass/db/queries/projects';
import { parseRequirementBullets } from '@compass/shared';
import { revalidatePath } from 'next/cache';

export type MilestoneRow = milestonesQ.MilestoneRow;

export async function toggleMilestone(formData: FormData): Promise<void> {
  await requireUserOrRedirect();
  const id = String(formData.get('id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  if (!id || !projectId) return;
  await milestonesQ.toggleDone(id);
  revalidatePath(`/projects/${projectId}`);
}

export async function addMilestone(formData: FormData): Promise<void> {
  await requireUserOrRedirect();
  const projectId = String(formData.get('project_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!projectId || !title) return;
  await milestonesQ.add({ project_id: projectId, title });
  revalidatePath(`/projects/${projectId}`);
}

/** Seed milestones from the in-app PRD's `## Requirements` bullets (PRD V2 §3.4). */
export async function seedMilestonesFromPrd(formData: FormData): Promise<void> {
  await requireUserOrRedirect();
  const projectId = String(formData.get('project_id') ?? '');
  if (!projectId) return;
  const project = await projectsQ.getProject(projectId);
  if (!project?.prd_markdown) return;
  const existing = await milestonesQ.listForProject(projectId);
  const have = new Set(existing.map((m) => m.title.toLowerCase()));
  for (const bullet of parseRequirementBullets(project.prd_markdown)) {
    if (!have.has(bullet.toLowerCase())) {
      have.add(bullet.toLowerCase()); // dedupe repeated bullets within the same pass too
      await milestonesQ.add({ project_id: projectId, title: bullet });
    }
  }
  revalidatePath(`/projects/${projectId}`);
}

export async function moveMilestone(formData: FormData): Promise<void> {
  await requireUserOrRedirect();
  const id = String(formData.get('id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';
  if (!id || !projectId) return;
  await milestonesQ.move(id, direction);
  revalidatePath(`/projects/${projectId}`);
}

export async function removeMilestone(formData: FormData): Promise<void> {
  await requireUserOrRedirect();
  const id = String(formData.get('id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  if (!id || !projectId) return;
  await milestonesQ.remove(id);
  revalidatePath(`/projects/${projectId}`);
}
