import { redirect } from "next/navigation";

const DashboardHomePage = () => {
  redirect("/dashboard/manage-courses");
};

export default DashboardHomePage;
