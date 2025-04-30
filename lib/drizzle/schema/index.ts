export { courseRelations, default as courseTable } from "./course";
export { default as courseCategoriesTable } from "./course.categories";
export { courseFellowRelations, default as courseFellowTable } from "./course.fellows";
export {
  default as courseToCategory,
  courseToCategoryRelations,
} from "./course.to.category";
export { enrollmentRelations, default as enrollmentTable } from "./enrollment";
export { postsRelations, default as postTable } from "./post";
export { default as authorRolesTable } from "./post.author.role";
export { authorsRelations, default as authorsTable } from "./post.authors";
export { default as postCategoriesTable } from "./post.categories";
export { blogTagRelations, default as postTagsTable } from "./post.tag";
export { default as postToCategory, postToCategoryRelations } from "./post.to.category";
export { postToTagRelations, default as postToTagTable } from "./post.to.tag";
export { sessionRelations, default as sessionTable } from "./session";
export { userRelations, userRoleEnum, default as userTable } from "./user";
