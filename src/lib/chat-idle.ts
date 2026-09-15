/** Live-chat idle check: prompt client, then auto-close if no reply. */

/** Wait this long after the last bot/agent message before asking “still online?” */
export const CHAT_IDLE_PROMPT_AFTER_MS = 5 * 60 * 1000;

/** After the prompt, wait this long with no customer reply before closing. */
export const CHAT_IDLE_CLOSE_AFTER_MS = 2 * 60 * 1000;

export const CHAT_IDLE_CHECK_MESSAGE =
  "Are you still online for this chat? Please reply or tap **Yes, I'm still here** within a few minutes — otherwise we'll close this conversation due to inactivity.";

export const CHAT_IDLE_STILL_HERE_LABEL = "Yes, I'm still here";

export const CHAT_IDLE_AUTO_CLOSE_MESSAGE =
  "There was no response, so this chat has been closed due to inactivity. You can start a new conversation anytime.";
