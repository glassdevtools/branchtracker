// Git child processes need the parent environment because simple-git's env() replaces the
// environment instead of extending it. Without HOME and PATH, Git can't read the user's
// global config or credential helpers, so private-repo fetches fail even with saved logins.
//
// Editor, pager, and override variables stay out: the app never opens an editor, they can
// change Git's output format, and simple-git blocks them as unsafe. GIT_SSH_COMMAND passes
// through (with simple-git's explicit allowance) so custom SSH auth setups keep working.
const EXCLUDED_GIT_ENV_KEYS = [
  "EDITOR",
  "GIT_ASKPASS",
  "GIT_CONFIG",
  "GIT_EDITOR",
  "GIT_EXTERNAL_DIFF",
  "GIT_PAGER",
  "GIT_PROXY_COMMAND",
  "GIT_SEQUENCE_EDITOR",
];

export const GIT_UNSAFE_ALLOWANCES = {
  allowUnsafeSshCommand: true,
};

export const readGitProcessEnv = () => {
  const gitEnv: { [key: string]: string } = {};

  for (const key of Object.keys(process.env)) {
    const value = process.env[key];

    if (value === undefined || EXCLUDED_GIT_ENV_KEYS.includes(key)) {
      continue;
    }

    gitEnv[key] = value;
  }

  gitEnv.GIT_TERMINAL_PROMPT = "0";

  return gitEnv;
};
