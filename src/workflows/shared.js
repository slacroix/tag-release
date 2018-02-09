import * as run from "./steps";

export const rebaseUpdateLogCommitTagRelease = [
	run.getCurrentBranchVersion,
	run.checkHasDevelopBranch,
	run.gitMergeUpstreamDevelop,
	run.gitShortLog,
	run.previewLog,
	run.askSemverJump,
	run.updateLog,
	run.updateVersion,
	run.updateChangelog,
	run.updatePackageLockJson,
	run.gitDiff,
	run.gitAdd,
	run.gitCommit,
	run.gitTag,
	run.gitPushUpstreamMaster,
	run.npmPublish,
	run.gitCheckoutDevelop,
	run.gitMergeMaster,
	run.gitPushUpstreamDevelop,
	run.gitPushOriginMaster,
	run.githubUpstream,
	run.githubRelease
];

export const createPullRequest = [
	run.getDependenciesFromFile,
	run.githubUpstream,
	run.askVersions,
	run.updateDependencies,
	run.updatePackageLockJson,
	run.gitDiff,
	run.gitAdd,
	run.gitAmendCommitBumpMessage,
	run.gitForcePushUpstreamFeatureBranch,
	run.githubUpstream,
	run.createGithubPullRequestAganistDevelop,
	run.cleanUpTmpFiles
];
