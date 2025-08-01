import { OBJ, optional, STR } from './lib/validator.ts'
import { Asserted } from './lib/router.ts'
import { createCollection } from './lib/json_store.ts'

export const userDef = OBJ({
  userEmail: STR('The user email address'),
  userFullName: STR('The user login name'),
  userPicture: optional(STR('The user profile picture URL')),
})

export const User = await createCollection<
  Asserted<typeof userDef>,
  'userEmail'
>({
  name: 'user',
  primaryKey: 'userEmail',
})
