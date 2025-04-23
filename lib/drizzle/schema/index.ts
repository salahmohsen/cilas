export { courseRelations, default as courseTable } from "./course";
export { enrollmentRelations, default as enrollmentTable } from "./enrollment";
export { postsRelations, default as postsTable } from "./post";
export { default as authorRolesTable } from "./post.author.role";
export { default as authorToRoleTable, postAuthorRelations } from "./post.author.to.role";
export { authorsRelations, default as authorsTable } from "./post.authors";
export { default as postCategoriesTable } from "./post.category";
export { blogTagRelations, default as postTagsTable } from "./post.tag";
export {
  postsToCategoriesRelations,
  default as postsToCategoriesTable,
} from "./post.to.category";
export {
  postsToTagsRelations as blogsToTagsRelations,
  default as postsToTagsTable,
} from "./post.to.tag";
export { sessionRelations, default as sessionTable } from "./session";
export { userRelations, default as userTable } from "./user";
