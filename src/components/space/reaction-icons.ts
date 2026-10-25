import {
  Heart,
  Lightbulb,
  MessageCircleQuestion,
  PartyPopper,
  Rocket,
  ThumbsUp,
  type LucideIcon,
} from 'lucide-react'

import type { ReactionKind } from '@/lib/space-reactions'

/** One icon per reaction, shared by the post bar and the comment reactions. */
export const REACTION_ICON: Record<ReactionKind, LucideIcon> = {
  agree: ThumbsUp,
  thank_you: Heart,
  celebrate: PartyPopper,
  insightful: Lightbulb,
  same_question: MessageCircleQuestion,
  rocket: Rocket,
}
