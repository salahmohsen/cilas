export { blogRelations, default as blogsTable } from "./blog";
export { default as blogCategoriesTable, blogCategoryRelations } from "./blog.category";
export { blogTagRelations, default as blogTagsTable } from "./blog.tags";
export { blogAuthorRelations, default as blogAuthorsTable } from "./blog.to.author";
export {
  blogsToCategoriesRelations,
  default as blogsToCategoriesTable,
} from "./blog.to.category";
export { blogsToTagsRelations, default as blogsToTagsTable } from "./blog.to.tags";
export { courseRelations, default as courseTable } from "./course";
export { bundleRelations, default as bundleTable } from "./course.bundle";
export { enrollmentRelations, default as enrollmentTable } from "./enrollment";
export { sessionRelations, default as sessionTable } from "./session";
export { userRelations, default as userTable } from "./user";
