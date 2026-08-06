import assert from "node:assert/strict";
import test from "node:test";
import {
  readDuplicateCheckedOutBranchOfBranch,
  readCommitHistoryCheckoutsForCommit,
  readCommitHistoryRowCheckouts,
  readCommitHistoryRowThreadGroups,
} from "../src/renderer/commitHistoryCheckouts";
import type {
  ChatThread,
  GitChangeSummary,
  GitWorktree,
} from "../src/shared/types";

const CLEAN_CHANGE_SUMMARY: GitChangeSummary = {
  staged: {
    added: 0,
    removed: 0,
    changedFileCount: 0,
  },
  unstaged: {
    added: 0,
    removed: 0,
    changedFileCount: 0,
  },
  conflictCount: 0,
};

const DIRTY_CHANGE_SUMMARY: GitChangeSummary = {
  staged: {
    added: 1,
    removed: 0,
    changedFileCount: 1,
  },
  unstaged: {
    added: 0,
    removed: 0,
    changedFileCount: 0,
  },
  conflictCount: 0,
};

const createWorktree = ({
  path,
  head,
  branch,
}: {
  path: string;
  head: string;
  branch: string | null;
}) => {
  const worktree: GitWorktree = {
    path,
    head,
    branch,
    isDetached: false,
    threadIds: [],
  };

  return worktree;
};

const createThread = ({ id, cwd }: { id: string; cwd: string }) => {
  const thread: ChatThread = {
    id,
    providerId: "codex",
    name: null,
    preview: "",
    cwd,
    path: null,
    source: "",
    modelProvider: "",
    createdAt: 0,
    updatedAt: 0,
    archived: false,
    status: { type: "idle" },
    gitInfo: null,
  };

  return thread;
};

test("moves a dirty main checkout from the commit row to the changed row", () => {
  const checkouts = readCommitHistoryCheckoutsForCommit({
    commitSha: "head-sha",
    isMainHeadCommit: true,
    mainWorktreePath: "/repo/main",
    currentBranch: "main",
    worktrees: [],
    gitChangesOfCwd: {
      "/repo/main": DIRTY_CHANGE_SUMMARY,
    },
  });

  assert.deepEqual(
    readCommitHistoryRowCheckouts({
      checkouts,
      changedWorkingTreeCwd: null,
    }).map((checkout) => checkout.path),
    [],
  );
  assert.deepEqual(
    readCommitHistoryRowCheckouts({
      checkouts,
      changedWorkingTreeCwd: "/repo/main",
    }).map((checkout) => ({
      path: checkout.path,
      branch: checkout.branch,
      isMainWorktree: checkout.isMainWorktree,
    })),
    [{ path: "/repo/main", branch: "main", isMainWorktree: true }],
  );
});

test("shows the same branch on clean and dirty duplicate checkout rows", () => {
  const checkouts = readCommitHistoryCheckoutsForCommit({
    commitSha: "topic-sha",
    isMainHeadCommit: false,
    mainWorktreePath: "/repo/main",
    currentBranch: "main",
    worktrees: [
      createWorktree({
        path: "/repo/clean-topic",
        head: "topic-sha",
        branch: "topic",
      }),
      createWorktree({
        path: "/repo/dirty-topic",
        head: "topic-sha",
        branch: "topic",
      }),
    ],
    gitChangesOfCwd: {
      "/repo/clean-topic": CLEAN_CHANGE_SUMMARY,
      "/repo/dirty-topic": DIRTY_CHANGE_SUMMARY,
    },
  });

  assert.deepEqual(
    readCommitHistoryRowCheckouts({
      checkouts,
      changedWorkingTreeCwd: null,
    }).map((checkout) => ({
      path: checkout.path,
      branch: checkout.branch,
      worktreePath: checkout.worktree?.path,
    })),
    [
      {
        path: "/repo/clean-topic",
        branch: "topic",
        worktreePath: "/repo/clean-topic",
      },
    ],
  );
  assert.deepEqual(
    readCommitHistoryRowCheckouts({
      checkouts,
      changedWorkingTreeCwd: "/repo/dirty-topic",
    }).map((checkout) => ({
      path: checkout.path,
      branch: checkout.branch,
      worktreePath: checkout.worktree?.path,
    })),
    [
      {
        path: "/repo/dirty-topic",
        branch: "topic",
        worktreePath: "/repo/dirty-topic",
      },
    ],
  );
});

test("uses the most specific dirty checkout for nested worktree paths", () => {
  const checkouts = readCommitHistoryCheckoutsForCommit({
    commitSha: "shared-sha",
    isMainHeadCommit: true,
    mainWorktreePath: "/repo/main",
    currentBranch: "main",
    worktrees: [
      createWorktree({
        path: "/repo/main/worktrees/topic",
        head: "shared-sha",
        branch: "topic",
      }),
    ],
    gitChangesOfCwd: {
      "/repo/main": DIRTY_CHANGE_SUMMARY,
      "/repo/main/worktrees/topic": DIRTY_CHANGE_SUMMARY,
    },
  });

  assert.deepEqual(
    readCommitHistoryRowCheckouts({
      checkouts,
      changedWorkingTreeCwd: "/repo/main/worktrees/topic",
    }).map((checkout) => ({
      path: checkout.path,
      branch: checkout.branch,
      isMainWorktree: checkout.isMainWorktree,
    })),
    [
      {
        path: "/repo/main/worktrees/topic",
        branch: "topic",
        isMainWorktree: false,
      },
    ],
  );
});

test("keeps a dirty detached checkout branchless", () => {
  const checkouts = readCommitHistoryCheckoutsForCommit({
    commitSha: "head-sha",
    isMainHeadCommit: false,
    mainWorktreePath: "/repo/main",
    currentBranch: "main",
    worktrees: [
      createWorktree({
        path: "/repo/detached",
        head: "head-sha",
        branch: null,
      }),
    ],
    gitChangesOfCwd: {
      "/repo/detached": DIRTY_CHANGE_SUMMARY,
    },
  });

  assert.deepEqual(
    readCommitHistoryRowCheckouts({
      checkouts,
      changedWorkingTreeCwd: "/repo/detached",
    }).map((checkout) => ({
      path: checkout.path,
      branch: checkout.branch,
    })),
    [{ path: "/repo/detached", branch: null }],
  );
});

test("creates one row line per checkout and groups its chats", () => {
  const firstCheckout = createWorktree({
    path: "/repo/first",
    head: "shared-sha",
    branch: "first",
  });
  const secondCheckout = createWorktree({
    path: "/repo/second",
    head: "shared-sha",
    branch: "second",
  });

  assert.deepEqual(
    readCommitHistoryRowThreadGroups({
      checkouts: [
        {
          path: firstCheckout.path,
          branch: firstCheckout.branch,
          isMainWorktree: false,
          worktree: firstCheckout,
        },
        {
          path: secondCheckout.path,
          branch: secondCheckout.branch,
          isMainWorktree: false,
          worktree: secondCheckout,
        },
      ],
      threadGroups: [
        {
          key: "cwd:/repo/second/package-a",
          cwd: "/repo/second/package-a",
          threads: [
            createThread({ id: "second-a", cwd: "/repo/second/package-a" }),
          ],
        },
        {
          key: "cwd:/repo/first/package",
          cwd: "/repo/first/package",
          threads: [createThread({ id: "first", cwd: "/repo/first/package" })],
        },
        {
          key: "cwd:/repo/second/package-b",
          cwd: "/repo/second/package-b",
          threads: [
            createThread({ id: "second-b", cwd: "/repo/second/package-b" }),
          ],
        },
      ],
    }).map((threadGroup) => ({
      key: threadGroup.key,
      cwd: threadGroup.cwd,
      threadIds: threadGroup.threads.map((thread) => thread.id),
    })),
    [
      {
        key: "checkout:/repo/first",
        cwd: "/repo/first",
        threadIds: ["first"],
      },
      {
        key: "checkout:/repo/second",
        cwd: "/repo/second",
        threadIds: ["second-a", "second-b"],
      },
    ],
  );
});

test("keeps a checkout line when it has no chats", () => {
  const worktree = createWorktree({
    path: "/repo/clean-worktree",
    head: "shared-sha",
    branch: "topic",
  });

  assert.deepEqual(
    readCommitHistoryRowThreadGroups({
      checkouts: [
        {
          path: worktree.path,
          branch: worktree.branch,
          isMainWorktree: false,
          worktree,
        },
      ],
      threadGroups: [],
    }),
    [
      {
        key: "checkout:/repo/clean-worktree",
        cwd: "/repo/clean-worktree",
        threads: [],
      },
    ],
  );
});

test("keeps chat groups that do not belong to a checkout", () => {
  assert.deepEqual(
    readCommitHistoryRowThreadGroups({
      checkouts: [],
      threadGroups: [
        {
          key: "thread:cloud",
          cwd: "",
          threads: [],
        },
      ],
    }),
    [
      {
        key: "thread:cloud",
        cwd: "",
        threads: [],
      },
    ],
  );
});

test("detects branches checked out in multiple places", () => {
  assert.deepEqual(
    readDuplicateCheckedOutBranchOfBranch({
      currentBranch: "topic",
      worktrees: [
        createWorktree({
          path: "/repo/topic-a",
          head: "topic-sha",
          branch: "topic",
        }),
        createWorktree({
          path: "/repo/other",
          head: "other-sha",
          branch: "other",
        }),
        createWorktree({
          path: "/repo/other-again",
          head: "other-sha",
          branch: "other",
        }),
      ],
    }),
    {
      topic: true,
      other: true,
    },
  );
});
