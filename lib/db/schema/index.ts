export { courseRelations, default as courseTable } from "./course";
export { bundleRelations, default as bundleTable } from "./course.bundle";
export { enrollmentRelations, default as enrollmentTable } from "./enrollment";
export { blogRelations, default as blogsTable } from "./post";
export { blogAuthorRelations, default as blogAuthorsTable } from "./post.author.to.role";
export { default as blogCategoriesTable, blogCategoryRelations } from "./post.category";
export { blogTagRelations, default as postTagsTable } from "./post.tag";
export {
  blogsToCategoriesRelations,
  default as blogsToCategoriesTable,
} from "./post.to.category";
export { blogsToTagsRelations, default as blogsToTagsTable } from "./post.to.tag";
export { sessionRelations, default as sessionTable } from "./session";
export { userRelations, default as userTable } from "./user";
