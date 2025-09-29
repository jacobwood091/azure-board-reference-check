import * as core from "@actions/core";
import * as github from "@actions/github";

const { context } = github;

const pullRequest = context.payload.pull_request;
const skipDrafts = core.getBooleanInput("skip-drafts");

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

  const description = pullRequest.body || "";

  // Check for Azure Board references (support multiple) or bypass
  const abMatches = description.match(/AB#\d+/g);
  const hasOverride = /\bno-ab\b/i.test(description);

  if (abMatches && abMatches.length > 0) {
    const references = abMatches.join(", ");

    // Create job summary for rich formatting
    await core.summary
      .addHeading("✅ Azure Board Reference Found")
      .addRaw(`Found reference(s): **${references}**`)
      .addSeparator()
      .addRaw("Azure Board reference(s) found in the PR description:")
      .addList(abMatches)
      .write();

    core.info(`✅ Azure Board reference(s) found: ${references}`);
    core.setOutput("ab-numbers", abMatches);
    return;
  }

  if (hasOverride) {
    // Create job summary for bypass case
    await core.summary
      .addHeading("✅ Azure Board Reference Check Bypassed")
      .addRaw("Check bypassed with `no-ab` keyword")
      .addSeparator()
      .addRaw(
        "This PR has been explicitly marked as not requiring an Azure Board reference using the `no-ab` bypass keyword.",
      )
      .write();

    core.info("✅ Override applied (no-ab)");
    core.setOutput("ab-numbers", []);
    return;
  }

  // Use job summary for rich formatting visible in the workflow run
  await core.summary
    .addHeading("❌ Azure Board Reference Missing")
    .addRaw("No Azure Board reference found in PR description")
    .addSeparator()
    .addHeading("🔧 How to fix:", 2)
    .addList([
      "Add a work item reference like `AB#1234` to your PR description",
      "Or bypass the check by adding `no-ab` to your PR description",
    ])
    .addSeparator()
    .addHeading("📝 Examples:", 2)
    .addRaw("**With work item:**")
    .addCodeBlock(`Fixed login issue as described in AB#5678`, "markdown")
    .addRaw("**Without work item:**")
    .addCodeBlock(`Updated documentation - no-ab`, "markdown")
    .write();

  // Use annotations to add inline feedback
  core.error("Azure Board reference missing from PR description", {
    title: "❌ Missing Azure Board Reference",
  });

  // Use notice for additional visibility
  core.notice(
    '💡 Add AB#1234 to your PR description or use "no-ab" to bypass this check',
  );

  // Use a detailed failure message
  core.setFailed(`❌ AZURE BOARD REFERENCE MISSING

📋 This PR needs to be linked to an Azure Board work item.

🔧 HOW TO FIX:
   1. Add a work item reference like AB#123456 to your PR description
   2. Or bypass the check by adding "no-ab" to your PR description

📝 EXAMPLES:
   ✅ With work item: "AB#123456"
   ✅ Without work item: "Updated documentation – no-ab"
`);

  core.setOutput("ab-numbers", []);
};

run();
