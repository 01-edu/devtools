import { get } from './lmdb-store.ts'
import {
  type Comment,
  extractKey,
  type ProjectScope,
  type Provider,
  type WorkItem,
} from './tickets.ts'

type DiscordThread = {
  id?: string
  guild_id?: string
  name?: string
  parent_id?: string
  last_message_id?: string | null
  thread_metadata?: {
    archived?: boolean | null
  } | null
}

type DiscordMessageContent = {
  id?: string | null
  content?: string | null
  timestamp?: string | null
  author?: { id?: string | null } | null
  attachments?: { url?: string | null }[]
  embeds?: { title?: string | null; description?: string | null }[]
}

type DiscordMessage = DiscordMessageContent & {
  type?: number
  referenced_message?: DiscordMessageContent | null
}

type StoreGet = (
  path: string,
  params?: { q?: string },
) => Promise<DiscordThread[] | DiscordMessage[]>

// ANNOUNCEMENT_THREAD, PUBLIC_THREAD, PRIVATE_THREAD
const THREAD_TYPES = [10, 11, 12] as const

// DEFAULT, REPLY, CHAT_INPUT_COMMAND, THREAD_STARTER_MESSAGE,
// CONTEXT_MENU_COMMAND — everything else is a system notice (pin, join,
// rename...) rather than something someone said
const THREAD_STARTER_MESSAGE = 21 as const
const CONVERSATION_TYPES = new Set([0, 19, 20, THREAD_STARTER_MESSAGE, 23])

// every key is `{collection}/{channelId}/{messageId}`, so scoping the path to
// the thread id makes the store prefix-scan that thread only
const MESSAGE_COLLECTIONS = [
  'discord/message',
  'discord/message-bot',
  'discord/bot-message',
] as const

const MESSAGE_FIELDS = `id,
  content,
  timestamp,
  author: { id: .author.id },
  attachments: ((.attachments // []) | map({ url })),
  embeds: ((.embeds // []) | map({ title, description }))` as const

const DISCORD_EPOCH = 1420070400000n as const
const SNOWFLAKE = /^[0-9]+$/

const snowflakeTime = (id: string): number =>
  Number((BigInt(id) >> 22n) + DISCORD_EPOCH)

const toWorkItem = (thread: DiscordThread): WorkItem | undefined => {
  if (!thread.id || !thread.name || !thread.guild_id) return undefined
  return {
    source: 'discord',
    externalId: thread.id,
    externalUrl: `https://discord.com/channels/${thread.guild_id}/${thread.id}`,
    title: thread.name,
    status: thread.thread_metadata?.archived ? 'archived' : 'open',
    updatedAt: snowflakeTime(thread.last_message_id ?? thread.id),
    raw: { thread },
  }
}

const messageBody = (message: DiscordMessageContent): string =>
  [
    message.content,
    ...(message.embeds ?? []).flatMap((embed) => [
      embed.title,
      embed.description,
    ]),
    ...(message.attachments ?? []).map((attachment) => attachment.url),
  ].filter(Boolean).join('\n')

const toComment = (
  item: WorkItem,
  message: DiscordMessage,
): Comment | undefined => {
  if (!message.id || !CONVERSATION_TYPES.has(message.type ?? 0)) {
    return undefined
  }
  // the starter of a thread opened from a channel message lives in the parent
  // channel, it only shows up here as the referenced message
  const entry = message.type === THREAD_STARTER_MESSAGE
    ? message.referenced_message
    : message
  const body = entry ? messageBody(entry) : ''
  if (!body) return undefined
  return {
    source: 'discord',
    author: entry?.author?.id ?? undefined,
    body,
    url: `${item.externalUrl}/${message.id}`,
    createdAt: entry?.timestamp
      ? Date.parse(entry.timestamp)
      : snowflakeTime(entry?.id ?? message.id),
  }
}

export const createDiscordProvider = (
  storeGet: StoreGet = (path, params) =>
    get<DiscordThread[] | DiscordMessage[]>(path, params),
): Provider => ({
  id: 'discord',

  async list(scope: ProjectScope): Promise<WorkItem[]> {
    if (!scope.discordChannelId) return []
    const threads = await storeGet('discord/channel', {
      q: `select(.parent_id == ${JSON.stringify(scope.discordChannelId)} and (${
        THREAD_TYPES.map((type) => `.type == ${type}`).join(' or ')
      })) | {
        id,
        guild_id,
        name,
        parent_id,
        last_message_id,
        thread_metadata: { archived: .thread_metadata.archived }
      }`,
    })

    const items: WorkItem[] = []
    for (const thread of threads as DiscordThread[]) {
      const item = toWorkItem(thread)
      if (item && extractKey(item)) items.push(item)
    }
    return items
  },

  async comments(item: WorkItem): Promise<Comment[]> {
    if (!SNOWFLAKE.test(item.externalId)) return []
    const q = `select(.channel_id == ${JSON.stringify(item.externalId)}) | {
      type,
      ${MESSAGE_FIELDS},
      referenced_message: (if .type == ${THREAD_STARTER_MESSAGE}
        then (.referenced_message | { ${MESSAGE_FIELDS} })
        else null end)
    }`
    const results = await Promise.all(
      MESSAGE_COLLECTIONS.map((collection) =>
        storeGet(`${collection}/${item.externalId}`, { q })
      ),
    )

    // the two bot ingests overlap, keep one copy of each message
    const messages = new Map<string, DiscordMessage>()
    for (const message of results.flat() as DiscordMessage[]) {
      if (message.id) messages.set(message.id, message)
    }

    const comments: Comment[] = []
    for (const message of messages.values()) {
      const comment = toComment(item, message)
      if (comment) comments.push(comment)
    }
    return comments.sort((a, b) => a.createdAt! - b.createdAt!)
  },
})

export const discordProvider = createDiscordProvider()
