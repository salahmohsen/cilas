import type { Payload } from 'payload'
import type { GovernanceSeed, SeedContext } from '../seed.type'
import { getOrCreateId, requireId } from '../seed.utils'

/** Every person below must also exist in `usersData` — governance links to a user. */
export const governanceData: GovernanceSeed[] = [
  {
    email: 'michael.brint@cilas.test',
    role: 'advisor',
    advises_on: 'curriculum design and university partnerships (US, UK)',
  },
  {
    email: 'teun.dekker@cilas.test',
    role: 'advisor',
    advises_on: 'skills training and university partnerships (Netherlands)',
  },
  {
    email: 'yenchi.fan@cilas.test',
    role: 'advisor',
    advises_on: 'collaborative learning and cross-cultural communication',
  },
  {
    email: 'abdulhayy@cilas.test',
    role: 'advisor',
    advises_on: 'curriculum design and partnership with AUC',
  },
  {
    email: 'tommaso.vitale@cilas.test',
    role: 'advisor',
    advises_on: 'capstone projects and university partnerships (France, Italy)',
  },
  { email: 'karim@ci-las.org', role: 'trustee', board_role: 'Chairman' },
  { email: 'amani.elshimi@cilas.test', role: 'trustee', board_role: 'Secretary' },
  { email: 'ahmed.galal@cilas.test', role: 'trustee', board_role: 'Treasurer' },
]

export const seedGovernance = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const member of governanceData) {
    const { email, role, ...detail } = member
    const personId = requireId(ctx.people, email)

    await getOrCreateId(payload, 'governance', { person: { equals: personId } }, () =>
      payload.create({
        collection: 'governance',
        data: { person: personId, role, ...detail },
        overrideAccess: true,
      }),
    )
    console.log('governance:', email, role)
  }
}
