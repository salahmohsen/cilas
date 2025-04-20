import { BundleWithCourseTitles, userLocalInfo } from "@/lib/types/drizzle.types";
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
  isPostSelected: Record<number, boolean> | null;
  isSeriesSelected: Record<number, boolean> | null;
  postInfo: Posts[0] | null;
  filter: PostsFilter;
  author: userLocalInfo | undefined;
  isLoading: boolean;
  posts: Posts | null;
  series: null | BundleWithCourseTitles[];

  // Actions
  setActiveTab: (tab: PostsTabs) => void;
  setPostSelected: (selected: Record<number, boolean> | null) => void;
  setSeriesSelected: (selected: Record<number, boolean> | null) => void;
  setPostInfo: (post: Posts[0] | undefined | null) => void;
  setFilter: (filter: PostsFilter) => void;
  setAuthor: (fellow: userLocalInfo | undefined) => void;
  setLoading: (loading: boolean) => void;
  setPosts: (posts: Posts) => void;
  setSeries: (bundles: BundleWithCourseTitles[]) => void;
  revalidatePost: (postId: number) => Promise<void>;

  // Async actions
  getPosts: () => Promise<void>;
  getSeries: () => Promise<void>;
  handleDelete: (postId: number) => Promise<string | number | undefined>;
}
