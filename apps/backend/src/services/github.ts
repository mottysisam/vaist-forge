/**
 * GitHub Service
 * Push generated code to GitHub and trigger build workflows
 */

import type { PluginPlan } from '@vaist/shared';
import { generateFromPlan, type GeneratedFiles } from './cpp-generator';
import { generateWasmFromPlan, type WasmGeneratedFiles } from './wasm-generator';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface WorkflowRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'timed_out' | null;
  htmlUrl: string;
  createdAt: string;
}

export interface ArtifactInfo {
  id: number;
  name: string;
  sizeInBytes: number;
  downloadUrl: string;
}

// GitHub API Response Types
interface GitHubWorkflowRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'timed_out' | null;
  html_url: string;
  created_at: string;
}

interface GitHubRepo {
  default_branch: string;
}

interface GitHubRef {
  object: { sha: string };
}

interface GitHubCommit {
  tree: { sha: string };
}

interface GitHubTree {
  sha: string;
}

interface GitHubBlob {
  sha: string;
}

interface GitHubArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  archive_download_url: string;
}

/**
 * GitHub API client for vAIst code generation
 */
export class GitHubService {
  private baseUrl = 'https://api.github.com';
  private token: string;
  private owner: string;
  private repo: string;

  constructor(config: GitHubConfig) {
    this.token = config.token;
    this.owner = config.owner;
    this.repo = config.repo;
  }

  /**
   * Generate C++ code from plan and push to a project branch
   * Generates both JUCE (native VST3) and WASM (browser preview) code
   */
  async pushGeneratedCode(
    projectId: string,
    plan: PluginPlan,
    pluginName: string
  ): Promise<{ branch: string; commitSha: string }> {
    // Generate the JUCE C++ files (for native VST3)
    const juceFiles = generateFromPlan(plan, pluginName);

    // Generate the WASM C++ files (for browser preview)
    const wasmFiles = generateWasmFromPlan(plan, pluginName);

    // Create a branch for this project
    const branch = `build/${projectId}`;

    // Get the default branch SHA
    const defaultBranch = await this.getDefaultBranch();
    const baseSha = await this.getBranchSha(defaultBranch);

    // Create or update the branch
    await this.createOrUpdateBranch(branch, baseSha);

    // Commit all generated files (JUCE + WASM)
    const commitSha = await this.commitAllFiles(
      branch,
      juceFiles,
      wasmFiles,
      `🎹 Generate ${pluginName} plugin\n\nProject ID: ${projectId}\nIncludes WASM for browser preview`
    );

    return { branch, commitSha };
  }

  /**
   * Trigger the build workflow for a branch
   */
  async triggerBuildWorkflow(branch: string): Promise<number> {
    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/actions/workflows/build.yml/dispatches`,
      {
        method: 'POST',
        body: JSON.stringify({
          ref: branch,
        }),
      }
    );

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to trigger workflow: ${response.statusText}`);
    }

    // Wait a moment and get the workflow run ID
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const runs = await this.getWorkflowRuns(branch);
    if (runs.length === 0) {
      throw new Error('Workflow run not found after trigger');
    }

    return runs[0].id;
  }

  /**
   * Get workflow run status
   */
  async getWorkflowRun(runId: number): Promise<WorkflowRun> {
    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/actions/runs/${runId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get workflow run: ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubWorkflowRun;

    return {
      id: data.id,
      status: data.status,
      conclusion: data.conclusion,
      htmlUrl: data.html_url,
      createdAt: data.created_at,
    };
  }

  /**
   * Get recent workflow runs for a branch
   */
  async getWorkflowRuns(branch: string): Promise<WorkflowRun[]> {
    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=5`
    );

    if (!response.ok) {
      throw new Error(`Failed to get workflow runs: ${response.statusText}`);
    }

    const data = (await response.json()) as { workflow_runs: GitHubWorkflowRun[] };

    return data.workflow_runs.map((run) => ({
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      htmlUrl: run.html_url,
      createdAt: run.created_at,
    }));
  }

  /**
   * Get workflow run logs
   */
  async getWorkflowLogs(runId: number): Promise<string> {
    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/logs`,
      { redirect: 'follow' }
    );

    if (!response.ok) {
      // Logs might not be available yet
      if (response.status === 404) {
        return 'Logs not yet available...';
      }
      throw new Error(`Failed to get logs: ${response.statusText}`);
    }

    // Returns a zip file URL - we'll just return a link for now
    return `Logs available at: https://github.com/${this.owner}/${this.repo}/actions/runs/${runId}`;
  }

  /**
   * List artifacts from a workflow run
   */
  async getArtifacts(runId: number): Promise<ArtifactInfo[]> {
    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/artifacts`
    );

    if (!response.ok) {
      throw new Error(`Failed to get artifacts: ${response.statusText}`);
    }

    const data = (await response.json()) as { artifacts: GitHubArtifact[] };

    return data.artifacts.map((artifact) => ({
      id: artifact.id,
      name: artifact.name,
      sizeInBytes: artifact.size_in_bytes,
      downloadUrl: artifact.archive_download_url,
    }));
  }

  /**
   * Download artifact and return as ArrayBuffer
   */
  async downloadArtifact(artifactId: number): Promise<ArrayBuffer> {
    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/actions/artifacts/${artifactId}/zip`,
      { redirect: 'follow' }
    );

    if (!response.ok) {
      throw new Error(`Failed to download artifact: ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  // Private helper methods

  private async request(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'vAIst-Backend/1.0',
        ...options.headers,
      },
    });
  }

  private async getDefaultBranch(): Promise<string> {
    console.log(`[GitHub] Getting default branch for ${this.owner}/${this.repo}`);
    console.log(`[GitHub] Token prefix: ${this.token?.slice(0, 20)}...`);

    const response = await this.request(
      `/repos/${this.owner}/${this.repo}`
    );

    console.log(`[GitHub] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const body = await response.text();
      console.error(`[GitHub] Error body:`, body);
      throw new Error(`Failed to get repo info: ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubRepo;
    return data.default_branch;
  }

  private async getBranchSha(branch: string): Promise<string> {
    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/git/ref/heads/${branch}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get branch SHA: ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubRef;
    return data.object.sha;
  }

  private async createOrUpdateBranch(
    branch: string,
    baseSha: string
  ): Promise<void> {
    // Try to update existing branch
    const updateResponse = await this.request(
      `/repos/${this.owner}/${this.repo}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          sha: baseSha,
          force: true,
        }),
      }
    );

    if (updateResponse.ok) {
      return;
    }

    // Branch doesn't exist, create it
    const createResponse = await this.request(
      `/repos/${this.owner}/${this.repo}/git/refs`,
      {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: baseSha,
        }),
      }
    );

    if (!createResponse.ok) {
      throw new Error(`Failed to create branch: ${createResponse.statusText}`);
    }
  }

  /**
   * Commit both JUCE and WASM files to the repository
   */
  private async commitAllFiles(
    branch: string,
    juceFiles: GeneratedFiles,
    wasmFiles: WasmGeneratedFiles,
    message: string
  ): Promise<string> {
    // Get current tree
    const branchSha = await this.getBranchSha(branch);
    const commitResponse = await this.request(
      `/repos/${this.owner}/${this.repo}/git/commits/${branchSha}`
    );

    if (!commitResponse.ok) {
      throw new Error(`Failed to get commit: ${commitResponse.statusText}`);
    }

    const commitData = (await commitResponse.json()) as GitHubCommit;
    const treeSha = commitData.tree.sha;

    // Create blobs for all files (JUCE + WASM)
    const blobs = await Promise.all([
      // JUCE files (for native VST3)
      this.createBlob(juceFiles.processorH, 'Source/PluginProcessor.h'),
      this.createBlob(juceFiles.processorCpp, 'Source/PluginProcessor.cpp'),
      this.createBlob(juceFiles.editorH, 'Source/PluginEditor.h'),
      this.createBlob(juceFiles.editorCpp, 'Source/PluginEditor.cpp'),
      // WASM files (for browser preview)
      this.createBlob(wasmFiles.processorH, 'Source/wasm/processor.h'),
      this.createBlob(wasmFiles.processorCpp, 'Source/wasm/processor.cpp'),
      this.createBlob(wasmFiles.wasmBindings, 'Source/wasm/bindings.cpp'),
      this.createBlob(wasmFiles.wasmDescriptor, 'Source/wasm/descriptor.json'),
    ]);

    // Create new tree
    const treeResponse = await this.request(
      `/repos/${this.owner}/${this.repo}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify({
          base_tree: treeSha,
          tree: blobs,
        }),
      }
    );

    if (!treeResponse.ok) {
      throw new Error(`Failed to create tree: ${treeResponse.statusText}`);
    }

    const treeData = (await treeResponse.json()) as GitHubTree;

    // Create commit
    const newCommitResponse = await this.request(
      `/repos/${this.owner}/${this.repo}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify({
          message,
          tree: treeData.sha,
          parents: [branchSha],
        }),
      }
    );

    if (!newCommitResponse.ok) {
      throw new Error(`Failed to create commit: ${newCommitResponse.statusText}`);
    }

    const newCommitData = (await newCommitResponse.json()) as { sha: string };

    // Update branch reference
    await this.request(
      `/repos/${this.owner}/${this.repo}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          sha: newCommitData.sha,
        }),
      }
    );

    return newCommitData.sha;
  }

  private async commitFiles(
    branch: string,
    files: GeneratedFiles,
    message: string
  ): Promise<string> {
    // Get current tree
    const branchSha = await this.getBranchSha(branch);
    const commitResponse = await this.request(
      `/repos/${this.owner}/${this.repo}/git/commits/${branchSha}`
    );

    if (!commitResponse.ok) {
      throw new Error(`Failed to get commit: ${commitResponse.statusText}`);
    }

    const commitData = (await commitResponse.json()) as GitHubCommit;
    const treeSha = commitData.tree.sha;

    // Create blobs for each file
    const blobs = await Promise.all([
      this.createBlob(files.processorH, 'Source/PluginProcessor.h'),
      this.createBlob(files.processorCpp, 'Source/PluginProcessor.cpp'),
      this.createBlob(files.editorH, 'Source/PluginEditor.h'),
      this.createBlob(files.editorCpp, 'Source/PluginEditor.cpp'),
    ]);

    // Create new tree
    const treeResponse = await this.request(
      `/repos/${this.owner}/${this.repo}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify({
          base_tree: treeSha,
          tree: blobs,
        }),
      }
    );

    if (!treeResponse.ok) {
      throw new Error(`Failed to create tree: ${treeResponse.statusText}`);
    }

    const treeData = (await treeResponse.json()) as GitHubTree;

    // Create commit
    const newCommitResponse = await this.request(
      `/repos/${this.owner}/${this.repo}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify({
          message,
          tree: treeData.sha,
          parents: [branchSha],
        }),
      }
    );

    if (!newCommitResponse.ok) {
      throw new Error(`Failed to create commit: ${newCommitResponse.statusText}`);
    }

    const newCommitData = (await newCommitResponse.json()) as { sha: string };

    // Update branch reference
    await this.request(
      `/repos/${this.owner}/${this.repo}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          sha: newCommitData.sha,
        }),
      }
    );

    return newCommitData.sha;
  }

  private async createBlob(
    content: string,
    path: string
  ): Promise<{ path: string; mode: string; type: string; sha: string }> {
    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/git/blobs`,
      {
        method: 'POST',
        body: JSON.stringify({
          content,
          encoding: 'utf-8',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create blob for ${path}: ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubBlob;

    return {
      path,
      mode: '100644',
      type: 'blob',
      sha: data.sha,
    };
  }
}

/**
 * Create GitHub service from environment
 */
export function createGitHubService(env: {
  GITHUB_TOKEN: string;
}): GitHubService {
  console.log('[GitHub] Creating service with token:', env.GITHUB_TOKEN ? `${env.GITHUB_TOKEN.slice(0, 15)}...` : 'UNDEFINED');
  return new GitHubService({
    token: env.GITHUB_TOKEN,
    owner: 'mottysisam',
    repo: 'vaist-forge',
  });
}
