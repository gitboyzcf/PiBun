/**
 * webview 侧 RPC 客户端
 */
import { Electroview } from "electrobun/view";
import type { PiBunRpcSchema } from "../shared/rpc-schema";
import { handleAgentEvent, handleSessionState, showToast } from "./store";

export const rpc = Electroview.defineRPC<PiBunRpcSchema>({
	maxRequestTime: 60_000,
	handlers: {
		requests: {},
		messages: {
			agentEvent: ({ sessionId, event }) => handleAgentEvent(sessionId, event),
			sessionState: ({ session }) => handleSessionState(session),
			toast: ({ level, text }) => showToast(level, text),
		},
	},
});

// Electroview 需要实例化以建立 transport
new Electroview({ rpc });
