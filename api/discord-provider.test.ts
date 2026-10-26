import { assertEquals } from '@std/assert'
import { describe, it } from '@std/testing/bdd'
import { createDiscordProvider } from './discord-provider.ts'
import { extractKey } from './tickets.ts'

const snowflake = (iso: string): string =>
  String((BigInt(Date.parse(iso)) - 1420070400000n) << 22n)

const guildId = '800000000000000001'
const channelId = '900000000000000001'
const threadId = snowflake('2026-01-01T09:00:00.000Z')
const lastMessageId = snowflake('2026-01-03T12:00:00.000Z')

const thread = {
  id: threadId,
  guild_id: guildId,
  name: 'TNT393 Hide settings tab for non-admin tournament users',
  parent_id: channelId,
  last_message_id: lastMessageId,
  thread_metadata: { archived: false },
}

const message = (
  iso: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: snowflake(iso),
  type: 0,
  timestamp: iso,
  author: { id: 'discord-ada' },
  attachments: [],
  embeds: [],
  ...overrides,
})

describe('discordProvider', () => {
  it('lists keyed threads of the project channel', async () => {
    const received: { path: string; q?: string }[] = []
    const provider = createDiscordProvider((path, params) => {
      received.push({ path, q: params?.q })
      return Promise.resolve([
        thread,
        { ...thread, id: snowflake('2026-01-02T00:00:00.000Z'), name: 'chat' },
        { ...thread, id: undefined },
      ])
    })

    const items = await provider.list({ discordChannelId: channelId })

    assertEquals(received.map(({ path }) => path), ['discord/channel'])
    assertEquals(
      received[0].q?.includes(`.parent_id == "${channelId}"`),
      true,
    )
    assertEquals(
      received[0].q?.includes('.type == 10 or .type == 11 or .type == 12'),
      true,
    )
    assertEquals(items.length, 1)
    assertEquals(items[0].externalId, threadId)
    assertEquals(
      items[0].externalUrl,
      `https://discord.com/channels/${guildId}/${threadId}`,
    )
    assertEquals(items[0].title, thread.name)
    assertEquals(items[0].status, 'open')
    assertEquals(items[0].updatedAt, Date.parse('2026-01-03T12:00:00.000Z'))
    assertEquals(extractKey(items[0]), 'TNT393')
  })

  it('marks archived threads', async () => {
    const provider = createDiscordProvider(() =>
      Promise.resolve([{ ...thread, thread_metadata: { archived: true } }])
    )

    const [item] = await provider.list({ discordChannelId: channelId })

    assertEquals(item.status, 'archived')
  })

  it('does not list when channel scope is absent', async () => {
    let called = false
    const provider = createDiscordProvider(() => {
      called = true
      return Promise.resolve([])
    })

    assertEquals(await provider.list({}), [])
    assertEquals(called, false)
  })

  it('returns every thread message chronologically, scoped by thread', async () => {
    const received: { path: string; q?: string }[] = []
    const botReply = message('2026-01-02T11:00:00.000Z', {
      author: { id: 'ci-bot' },
      embeds: [{ title: 'Deploy preview', description: 'Ready' }],
    })
    const provider = createDiscordProvider((path, params) => {
      received.push({ path, q: params?.q })
      if (path === 'discord/channel') return Promise.resolve([thread])
      if (path.startsWith('discord/message/')) {
        return Promise.resolve([
          message('2026-01-03T12:00:00.000Z', {
            content: 'Merged, closing.',
            author: { id: 'discord-grace' },
          }),
          message('2026-01-01T09:00:00.000Z', {
            type: 21,
            content: '',
            referenced_message: message('2026-01-01T08:59:00.000Z', {
              content: 'Settings tab should be admin only.',
            }),
          }),
          message('2026-01-02T10:00:00.000Z', {
            content: 'Screenshot:',
            attachments: [{ url: 'https://cdn.discordapp.com/a.png' }],
          }),
          message('2026-01-02T10:30:00.000Z', { type: 6, content: '' }),
        ])
      }
      // both bot ingests carry the same message
      return Promise.resolve([botReply])
    })

    const [item] = await provider.list({ discordChannelId: channelId })
    const comments = await provider.comments(item)

    assertEquals(received.slice(1).map(({ path }) => path), [
      `discord/message/${threadId}`,
      `discord/message-bot/${threadId}`,
      `discord/bot-message/${threadId}`,
    ])
    assertEquals(
      received.slice(1).every(({ q }) =>
        q?.includes(`.channel_id == "${threadId}"`)
      ),
      true,
    )
    assertEquals(comments.map((comment) => comment.body), [
      'Settings tab should be admin only.',
      'Screenshot:\nhttps://cdn.discordapp.com/a.png',
      'Deploy preview\nReady',
      'Merged, closing.',
    ])
    assertEquals(comments.map((comment) => comment.author), [
      'discord-ada',
      'discord-ada',
      'ci-bot',
      'discord-grace',
    ])
    assertEquals(
      comments[0].createdAt,
      Date.parse('2026-01-01T08:59:00.000Z'),
    )
    assertEquals(
      comments[2].url,
      `https://discord.com/channels/${guildId}/${threadId}/${botReply.id}`,
    )
  })

  it('does not query messages for a non-snowflake thread id', async () => {
    let called = false
    const provider = createDiscordProvider(() => {
      called = true
      return Promise.resolve([])
    })

    const comments = await provider.comments({
      source: 'discord',
      externalId: '../../google/user',
      externalUrl: '',
      title: 'TNT393 Hide settings',
    })

    assertEquals(comments, [])
    assertEquals(called, false)
  })
})
