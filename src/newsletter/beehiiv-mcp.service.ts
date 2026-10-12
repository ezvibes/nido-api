import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MCPToolset, StreamableHTTPConnectionParams } from '@google/adk';

export interface McpPostDraftPayload {
  title: string;
  content_html: string;
  subtitle?: string;
  publication_id?: string;
}

export interface McpPostDraftResult {
  id: string;
  title: string;
  subtitle?: string;
  status: 'draft';
  web_url?: string;
  created_at?: number;
}

@Injectable()
export class BeehiivMcpService {
  private readonly logger = new Logger(BeehiivMcpService.name);
  private toolset: MCPToolset | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initializes or returns the cached MCPToolset configured for Beehiiv remote MCP server.
   */
  getMcpToolset(): MCPToolset | null {
    if (this.toolset) {
      return this.toolset;
    }

    const apiKey = this.configService.get<string>('BEEHIIV_API_KEY')?.trim();
    const mcpUrl =
      this.configService.get<string>('BEEHIIV_MCP_URL')?.trim() ||
      'https://mcp.beehiiv.com/mcp';

    if (!apiKey) {
      this.logger.warn(
        'BEEHIIV_API_KEY is not configured; Beehiiv MCP toolset disabled.',
      );
      return null;
    }

    const connectionParams: StreamableHTTPConnectionParams = {
      type: 'StreamableHTTPConnectionParams',
      url: mcpUrl,
      transportOptions: {
        requestInit: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      },
    };

    try {
      this.toolset = new MCPToolset(connectionParams, [
        'create_post',
        'get_posts',
      ]);
      this.logger.log(`Initialized Beehiiv MCPToolset target: ${mcpUrl}`);
      return this.toolset;
    } catch (err: any) {
      this.logger.error(
        `Failed to initialize Beehiiv MCPToolset: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Stages a newsletter draft via MCP or graceful mock fallback.
   */
  async stageDraftViaMcp(
    payload: McpPostDraftPayload,
  ): Promise<McpPostDraftResult> {
    const isMockStaging =
      this.configService.get<string>('BEEHIIV_MOCK_STAGING') === 'true';

    if (isMockStaging) {
      this.logger.log(
        `[MOCK STAGING] BEEHIIV_MOCK_STAGING=true. Simulating successful draft staging for: "${payload.title}"`,
      );
      return {
        id: `mock_mcp_post_${Date.now()}`,
        title: payload.title,
        subtitle: payload.subtitle,
        status: 'draft',
        web_url: `https://app.beehiiv.com/posts/mock_${Date.now()}/edit`,
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    const toolset = this.getMcpToolset();
    if (!toolset) {
      this.logger.warn(
        `Beehiiv MCP Toolset unavailable. Falling back to local offline staging result.`,
      );
      return {
        id: `local_staged_${Date.now()}`,
        title: payload.title,
        subtitle: payload.subtitle,
        status: 'draft',
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    try {
      const pubId =
        payload.publication_id ||
        this.configService.get<string>('BEEHIIV_PUBLICATION_ID')?.trim();

      const session = await (toolset as any).mcpSessionManager.createSession();
      try {
        const result = await session.callTool({
          name: 'create_post',
          arguments: {
            title: payload.title,
            content_html: payload.content_html,
            subtitle: payload.subtitle,
            publication_id: pubId,
          },
        });

        const data = (result as any)?.content?.[0]?.text
          ? JSON.parse((result as any).content[0].text)
          : result;

        return {
          id: data.id || `mcp_post_${Date.now()}`,
          title: data.title || payload.title,
          subtitle: data.subtitle || payload.subtitle,
          status: 'draft',
          web_url: data.web_url,
          created_at: data.created_at || Math.floor(Date.now() / 1000),
        };
      } finally {
        await (toolset as any).mcpSessionManager.closeSession(session);
      }
    } catch (err: any) {
      this.logger.error(`MCP draft staging failed: ${err.message}`, err.stack);
      // Fallback with graceful non-fatal local draft result
      return {
        id: `offline_draft_${Date.now()}`,
        title: payload.title,
        subtitle: payload.subtitle,
        status: 'draft',
        created_at: Math.floor(Date.now() / 1000),
      };
    }
  }
}
