// The inputs of the MCP tools the session had connected when this mod
// was last saved, from each server's tools/list inputSchema.
// Merges into the engine's ToolCallInput (types/ McpToolInputs) so
// `e.tool === "mcp__<server>__<tool>"` narrows to the tool's arguments.
// Written again at a save of the mod with a server connected.
// Trimmed in this repo to the plugin's own server, so no one's connected servers are committed.
export {}
declare module 'claude-code' {
  interface McpToolInputs {
    /** Compact the conversation, as /compact does, once the current turn ends. */
    "mcp__ai-workflow__compact": {
      /** What the summary must keep */
      instructions?: string
    }
    /** The plan rate-limit windows (five_hour, seven_day, ...): percent used and reset time. */
    "mcp__ai-workflow__usage": {}
    /** The session's permission mode (default, acceptEdits, auto, bypassPermissions, plan, dontAsk), or unknown. */
    "mcp__ai-workflow__permission_mode": {}
  }
}
