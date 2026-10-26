// The narration, one entry per scene. `npm run voice` reads this file, so edit the words here
// and re-run it; every scene stretches to fit its voice clip.

export type SceneId = 'hook' | 'problem' | 'intro' | 'demo' | 'how' | 'stack' | 'outro';

export const script: { id: SceneId; text: string }[] = [
  {
    id: 'hook',
    text: 'What if you could change your app for one user, without shipping a single line of code?',
  },
  {
    id: 'problem',
    text: 'Normally, turning a feature on means a new build, a deploy, and a wait. Turning it off during an incident? Same thing.',
  },
  {
    id: 'intro',
    text: 'This is FlagFlow. Multi-tenant feature flags that reach a running app in under a second.',
  },
  {
    id: 'demo',
    text: 'On the left, the dashboard. On the right, a live customer app. I turn on dark mode for user U zero zero one, and it switches instantly. No refresh. No redeploy. User U zero zero three is not targeted, so nothing changes for them.',
  },
  {
    id: 'how',
    text: 'Under the hood, the change is saved in Postgres with an audit log, published through Redis, and streamed to the app over server-sent events. The client evaluates flags locally, so the API key never reaches the browser.',
  },
  {
    id: 'stack',
    text: 'Built with React, Node, TypeScript, Postgres and Redis, and backed by end-to-end tests and a security attack suite.',
  },
  {
    id: 'outro',
    text: 'FlagFlow. Ship the code once. Flip the switch any time.',
  },
];
