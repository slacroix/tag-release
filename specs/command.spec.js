const util = require("../src/utils");
const command = require("../src/command");
const git = require("../src/git");
const path = require("path");
const runCommand = require("../src/helpers/runCommand");
const getBranchList = require("../src/helpers/getBranchList"); // eslint-disable-line no-unused-vars

jest.mock("../src/utils");
jest.mock("../src/helpers/runCommand", () =>
	jest.fn(() => Promise.resolve(""))
);
jest.mock("../src/helpers/getBranchList", () =>
	jest.fn(() =>
		Promise.resolve([
			"feature-branch",
			"promote-release-v1.1.1-feature.0",
			"* master",
			"develop",
			"promote-release-v1.1.1-feature.1"
		])
	)
);
jest.mock("../src/git");

describe("command", () => {
	let branch, onError;
	beforeEach(() => {
		branch = "feature-branch";
		onError = jest.fn();
	});

	describe("branchExists", () => {
		it("should call branch with appropriate args", () => {
			git.branch.mockImplementation(() =>
				Promise.resolve("feature-branch")
			);
			return command.branchExists("feature-branch").then(result => {
				expect(git.branch).toHaveBeenCalledTimes(1);
				expect(git.branch).toHaveBeenCalledWith({
					branch: "feature-branch",
					option: "--list",
					logMessage: `verifying "feature-branch" exists`
				});
				expect(result).toBe(true);
			});
		});
	});

	describe("branchExistsRemote", () => {
		it(`should return if branch exists on "origin" remote`, () => {
			return command
				.branchExistsRemote({
					branch: "feature-branch",
					remote: "origin"
				})
				.then(() => {
					expect(runCommand).toHaveBeenCalledTimes(1);
					expect(runCommand).toHaveBeenCalledWith({
						args: "ls-remote origin feature-branch",
						logMessage: `checking if "feature-branch" exists on origin`
					});
				});
		});
	});

	describe("checkConflictMarkers", () => {
		it("should call diff with appropriate args", () => {
			command.checkConflictMarkers();
			expect(git.diff).toHaveBeenCalledTimes(1);
			expect(git.diff).toHaveBeenCalledWith({
				option: "--check",
				logMessage: "verifying conflict resolution",
				failHelpKey: "gitCheckConflictMarkers",
				showError: false
			});
		});
	});

	describe("commitAmend", () => {
		it("should call commit with appropriate args", () => {
			command.commitAmend({ comment: "commit message" });
			expect(git.commit).toHaveBeenCalledTimes(1);
			expect(git.commit).toHaveBeenCalledWith({
				option: "--amend -m",
				comment: "commit message"
			});
		});
	});

	describe("cleanUp", () => {
		let joinSpy, deleteSpy;
		beforeEach(() => {
			joinSpy = jest
				.spyOn(path, "join")
				.mockImplementation(() => "my_path/");
			deleteSpy = jest
				.spyOn(util, "deleteFile")
				.mockImplementation(() => "");
		});

		it("should call 'runCommand' with appropriate arguments", () => {
			return command.cleanUp().then(() => {
				expect(deleteSpy).toHaveBeenCalledTimes(1);
				expect(deleteSpy).toHaveBeenCalledWith(`my_path/`);
			});
		});

		afterEach(() => {
			joinSpy.mockRestore();
			deleteSpy.mockRestore();
		});
	});

	describe("fetchUpstream", () => {
		it("should call fetch with appropriate args", () => {
			command.fetchUpstream({});
			expect(git.fetch).toHaveBeenCalledTimes(1);
			expect(git.fetch).toHaveBeenCalledWith({
				failHelpKey: "fetchUpstream"
			});
		});
	});

	describe("generateRebaseCommitLog", () => {
		let writeSpy;
		beforeEach(() => {
			writeSpy = jest
				.spyOn(util, "writeFile")
				.mockImplementation(() => "");
		});

		it("should remove all pre-release commits", () => {
			runCommand.mockImplementation(() =>
				Promise.resolve(`0987654 1.1.1-feature.1
et768df this is commit 2
23fe4e3 1.1.1-feature.0
0dda789 this is commit 1`)
			);
			return command.generateRebaseCommitLog().then(() => {
				expect(writeSpy.mock.calls[0][1])
					.toEqual(`pick 0dda789 this is commit 1
pick et768df this is commit 2
`);
			});
		});

		it("should remove all pre-release commits part 2", () => {
			runCommand.mockImplementation(() =>
				Promise.resolve(`eabc473 1.1.1-feature.1
2f3e4a5 v1.1.1-fancy.9
23ae89c this is commit 2
e7a8e93 1.1.1-feature.0
098abc7 this is commit 1
3eabc56 something random
987abc6 1.0.0-new.0
9b8a76c 0.0.9-new-thing.18
0a9b8c7 another commit
abcd9e8 0.1.1-feature.1 should also be left
e8d9f00 should leave this 0.1.1-feature.0`)
			);
			return command.generateRebaseCommitLog().then(() => {
				expect(writeSpy.mock.calls[0][1])
					.toEqual(`pick e8d9f00 should leave this 0.1.1-feature.0
pick abcd9e8 0.1.1-feature.1 should also be left
pick 0a9b8c7 another commit
pick 3eabc56 something random
pick 098abc7 this is commit 1
pick 23ae89c this is commit 2
`);
			});
		});

		afterEach(() => {
			writeSpy.mockRestore();
		});
	});

	describe("getPrereleaseTagList", () => {
		beforeEach(() => {
			runCommand.mockImplementation(() =>
				Promise.resolve(`v18.0.0-robert.0
v18.0.0-robert.1
v17.12.0-break.1
v17.12.0-break.0
v17.11.2`)
			);
		});

		it("should runCommand with appropriate args", () => {
			return command.getPrereleaseTagList().then(() => {
				expect(runCommand).toHaveBeenCalledTimes(1);
				expect(runCommand).toHaveBeenCalledWith({
					args: "tag --sort=-v:refname",
					logMessage: "getting list of pre-releases"
				});
			});
		});

		it("should return list of latest tags", () => {
			return command.getPrereleaseTagList(10).then(result => {
				expect(result).toEqual([
					"v18.0.0-robert.1",
					"v17.12.0-break.1"
				]);
			});
		});
	});

	describe("removePreReleaseCommits", () => {
		let joinSpy;
		beforeEach(() => {
			joinSpy = jest
				.spyOn(path, "join")
				.mockImplementation(() => "my_path/");
		});

		it("should call 'runCommand' with appropriate arguments", () => {
			return command.removePreReleaseCommits().then(() => {
				expect(runCommand).toHaveBeenCalledTimes(1);
				expect(runCommand).toHaveBeenCalledWith({
					args:
						'GIT_SEQUENCE_EDITOR="cat my_path/ >" git rebase -i -p upstream/master',
					failHelpKey: "gitRebaseInteractive",
					fullCommand: true,
					logMessage: "Removing pre-release commit history",
					exitOnFail: true
				});
			});
		});

		it("should pass onError to 'runCommand'", () => {
			return command.removePreReleaseCommits({ onError }).then(() => {
				expect(runCommand).toHaveBeenCalledTimes(1);
				expect(runCommand).toHaveBeenCalledWith({
					args:
						'GIT_SEQUENCE_EDITOR="cat my_path/ >" git rebase -i -p upstream/master',
					failHelpKey: "gitRebaseInteractive",
					fullCommand: true,
					logMessage: "Removing pre-release commit history",
					exitOnFail: true,
					onError
				});
			});
		});

		afterEach(() => {
			joinSpy.mockRestore();
		});
	});

	describe("removePromotionBranches", () => {
		let deleteBranchSpy;
		beforeEach(() => {
			deleteBranchSpy = jest
				.spyOn(command, "deleteBranch")
				.mockImplementation(
					jest.fn(response => Promise.resolve(response.branch))
				);
		});

		it("should remove all promotion branches", () => {
			return command.removePromotionBranches().then(result => {
				expect(command.deleteBranch).toHaveBeenCalledTimes(2);
				expect(result).toEqual([
					"promote-release-v1.1.1-feature.0",
					"promote-release-v1.1.1-feature.1"
				]);
			});
		});

		afterEach(() => {
			deleteBranchSpy.mockRestore();
		});
	});

	describe("stageFiles", () => {
		it("should call add with appropriate args", () => {
			command.stageFiles();
			expect(git.add).toHaveBeenCalledTimes(1);
			expect(git.add).toHaveBeenCalledWith({
				option: "-u"
			});
		});
	});

	describe("checkout commands", () => {
		const checkoutCommands = {
			checkoutAndCreateBranch: {
				args: { branch, onError },
				expected: { branch, option: "-b", onError }
			},
			checkoutBranch: {
				args: { branch },
				expected: { branch }
			},
			checkoutTag: {
				args: { tag: "v1.0.0-pre" },
				expected: {
					branch: "promote-release-v1.0.0-pre",
					option: "-b",
					tag: "v1.0.0-pre"
				}
			}
		};

		describe("default", () => {
			Object.keys(checkoutCommands).forEach(comm => {
				const data = checkoutCommands[comm];

				it(`should call "command.${comm}" with the appropriate args`, () => {
					const result = data.args
						? command[comm].bind(null, data.args)
						: command[comm].bind(null, {});
					result();

					expect(git.checkout).toHaveBeenCalledTimes(1);
					expect(git.checkout).toHaveBeenCalledWith(data.expected);
				});
			});
		});
	});

	describe("branch commands", () => {
		const branchCommands = {
			createLocalBranch: {
				args: "feature-branch",
				expected: {
					branch: "feature-branch",
					tracking: "feature-branch",
					logMessage: `creating local branch "feature-branch"`
				}
			},
			deleteBranch: {
				args: { branch, onError },
				expected: {
					branch,
					option: "-D",
					showOutput: true,
					logMessage: "",
					onError
				}
			},
			getRemoteBranches: {
				expected: {
					option: "-r",
					showOutput: false
				}
			},
			getAllBranchesWithTag: {
				args: "v1.0.0-pre",
				expected: {
					option: "-a --contains",
					tag: "v1.0.0-pre"
				}
			}
		};

		describe("default", () => {
			Object.keys(branchCommands).forEach(comm => {
				const data = branchCommands[comm];

				it(`should call "command.${comm}" with the appropriate args`, () => {
					const result = data.args
						? command[comm].bind(null, data.args)
						: command[comm];
					result();

					expect(git.branch).toHaveBeenCalledTimes(1);
					expect(git.branch).toHaveBeenCalledWith(data.expected);
				});
			});
		});
	});

	describe("merge commands", () => {
		const mergeCommands = {
			mergeMaster: {
				expected: {
					branch: "master",
					failHelpKey: "gitMergeDevelopWithMaster"
				}
			},
			mergePromotionBranch: {
				args: "v1.0.0-pre",
				expected: {
					branch: "promote-release-v1.0.0-pre",
					fastForwardOnly: false
				}
			},
			mergeUpstreamDevelop: {
				expected: {
					branch: "develop",
					remote: "upstream"
				}
			},
			mergeUpstreamMaster: {
				expected: {
					branch: "master",
					remote: "upstream"
				}
			}
		};

		describe("default", () => {
			Object.keys(mergeCommands).forEach(comm => {
				const data = mergeCommands[comm];

				it(`should call "command.${comm}" with the appropriate args`, () => {
					const result = data.args
						? command[comm].bind(null, data.args)
						: command[comm];
					result();

					expect(git.merge).toHaveBeenCalledTimes(1);
					expect(git.merge).toHaveBeenCalledWith(data.expected);
				});
			});
		});
	});

	describe("push commands", () => {
		const pushCommands = {
			createRemoteBranch: {
				args: { branch },
				expected: {
					branch,
					remote: "upstream",
					base: "master"
				}
			},
			deleteBranchUpstream: {
				args: { branch, onError },
				expected: {
					branch: `:${branch}`,
					remote: "upstream",
					logMessage: "",
					onError
				}
			},
			pushRemoteBranch: {
				args: { branch, onError },
				expected: {
					branch,
					option: "-u",
					remote: "origin",
					onError
				}
			},
			pushUpstreamMaster: {
				expected: {
					branch: "master",
					remote: "upstream",
					failHelpKey: "gitPushUpstreamFeatureBranch"
				}
			},
			pushUpstreamMasterWithTag: {
				args: { tag: "v1.0.0-pre" },
				expected: {
					branch: "master",
					remote: "upstream",
					tag: "v1.0.0-pre"
				}
			},
			pushOriginMaster: {
				expected: {
					branch: "master",
					remote: "origin"
				}
			},
			pushUpstreamDevelop: {
				expected: {
					branch: "develop",
					remote: "upstream"
				}
			}
		};

		describe("default", () => {
			Object.keys(pushCommands).forEach(comm => {
				const data = pushCommands[comm];

				it(`should call "command.${comm}" with the appropriate args`, () => {
					const result = data.args
						? command[comm].bind(null, data.args)
						: command[comm];
					result();

					expect(git.push).toHaveBeenCalledTimes(1);
					expect(git.push).toHaveBeenCalledWith(data.expected);
				});
			});
		});
	});

	describe("rebase commands", () => {
		const rebaseCommands = {
			rebaseUpstreamBranch: {
				args: { branch, onError },
				expected: {
					branch,
					remote: "upstream",
					onError,
					exitOnFail: false
				}
			},
			rebaseUpstreamDevelop: {
				args: { onError },
				expected: {
					branch: "develop",
					remote: "upstream",
					failHelpKey: "gitRebaseUpstreamBase",
					exitOnFail: true,
					onError
				}
			},
			rebaseUpstreamMaster: {
				args: { onError },
				expected: {
					branch: "master",
					remote: "upstream",
					failHelpKey: "gitRebaseUpstreamBase",
					exitOnFail: true,
					onError
				}
			}
		};

		describe("default", () => {
			Object.keys(rebaseCommands).forEach(comm => {
				const data = rebaseCommands[comm];

				it(`should call "command.${comm}" with the appropriate args`, () => {
					const result = data.args
						? command[comm].bind(null, data.args)
						: command[comm];
					result();

					expect(git.rebase).toHaveBeenCalledTimes(1);
					expect(git.rebase).toHaveBeenCalledWith(data.expected);
				});
			});
		});
	});

	describe("runCommand commands", () => {
		const runCommands = {
			getTagList: {
				expected: {
					args: "tag --sort=v:refname",
					logMessage: "getting list of tags"
				}
			},
			getLatestCommitMessage: {
				expected: {
					args: "log --format=%B -n 1"
				}
			},
			getLastCommitText: {
				expected: {
					args: "log -1 --pretty=%B",
					showOutput: false
				}
			},
			resetBranch: {
				args: branch,
				expected: {
					args: `reset --hard upstream/${branch}`
				}
			},
			rebaseContinue: {
				expected: {
					args: `GIT_EDITOR="cat" git rebase --continue`,
					logMessage: "continuing with rebase",
					failHelpKey: "gitRebaseInteractive",
					showError: false,
					fullCommand: true
				}
			},
			shortLog: {
				args: "v1.0.0-pre",
				expected: {
					args: `--no-pager log --no-merges --date-order --pretty=format:"%s" v1.0.0-pre..`,
					logMessage: "parsing git log"
				}
			},
			uncommittedChangesExist: {
				args: {},
				expected: {
					args: "diff-index HEAD --",
					logMessage: "checking for uncommitted changes"
				}
			}
		};

		describe("default", () => {
			Object.keys(runCommands).forEach(comm => {
				const data = runCommands[comm];

				it(`should call "command.${comm}" with the appropriate args`, () => {
					const result = data.args
						? command[comm](data.args)
						: command[comm]();

					return result.then(() => {
						expect(runCommand).toHaveBeenCalledTimes(1);
						expect(runCommand).toHaveBeenCalledWith(data.expected);
					});
				});
			});
		});
	});

	describe("alternate behaviors", () => {
		it(`should call "command.shortLog" with the appropriate options when no tag is given`, () => {
			return command.shortLog().then(() => {
				expect(runCommand).toHaveBeenCalledTimes(1);
				expect(runCommand).toHaveBeenCalledWith({
					args: `--no-pager log --no-merges --date-order --pretty=format:"%s"`,
					logMessage: "parsing git log"
				});
			});
		});

		it(`"rebaseUpstreamMaster" should handle no args`, () => {
			command.rebaseUpstreamMaster();

			expect(git.rebase).toHaveBeenCalledTimes(1);
			expect(git.rebase).toHaveBeenCalledWith({
				branch: "master",
				remote: "upstream",
				failHelpKey: "gitRebaseUpstreamBase",
				exitOnFail: true
			});
		});

		it(`"rebaseUpstreamDevelop" should handle no args`, () => {
			command.rebaseUpstreamDevelop();

			expect(git.rebase).toHaveBeenCalledTimes(1);
			expect(git.rebase).toHaveBeenCalledWith({
				branch: "develop",
				remote: "upstream",
				failHelpKey: "gitRebaseUpstreamBase",
				exitOnFail: true
			});
		});
	});
});
