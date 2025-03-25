import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageHeaderProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export const PageHeader = ({ title, description, children }: PageHeaderProps) => {
  return (
    <Card className="m-5 flex flex-wrap items-end justify-between gap-5 p-5">
      <CardHeader className="p-0">
        <CardTitle>{title}</CardTitle>
        <CardDescription className="max-w-lg leading-relaxed text-balance">
          {description}
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex flex-wrap items-center gap-2 p-0">
        {children}
      </CardFooter>
    </Card>
  );
};
