import { Flower2 } from "lucide-react";
import { TableCell, TableRow } from "../../ui/table";

export default function CourseItem() {
  return (
    <TableRow className="bg-accent">
      <TableCell>
        <div className="overflow-hidden text-ellipsis font-medium ">
          On the decline of the Ivory Tower & the emergence of Pigeon Towers
        </div>
        <div className="hidden text-sm text-muted-foreground md:inline">
          Karim-Yassin GOESSINGER
        </div>
      </TableCell>

      <TableCell className="flex flex-col items-center justify-end gap-1 text-xs">
        <Flower2 size={20} strokeWidth={1} />
        Spring
      </TableCell>
    </TableRow>
  );
}
