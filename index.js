import * as core from "@actions/core";
import * as github from "@actions/github";

const { context } = github;

const pullRequest = context.payload.pull_request;
const skipDrafts = core.getBooleanInput("skip-drafts");
const token = core.getInput("token");
const octokit = github.getOctokit(token);

/**
 * Create or update a GitHub Check Run with rich formatting
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} sha - Commit SHA to associate the check run with
 * @param {"queued" | "in_progress" | "completed"} status - Check run status
 * @param {"success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out" | "action_required"} conclusion - Check run conclusion
 * @param {{title: string, summary: string, text: string}} details - Details for the check run output
 */
const updateCheck = async (owner, repo, sha, status, conclusion, details) => {
  const checkName = "Azure Board Reference Check";

  const existingChecks = await octokit.rest.checks.listForRef({
    owner,
    repo,
    ref: sha,
    check_name: checkName,
    per_page: 1,
  });

  if (existingChecks.data.check_runs?.length > 0) {
    const existingCheckRun = existingChecks.data.check_runs[0];
    const response = await octokit.rest.checks.update({
      check_run_id: existingCheckRun.id,
      owner,
      repo,
      name: checkName,
      head_sha: sha,
      status,
      conclusion,
      output: {
        title: details.title,
        summary: details.summary,
        text: details.text,
      },
    });
    core.info(`🔄 Updated existing check run: ${response.data.html_url}`);
    return;
  }

  const response = await octokit.rest.checks.create({
    owner,
    repo,
    name: checkName,
    head_sha: sha,
    status,
    conclusion,
    output: {
      title: details.title,
      summary: details.summary,
      text: details.text,
    },
  });
  core.info(`✅ Created new check run: ${response.data.html_url}`);
};

const run = async () => {
  if (!pullRequest) {
    core.setFailed("This action can only be run on pull request events");
    return;
  }

  if (skipDrafts && pullRequest.draft) {
    core.info("⏭️ Skipping validation for draft PR");
    core.setOutput("ab-numbers", []);
    return;
  }

  const { owner, repo } = context.repo;
  const description = pullRequest.body || "";
  const sha = pullRequest.head.sha;

  // Check for Azure Board references (support multiple) or bypass
  const abMatches = description.match(/AB#\d+/g);
  const hasOverride = /\bno-ab\b/i.test(description);

  if (abMatches && abMatches.length > 0) {
    const references = abMatches.join(", ");

    await updateCheck(owner, repo, sha, "completed", "success", {
      title: "✅ Azure Board Reference Found",
      summary: `Found reference(s): **${references}**`,
      text: `Azure Board reference(s) found in the PR description:\n\n${abMatches
        .map((ref) => `- ${ref}`)
        .join("\n")}`,
    });

    core.info(`✅ Azure Board reference(s) found: ${references}`);
    core.setOutput("ab-numbers", abMatches);
    return;
  }

  if (hasOverride) {
    await updateCheck(owner, repo, sha, "completed", "success", {
      title: "✅ Azure Board Reference Check Bypassed",
      summary: "Check bypassed with `no-ab` keyword",
      text: "This PR has been explicitly marked as not requiring an Azure Board reference using the `no-ab` bypass keyword.",
    });

    core.info("✅ Override applied (no-ab)");
    core.setOutput("ab-numbers", []);
    return;
  }

  await updateCheck(owner, repo, sha, "completed", "failure", {
    title: "❌ Azure Board Reference Missing",
    summary: "No Azure Board reference found in PR description",
    text: `## What's needed?\n\nThis PR needs to be linked to an Azure Board work item.\n\n## How to fix:\n\n1. **Add a work item reference** like \`AB#1234\` to your PR description\n2. **Or bypass the check** by adding \`no-ab\` to your PR description\n\n## Examples:\n\n**With work item:**\n\`\`\`\nFixed login issue as described in AB#5678\n\`\`\`\n\n**Without work item:**\n\`\`\`\nUpdated documentation - no-ab\n\`\`\``,
  });

  core.error("❌ Azure Board item missing");
  core.setOutput("ab-numbers", []);
  core.setFailed("Azure Board reference missing in PR description");
};

run();
