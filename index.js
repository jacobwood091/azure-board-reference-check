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
    core.info("Skipping validation for draft PR");
    core.setOutput("ab-numbers", []);
    return;
  }

  const description = pullRequest.body || "";

  // Check for Azure Board references (support multiple) or bypass
  const abMatches = description.match(/AB#\d+/g);
  const hasOverride = /\bno-ab\b/i.test(description);

  if (abMatches && abMatches.length > 0) {
    await core.summary
      .addHeading("✅ Azure Board Reference Found")
      .addRaw("Work items referenced in this PR:")
      .addList(abMatches)
      .write();

    core.setOutput("ab-numbers", abMatches);
    return;
  }

  if (hasOverride) {
    await core.summary
      .addHeading("✅ Azure Board Reference Check Bypassed")
      .addRaw("Check bypassed with `no-ab` keyword")
      .addSeparator()
      .addRaw(
        "This PR has been marked as not requiring an Azure Board reference.",
      )
      .write();

    core.setOutput("ab-numbers", []);
    return;
  }

  await core.summary
    .addHeading("❌ Azure Board Reference Missing")
    .addRaw("No Azure Board reference found in PR description")
    .addSeparator()
    .addHeading("To fix, either:", 2)
    .addList([
      "Add a work item reference in the format `AB#123456` to your PR description",
      "Or bypass the check by adding `no-ab` to your PR description",
    ])
    .addSeparator()
    .addHeading("Examples:", 2)
    .addRaw("With work item:")
    .addCodeBlock(`Fixed login issue as described in AB#123456`, "markdown")
    .addRaw("Without work item:")
    .addCodeBlock(`Updated documentation - no-ab`, "markdown")
    .write();

  core.setFailed(`❌ Missing Azure Board Reference

This PR needs to be linked to an Azure Board work item.

To fix, either:
   1. Add a work item reference in the format AB#123456 to your PR description
   2. Or bypass the check by adding "no-ab" to your PR description

Examples:
   With work item: "Fixed login issue as described in AB#123456"
   Without work item: "Updated documentation - no-ab"
`);

  core.setOutput("ab-numbers", []);
};

run();
