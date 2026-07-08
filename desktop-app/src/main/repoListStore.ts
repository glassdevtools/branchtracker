import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REPO_LIST_FILE_NAME = "repo-list.json";

export type RepoList = {
  didAutoDetectChatProviderRepos: boolean;
  repoRoots: string[];
};

const isObject = (value: unknown): value is { [key: string]: unknown } => {
  return typeof value === "object" && value !== null;
};

const readUniqueRepoRoots = (repoRoots: string[]) => {
  const isRepoRootAddedOfRoot: { [repoRoot: string]: boolean } = {};
  const uniqueRepoRoots: string[] = [];

  for (const repoRoot of repoRoots) {
    if (repoRoot.length === 0 || isRepoRootAddedOfRoot[repoRoot] === true) {
      continue;
    }

    isRepoRootAddedOfRoot[repoRoot] = true;
    uniqueRepoRoots.push(repoRoot);
  }

  return uniqueRepoRoots;
};

const readRepoListFromValue = (value: unknown): RepoList => {
  if (!isObject(value)) {
    return { didAutoDetectChatProviderRepos: false, repoRoots: [] };
  }

  const repoRoots = Array.isArray(value.repoRoots)
    ? value.repoRoots.filter(
        (repoRoot): repoRoot is string => typeof repoRoot === "string",
      )
    : [];

  return {
    didAutoDetectChatProviderRepos:
      value.didAutoDetectChatProviderRepos === true,
    repoRoots: readUniqueRepoRoots(repoRoots),
  };
};

// The repo list is the source of truth for the sidebar, so detection can run once without re-adding removed repos.
export const createRepoListStore = ({
  userDataPath,
}: {
  userDataPath: string;
}) => {
  const repoListPath = join(userDataPath, REPO_LIST_FILE_NAME);
  let cachedRepoList: RepoList | null = null;

  const readRepoList = async (): Promise<RepoList> => {
    if (cachedRepoList !== null) {
      return cachedRepoList;
    }

    try {
      cachedRepoList = readRepoListFromValue(
        JSON.parse(await readFile(repoListPath, "utf8")),
      );
    } catch {
      // A missing or unreadable list starts empty so one corrupted file can't block the dashboard.
      cachedRepoList = { didAutoDetectChatProviderRepos: false, repoRoots: [] };
    }

    return cachedRepoList;
  };

  const writeRepoList = async (repoList: RepoList) => {
    cachedRepoList = repoList;
    await mkdir(userDataPath, { recursive: true });
    await writeFile(
      repoListPath,
      `${JSON.stringify(repoList, null, 2)}\n`,
      "utf8",
    );
  };

  const addRepoRoots = async (repoRoots: string[]) => {
    const repoList = await readRepoList();

    await writeRepoList({
      ...repoList,
      repoRoots: readUniqueRepoRoots([...repoList.repoRoots, ...repoRoots]),
    });
  };

  const removeRepoRoot = async (repoRoot: string) => {
    const repoList = await readRepoList();

    await writeRepoList({
      ...repoList,
      repoRoots: repoList.repoRoots.filter(
        (listedRepoRoot) => listedRepoRoot !== repoRoot,
      ),
    });
  };

  const markDidAutoDetectChatProviderRepos = async () => {
    const repoList = await readRepoList();

    if (repoList.didAutoDetectChatProviderRepos) {
      return;
    }

    await writeRepoList({ ...repoList, didAutoDetectChatProviderRepos: true });
  };

  return {
    readRepoList,
    addRepoRoots,
    removeRepoRoot,
    markDidAutoDetectChatProviderRepos,
  };
};

export type RepoListStore = ReturnType<typeof createRepoListStore>;
