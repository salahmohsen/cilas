import { redirect } from "next/navigation";

const DashboardHomePage = () => {
  redirect("/admin/course-management");
};

export default DashboardHomePage;
