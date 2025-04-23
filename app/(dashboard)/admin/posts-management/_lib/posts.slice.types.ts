import { SafeUser } from "@/lib/drizzle/drizzle.types";
import { Posts } from "./posts.actions.type";

export enum PostsFilter {
  Published = "published",
  Draft = "draft",
}
export enum PostsTabs {
  Published = "published",
  Draft = "draft",
}

export interface PostsState {
  activeTab: PostsTabs | null;
  selectedPost: Record<number, boolean> | null;
  selectedSeries: Record<number, boolean> | null;
  postInfo: Posts[0] | null;
  filter: PostsFilter;
  author: SafeUser | undefined;
  isLoading: boolean;
  posts: Posts | null;
  series: null;

  // Actions
  setActiveTab: (tab: PostsTabs) => void;
  setSelectedPost: (selected: Record<number, boolean> | null) => void;
  setSelectedSeries: (selected: Record<number, boolean> | null) => void;
  setPostInfo: (post: Posts[0] | undefined | null) => void;
  setFilter: (filter: PostsFilter) => void;
  setAuthor: (fellow: SafeUser | undefined) => void;
  setLoading: (loading: boolean) => void;
  setPosts: (posts: Posts) => void;
  setSeries: (bundles: null) => void;
  revalidatePost: (postId: number) => Promise<void>;

  // Async actions
  getPosts: () => Promise<void>;
  getSeries: () => Promise<void>;
  handleDelete: (postId: number) => Promise<string | number | undefined>;
}
