// export const decodeId = (code: string): number => {
//     const rand = parseInt(code.slice(0, 3), 36)
//     const transformed = BigInt(parseInt(code.slice(3), 36))
//     return Number(transformed ^ BigInt(rand * SECRET))
//   }

// const getSession = Entry.sql<'id' | 'createdAt' | 'userId'>`
//   SELECT id, createdAt, user as userId
//   FROM Entry
//   WHERE id = ? AND archivedAt IS NULL
// `.get

export function decodeSession(_sessionCode?: string) {
  //   return sessionCode == null ? undefined : getSession(decodeId(sessionCode))
  return undefined
}
