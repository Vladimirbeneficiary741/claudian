import type { App } from 'obsidian';

import { ProviderRegistry } from '../../core/providers/ProviderRegistry';
import type { SharedAppStorage } from '../../core/bootstrap/storage';
import type { Conversation, ConversationMeta } from '../../core/types';
import type { ProviderId } from '../../core/types';
import { DEFAULT_CHAT_PROVIDER_ID } from '../../core/providers/types';
import type { ClaudianView } from '../../features/chat/ClaudianView';
import { getVaultPath } from '../../utils/path';

interface ConversationServiceDeps {
  app: App;
  storage: SharedAppStorage;
  getAllViews: () => ClaudianView[];
}

export class ConversationService {
  private readonly deps: ConversationServiceDeps;

  constructor(deps: ConversationServiceDeps) {
    this.deps = deps;
  }

  restoreFromMetadata(allMetadata: Array<{
    id: string;
    providerId?: ProviderId;
    title: string;
    createdAt: number;
    updatedAt: number;
    lastResponseAt?: number;
    sessionId?: string | null;
    providerState?: Record<string, unknown>;
    currentNote?: string;
    externalContextPaths?: string[];
    enabledMcpServers?: string[];
    usage?: Conversation['usage'];
    titleGenerationStatus?: Conversation['titleGenerationStatus'];
    resumeAtMessageId?: string;
  }>): Conversation[] {
    return allMetadata.map((meta) => {
      const resumeSessionId = meta.sessionId !== undefined ? meta.sessionId : meta.id;

      return {
        id: meta.id,
        providerId: meta.providerId ?? DEFAULT_CHAT_PROVIDER_ID,
        title: meta.title,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        lastResponseAt: meta.lastResponseAt,
        sessionId: resumeSessionId,
        providerState: meta.providerState,
        messages: [],
        currentNote: meta.currentNote,
        externalContextPaths: meta.externalContextPaths,
        enabledMcpServers: meta.enabledMcpServers,
        usage: meta.usage,
        titleGenerationStatus: meta.titleGenerationStatus,
        resumeAtMessageId: meta.resumeAtMessageId,
      };
    }).sort(
      (a, b) => (b.lastResponseAt ?? b.updatedAt) - (a.lastResponseAt ?? a.updatedAt)
    );
  }

  backfillResponseTimestamps(conversations: Conversation[]): Conversation[] {
    const updated: Conversation[] = [];
    for (const conv of conversations) {
      if (conv.lastResponseAt != null) continue;
      if (!conv.messages || conv.messages.length === 0) continue;

      for (let i = conv.messages.length - 1; i >= 0; i--) {
        const msg = conv.messages[i];
        if (msg.role === 'assistant') {
          conv.lastResponseAt = msg.timestamp;
          updated.push(conv);
          break;
        }
      }
    }
    return updated;
  }

  async loadSdkMessagesForConversation(conversation: Conversation): Promise<void> {
    await ProviderRegistry
      .getConversationHistoryService(conversation.providerId)
      .hydrateConversationHistory(conversation, getVaultPath(this.deps.app));
  }

  async createConversation(
    conversations: Conversation[],
    options?: { providerId?: ProviderId; sessionId?: string },
  ): Promise<Conversation> {
    const providerId = options?.providerId ?? DEFAULT_CHAT_PROVIDER_ID;
    const sessionId = options?.sessionId;
    const conversationId = sessionId ?? this.generateConversationId();
    const conversation: Conversation = {
      id: conversationId,
      providerId,
      title: this.generateDefaultTitle(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: sessionId ?? null,
      messages: [],
    };

    conversations.unshift(conversation);
    await this.deps.storage.sessions.saveMetadata(
      this.deps.storage.sessions.toSessionMetadata(conversation)
    );

    return conversation;
  }

  async switchConversation(conversations: Conversation[], id: string): Promise<Conversation | null> {
    const conversation = conversations.find(c => c.id === id);
    if (!conversation) return null;

    await this.loadSdkMessagesForConversation(conversation);
    return conversation;
  }

  async deleteConversation(conversations: Conversation[], id: string): Promise<void> {
    const index = conversations.findIndex(c => c.id === id);
    if (index === -1) return;

    const conversation = conversations[index];
    conversations.splice(index, 1);

    await ProviderRegistry
      .getConversationHistoryService(conversation.providerId)
      .deleteConversationSession(conversation, getVaultPath(this.deps.app));

    await this.deps.storage.sessions.deleteMetadata(id);

    for (const view of this.deps.getAllViews()) {
      const tabManager = view.getTabManager();
      if (!tabManager) continue;

      for (const tab of tabManager.getAllTabs()) {
        if (tab.conversationId === id) {
          tab.controllers.inputController?.cancelStreaming();
          await tab.controllers.conversationController?.createNew({ force: true });
        }
      }
    }
  }

  async renameConversation(conversations: Conversation[], id: string, title: string): Promise<void> {
    const conversation = conversations.find(c => c.id === id);
    if (!conversation) return;

    conversation.title = title.trim() || this.generateDefaultTitle();
    conversation.updatedAt = Date.now();

    await this.deps.storage.sessions.saveMetadata(
      this.deps.storage.sessions.toSessionMetadata(conversation)
    );
  }

  async updateConversation(
    conversations: Conversation[],
    id: string,
    updates: Partial<Conversation>,
  ): Promise<void> {
    const conversation = conversations.find(c => c.id === id);
    if (!conversation) return;

    const { providerId: _, ...safeUpdates } = updates;
    Object.assign(conversation, safeUpdates, { updatedAt: Date.now() });

    await this.deps.storage.sessions.saveMetadata(
      this.deps.storage.sessions.toSessionMetadata(conversation)
    );

    if (!ProviderRegistry.getConversationHistoryService(conversation.providerId).isPendingForkConversation(conversation)) {
      for (const msg of conversation.messages) {
        if (msg.images) {
          for (const img of msg.images) {
            img.data = '';
          }
        }
      }
    }
  }

  async getConversationById(conversations: Conversation[], id: string): Promise<Conversation | null> {
    const conversation = conversations.find(c => c.id === id) || null;

    if (conversation) {
      await this.loadSdkMessagesForConversation(conversation);
    }

    return conversation;
  }

  getConversationSync(conversations: Conversation[], id: string): Conversation | null {
    return conversations.find(c => c.id === id) || null;
  }

  findEmptyConversation(conversations: Conversation[]): Conversation | null {
    return conversations.find(c => c.messages.length === 0) || null;
  }

  getConversationList(conversations: Conversation[]): ConversationMeta[] {
    return conversations.map(c => ({
      id: c.id,
      providerId: c.providerId,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lastResponseAt: c.lastResponseAt,
      messageCount: c.messages.length,
      preview: this.getConversationPreview(c),
      titleGenerationStatus: c.titleGenerationStatus,
    }));
  }

  private generateConversationId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateDefaultTitle(): string {
    const now = new Date();
    return now.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private getConversationPreview(conv: Conversation): string {
    const firstUserMsg = conv.messages.find(m => m.role === 'user');
    if (!firstUserMsg) {
      return 'New conversation';
    }
    return firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
  }
}
