import { redirect } from "next/navigation";

const DashboardHomePage = () => {
  redirect("/dashboard/course-management");
};

export default DashboardHomePage;
