// Claude API access for Omni Agent and the AI tools: settings, the SDK client, single-shot completions and errors.
(function () {
	'use strict';
	const { store } = Omni;

	const DEFAULT_MODEL = 'claude-opus-5-5';
	// Models that accept the server-side refusal fallback ("fallbacks": "default"); others reject the parameter.
	const FALLBACK_MODELS = ['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5'];
	const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

	function settings() {
		return {
			model: (store.get('ai.model', DEFAULT_MODEL) || DEFAULT_MODEL).trim(),
			effort: store.get('ai.effort', 'medium'),
			fallback: store.get('ai.fallback', true),
		};
	}

	async function key() {
		const k = await Omni.secrets.get('anthropic');
		return k && String(k).trim() ? String(k).trim() : null;
	}

	async function mode() {
		return (await key()) ? 'claude' : 'offline';
	}

	async function client() {
		const apiKey = await key();
		if (!apiKey) throw new Error('No API key yet. Add one in Settings to use Claude.');
		await Omni.vendor('anthropic-sdk.min.js');
		// The key never leaves this machine except to api.anthropic.com; the SDK needs this flag to run in a page.
		return new window.Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
	}

	/** Adds model, effort and (where supported) refusal fallbacks to a Messages request. */
	function params(base) {
		const s = settings();
		const p = { model: s.model, ...base };
		if (s.effort && s.effort !== 'default') p.output_config = { ...(p.output_config || {}), effort: s.effort };
		if (s.fallback && FALLBACK_MODELS.includes(s.model)) {
			p.betas = [...(p.betas || []), FALLBACK_BETA];
			p.fallbacks = 'default';
		}
		return p;
	}

	/** Friendly text for SDK errors, by type rather than by message text. */
	function errorMessage(err) {
		const A = window.Anthropic;
		if (A && err instanceof A.AuthenticationError) return 'The API key was rejected. Check it in Settings (it starts with sk-ant-).';
		if (A && err instanceof A.PermissionDeniedError) return 'This API key is not allowed to use that model or feature.';
		if (A && err instanceof A.NotFoundError) return `The model "${settings().model}" was not found for this key. Check the model string in Settings.`;
		if (A && err instanceof A.RateLimitError) return 'Rate limited by the Claude API. Wait a moment and try again.';
		if (A && err instanceof A.BadRequestError) return `The Claude API refused the request: ${(err.error && err.error.error && err.error.error.message) || err.message}. If you changed the model or effort in Settings, try "Model default" effort.`;
		if (A && err instanceof A.APIConnectionError) return 'Could not reach api.anthropic.com. Check your internet connection.';
		if (A && err instanceof A.APIUserAbortError) return 'Stopped.';
		if (A && err instanceof A.APIError) return `Claude API error ${err.status || ''}: ${err.message}`;
		return err && err.message ? err.message : String(err);
	}

	function refusalText(message) {
		const cat = message.stop_details && message.stop_details.category;
		return `Claude declined this request${cat ? ` (category: ${cat})` : ''}. Rephrase it, or use the offline result.`;
	}

	/** One streamed request with no tools. onText(delta) receives text as it arrives. Resolves with the full text. */
	async function complete({ system, prompt, onText, signal, maxTokens }) {
		const c = await client();
		const stream = c.beta.messages.stream(
			params({ max_tokens: maxTokens || 16000, system, messages: [{ role: 'user', content: prompt }] }),
			signal ? { signal } : undefined,
		);
		if (onText) stream.on('text', onText);
		const message = await stream.finalMessage();
		if (message.stop_reason === 'refusal') throw new Error(refusalText(message));
		const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
		return message.stop_reason === 'max_tokens' ? text + '\n\n[The answer hit the length limit and was cut off.]' : text;
	}

	Omni.ai = { DEFAULT_MODEL, FALLBACK_MODELS, settings, key, mode, client, params, complete, errorMessage, refusalText };
})();
