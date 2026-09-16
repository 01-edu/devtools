import { describe, it } from '@std/testing/bdd'
import { assertEquals } from '@std/assert'
import { mergeTeamDirectory } from './team-directory.ts'

const ada = {
  id: 'g1',
  primaryEmail: 'ada@01edu.ai',
  emails: ['ada@01edu.ai'],
  name: 'Ada Lovelace',
}

describe('mergeTeamDirectory', () => {
  it('builds one Person per google user, deduping their emails', () => {
    const persons = mergeTeamDirectory(
      [{ ...ada, emails: ['ada@01edu.ai', 'ada@personal.com'] }],
      {},
    )

    assertEquals(persons, [{
      id: 'g1',
      name: 'Ada Lovelace',
      emails: ['ada@01edu.ai', 'ada@personal.com'],
    }])
  })

  it('applies the linked github/discord/jira ids for that google id', () => {
    const persons = mergeTeamDirectory([ada], {
      g1: { githubLogin: 'ada-lovelace', discordId: 'discord-1' },
    })

    assertEquals(persons[0].githubLogin, 'ada-lovelace')
    assertEquals(persons[0].discordId, 'discord-1')
    assertEquals(persons[0].jiraAccountId, undefined)
  })

  it('leaves every link field undefined when nothing was filled in', () => {
    const persons = mergeTeamDirectory([ada], {})

    assertEquals(persons[0].githubLogin, undefined)
    assertEquals(persons[0].discordId, undefined)
    assertEquals(persons[0].jiraAccountId, undefined)
  })

  it('ignores a link entry for a different google id', () => {
    const persons = mergeTeamDirectory([ada], {
      'someone-else': { githubLogin: 'not-ada' },
    })

    assertEquals(persons[0].githubLogin, undefined)
  })
})
