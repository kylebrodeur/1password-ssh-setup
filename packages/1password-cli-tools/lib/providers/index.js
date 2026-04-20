import { npmProvider } from './npm.js';

export const KNOWN_PROVIDERS = [
  {
    id: 'OPENAI_API_KEY',
    label: 'OpenAI API Key',
    placeholder: 'op://Private/API-Keys/openai',
  },
  {
    id: 'ANTHROPIC_API_KEY',
    label: 'Anthropic API Key',
    placeholder: 'op://Private/API-Keys/anthropic',
  },
  {
    id: 'GITHUB_TOKEN',
    label: 'GitHub Token',
    placeholder: 'op://Personal/GitHub/token',
  },
  npmProvider,
  {
    id: 'CUSTOM',
    label: '[ Add Custom Key ]',
    isCustom: true
  }
];
