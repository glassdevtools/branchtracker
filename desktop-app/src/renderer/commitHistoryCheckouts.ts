import type { GitChangeSummary, GitWorktree } from "../shared/types";
import { readGitChangeCleanState, readIsCwdInsidePath } from "./threadGroups";
import type { ThreadGroup } from "./threadGroups";

export type CommitHistoryCheckout = {
  path: string;
  branch: string | null;
  isMainWorktree: boolean;
  worktree: GitWorktree | null;
};

type CommitHistoryCheckoutWithDirtyState = CommitHistoryCheckout & {
  isDirty: boolean;
};

export const readCommitHistoryCheckoutsForCommit = ({
  commitSha,
  isMainHeadCommit,
  mainWorktreePath,
  currentBranch,
  worktrees,
  gitChangesOfCwd,
}: {
  commitSha: string;
  isMainHeadCommit: boolean;
  mainWorktreePath: string;
  currentBranch: string | null;
  worktrees: GitWorktree[];
  gitChangesOfCwd: { [cwd: string]: GitChangeSummary };
}) => {
  const checkouts: CommitHistoryCheckoutWithDirtyState[] = [];

  if (isMainHeadCommit) {
    checkouts.push({
      path: mainWorktreePath,
      branch: currentBranch,
      isMainWorktree: true,
      worktree: null,
      isDirty:
        readGitChangeCleanState({
          gitChangesOfCwd,
          cwd: mainWorktreePath,
        }) === "dirty",
    });
  }

  for (const worktree of worktrees) {
    if (worktree.head !== commitSha) {
      continue;
    }

    checkouts.push({
      path: worktree.path,
      branch: worktree.branch,
      isMainWorktree: false,
      worktree,
      isDirty:
        readGitChangeCleanState({
          gitChangesOfCwd,
          cwd: worktree.path,
        }) === "dirty",
    });
  }

  return checkouts;
};

export const readCommitHistoryRowCheckouts = ({
  checkouts,
  changedWorkingTreeCwd,
}: {
  checkouts: CommitHistoryCheckoutWithDirtyState[];
  changedWorkingTreeCwd: string | null;
}) => {
  if (changedWorkingTreeCwd === null) {
    return checkouts.filter((checkout) => !checkout.isDirty);
  }

  let owningCheckoutPath: string | null = null;

  for (const checkout of checkouts) {
    if (
      !checkout.isDirty ||
      !readIsCwdInsidePath({ cwd: changedWorkingTreeCwd, path: checkout.path })
    ) {
      continue;
    }

    if (
      owningCheckoutPath === null ||
      checkout.path.length > owningCheckoutPath.length
    ) {
      owningCheckoutPath = checkout.path;
    }
  }

  return checkouts.filter(
    (checkout) => checkout.isDirty && checkout.path === owningCheckoutPath,
  );
};

// Existing checkouts define the visible lines in a history row. Chats inside a
// checkout share that checkout's line, while chats without a local checkout
// keep their own cwd line.
export const readCommitHistoryRowThreadGroups = ({
  threadGroups,
  checkouts,
}: {
  threadGroups: ThreadGroup[];
  checkouts: CommitHistoryCheckout[];
}) => {
  const checkoutThreadGroups: ThreadGroup[] = checkouts.map((checkout) => ({
    key: `checkout:${checkout.path}`,
    cwd: checkout.path,
    threads: [],
  }));
  const unownedThreadGroups: ThreadGroup[] = [];

  for (const threadGroup of threadGroups) {
    let owningCheckoutIndex: number | null = null;

    for (
      let checkoutIndex = 0;
      checkoutIndex < checkouts.length;
      checkoutIndex += 1
    ) {
      const checkout = checkouts[checkoutIndex];

      if (!readIsCwdInsidePath({ cwd: threadGroup.cwd, path: checkout.path })) {
        continue;
      }

      if (
        owningCheckoutIndex === null ||
        checkout.path.length > checkouts[owningCheckoutIndex].path.length
      ) {
        owningCheckoutIndex = checkoutIndex;
      }
    }

    if (owningCheckoutIndex === null) {
      unownedThreadGroups.push(threadGroup);
      continue;
    }

    checkoutThreadGroups[owningCheckoutIndex].threads.push(
      ...threadGroup.threads,
    );
  }

  return [...checkoutThreadGroups, ...unownedThreadGroups];
};

export const readDirtyCommitHistoryCheckoutBranches = (
  checkouts: CommitHistoryCheckoutWithDirtyState[],
) => {
  const isDirtyBranchOfBranch: { [branch: string]: boolean } = {};

  for (const checkout of checkouts) {
    if (!checkout.isDirty || checkout.branch === null) {
      continue;
    }

    isDirtyBranchOfBranch[checkout.branch] = true;
  }

  return isDirtyBranchOfBranch;
};

export const readDuplicateCheckedOutBranchOfBranch = ({
  currentBranch,
  worktrees,
}: {
  currentBranch: string | null;
  worktrees: GitWorktree[];
}) => {
  const checkoutCountOfBranch: { [branch: string]: number } = {};
  const duplicateCheckedOutBranchOfBranch: { [branch: string]: boolean } = {};

  const pushCheckedOutBranch = (branch: string | null) => {
    if (branch === null) {
      return;
    }

    const checkoutCount = (checkoutCountOfBranch[branch] ?? 0) + 1;
    checkoutCountOfBranch[branch] = checkoutCount;

    if (checkoutCount > 1) {
      duplicateCheckedOutBranchOfBranch[branch] = true;
    }
  };

  pushCheckedOutBranch(currentBranch);

  for (const worktree of worktrees) {
    pushCheckedOutBranch(worktree.branch);
  }

  return duplicateCheckedOutBranchOfBranch;
};
