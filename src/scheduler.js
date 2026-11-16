// On-time triggers for the news bot in Temuujinhub/twitter-tech-bot.
//
// GitHub's own `schedule:` runs are often hours late or skipped, so the X posts and the daily
// market news article missed their times. A Cloudflare Cron Trigger (see wrangler.jsonc) fires
// on the minute and starts the bot's workflows with `workflow_dispatch`. The bot keeps its own
// timetable (5 random posts within working hours, one article a day), so starting it more often
// than needed is harmless: a run that is not due ends in a few seconds.
//
// Needs the Worker secret GITHUB_DISPATCH_TOKEN: a fine-grained GitHub token with access to
// Temuujinhub/twitter-tech-bot only and Permissions → Actions: Read and write.

const REPO = 'Temuujinhub/twitter-tech-bot';
const DEFAULT_REF = 'claude/twitter-bot-claude-setup-2cR85';

// UTC hours:minutes at which the daily website article is started (11:30 and 14:30 Ulaanbaatar).
// The second one is a retry: the article job publishes at most once a day.
const NEWS_TIMES = ['03:30', '06:30'];

export function workflowsFor(date) {
  const hhmm = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  const list = ['twitter-bot-automation.yml'];
  if (NEWS_TIMES.includes(hhmm)) list.push('website-news.yml');
  return list;
}

export async function dispatchWorkflow(env, workflow, fetchImpl = fetch) {
  const res = await fetchImpl(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'dar-rimal-scheduler',
    },
    body: JSON.stringify({ ref: env.BOT_REF || DEFAULT_REF }),
  });
  if (res.status !== 204) {
    const text = await res.text().catch(() => '');
    console.error(`dispatch ${workflow}: HTTP ${res.status} ${text.slice(0, 200)}`);
    return false;
  }
  console.log(`dispatch ${workflow}: started`);
  return true;
}

export async function runScheduled(event, env, fetchImpl = fetch) {
  if (!env.GITHUB_DISPATCH_TOKEN) {
    console.log('GITHUB_DISPATCH_TOKEN is not set: skipping the bot trigger');
    return [];
  }
  const workflows = workflowsFor(new Date(event.scheduledTime));
  return Promise.all(workflows.map((w) => dispatchWorkflow(env, w, fetchImpl)));
}
