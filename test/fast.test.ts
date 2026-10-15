import { describe, expect, it } from "vitest";
import { FastModeController, withPriorityServiceTier } from "../extensions/fast.ts";

const PROVIDER = "cliproxyapi";
/** A model served by this extension's provider. */
const proxyModel = (id: string) => ({ provider: PROVIDER, id });
/** pi's built-in Codex provider, which Fast also covers. */
const nativeModel = (id: string) => ({ provider: "openai-codex", id });

describe("FastModeController.stateForModel", () => {
	it("says on or off for a Fast-capable model, following the switch", () => {
		const fast = new FastModeController(false);
		fast.setSupportedModelIds(["gpt-6.1-sol"]);
		expect(fast.stateForModel(proxyModel("gpt-6.1-sol"), PROVIDER)).toBe("off");
		fast.setEnabled(true);
		expect(fast.stateForModel(proxyModel("gpt-6.1-sol"), PROVIDER)).toBe("on");
	});

	it("says nothing for a model without a priority tier, whichever way the switch is set", () => {
		const fast = new FastModeController(true);
		fast.setSupportedModelIds(["gpt-6.1-sol"]);
		expect(fast.stateForModel(proxyModel("deepseek-flash"), PROVIDER)).toBeUndefined();
		fast.setEnabled(false);
		expect(fast.stateForModel(proxyModel("deepseek-flash"), PROVIDER)).toBeUndefined();
	});

	it("matches model ids case-insensitively and follows a catalog refresh", () => {
		const fast = new FastModeController(true);
		fast.setSupportedModelIds(["GPT-6.1-Sol"]);
		expect(fast.stateForModel(proxyModel("gpt-6.1-sol"), PROVIDER)).toBe("on");
		fast.setSupportedModelIds([]);
		expect(fast.stateForModel(proxyModel("gpt-6.1-sol"), PROVIDER)).toBeUndefined();
	});

	it("only changes the wire request when the switch is on and the model is capable", () => {
		const fast = new FastModeController(false);
		fast.setSupportedModelIds(["gpt-6.1-sol"]);
		expect(fast.isEffectiveForModel(proxyModel("gpt-6.1-sol"), PROVIDER)).toBe(false);
		fast.setEnabled(true);
		expect(fast.isEffectiveForModel(proxyModel("gpt-6.1-sol"), PROVIDER)).toBe(true);
		expect(fast.isEffectiveForModel(proxyModel("deepseek-flash"), PROVIDER)).toBe(false);
	});

	it("covers native Codex GPT models without a catalog tier", () => {
		const fast = new FastModeController(true);
		fast.setSupportedModelIds([]);
		expect(fast.isFastCapableModel(nativeModel("gpt-6-luna"), PROVIDER)).toBe(true);
		expect(fast.stateForModel(nativeModel("gpt-6-luna"), PROVIDER)).toBe("on");
		// A native model that is not a GPT falls back to this provider's catalog,
		// which does not list it.
		expect(fast.isFastCapableModel(nativeModel("o5-mini"), PROVIDER)).toBe(false);
	});

	it("distinguishes a foreign provider's model from one that lacks a tier", () => {
		const fast = new FastModeController(true);
		fast.setSupportedModelIds(["gpt-6.1-sol"]);
		// Not ours: the switch does not reach it, so callers must not claim it
		// "does not advertise a priority service tier".
		expect(fast.managesModel({ provider: "anthropic", id: "claude-sonnet-5-5" }, PROVIDER)).toBe(false);
		expect(fast.isFastCapableModel({ provider: "anthropic", id: "claude-sonnet-5-5" }, PROVIDER)).toBe(false);
		// Ours, but the catalog gives it no tier.
		expect(fast.managesModel(proxyModel("deepseek-flash"), PROVIDER)).toBe(true);
		expect(fast.isFastCapableModel(proxyModel("deepseek-flash"), PROVIDER)).toBe(false);
	});
});

describe("withPriorityServiceTier", () => {
	it("adds the priority tier without mutating the payload", () => {
		const payload = { model: "gpt-6.1-sol", input: [] };
		expect(withPriorityServiceTier(payload)).toEqual({ ...payload, service_tier: "priority" });
		expect(payload).not.toHaveProperty("service_tier");
	});

	it("leaves a non-object payload alone", () => {
		expect(withPriorityServiceTier(undefined)).toBeUndefined();
		expect(withPriorityServiceTier([1])).toEqual([1]);
	});
});
