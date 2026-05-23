// "AI Launches" niche feed.
// Definition: GitHub repos created in the last N days whose name/description
// matches AI/ML signal keywords AND already have meaningful traction (stars).
// This is the primary product wedge: a curated, geo-tagged AI launch map.

const AI_KEYWORDS = [
  'llm', 'gpt', 'rag', 'embedding', 'embeddings', 'transformer', 'transformers',
  'agent', 'agents', 'multimodal', 'fine-tune', 'finetune', 'fine-tuning',
  'finetuning', 'inference', 'pytorch', 'tensorflow', 'jax', 'cuda', 'rocm',
  'diffusion', 'stable-diffusion', 'sdxl', 'comfyui', 'a1111',
  'machine-learning', 'deep-learning', 'neural', 'neural-network',
  'vector-db', 'mlops', 'huggingface', 'langchain', 'llama', 'mistral',
  'phi-3', 'gemma', 'whisper', 'tts', 'stt', 'voice', 'computer-vision',
  'reinforcement-learning', 'rlhf', 'dpo', 'ppo', 'mlx', 'onnx',
  'quantization', 'distillation', 'lora', 'peft',
];

function isAIRepo(repo) {
  const haystack = [
    repo.name,
    repo.full_name,
    repo.description || '',
    ...(Array.isArray(repo.topics) ? repo.topics : []),
  ].join(' ').toLowerCase();
  for (const kw of AI_KEYWORDS) {
    if (haystack.includes(kw)) return true;
  }
  return false;
}

async function fetchRecentAIRepos({ daysBack = 7, minStars = 30, perPage = 50 } = {}) {
  const since = new Date(Date.now() - daysBack * 86400_000).toISOString().slice(0, 10);
  const u = new URL('https://api.github.com/search/repositories');
  u.searchParams.set(
    'q',
    `created:>${since} stars:>=${minStars} topic:machine-learning OR topic:llm OR topic:ai`
  );
  u.searchParams.set('sort', 'stars');
  u.searchParams.set('order', 'desc');
  u.searchParams.set('per_page', String(perPage));
  const res = await fetch(u, {
    headers: {
      'User-Agent': 'TerraPulse/2.0',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`gh search ${res.status}`);
  const j = await res.json();
  return (j.items || [])
    .filter(isAIRepo)
    .map((r) => ({
      id: r.id,
      name: r.full_name,
      description: r.description,
      stars: r.stargazers_count,
      language: r.language,
      url: r.html_url,
      owner: r.owner.login,
      ownerAvatar: r.owner.avatar_url,
      createdAt: r.created_at,
      topics: r.topics,
    }));
}

module.exports = { fetchRecentAIRepos, isAIRepo };
