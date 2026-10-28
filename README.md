# Wan 2.7 AI Video & Image Generator for Obsidian (`obsidian-wan27`)

Official Obsidian plugin for **[Wan 2.7 AI](https://wan2-7.io/)**. Generate 1080p/2K text-to-video, image-to-video, and AI images directly inside your Markdown notes, check remaining account credits, and insert ready-to-use **[Wan 2.7 MCP Server](https://wan2-7.io/mcp/)** configurations.

## Official Documentation & Links

- **Wan 2.7 Website & Studio**: [https://wan2-7.io/](https://wan2-7.io/)
- **Wan 2.7 MCP Server**: [https://wan2-7.io/mcp/](https://wan2-7.io/mcp/)
- **Wan 2.7 MCP Setup Guide**: [https://wan2-7.io/mcp/guide/](https://wan2-7.io/mcp/guide/)
- **Wan 2.7 CLI Reference**: [https://wan2-7.io/cli/](https://wan2-7.io/cli/)
- **Wan 2.7 Pricing & Credits**: [https://wan2-7.io/pricing/](https://wan2-7.io/pricing/)

## Commands

- **Generate AI video into this note**: Describe a shot (`wan2.7-t2v` or `wan2.7-i2v`) and embed the generated video directly at your cursor.
- **Generate AI image into this note**: Generate high-resolution keyframe or concept images (`wan2.7-image` or `wan2.7-image-pro`) into your note.
- **Show remaining Wan 2.7 credits**: Check your live credit balance on [wan2-7.io](https://wan2-7.io/pricing/).
- **Insert Wan 2.7 MCP Server configuration block**: Insert the JSON configuration for connecting Claude Desktop, Cursor, or OpenClaw to [`@wan27/cli`](https://wan2-7.io/cli/).

## Setup

1. Sign in at **[wan2-7.io](https://wan2-7.io/)** and follow the **[MCP & API Guide](https://wan2-7.io/mcp/guide/)** to obtain your `WAN27_API_TOKEN`.
2. In Obsidian, open **Settings → Wan 2.7 AI Video & Image Generator** and paste your token.

## Network Use & Privacy

This plugin communicates only with `https://wan2-7.io` using Obsidian's built-in `requestUrl` API when you explicitly run a command. No telemetry or analytics are collected.

## License

MIT © [Wan27](https://wan2-7.io/)
